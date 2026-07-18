/**
 * Submits FlowerSandbox v1.0.2 for App Store Review directly via the
 * App Store Connect API, bypassing the kit's age-rating step (which
 * 409-errors on an already-live app whose AppInfo is locked).
 *
 * Usage: node scripts/submit-for-review.mjs
 *
 * Requires in .env (loaded automatically):
 *   APP_STORE_CONNECT_KEY_ID
 *   APP_STORE_CONNECT_ISSUER_ID
 *   APP_STORE_CONNECT_PRIVATE_KEY_PATH
 *   APP_STORE_CONNECT_APP_ID
 */

import { createPrivateKey, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Load .env
// ---------------------------------------------------------------------------
const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');
const envPath = resolve(root, '.env');

for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  const val = trimmed.slice(eq + 1).trim();
  if (!process.env[key]) process.env[key] = val;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const KEY_ID       = process.env.APP_STORE_CONNECT_KEY_ID;
const ISSUER_ID    = process.env.APP_STORE_CONNECT_ISSUER_ID;
const KEY_PATH     = process.env.APP_STORE_CONNECT_PRIVATE_KEY_PATH;
const APP_ID       = process.env.APP_STORE_CONNECT_APP_ID;
const VERSION_ID   = '7ef08e38-b435-403e-bdad-450890e2701e'; // 1.0.2 PREPARE_FOR_SUBMISSION

const BASE_URL = 'https://api.appstoreconnect.apple.com/v1';

// ---------------------------------------------------------------------------
// JWT
// ---------------------------------------------------------------------------
function generateJWT() {
  const pem = readFileSync(KEY_PATH, 'utf8');
  const privateKey = createPrivateKey(pem);
  const now = Math.floor(Date.now() / 1000);

  const header  = b64url(JSON.stringify({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' }));
  const payload = b64url(JSON.stringify({ iss: ISSUER_ID, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' }));
  const msg     = `${header}.${payload}`;

  const sig = sign('sha256', Buffer.from(msg), { key: privateKey, dsaEncoding: 'ieee-p1363' });
  return `${msg}.${sig.toString('base64url')}`;
}

function b64url(str) {
  return Buffer.from(str).toString('base64url');
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------
async function req(method, path, body) {
  const token = generateJWT();
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${BASE_URL}${path}`, opts);
  const text = await res.text();

  if (!res.ok) {
    throw new Error(`${method} ${path} → HTTP ${res.status}\n${text}`);
  }
  return text ? JSON.parse(text) : null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
(async () => {
  console.log('1. Checking existing review submissions for the app...');
  const existing = await req('GET', `/reviewSubmissions?filter[app]=${APP_ID}&filter[platform]=IOS&filter[state]=WAITING_FOR_REVIEW,READY_FOR_REVIEW,UNRESOLVED_ISSUES`);
  let submissionId;

  if (existing?.data?.length) {
    submissionId = existing.data[0].id;
    console.log(`   Reusing existing submission: ${submissionId} (state: ${existing.data[0].attributes.state})`);
  } else {
    console.log('2. Creating new review submission...');
    const created = await req('POST', '/reviewSubmissions', {
      data: {
        type: 'reviewSubmissions',
        attributes: { platform: 'IOS' },
        relationships: {
          app: { data: { type: 'apps', id: APP_ID } },
        },
      },
    });
    submissionId = created.data.id;
    console.log(`   Created submission: ${submissionId}`);
  }

  // -------------------------------------------------------------------------
  // Add version item — POST directly; ASC returns error if already attached
  // -------------------------------------------------------------------------
  console.log('3. Attaching App Store version to submission...');
  try {
    await req('POST', '/reviewSubmissionItems', {
      data: {
        type: 'reviewSubmissionItems',
        relationships: {
          reviewSubmission: { data: { type: 'reviewSubmissions', id: submissionId } },
          appStoreVersion:  { data: { type: 'appStoreVersions',  id: VERSION_ID  } },
        },
      },
    });
    console.log('   Version item added.');
  } catch (err) {
    // ENTITY_ALREADY_EXISTS or similar — treat as already attached
    if (err.message.includes('409') || err.message.includes('ENTITY_ALREADY_EXISTS') || err.message.includes('already')) {
      console.log('   Version item already attached (skipping).');
    } else {
      throw err;
    }
  }

  // -------------------------------------------------------------------------
  // Submit for review
  // -------------------------------------------------------------------------
  console.log('4. Submitting for review...');
  await req('POST', `/reviewSubmissions/${submissionId}/actions/submit`);
  console.log('\n✅ Successfully submitted FlowerSandbox v1.0.2 for App Review!');
  console.log(`   Submission ID: ${submissionId}`);
  console.log(`   View in ASC: https://appstoreconnect.apple.com/apps/${APP_ID}/appstore/ios`);
})().catch((err) => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
