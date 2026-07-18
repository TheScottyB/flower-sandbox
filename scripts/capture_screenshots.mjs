import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Fully-automated screenshot capture and verification for Flower Sandbox.
 * No manual interaction required — the script deep-links to each screen,
 * waits for it to render, captures, verifies via OCR, and retries on failure.
 */

const MAX_CAPTURE_RETRIES = 3;

const DEVICE_TYPES = {
  iphone_pro_max: {
    name: 'iPhone Pro Max (6.7")',
    simulator: 'iPhone 16 Pro Max',
    filePrefix: 'iphone67',
    scales: [
      { prefix: 'iphone65', w: 1242, h: 2688 },
      { prefix: 'iphone61', w: 1179, h: 2556 },
    ],
  },
  // NOTE: The 5.5" App Store slot (iphone55, 1242×2208) requires an iPhone 8 Plus
  // simulator. The iPhone SE 3rd gen produces 750×1334 which is the wrong size.
  // That slot is optional when 6.7" screenshots are provided, so it is omitted here.
  ipad_pro: {
    name: 'iPad Pro (12.9")',
    simulator: 'iPad Pro 13-inch (M4)',
    filePrefix: 'ipad129',
    scales: [
      { prefix: 'ipad11', w: 1668, h: 2388 },
      { prefix: 'ipad105', w: 1668, h: 2224 },
      { prefix: 'ipad97', w: 1536, h: 2048 },
    ],
  },
};

// route: Expo Router path that will be deep-linked via the app URL scheme.
// waitMs: how long to wait after navigating before capturing (ms).
// Extra wait for subscription — StoreKit pricing loads asynchronously.
const SCREENSHOT_SCENES = [
  {
    key: 'front',
    suffix: '',
    desc: 'Garden main interactive view',
    route: '/',
    waitMs: 3000,
  },
  {
    key: 'about',
    suffix: '_about',
    desc: 'About / Information screen',
    route: '/about',
    waitMs: 2000,
  },
  {
    key: 'subscription',
    suffix: '_subscription',
    desc: 'Premium Subscription screen',
    route: '/subscription',
    waitMs: 5000, // StoreKit pricing loads async
  },
];

function runCommand(cmd) {
  try {
    return execSync(cmd, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();
  } catch (_e) {
    return null;
  }
}

function createDirectoryStructure() {
  const baseDir = path.join(process.cwd(), 'app_store_assets/screenshots');
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
  return baseDir;
}

function listAvailableSimulators() {
  try {
    const output = execSync('xcrun simctl list devices available', {
      encoding: 'utf-8',
    });
    console.log('\nAvailable Simulators:');
    console.log(output);
  } catch (error) {
    console.error('Error listing simulators:', error.message);
  }
}

/**
 * Returns the UDID of the first booted simulator whose name matches deviceName,
 * or null if none is found.
 */
function findBootedUDID(deviceName) {
  try {
    const output = execSync('xcrun simctl list devices booted', {
      encoding: 'utf-8',
    });
    for (const line of output.split('\n')) {
      if (line.includes(deviceName)) {
        const m = line.match(/\(([0-9A-F-]{36})\)/i);
        if (m) return m[1];
      }
    }
  } catch (_e) {}
  return null;
}

/**
 * Read the iOS bundle identifier from app.json so we can launch the app by ID.
 */
function getBundleIdentifier() {
  try {
    const appJson = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'app.json'), 'utf-8'),
    );
    return appJson?.expo?.ios?.bundleIdentifier ?? null;
  } catch (_e) {
    return null;
  }
}

/**
 * Read the URL scheme from app.json (expo.scheme) for deep-link navigation.
 */
function getUrlScheme() {
  try {
    const appJson = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'app.json'), 'utf-8'),
    );
    const scheme = appJson?.expo?.scheme;
    // scheme can be a string or an array — take the first one.
    return Array.isArray(scheme) ? scheme[0] : (scheme ?? 'flowersandbox');
  } catch (_e) {
    return 'flowersandbox';
  }
}

/**
 * Boots (if needed) the simulator for deviceInfo, configures its status bar,
 * auto-installs the local Release build if present, and returns the UDID.
 * Returns null on failure.
 */
function startSimulatorAndConfigure(deviceInfo) {
  const name = deviceInfo.simulator;

  // Prefer an already-booted simulator matching this device name so we never
  // ambiguously target a random one when multiple share the same name.
  let udid = findBootedUDID(name);

  if (udid) {
    console.log(`\nUsing already-booted "${name}" (${udid})`);
  } else {
    try {
      console.log(`\nBooting simulator for "${name}"...`);
      execSync(`xcrun simctl boot "${name}" || true`, { stdio: 'ignore' });
      execSync('sleep 2');
      udid = findBootedUDID(name);
    } catch (error) {
      console.error(`Error starting simulator for ${name}:`, error.message);
      listAvailableSimulators();
      return null;
    }
  }

  if (!udid) {
    console.error(
      `Could not determine UDID for "${name}". ` +
        `Boot it manually and retry.`,
    );
    listAvailableSimulators();
    return null;
  }

  execSync(`open -a Simulator`, { stdio: 'ignore' });

  console.log(`Standardizing simulator status bar to 9:41 AM...`);
  execSync(
    `xcrun simctl status_bar ${udid} override ` +
      `--time "9:41" ` +
      `--batteryState "charged" ` +
      `--batteryLevel "100" ` +
      `--cellularMode "active" ` +
      `--cellularBars "4" ` +
      `--wifiMode "searching" ` +
      `--wifiBars "3" || true`,
    { stdio: 'ignore' },
  );

  // Auto-install the local Release simulator build if it exists.
  const releaseBuildPath = path.join(
    process.cwd(),
    'ios/build/Release/Build/Products/Release-iphonesimulator/FlowerSandbox.app',
  );
  if (fs.existsSync(releaseBuildPath)) {
    console.log(`Installing Release build on simulator (${udid})...`);
    try {
      execSync(`xcrun simctl install ${udid} "${releaseBuildPath}"`, {
        stdio: 'ignore',
      });
      const bundleId = getBundleIdentifier();
      if (bundleId) {
        execSync(`xcrun simctl launch ${udid} ${bundleId} || true`, {
          stdio: 'ignore',
        });
      }
      console.log(`   ✅ Release build installed and launched.`);
    } catch (err) {
      console.warn(`   ⚠️  Auto-install failed: ${err.message}`);
    }
  } else {
    console.warn(
      `   ⚠️  Release build not found at ios/build/Release/. ` +
        `Run: npx expo run:ios --configuration Release --device "${name}"`,
    );
  }

  return udid;
}

function resizeImage(sourcePath, destPath, targetW, targetH) {
  const wStr = runCommand(
    `sips -g pixelWidth "${sourcePath}" | awk '/pixelWidth/ {print $2}'`,
  );
  const hStr = runCommand(
    `sips -g pixelHeight "${sourcePath}" | awk '/pixelHeight/ {print $2}'`,
  );
  const isLandscape = wStr && hStr && parseInt(wStr, 10) > parseInt(hStr, 10);

  const w = isLandscape ? targetH : targetW;
  const h = isLandscape ? targetW : targetH;

  execSync(`sips -z ${h} ${w} "${sourcePath}" --out "${destPath}"`, {
    stdio: 'ignore',
  });
}

function captureAndVerify(baseDir, deviceInfo, udid, scene) {
  const prefix = deviceInfo.filePrefix;
  const targetPath = path.join(baseDir, `${prefix}${scene.suffix}.png`);
  const scheme = getUrlScheme();
  const deeplink = `${scheme}:/${scene.route}`;

  console.log(`\n--------------------------------------------------`);
  console.log(`SCENE: ${scene.key.toUpperCase()} — ${scene.desc}`);
  console.log(`--------------------------------------------------`);

  for (let attempt = 1; attempt <= MAX_CAPTURE_RETRIES; attempt++) {
    if (attempt > 1) {
      console.log(`   Retry ${attempt}/${MAX_CAPTURE_RETRIES}...`);
    }

    // Navigate to the scene via deep link.
    console.log(`   Deep linking → ${deeplink}`);
    runCommand(`xcrun simctl openurl ${udid} "${deeplink}"`);

    // Wait for the screen to render (longer on retry).
    const waitSec = ((scene.waitMs ?? 2500) + (attempt - 1) * 2000) / 1000;
    console.log(`   Waiting ${waitSec}s for screen to render...`);
    execSync(`sleep ${waitSec}`);

    // Capture.
    console.log(`   Capturing screenshot...`);
    try {
      execSync(`xcrun simctl io ${udid} screenshot "${targetPath}"`, {
        stdio: 'ignore',
      });
    } catch (err) {
      console.error(`   ❌ Capture failed: ${err.message}`);
      if (attempt === MAX_CAPTURE_RETRIES) {
        throw new Error(
          `Could not capture screenshot for scene "${scene.key}" after ${MAX_CAPTURE_RETRIES} attempts.`,
        );
      }
      continue;
    }

    // Detect upside-down capture: if OCR finds the time string in the bottom
    // quarter of the image the simulator was oriented inverted — rotate 180°.
    const hasTesseractEarly = runCommand('which tesseract');
    if (hasTesseractEarly) {
      const imgH = parseInt(
        runCommand(
          `sips -g pixelHeight "${targetPath}" | awk '/pixelHeight/ {print $2}'`,
        ) || '0',
        10,
      );
      if (imgH > 0) {
        const tmpCrop = targetPath.replace('.png', '_bottomcrop.png');
        runCommand(
          `sips "${targetPath}" --cropOffset 0 ${Math.round(imgH * 0.85)} ` +
            `--cropBox 99999 ${Math.round(imgH * 0.15)} --out "${tmpCrop}"`,
        );
        const bottomText =
          runCommand(`tesseract "${tmpCrop}" stdout --psm 7 2>/dev/null`) || '';
        if (tmpCrop && fs.existsSync(tmpCrop)) fs.unlinkSync(tmpCrop);
        if (
          /\b9:41\b/.test(bottomText) ||
          /\b\d{1,2}:\d{2}\s*(AM|PM)\b/i.test(bottomText)
        ) {
          console.log(`   ⚠️  Detected upside-down capture — rotating 180°...`);
          execSync(`sips -r 180 "${targetPath}"`, { stdio: 'ignore' });
        }
      }
    }

    // Strip alpha channel if present.
    const hasAlpha =
      runCommand(
        `sips -g hasAlpha "${targetPath}" | awk '/hasAlpha/ {print $2}'`,
      ) === 'yes';
    if (hasAlpha) {
      console.log(`   Removing alpha channel/transparency...`);
      execSync(
        `sips -s format png "${targetPath}" --setProperty formatOptions default --out "${targetPath}"`,
        { stdio: 'ignore' },
      );
    }

    // OCR verification.
    let ocrIssue = null;
    const hasTesseract = runCommand('which tesseract');
    if (hasTesseract) {
      console.log(`   Running OCR verification...`);
      const ocrText = runCommand(
        `tesseract "${targetPath}" stdout --psm 3 2>/dev/null`,
      );
      const textLower = (ocrText || '').toLowerCase();

      if (
        textLower.includes('calendar') &&
        textLower.includes('photos') &&
        textLower.includes('settings') &&
        textLower.includes('wallet')
      ) {
        ocrIssue = 'iOS Simulator Home Screen (Springboard)';
      } else if (
        textLower.includes('development build') ||
        textLower.includes('metro') ||
        textLower.includes('enter url manually') ||
        textLower.includes('development servers') ||
        textLower.includes('expo go')
      ) {
        ocrIssue = 'Expo Go / Developer Launcher — recapture from Release build';
      } else if (
        textLower.includes('would like to use your location') ||
        (textLower.includes('allow') && textLower.includes('location'))
      ) {
        ocrIssue = 'Location Permission Alert Popup';
      } else if (textLower.includes('cancel') && textLower.includes('allow')) {
        ocrIssue = 'Active system alert dialog';
      }
    } else {
      console.log(`   ⚠️  Tesseract not found — skipping OCR check.`);
    }

    if (ocrIssue) {
      console.log(`   🔴 REJECTED (${ocrIssue}) — re-navigating and retrying...`);
      if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
      if (attempt === MAX_CAPTURE_RETRIES) {
        throw new Error(
          `Scene "${scene.key}" was rejected after ${MAX_CAPTURE_RETRIES} attempts: ${ocrIssue}`,
        );
      }
      continue;
    }

    console.log(`   🟢 ${path.basename(targetPath)}`);

    // Generate scaled copies.
    for (const scale of deviceInfo.scales) {
      const scalePath = path.join(
        baseDir,
        `${scale.prefix}${scene.suffix}.png`,
      );
      console.log(`   Scaling → ${scale.prefix} (${scale.w}×${scale.h})...`);
      resizeImage(targetPath, scalePath, scale.w, scale.h);
      execSync(
        `sips -s format png "${scalePath}" --setProperty formatOptions default --out "${scalePath}"`,
        { stdio: 'ignore' },
      );
    }

    return; // success
  }
}

async function main() {
  console.log('Welcome to the Flower Sandbox Screen Capture & Scaler Tool (Automated Mode)!');

  // ⚠️  RELEASE BUILD REQUIRED
  console.log(
    '\n' +
      '╔═════════════════════════════════════════════════════════════╗\n' +
      '║  ⚠️  IMPORTANT — USE A RELEASE OR TESTFLIGHT BUILD ONLY   ║\n' +
      '║                                                             ║\n' +
      '║  Screenshots MUST be captured from a production or          ║\n' +
      '║  TestFlight build installed on the simulator — NOT from     ║\n' +
      '║  Expo Go or any development / dev-client build.             ║\n' +
      '║                                                             ║\n' +
      '║  Development builds leave visible artifacts that Apple      ║\n' +
      '║  reviewers will flag:                                       ║\n' +
      '║   • "◀ Expo Go" back-navigation label in the status bar    ║\n' +
      '║   • Floating development gear (⚙) button                   ║\n' +
      '║   • Red-box / Metro error screens                           ║\n' +
      '║                                                             ║\n' +
      '║  To install a production simulator build:                   ║\n' +
      '║    pnpm run build:preview   (Preview build via EAS)         ║\n' +
      '║    pnpm run build:ios       (Production build via EAS)      ║\n' +
      '╚═════════════════════════════════════════════════════════════╝\n',
  );

  const baseDir = createDirectoryStructure();

  // Optional --device <key> filter, e.g. --device ipad_pro
  const deviceFilter = (() => {
    const idx = process.argv.indexOf('--device');
    return idx !== -1 ? process.argv[idx + 1] : null;
  })();

  const devices = Object.keys(DEVICE_TYPES).filter(
    (k) => !deviceFilter || k === deviceFilter,
  );

  if (deviceFilter && devices.length === 0) {
    console.error(
      `Unknown --device "${deviceFilter}". Valid keys: ${Object.keys(DEVICE_TYPES).join(', ')}`,
    );
    process.exit(1);
  }

  for (const deviceKey of devices) {
    const deviceInfo = DEVICE_TYPES[deviceKey];
    console.log(`\n==================================================`);
    console.log(`DEVICE: ${deviceInfo.name}`);
    console.log(`==================================================`);

    const udid = startSimulatorAndConfigure(deviceInfo);
    if (!udid) {
      console.log(`Skipping device ${deviceInfo.name} due to boot error.`);
      continue;
    }

    for (const scene of SCREENSHOT_SCENES) {
      captureAndVerify(baseDir, deviceInfo, udid, scene);
    }
  }

  console.log('\n==================================================');
  console.log('🎉 All screenshots captured, verified, and scaled!');
  console.log(`Saved under: ${baseDir}`);
  console.log('You can now run quality control verification:');
  console.log('  pnpm run qc-screenshots');
  console.log('==================================================\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
