#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createPrivateKey, sign as signJwt } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ASC_BASE_URL = 'https://api.appstoreconnect.apple.com/v1';

const HELP = `
Usage:
  pnpm run app-store:release -- [options]
  pnpm run app-store:submit-review -- [options]

Options:
  --skip-eas-upload              Do not run the EAS build/upload step.
  --skip-review-submit           Run local checks and EAS upload, then stop.
  --skip-local-checks            Do not run typecheck and tests.
  --version=<version>            App Store version string. Defaults to app.json expo.version.
  --app-id=<id>                  App Store Connect app ID. Defaults to eas.json submit.production.ios.ascAppId.
  --asc-build-id=<id>            Attach a specific App Store Connect build resource ID.
  --wait-processing-minutes=<n>  Wait for App Store Connect build processing. Default: 45.
  --poll-interval-seconds=<n>    Poll interval while waiting for processing. Default: 60.
  --release-type=<type>          New App Store version release type. Default: AFTER_APPROVAL.
  --allow-first-iap-unattached   Bypass the first-IAP browser-step guard.
  --dry-run                      Print mutating API calls (POST/PATCH/DELETE) and the EAS command
                                 without executing them. GETs still hit the live App Store Connect
                                 API to read real state, so valid credentials are still required.
  --help                         Show this help.

Required for App Store Connect API calls:
  APP_STORE_CONNECT_KEY_ID
  APP_STORE_CONNECT_ISSUER_ID
  APP_STORE_CONNECT_PRIVATE_KEY or APP_STORE_CONNECT_PRIVATE_KEY_PATH

Required when creating App Review details:
  APP_REVIEW_CONTACT_FIRST_NAME
  APP_REVIEW_CONTACT_LAST_NAME
  APP_REVIEW_CONTACT_EMAIL
  APP_REVIEW_CONTACT_PHONE

If this is the first subscription/IAP for the app, Apple requires you to attach
the product to the app version in App Store Connect once. After doing that, set:
  APP_STORE_FIRST_IAP_ATTACHED=1
`;

class AppStoreConnectError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = 'AppStoreConnectError';
    this.status = status;
    this.payload = payload;
  }
}

class AppStoreConnectClient {
  constructor({ keyId, issuerId, privateKey, dryRun }) {
    this.keyId = keyId;
    this.issuerId = issuerId;
    this.privateKey = privateKey;
    this.dryRun = dryRun;
  }

  token() {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'ES256', kid: this.keyId, typ: 'JWT' };
    const payload = {
      aud: 'appstoreconnect-v1',
      exp: now + 20 * 60,
      iat: now,
      iss: this.issuerId,
    };
    const input = `${base64UrlJson(header)}.${base64UrlJson(payload)}`;
    const signature = signJwt('sha256', Buffer.from(input), {
      key: this.privateKey,
      dsaEncoding: 'ieee-p1363',
    });
    return `${input}.${base64Url(signature)}`;
  }

  async request(method, path, { query, body } = {}) {
    const url = new URL(`${ASC_BASE_URL}${path}`);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value === undefined || value === null || value === '') continue;
      url.searchParams.set(key, String(value));
    }

    if (this.dryRun && method !== 'GET') {
      log(`[dry-run] ${method} ${url.toString()}`);
      if (body) log(JSON.stringify(body, null, 2));
      return {
        data: {
          id: `dry-run-${body?.data?.type ?? 'resource'}`,
          type: body?.data?.type ?? 'dryRunResources',
          attributes: {},
        },
      };
    }

    // Retry transient 5xx + network errors with exponential backoff. Apple's
    // API returns sporadic 502/503 under load; a single retry usually clears
    // it. 4xx are not retried (those are our bug, not Apple's).
    const MAX_ATTEMPTS = 4;
    let lastError;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      let response;
      try {
        response = await fetch(url, {
          method,
          headers: {
            Authorization: `Bearer ${this.token()}`,
            'Content-Type': 'application/json',
          },
          body: body ? JSON.stringify(body) : undefined,
        });
      } catch (err) {
        // Network-level failure (DNS, ECONNRESET, etc.) — retriable.
        lastError = err;
        if (attempt === MAX_ATTEMPTS) throw err;
        const delay = 500 * 2 ** (attempt - 1) + Math.random() * 250;
        log(`[retry ${attempt}/${MAX_ATTEMPTS - 1}] ${method} ${path}: ${err.message} (waiting ${Math.round(delay)}ms)`);
        await sleep(delay);
        continue;
      }

      const text = await response.text();
      const payload = text ? safeJson(text) : {};

      if (response.ok) return payload;

      // Retry 5xx; surface 4xx immediately.
      const retriable = response.status >= 500 && attempt < MAX_ATTEMPTS;
      if (!retriable) {
        throw new AppStoreConnectError(
          `${method} ${path} failed with ${response.status}: ${formatAppleError(payload)}`,
          response.status,
          payload,
        );
      }
      const delay = 500 * 2 ** (attempt - 1) + Math.random() * 250;
      log(`[retry ${attempt}/${MAX_ATTEMPTS - 1}] ${method} ${path} → ${response.status} (waiting ${Math.round(delay)}ms)`);
      await sleep(delay);
    }

    // Unreachable in practice — the loop either returns or throws.
    throw lastError ?? new Error(`${method} ${path} exhausted retries`);
  }
}

let currentAppName = 'your app';

async function main() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
      if (match) {
        const key = match[1];
        let val = match[2].trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (process.env[key] === undefined) {
          process.env[key] = val;
        }
      }
    });
  }

  const flags = parseFlags(process.argv.slice(2));
  if (flags.has('help')) {
    process.stdout.write(HELP);
    return;
  }

  const options = {
    allowFirstIapUnattached: boolFlag(flags, 'allow-first-iap-unattached') || envBool('APP_STORE_ALLOW_UNATTACHED_FIRST_IAP'),
    appId: stringFlag(flags, 'app-id') || process.env.APP_STORE_CONNECT_APP_ID || process.env.ASC_APP_ID,
    ascBuildId: stringFlag(flags, 'asc-build-id') || stringFlag(flags, 'build-id') || process.env.ASC_BUILD_ID,
    dryRun: boolFlag(flags, 'dry-run'),
    releaseType: stringFlag(flags, 'release-type') || process.env.APP_STORE_RELEASE_TYPE || 'AFTER_APPROVAL',
    runLocalChecks: !boolFlag(flags, 'skip-local-checks') && !boolFlag(flags, 'no-local-checks'),
    skipEasUpload: boolFlag(flags, 'skip-eas-upload') || boolFlag(flags, 'no-upload'),
    submitReview: !boolFlag(flags, 'skip-review-submit') && !boolFlag(flags, 'no-review-submit'),
    versionString: stringFlag(flags, 'version') || process.env.APP_STORE_VERSION,
    waitProcessingMs: numberFlag(flags, 'wait-processing-minutes', 45) * 60 * 1000,
    pollIntervalMs: numberFlag(flags, 'poll-interval-seconds', 60) * 1000,
  };

  const project = await loadProjectConfig(options);
  currentAppName = project.appName;

  log(`Target app: ${project.appName} (${project.bundleIdentifier})`);
  log(`App Store Connect app ID: ${project.appId}`);
  log(`Version: ${project.versionString}`);

  let client = null;
  if (options.submitReview) {
    assertFirstIapReady(project, options);
    client = await loadAppStoreConnectClient(options);
    await confirmApp(client, project.appId);
  }

  if (options.runLocalChecks) {
    await run('pnpm', ['run', 'typecheck'], { dryRun: options.dryRun });
    await run('pnpm', ['test', '--', '--runInBand'], { dryRun: options.dryRun });
  }

  if (!options.skipEasUpload) {
    await run(
      'pnpm',
      ['exec', 'eas', 'build', '--platform', 'ios', '--profile', 'production', '--auto-submit', '--non-interactive', '--wait'],
      { dryRun: options.dryRun },
    );
  }

  if (!options.submitReview) {
    log('Stopped before App Review submission because --skip-review-submit was set.');
    return;
  }

  const appStoreVersion = await findOrCreateAppStoreVersion(client, project);
  const build = await findValidBuild(client, project, options);

  await attachBuildToVersion(client, appStoreVersion.id, build.id);
  await ensureReviewDetails(client, appStoreVersion.id);
  await configureAppStoreMetadataAndScreenshots(client, project, appStoreVersion.id);

  const result = await submitForReview(client, project.appId, appStoreVersion.id);
  if (result.alreadySubmitted) {
    log(`Already submitted for review. Review submission ${result.submission.id} is ${result.submission.attributes?.state}.`);
  } else {
    log(`Submitted for App Review. Review submission ${result.submission.id} is ${result.submission.attributes?.state ?? 'submitted'}.`);
  }
}

async function loadProjectConfig(options) {
  const appJson = await readJson('app.json');
  const easJson = await readJson('eas.json');
  const expo = appJson.expo ?? appJson;
  const submitIos = easJson.submit?.production?.ios ?? {};
  const productionEnv = easJson.build?.production?.env ?? {};

  const appId = options.appId || submitIos.ascAppId;
  const versionString = options.versionString || expo.version;
  const bundleIdentifier = expo.ios?.bundleIdentifier;

  const missing = [];
  if (!appId) missing.push('App Store Connect app ID (eas.json submit.production.ios.ascAppId or APP_STORE_CONNECT_APP_ID)');
  if (!versionString) missing.push('app version (app.json expo.version or APP_STORE_VERSION)');
  if (!bundleIdentifier) missing.push('iOS bundle identifier (app.json expo.ios.bundleIdentifier)');
  if (missing.length > 0) {
    throw new Error(`Missing required project config:\n- ${missing.join('\n- ')}`);
  }

  return {
    appId,
    appName: expo.name ?? expo.slug ?? 'unknown',
    slug: expo.slug ?? 'unknown',
    bundleIdentifier,
    iapProductId: process.env.EXPO_PUBLIC_IAP_PRODUCT_ID || productionEnv.EXPO_PUBLIC_IAP_PRODUCT_ID,
    releaseType: options.releaseType,
    versionString,
  };
}

async function loadAppStoreConnectClient(options) {
  const keyId = process.env.APP_STORE_CONNECT_KEY_ID || process.env.ASC_KEY_ID;
  const issuerId = process.env.APP_STORE_CONNECT_ISSUER_ID || process.env.ASC_ISSUER_ID;
  const inlinePrivateKey = process.env.APP_STORE_CONNECT_PRIVATE_KEY || process.env.ASC_PRIVATE_KEY;
  const privateKeyPath =
    process.env.APP_STORE_CONNECT_PRIVATE_KEY_PATH ||
    process.env.ASC_PRIVATE_KEY_PATH ||
    process.env.ASC_KEY_PATH;

  const missing = [];
  if (!keyId) missing.push('APP_STORE_CONNECT_KEY_ID');
  if (!issuerId) missing.push('APP_STORE_CONNECT_ISSUER_ID');
  if (!inlinePrivateKey && !privateKeyPath) {
    missing.push('APP_STORE_CONNECT_PRIVATE_KEY or APP_STORE_CONNECT_PRIVATE_KEY_PATH');
  }
  if (missing.length > 0) {
    throw new Error(`Missing App Store Connect API credentials:\n- ${missing.join('\n- ')}`);
  }

  const privateKeyText = inlinePrivateKey
    ? inlinePrivateKey.replace(/\\n/g, '\n')
    : await readFile(privateKeyPath, 'utf8');

  const privateKey = createPrivateKey(privateKeyText);
  return new AppStoreConnectClient({ keyId, issuerId, privateKey, dryRun: options.dryRun });
}

async function confirmApp(client, appId) {
  const response = await client.request('GET', `/apps/${appId}`, {
    query: { 'fields[apps]': 'name,bundleId,sku,primaryLocale' },
  });
  const app = response.data;
  log(`Confirmed App Store Connect app: ${app.attributes?.name ?? app.id}`);
}

function assertFirstIapReady(project, options) {
  if (!project.iapProductId || options.allowFirstIapUnattached || envBool('APP_STORE_FIRST_IAP_ATTACHED')) {
    return;
  }

  throw new Error(
    [
      `First subscription/IAP guard tripped for ${project.iapProductId}.`,
      'Apple requires the first subscription or IAP to be attached to the app version in App Store Connect before review.',
      'The public reviewSubmissionItems API supports app versions, events, custom product pages, and experiments, but not IAP/subscription attachment.',
      'Complete the subscription price, localization, review screenshot, and version attachment in App Store Connect once.',
      'Then rerun with APP_STORE_FIRST_IAP_ATTACHED=1.',
      'Use --allow-first-iap-unattached only if this IAP is already approved or intentionally not part of this review.',
    ].join('\n'),
  );
}

// States where attaching a new build + (re)submitting for review is sensible.
// READY_FOR_SALE / PROCESSING_FOR_APP_STORE / IN_REVIEW / etc. are terminal or
// in-flight — touching the version then would either fail with a cryptic Apple
// error or silently corrupt a live submission.
const EDITABLE_APP_STORE_STATES = new Set([
  'PREPARE_FOR_SUBMISSION',
  'DEVELOPER_REJECTED',
  'REJECTED',
  'METADATA_REJECTED',
  'INVALID_BINARY',
  'DEVELOPER_REMOVED_FROM_SALE',
]);

async function findOrCreateAppStoreVersion(client, project) {
  const response = await client.request('GET', `/apps/${project.appId}/appStoreVersions`, {
    query: {
      'fields[appStoreVersions]': 'platform,versionString,appVersionState,appStoreState,releaseType,createdDate',
      'filter[platform]': 'IOS',
      'filter[versionString]': project.versionString,
      limit: 1,
    },
  });

  if (response.data?.length) {
    const version = response.data[0];
    const state = version.attributes?.appStoreState;
    if (state && !EDITABLE_APP_STORE_STATES.has(state)) {
      throw new Error(
        [
          `App Store version ${project.versionString} (${version.id}) is in state ${state}.`,
          'Cannot attach a new build to a version in this state.',
          'Bump expo.version in app.json to a fresh version string, or move the existing version back to a draftable state in App Store Connect.',
          `Editable states: ${[...EDITABLE_APP_STORE_STATES].join(', ')}.`,
        ].join('\n'),
      );
    }
    log(`Found App Store version ${project.versionString}: ${version.id} (${version.attributes?.appVersionState}, state=${state ?? 'unknown'}).`);
    return version;
  }

  log(`Creating App Store version ${project.versionString}.`);
  const created = await client.request('POST', '/appStoreVersions', {
    body: {
      data: {
        type: 'appStoreVersions',
        attributes: {
          platform: 'IOS',
          releaseType: project.releaseType,
          versionString: project.versionString,
        },
        relationships: {
          app: { data: { type: 'apps', id: project.appId } },
        },
      },
    },
  });
  return created.data;
}

async function findValidBuild(client, project, options) {
  if (options.ascBuildId) {
    return await waitForSpecificBuild(client, options.ascBuildId, options);
  }

  const deadline = Date.now() + options.waitProcessingMs;
  while (true) {
    const builds = await listRecentBuilds(client, project);
    const validBuild = builds.find((build) => build.attributes?.processingState === 'VALID' && !build.attributes?.expired);
    if (validBuild) {
      logBuild('Using App Store Connect build', validBuild);
      return validBuild;
    }

    const latest = builds[0];
    if (latest) {
      logBuild('Latest build is not ready yet', latest);
      const latestState = latest.attributes?.processingState;
      if ((latestState === 'FAILED' || latestState === 'INVALID') && !builds.some((build) => build.attributes?.processingState === 'PROCESSING')) {
        throw new Error(`Latest App Store Connect build is ${latestState}; upload a new build before submitting.`);
      }
    } else {
      log(`No App Store Connect builds found for version ${project.versionString} yet.`);
    }

    if (Date.now() >= deadline) {
      throw new Error(`Timed out waiting for a VALID App Store Connect build for version ${project.versionString}.`);
    }
    await sleep(options.pollIntervalMs);
  }
}

async function waitForSpecificBuild(client, buildId, options) {
  const deadline = Date.now() + options.waitProcessingMs;
  while (true) {
    const response = await client.request('GET', `/builds/${buildId}`, {
      query: {
        'fields[builds]': 'version,uploadedDate,processingState,expired,usesNonExemptEncryption,buildAudienceType',
      },
    });
    const build = response.data;
    const state = build.attributes?.processingState;
    if (state === 'VALID' && !build.attributes?.expired) {
      logBuild('Using App Store Connect build', build);
      return build;
    }
    if (state === 'FAILED' || state === 'INVALID') {
      throw new Error(`App Store Connect build ${buildId} is ${state}; upload a valid build before submitting.`);
    }
    if (Date.now() >= deadline) {
      throw new Error(`Timed out waiting for App Store Connect build ${buildId} to finish processing.`);
    }
    logBuild('Specific build is not ready yet', build);
    await sleep(options.pollIntervalMs);
  }
}

async function listRecentBuilds(client, project) {
  const response = await client.request('GET', '/builds', {
    query: {
      'fields[builds]': 'version,uploadedDate,processingState,expired,usesNonExemptEncryption,buildAudienceType',
      'filter[app]': project.appId,
      'filter[preReleaseVersion.platform]': 'IOS',
      'filter[preReleaseVersion.version]': project.versionString,
      limit: 10,
      sort: '-uploadedDate',
    },
  });
  return response.data ?? [];
}

async function attachBuildToVersion(client, appStoreVersionId, buildId) {
  try {
    const existing = await client.request('GET', `/appStoreVersions/${appStoreVersionId}/build`, {
      query: { 'fields[builds]': 'version,uploadedDate,processingState' },
    });
    if (existing.data?.id === buildId) {
      log(`Build ${buildId} is already attached to App Store version ${appStoreVersionId}.`);
      return;
    }
  } catch (error) {
    if (!(error instanceof AppStoreConnectError) || error.status !== 404) throw error;
  }

  log(`Attaching build ${buildId} to App Store version ${appStoreVersionId}.`);
  await client.request('PATCH', `/appStoreVersions/${appStoreVersionId}/relationships/build`, {
    body: { data: { type: 'builds', id: buildId } },
  });
}

async function ensureReviewDetails(client, appStoreVersionId) {
  const attrs = collectReviewDetailAttributes();

  try {
    const existing = await client.request('GET', `/appStoreVersions/${appStoreVersionId}/appStoreReviewDetail`, {
      query: {
        'fields[appStoreReviewDetails]': 'contactFirstName,contactLastName,contactPhone,contactEmail,demoAccountName,demoAccountPassword,demoAccountRequired,notes',
      },
    });

    if (existing.data) {
      if (Object.keys(attrs).length === 0) {
        log(`Existing App Review details found: ${existing.data.id}.`);
        return;
      }

      log(`Updating App Review details: ${existing.data.id}.`);
      await client.request('PATCH', `/appStoreReviewDetails/${existing.data.id}`, {
        body: {
          data: {
            type: 'appStoreReviewDetails',
            id: existing.data.id,
            attributes: attrs,
          },
        },
      });
      return;
    }
  } catch (error) {
    if (!(error instanceof AppStoreConnectError) || error.status !== 404) throw error;
  }

  const required = ['contactFirstName', 'contactLastName', 'contactEmail', 'contactPhone'];
  const missing = required.filter((key) => !attrs[key]);
  if (missing.length > 0) {
    throw new Error(
      [
        'No App Review details exist for this version, and required review-contact env vars are missing.',
        `Missing attributes: ${missing.join(', ')}`,
        'Set APP_REVIEW_CONTACT_FIRST_NAME, APP_REVIEW_CONTACT_LAST_NAME, APP_REVIEW_CONTACT_EMAIL, and APP_REVIEW_CONTACT_PHONE.',
      ].join('\n'),
    );
  }

  if (attrs.demoAccountRequired && (!attrs.demoAccountName || !attrs.demoAccountPassword)) {
    throw new Error('APP_REVIEW_DEMO_ACCOUNT_REQUIRED is true, so APP_REVIEW_DEMO_ACCOUNT_NAME and APP_REVIEW_DEMO_ACCOUNT_PASSWORD are required.');
  }

  if (attrs.demoAccountRequired === undefined) attrs.demoAccountRequired = false;

  log('Creating App Review details.');
  await client.request('POST', '/appStoreReviewDetails', {
    body: {
      data: {
        type: 'appStoreReviewDetails',
        attributes: attrs,
        relationships: {
          appStoreVersion: { data: { type: 'appStoreVersions', id: appStoreVersionId } },
        },
      },
    },
  });
}

function collectReviewDetailAttributes() {
  const attrs = {};
  setIfPresent(attrs, 'contactFirstName', process.env.APP_REVIEW_CONTACT_FIRST_NAME);
  setIfPresent(attrs, 'contactLastName', process.env.APP_REVIEW_CONTACT_LAST_NAME);
  setIfPresent(attrs, 'contactEmail', process.env.APP_REVIEW_CONTACT_EMAIL);
  setIfPresent(attrs, 'contactPhone', process.env.APP_REVIEW_CONTACT_PHONE);
  setIfPresent(attrs, 'demoAccountName', process.env.APP_REVIEW_DEMO_ACCOUNT_NAME);
  setIfPresent(attrs, 'demoAccountPassword', process.env.APP_REVIEW_DEMO_ACCOUNT_PASSWORD);
  setIfPresent(attrs, 'notes', process.env.APP_REVIEW_NOTES);

  if (process.env.APP_REVIEW_DEMO_ACCOUNT_REQUIRED !== undefined) {
    attrs.demoAccountRequired = envBool('APP_REVIEW_DEMO_ACCOUNT_REQUIRED');
  } else if (attrs.demoAccountName || attrs.demoAccountPassword) {
    attrs.demoAccountRequired = true;
  }

  return attrs;
}

async function uploadScreenshot(client, setId, filePath) {
  const fileName = path.basename(filePath);
  const fileBuffer = fs.readFileSync(filePath);
  const fileSize = fileBuffer.length;
  
  log(`Reserving screenshot slot for ${fileName} (${fileSize} bytes)...`);
  const reserveRes = await client.request('POST', '/appScreenshots', {
    body: {
      data: {
        type: 'appScreenshots',
        attributes: {
          fileName: fileName,
          fileSize: fileSize
        },
        relationships: {
          appScreenshotSet: {
            data: {
              type: 'appScreenshotSets',
              id: setId
            }
          }
        }
      }
    }
  });
  
  const screenshotId = reserveRes.data.id;
  const uploadOps = reserveRes.data.attributes.uploadOperations;
  log(`Reserved screenshot ID: ${screenshotId}. Uploading chunks...`);
  
  for (const op of uploadOps) {
    const chunk = fileBuffer.slice(op.offset, op.offset + op.length);
    log(`Uploading chunk: offset ${op.offset}, length ${op.length}...`);
    
    const headers = {};
    if (op.requestHeaders) {
      op.requestHeaders.forEach(h => {
        headers[h.name] = h.value;
      });
    }
    
    const uploadRes = await fetch(op.url, {
      method: op.method || 'PUT',
      headers: headers,
      body: chunk
    });
    
    if (!uploadRes.ok) {
      throw new Error(`Failed to upload chunk: HTTP ${uploadRes.status} - ${await uploadRes.text()}`);
    }
  }
  
  log(`Upload complete for ${fileName}. Committing screenshot...`);
  const md5 = crypto.createHash('md5').update(fileBuffer).digest('hex');
  await client.request('PATCH', `/appScreenshots/${screenshotId}`, {
    body: {
      data: {
        type: 'appScreenshots',
        id: screenshotId,
        attributes: {
          sourceFileChecksum: md5,
          uploaded: true
        }
      }
    }
  });
  log(`Successfully committed screenshot ${fileName}`);
  return screenshotId;
}

async function pollScreenshots(client, ids) {
  if (!ids || ids.length === 0) return;
  log(`Polling status for ${ids.length} uploaded screenshot(s)...`);
  const pending = new Set(ids);
  const maxAttempts = 60;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    log(`Checking screenshot processing status (Attempt ${attempt}/${maxAttempts})...`);
    for (const id of pending) {
      try {
        const res = await client.request('GET', `/appScreenshots/${id}`);
        const state = res.data.attributes.assetDeliveryState?.state;
        log(`Screenshot ID ${id}: state is ${state}`);
        if (state === 'COMPLETE') {
          pending.delete(id);
        } else if (state === 'FAILED') {
          throw new Error(`Screenshot ID ${id} processing failed on Apple's servers.`);
        }
      } catch (err) {
        log(`Warning checking screenshot ${id} (will retry): ${err.message}`);
      }
    }
    if (pending.size === 0) {
      log('All uploaded screenshots are successfully processed and COMPLETE.');
      return;
    }
    await sleep(10000);
  }
  throw new Error(`Timeout waiting for screenshots to process on Apple's servers.`);
}

function getMetadata(slug, appName) {
  const metadata = {
    copyright: process.env.APP_STORE_COPYRIGHT || '© 2026 Scott Beilfuss',
    supportUrl: process.env.APP_STORE_SUPPORT_URL || `https://thescottybe.github.io/${slug}`,
    marketingUrl: process.env.APP_STORE_MARKETING_URL || `https://thescottybe.github.io/${slug}`,
    privacyPolicyUrl: process.env.APP_STORE_PRIVACY_POLICY_URL || `https://thescottybe.github.io/${slug}/privacy`
  };

  if (slug === 'flower-sandbox') {
    metadata.description = process.env.APP_STORE_DESCRIPTION || "FlowerSandbox is a peaceful, interactive digital garden where you can plant beautiful flowers, customize your garden layout, and relax with serene animations. Nurture your virtual sanctuary, experiment with colorful petals, and enjoy a calming, distraction-free environment designed for mindfulness and relaxation.";
    metadata.keywords = process.env.APP_STORE_KEYWORDS || "garden,flowers,relax,nature,grow,plants,mindfulness,virtual garden,sandbox,calm";
    metadata.subtitle = process.env.APP_STORE_SUBTITLE || "Peaceful Garden Sandbox";
    metadata.primaryCategory = process.env.APP_STORE_PRIMARY_CATEGORY || 'LIFESTYLE';
  } else if (slug === 'mortgage-flipcard') {
    metadata.description = process.env.APP_STORE_DESCRIPTION || "Mortgage FlipCard is a useful, intuitive, and novel mortgage planning companion built around interactive 3D cards. Easily compare different mortgage scenarios side-by-side. Flip cards to reveal comprehensive financial breakdowns, amortization schedules, and localized climate hazard risk metrics (flood, wildfire, wind) based on the property's zip code. Plan your home purchase smarter with offline-first tools, beautiful custom skins/themes, and advanced AI scenario coaching.";
    metadata.keywords = process.env.APP_STORE_KEYWORDS || "mortgage,calculator,loan,compare,amortization,home,payment,climate,risk,finance";
    metadata.subtitle = process.env.APP_STORE_SUBTITLE || "Compare Scenarios & Hazards";
    metadata.primaryCategory = process.env.APP_STORE_PRIMARY_CATEGORY || 'FINANCE';
  } else if (slug === 'creative-story-canvas' || slug === 'react-example') {
    metadata.description = process.env.APP_STORE_DESCRIPTION || "Creative Story Canvas is an elegant and powerful writing companion designed for authors, screenwriters, and creative minds. Organize your ideas, structure your plots, and draft your stories on a beautiful, distraction-free interface built for focus. Whether you are outlining your next novel or writing daily micro-fiction, Creative Story Canvas helps you map your creative thoughts visually and bring your stories to life.";
    metadata.keywords = process.env.APP_STORE_KEYWORDS || "writing,story,creative,plot,novel,author,screenplay,editor,notebook";
    metadata.subtitle = process.env.APP_STORE_SUBTITLE || "Creative Writing Companion";
    metadata.primaryCategory = process.env.APP_STORE_PRIMARY_CATEGORY || 'BOOKS';
  } else {
    metadata.description = process.env.APP_STORE_DESCRIPTION || `${appName} is a beautiful and premium companion app designed to elevate your daily productivity and lifestyle.`;
    metadata.keywords = process.env.APP_STORE_KEYWORDS || "utility,companion,helper,premium,lifestyle";
    metadata.subtitle = process.env.APP_STORE_SUBTITLE || "Your Premium Companion";
    metadata.primaryCategory = process.env.APP_STORE_PRIMARY_CATEGORY || 'UTILITIES';
  }

  return metadata;
}

async function configureAppStoreMetadataAndScreenshots(client, project, appStoreVersionId) {
  log('--- STARTING METADATA UPDATE & SCREENSHOT UPLOAD FLOW ---');

  const localeCode = 'en-US';
  log(`Retrieving version localizations for ${localeCode}...`);
  const locsResponse = await client.request('GET', `/appStoreVersions/${appStoreVersionId}/appStoreVersionLocalizations`);
  let locId = null;
  if (locsResponse.data && locsResponse.data.length > 0) {
    const match = locsResponse.data.find(l => l.attributes.locale === localeCode) || locsResponse.data[0];
    locId = match.id;
    log(`Found existing version localization ID: ${locId} (${match.attributes.locale})`);
  } else {
    log(`Creating version localization for ${localeCode}...`);
    const createLocResponse = await client.request('POST', `/appStoreVersionLocalizations`, {
      body: {
        data: {
          type: 'appStoreVersionLocalizations',
          attributes: {
            locale: localeCode
          },
          relationships: {
            appStoreVersion: {
              data: {
                type: 'appStoreVersions',
                id: appStoreVersionId
              }
            }
          }
        }
      }
    });
    locId = createLocResponse.data.id;
    log(`Created version localization ID: ${locId}`);
  }

  const slug = project.slug;
  const meta = getMetadata(slug, project.appName);
  const copyright = meta.copyright;
  const description = meta.description;
  const keywords = meta.keywords;
  const supportUrl = meta.supportUrl;
  const marketingUrl = meta.marketingUrl;
  const privacyPolicyUrl = meta.privacyPolicyUrl;
  const subtitle = meta.subtitle;
  const primaryCategory = meta.primaryCategory;

  log(`Updating version copyright: ${copyright}`);
  await client.request('PATCH', `/appStoreVersions/${appStoreVersionId}`, {
    body: {
      data: {
        type: 'appStoreVersions',
        id: appStoreVersionId,
        attributes: {
          copyright: copyright
        }
      }
    }
  });

  log('Updating version localization metadata...');
  await client.request('PATCH', `/appStoreVersionLocalizations/${locId}`, {
    body: {
      data: {
        type: 'appStoreVersionLocalizations',
        id: locId,
        attributes: {
          description,
          keywords,
          supportUrl,
          marketingUrl
        }
      }
    }
  });

  log('Retrieving app info metadata...');
  const appInfosRes = await client.request('GET', `/apps/${project.appId}/appInfos`);
  const appInfoId = appInfosRes.data[0].id;
  log(`App Info ID: ${appInfoId}`);

  log(`Setting Primary Category to ${primaryCategory}...`);
  await client.request('PATCH', `/appInfos/${appInfoId}`, {
    body: {
      data: {
        type: 'appInfos',
        id: appInfoId,
        relationships: {
          primaryCategory: {
            data: {
              type: 'appCategories',
              id: primaryCategory
            }
          }
        }
      }
    }
  });

  log('Retrieving app info localizations...');
  const appInfoLocsRes = await client.request('GET', `/appInfos/${appInfoId}/appInfoLocalizations`);
  if (appInfoLocsRes.data && appInfoLocsRes.data.length > 0) {
    const appInfoLocId = appInfoLocsRes.data[0].id;
    log(`App Info Localization ID: ${appInfoLocId}`);
    log('Updating privacy policy URL and subtitle on app info localization...');
    await client.request('PATCH', `/appInfoLocalizations/${appInfoLocId}`, {
      body: {
        data: {
          type: 'appInfoLocalizations',
          id: appInfoLocId,
          attributes: {
            privacyPolicyUrl,
            subtitle
          }
        }
      }
    });
  }

  log('Updating content rights declaration to DOES_NOT_USE_THIRD_PARTY_CONTENT...');
  await client.request('PATCH', `/apps/${project.appId}`, {
    body: {
      data: {
        type: 'apps',
        id: project.appId,
        attributes: {
          contentRightsDeclaration: 'DOES_NOT_USE_THIRD_PARTY_CONTENT'
        }
      }
    }
  });

  log('Updating age rating declarations questionnaire...');
  await client.request('PATCH', `/ageRatingDeclarations/${appInfoId}`, {
    body: {
      data: {
        type: 'ageRatingDeclarations',
        id: appInfoId,
        attributes: {
          advertising: false,
          alcoholTobaccoOrDrugUseOrReferences: 'NONE',
          contests: 'NONE',
          gambling: false,
          gamblingSimulated: 'NONE',
          gunsOrOtherWeapons: 'NONE',
          healthOrWellnessTopics: false,
          lootBox: false,
          medicalOrTreatmentInformation: 'NONE',
          messagingAndChat: false,
          parentalControls: false,
          profanityOrCrudeHumor: 'NONE',
          ageAssurance: false,
          sexualContentGraphicAndNudity: 'NONE',
          sexualContentOrNudity: 'NONE',
          horrorOrFearThemes: 'NONE',
          matureOrSuggestiveThemes: 'NONE',
          unrestrictedWebAccess: false,
          userGeneratedContent: false,
          violenceCartoonOrFantasy: 'NONE',
          violenceRealisticProlongedGraphicOrSadistic: 'NONE',
          violenceRealistic: 'NONE'
        }
      }
    }
  });

  log('Setting App Pricing to Free...');
  try {
    const pricePointsRes = await client.request('GET', `/apps/${project.appId}/appPricePoints`, {
      query: { 'filter[territory]': 'USA' }
    });
    const freePricePoint = pricePointsRes.data?.find(p => p.attributes?.customerPrice === '0.0');
    if (!freePricePoint) {
      throw new Error('Could not find Free (0.0 USD) Price Point in the Apple API response.');
    }
    log(`Found Free Price Point ID: ${freePricePoint.id}`);

    await client.request('POST', `/appPriceSchedules`, {
      body: {
        data: {
          type: 'appPriceSchedules',
          relationships: {
            app: { data: { type: 'apps', id: project.appId } },
            baseTerritory: { data: { type: 'territories', id: 'USA' } },
            manualPrices: {
              data: [
                {
                  type: 'appPrices',
                  id: '${temp-free-price}'
                }
              ]
            }
          }
        },
        included: [
          {
            type: 'appPrices',
            id: '${temp-free-price}',
            attributes: { startDate: null },
            relationships: {
              appPricePoint: {
                data: {
                  type: 'appPricePoints',
                  id: freePricePoint.id
                }
              }
            }
          }
        ]
      }
    });
    log('Successfully set App Pricing to Free.');
  } catch (pricingError) {
    log(`Warning: Failed to set App Pricing via API: ${pricingError.message}`);
    log('If pricing is already set, this warning can be ignored.');
  }

  const screenshotGroups = [
    {
      displayType: 'APP_IPHONE_65',
      files: ['./assets/iphone65.png', './assets/iphone65_back.png']
    },
    {
      displayType: 'APP_IPAD_PRO_3GEN_129',
      files: ['./assets/ipad129.png', './assets/ipad129_back.png']
    }
  ];

  log('Fetching existing app screenshot sets...');
  const setsRes = await client.request('GET', `/appStoreVersionLocalizations/${locId}/appScreenshotSets`);
  const uploadedIds = [];

  for (const group of screenshotGroups) {
    const { displayType, files } = group;
    const existingFiles = files
      .map(f => path.isAbsolute(f) ? f : path.resolve(process.cwd(), f))
      .filter(f => fs.existsSync(f));

    if (existingFiles.length === 0) {
      log(`No files found on disk for ${displayType}. Skipping.`);
      continue;
    }

    let set = setsRes.data ? setsRes.data.find(s => s.attributes.screenshotDisplayType === displayType) : null;
    if (!set) {
      log(`Creating appScreenshotSet for ${displayType}...`);
      const createSetRes = await client.request('POST', '/appScreenshotSets', {
        body: {
          data: {
            type: 'appScreenshotSets',
            attributes: { screenshotDisplayType: displayType },
            relationships: {
              appStoreVersionLocalization: {
                data: { type: 'appStoreVersionLocalizations', id: locId }
              }
            }
          }
        }
      });
      set = createSetRes.data;
    } else {
      log(`Found existing set for ${displayType} (ID: ${set.id})`);
    }

    if (client.dryRun && set.id.startsWith('dry-run-')) {
      log(`[dry-run] Skipping screenshot query and upload for mock set ${set.id}`);
      continue;
    }

    const screenshotsRes = await client.request('GET', `/appScreenshotSets/${set.id}/appScreenshots`);
    if (screenshotsRes.data && screenshotsRes.data.length > 0) {
      log(`Clearing ${screenshotsRes.data.length} existing screenshot(s) from set ${displayType}...`);
      for (const s of screenshotsRes.data) {
        log(`Deleting screenshot: ${s.attributes.fileName} (ID: ${s.id})...`);
        try {
          await client.request('DELETE', `/appScreenshots/${s.id}`);
          log(`Successfully deleted screenshot ${s.id}`);
        } catch (err) {
          log(`Failed to delete screenshot ${s.id}: ${err.message}`);
        }
      }
    }

    for (const absolutePath of existingFiles) {
      const fileName = path.basename(absolutePath);
      log(`Uploading ${fileName} to set ${displayType}...`);
      const screenshotId = await uploadScreenshot(client, set.id, absolutePath);
      if (screenshotId) {
        uploadedIds.push(screenshotId);
      }
    }
  }

  if (uploadedIds.length > 0) {
    log(`Waiting for Apple to process ${uploadedIds.length} uploaded screenshot(s)...`);
    await pollScreenshots(client, uploadedIds);
  }

  log('--- METADATA UPDATE & SCREENSHOT UPLOAD FLOW COMPLETE ---');
}

async function submitForReview(client, appId, appStoreVersionId) {
  const activeSubmissions = await listActiveReviewSubmissions(client, appId);

  for (const submission of activeSubmissions) {
    const hasVersion = await reviewSubmissionHasVersion(client, submission.id, appStoreVersionId);
    const state = submission.attributes?.state;
    if (hasVersion && (state === 'WAITING_FOR_REVIEW' || state === 'IN_REVIEW')) {
      return { submission, alreadySubmitted: true };
    }
    if (hasVersion && state === 'READY_FOR_REVIEW') {
      await sendReviewSubmission(client, submission.id);
      const refreshed = await readReviewSubmission(client, submission.id);
      return { submission: refreshed, alreadySubmitted: false };
    }
  }

  const readySubmission = activeSubmissions.find((submission) => submission.attributes?.state === 'READY_FOR_REVIEW');
  const submission = readySubmission ?? await createReviewSubmission(client, appId);
  const hasVersion = await reviewSubmissionHasVersion(client, submission.id, appStoreVersionId);

  if (!hasVersion) {
    await createReviewSubmissionItem(client, submission.id, appStoreVersionId);
  }

  await sendReviewSubmission(client, submission.id);
  const refreshed = await readReviewSubmission(client, submission.id);
  return { submission: refreshed, alreadySubmitted: false };
}

async function listActiveReviewSubmissions(client, appId) {
  const response = await client.request('GET', `/apps/${appId}/reviewSubmissions`, {
    query: {
      'fields[reviewSubmissions]': 'platform,submittedDate,state',
      'filter[platform]': 'IOS',
      limit: 50,
    },
  });
  const activeStates = new Set(['READY_FOR_REVIEW', 'WAITING_FOR_REVIEW', 'IN_REVIEW', 'UNRESOLVED_ISSUES']);
  return (response.data ?? []).filter((submission) => activeStates.has(submission.attributes?.state));
}

async function createReviewSubmission(client, appId) {
  log('Creating review submission draft.');
  const response = await client.request('POST', '/reviewSubmissions', {
    body: {
      data: {
        type: 'reviewSubmissions',
        attributes: { platform: 'IOS' },
        relationships: {
          app: { data: { type: 'apps', id: appId } },
        },
      },
    },
  });
  return response.data;
}

async function reviewSubmissionHasVersion(client, submissionId, appStoreVersionId) {
  const response = await client.request('GET', `/reviewSubmissions/${submissionId}/items`, {
    query: {
      'fields[reviewSubmissionItems]': 'state,appStoreVersion',
      include: 'appStoreVersion',
      limit: 50,
    },
  });

  const relationshipMatch = (response.data ?? []).some(
    (item) => item.relationships?.appStoreVersion?.data?.id === appStoreVersionId,
  );
  const includedMatch = (response.included ?? []).some((item) => item.type === 'appStoreVersions' && item.id === appStoreVersionId);
  return relationshipMatch || includedMatch;
}

async function createReviewSubmissionItem(client, submissionId, appStoreVersionId) {
  log(`Adding App Store version ${appStoreVersionId} to review submission ${submissionId}.`);
  await client.request('POST', '/reviewSubmissionItems', {
    body: {
      data: {
        type: 'reviewSubmissionItems',
        relationships: {
          appStoreVersion: { data: { type: 'appStoreVersions', id: appStoreVersionId } },
          reviewSubmission: { data: { type: 'reviewSubmissions', id: submissionId } },
        },
      },
    },
  });
}

async function sendReviewSubmission(client, submissionId) {
  log(`Submitting review submission ${submissionId}.`);
  await client.request('PATCH', `/reviewSubmissions/${submissionId}`, {
    body: {
      data: {
        type: 'reviewSubmissions',
        id: submissionId,
        attributes: { submitted: true },
      },
    },
  });
}

async function readReviewSubmission(client, submissionId) {
  const response = await client.request('GET', `/reviewSubmissions/${submissionId}`, {
    query: { 'fields[reviewSubmissions]': 'platform,submittedDate,state' },
  });
  return response.data;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function run(command, args, { dryRun }) {
  if (dryRun) {
    log(`[dry-run] ${shellQuote([command, ...args])}`);
    return Promise.resolve();
  }

  log(`Running: ${shellQuote([command, ...args])}`);
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

// Canonical set of accepted CLI flags. Keep in sync with the HELP constant.
const KNOWN_FLAGS = new Set([
  'skip-eas-upload',
  'skip-review-submit',
  'skip-local-checks',
  'version',
  'app-id',
  'asc-build-id',
  'wait-processing-minutes',
  'poll-interval-seconds',
  'release-type',
  'allow-first-iap-unattached',
  'dry-run',
  'help',
]);

function parseFlags(args) {
  const flags = new Map();
  for (const arg of args) {
    if (!arg.startsWith('--')) continue;
    const raw = arg.slice(2);
    const equalsIndex = raw.indexOf('=');
    const name = equalsIndex === -1 ? raw : raw.slice(0, equalsIndex);
    if (!KNOWN_FLAGS.has(name)) {
      throw new Error(`Unknown flag --${name}. Run with --help to see accepted flags.`);
    }
    if (equalsIndex === -1) {
      flags.set(raw, true);
    } else {
      flags.set(name, raw.slice(equalsIndex + 1));
    }
  }
  return flags;
}

function boolFlag(flags, name) {
  const value = flags.get(name);
  if (value === undefined) return false;
  if (value === true) return true;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function stringFlag(flags, name) {
  const value = flags.get(name);
  if (value === undefined || value === true || value === '') return undefined;
  return String(value);
}

function numberFlag(flags, name, fallback) {
  const value = stringFlag(flags, name);
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`--${name} must be a positive number.`);
  }
  return parsed;
}

function envBool(name) {
  return ['1', 'true', 'yes', 'on'].includes(String(process.env[name] ?? '').toLowerCase());
}

function setIfPresent(target, key, value) {
  if (value !== undefined && value !== '') target[key] = value;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

// Keys whose values are redacted from any error output. Apple sometimes
// echoes the request body in validation errors, and we POST these as part
// of review-detail attributes (App Review demo account credentials).
const REDACTED_KEYS = new Set([
  'demoAccountPassword',
  'demoAccountName',
  'contactEmail',
  'contactPhone',
]);

function redactSensitive(value) {
  if (Array.isArray(value)) return value.map(redactSensitive);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = REDACTED_KEYS.has(k) && v != null && v !== '' ? '[REDACTED]' : redactSensitive(v);
    }
    return out;
  }
  return value;
}

function formatAppleError(payload) {
  if (Array.isArray(payload?.errors)) {
    return payload.errors
      .map((error) => {
        const parts = [error.code, error.title, error.detail];
        if (error.meta?.associatedErrors) {
          parts.push(`Associated: ${JSON.stringify(error.meta.associatedErrors)}`);
        } else if (error.meta) {
          parts.push(`Meta: ${JSON.stringify(error.meta)}`);
        }
        return parts.filter(Boolean).join(' - ');
      })
      .join('; ');
  }
  // Fallback: redact known-sensitive keys before serializing in case Apple
  // echoed our request body.
  return payload?.raw ?? JSON.stringify(redactSensitive(payload));
}

function base64UrlJson(value) {
  return base64Url(Buffer.from(JSON.stringify(value)));
}

function base64Url(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function logBuild(prefix, build) {
  const attrs = build.attributes ?? {};
  log(`${prefix}: ${build.id} build=${attrs.version ?? 'unknown'} state=${attrs.processingState ?? 'unknown'} uploaded=${attrs.uploadedDate ?? 'unknown'}`);
}

function shellQuote(parts) {
  return parts
    .map((part) => {
      const value = String(part);
      return /^[A-Za-z0-9_./:=@-]+$/.test(value) ? value : JSON.stringify(value);
    })
    .join(' ');
}

function log(message) {
  process.stdout.write(`${message}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error.message}\n`);
  if (error.message.includes('409') || error.message.toLowerCase().includes('privacy') || error.message.toLowerCase().includes('data usage') || error.message.includes('APP_DATA_USAGES_REQUIRED')) {
    process.stdout.write('\n\x1b[33m💡 TROUBLESHOOTING TIP:\x1b[0m\n');
    process.stdout.write('This error indicates that the App Privacy (Data Usages) questionnaire is not completed or published for your app.\n');
    process.stdout.write('Please log into App Store Connect:\n');
    process.stdout.write('  1. Navigate to: https://appstoreconnect.apple.com\n');
    process.stdout.write(`  2. Select your app "${currentAppName}"\n`);
    process.stdout.write('  3. In the left sidebar under "General", select "App Privacy"\n');
    process.stdout.write('  4. Click "Get Started" and complete the questionnaire (declare no data is collected, as this is an offline-first app)\n');
    process.stdout.write('  5. Click "Publish" at the top right of the App Privacy page\n');
    process.stdout.write('Once published, re-run this submission script.\n\n');
  }
  process.exitCode = 1;
});

