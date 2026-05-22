const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration resolution from app.json
function loadConfig() {
  let appJson = {};
  const appJsonPath = path.resolve(process.cwd(), 'app.json');
  if (fs.existsSync(appJsonPath)) {
    try {
      appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
    } catch (e) {
      console.warn('Warning: Failed to parse app.json:', e.message);
    }
  }
  const expo = appJson.expo ?? appJson;
  return {
    scheme: expo.scheme || 'exp',
    name: expo.name || 'App'
  };
}

const config = loadConfig();

// Read arguments or defaults
const args = process.argv.slice(2);
const portArg = args.find(a => a.startsWith('--port='));
const PORT = portArg ? portArg.split('=')[1] : '8081';

const ASSETS_DIR = path.resolve(process.cwd(), 'assets');
const IPHONE_NAME = 'iPhone 16 Pro Max';
const IPAD_NAME = 'iPad Pro 13-inch (M4)';

// Route mapping for screen captures
const ROUTES = [
  { suffix: '', name: 'home', fileSuffix: '' },
  { suffix: '/--/subscription', name: 'subscription', fileSuffix: '_back' }
];

function findDeviceUuid(name) {
  const listJson = execSync('xcrun simctl list devices --json', { encoding: 'utf8' });
  const { devices } = JSON.parse(listJson);
  
  for (const runtime of Object.keys(devices)) {
    const list = devices[runtime];
    const match = list.find(d => d.name === name && d.state === 'Booted');
    if (match) {
      return match.udid;
    }
  }
  
  const sortedRuntimes = Object.keys(devices).sort((a, b) => b.localeCompare(a));
  for (const runtime of sortedRuntimes) {
    if (!runtime.includes('iOS')) continue;
    const list = devices[runtime];
    const match = list.find(d => d.name === name);
    if (match) {
      return match.udid;
    }
  }
  
  throw new Error(`Device "${name}" not found in simulators list.`);
}

function ensureBooted(udid, name) {
  const listJson = execSync('xcrun simctl list devices --json', { encoding: 'utf8' });
  const { devices } = JSON.parse(listJson);
  let state = 'Shutdown';
  for (const runtime of Object.keys(devices)) {
    const match = devices[runtime].find(d => d.udid === udid);
    if (match) {
      state = match.state;
      break;
    }
  }
  
  if (state !== 'Booted') {
    console.log(`Booting ${name} (${udid})...`);
    execSync(`xcrun simctl boot ${udid}`);
    
    let attempts = 0;
    while (attempts < 30) {
      attempts++;
      const checkJson = execSync('xcrun simctl list devices --json', { encoding: 'utf8' });
      const checkDevices = JSON.parse(checkJson).devices;
      let checkState = 'Shutdown';
      for (const runtime of Object.keys(checkDevices)) {
        const checkMatch = checkDevices[runtime].find(d => d.udid === udid);
        if (checkMatch) {
          checkState = checkMatch.state;
          break;
        }
      }
      if (checkState === 'Booted') {
        console.log(`${name} is now booted.`);
        break;
      }
      execSync('sleep 2');
    }
  } else {
    console.log(`${name} is already booted.`);
  }
}

function ensureExpoGoInstalled(targetUdid, iphoneUdid) {
  let isInstalled = false;
  try {
    execSync(`xcrun simctl get_app_container ${targetUdid} host.exp.Exponent app`, { stdio: 'ignore' });
    isInstalled = true;
    console.log(`Expo Go is already installed on simulator ${targetUdid}.`);
  } catch (e) {
    isInstalled = false;
  }

  if (!isInstalled) {
    console.log(`Expo Go is NOT installed on simulator ${targetUdid}. Installing it from iPhone simulator...`);
    ensureBooted(iphoneUdid, IPHONE_NAME);
    const appContainer = execSync(`xcrun simctl get_app_container ${iphoneUdid} host.exp.Exponent app`, { encoding: 'utf8' }).trim();
    console.log(`Found Expo Go bundle path: ${appContainer}`);
    console.log(`Installing Expo Go onto simulator ${targetUdid}...`);
    execSync(`xcrun simctl install ${targetUdid} "${appContainer}"`);
    console.log('Expo Go installed successfully.');
  }
}

async function run() {
  try {
    console.log(`Resolving simulator devices for ${config.name}...`);
    const iphoneUdid = findDeviceUuid(IPHONE_NAME);
    const ipadUdid = findDeviceUuid(IPAD_NAME);
    console.log(`Resolved iPhone UUID: ${iphoneUdid}`);
    console.log(`Resolved iPad UUID: ${ipadUdid}`);

    console.log('Ensuring Assets directory exists...');
    fs.mkdirSync(ASSETS_DIR, { recursive: true });

    // Ensure Simulator app is open on macOS
    execSync('open -a Simulator');

    // ==========================================
    // IPHONE SCREENSHOT CAPTURE FLOW
    // ==========================================
    console.log(`\n--- STARTING IPHONE CAPTURE (Device: ${IPHONE_NAME}) ---`);
    ensureBooted(iphoneUdid, IPHONE_NAME);
    ensureExpoGoInstalled(iphoneUdid, iphoneUdid);

    for (const route of ROUTES) {
      const url = `exp://127.0.0.1:${PORT}${route.suffix}`;
      console.log(`Opening route "${route.name}" on iPhone simulator: ${url}`);
      execSync(`xcrun simctl openurl ${iphoneUdid} "${url}"`);
      
      const waitTime = route.suffix === '' ? 15 : 6;
      console.log(`Waiting ${waitTime} seconds for bundling and rendering...`);
      execSync(`sleep ${waitTime}`);

      const screenshotName = `iphone65${route.fileSuffix}.png`;
      const screenshotPath = path.join(ASSETS_DIR, screenshotName);
      console.log(`Taking screenshot: ${screenshotPath}`);
      execSync(`xcrun simctl io ${iphoneUdid} screenshot "${screenshotPath}"`);
      console.log(`Resizing to 1242x2688...`);
      execSync(`sips -z 2688 1242 "${screenshotPath}"`);
    }

    console.log(`Shutting down iPhone simulator to free resources...`);
    execSync(`xcrun simctl shutdown ${iphoneUdid}`);
    execSync('sleep 2');

    // ==========================================
    // IPAD SCREENSHOT CAPTURE FLOW
    // ==========================================
    console.log(`\n--- STARTING IPAD CAPTURE (Device: ${IPAD_NAME}) ---`);
    ensureBooted(ipadUdid, IPAD_NAME);
    ensureExpoGoInstalled(ipadUdid, iphoneUdid);

    for (const route of ROUTES) {
      const url = `exp://127.0.0.1:${PORT}${route.suffix}`;
      console.log(`Opening route "${route.name}" on iPad simulator: ${url}`);
      execSync(`xcrun simctl openurl ${ipadUdid} "${url}"`);
      
      const waitTime = route.suffix === '' ? 15 : 6;
      console.log(`Waiting ${waitTime} seconds for bundling and rendering...`);
      execSync(`sleep ${waitTime}`);

      const screenshotName = `ipad129${route.fileSuffix}.png`;
      const screenshotPath = path.join(ASSETS_DIR, screenshotName);
      console.log(`Taking screenshot: ${screenshotPath}`);
      execSync(`xcrun simctl io ${ipadUdid} screenshot "${screenshotPath}"`);
      console.log(`Resizing to 2048x2732...`);
      execSync(`sips -z 2732 2048 "${screenshotPath}"`);
    }

    console.log(`Shutting down iPad simulator...`);
    execSync(`xcrun simctl shutdown ${ipadUdid}`);
    execSync('sleep 2');

    console.log('\nRestoring default iPhone simulator to booted state...');
    ensureBooted(iphoneUdid, IPHONE_NAME);

    console.log('\n\x1b[32mALL SCREENSHOTS CAPTURED SUCCESSFULY!\x1b[0m');
    ROUTES.forEach(route => {
      console.log(`- iPhone (${route.name}): assets/iphone65${route.fileSuffix}.png`);
      console.log(`- iPad (${route.name}): assets/ipad129${route.fileSuffix}.png`);
    });

  } catch (error) {
    console.error('\n\x1b[31mScreenshot capture failed with error:\x1b[0m');
    console.error(error.message);
    process.exit(1);
  }
}

run();
