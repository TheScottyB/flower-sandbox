# `@thescottyb/eas-app-store-kit` Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use @superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship `@thescottyb/eas-app-store-kit` v0.1.0 — a private-npm ESM Node CLI + JS API that consolidates App Store submission automation from `flower-sandbox`, `Creative-Writing-Interface`, and `~/.gemini/.../take-expo-to-appstore-skill/` — and migrate both consumer repos to use it.

**Architecture:** New standalone Git repo at `~/code/eas-app-store-kit/` with pure-ESM JavaScript + JSDoc types (no build step). Module boundaries match the design doc's `src/` layout. Tests use Node's built-in `node:test` runner (no Jest dep) — minimal overhead for a CLI tool. Apple ASC API calls are TDD'd via a mock `fetch` to verify retry, redaction, idempotency, and JWT shape. EAS Build is invoked via `spawn` (not tested; carried verbatim from flower-sandbox). Per-resource modules (version, build, submission, screenshots, etc.) get unit tests for their request shape and skeleton integration tests guarded behind real ASC env vars.

**Tech Stack:** Node 22+, pure ESM JS, `node:test`, `node:util#parseArgs`, native `fetch`, `node:crypto` (ES256 JWT). One dev dependency only: `@types/node` for editor IntelliSense over JSDoc. No bundler, no Jest, no inquirer.

**Design doc:** `flower-sandbox/docs/plans/2026-05-22-app-submission-extraction-design.md`

**Source repos** (paths used throughout):
- New kit: `~/code/eas-app-store-kit/`
- Consumer 1: `~/workspace/flower-sandbox/`
- Consumer 2: `~/antigravity/Creative-Writing-Interface/`
- Legacy reference (will be archived): `~/.gemini/antigravity/scratch/take-expo-to-appstore-skill/`

**Skill references:**
- @superpowers:test-driven-development for the helper + client modules (Tasks 3–6)
- @superpowers:verification-before-completion before declaring each consumer migration done (Tasks 15, 16)

---

## Pre-flight (one-time)

Confirm prerequisites before starting:

```bash
node --version              # >= 22.13.0
pnpm --version              # >= 11
ls ~/workspace/flower-sandbox/scripts/app-store-submit-review.mjs    # exists
ls ~/.gemini/antigravity/scratch/take-expo-to-appstore-skill/        # 6 files present
ls ~/antigravity/Creative-Writing-Interface/scripts/                  # 6 cjs files
```

If any path is missing, stop and ask the user. The plan assumes all three sources exist as documented in the design doc.

---

## Phase A — Scaffold the new repo (Tasks 1–2)

### Task 1: Create the repo + initial scaffolding

**Files:**
- Create: `~/code/eas-app-store-kit/` (new directory)
- Create: `~/code/eas-app-store-kit/package.json`
- Create: `~/code/eas-app-store-kit/.gitignore`
- Create: `~/code/eas-app-store-kit/.npmrc` (only if you want pnpm-specific defaults; otherwise skip)
- Create: `~/code/eas-app-store-kit/LICENSE` (MIT)
- Create: `~/code/eas-app-store-kit/README.md` (initial stub; expanded in Task 14)

**Step 1: Create the directory and init git**

```bash
mkdir -p ~/code/eas-app-store-kit
cd ~/code/eas-app-store-kit
git init -b main
```

**Step 2: Write `package.json`**

Create `~/code/eas-app-store-kit/package.json`:

```json
{
  "name": "@thescottyb/eas-app-store-kit",
  "version": "0.1.0-dev",
  "description": "EAS-friendly App Store submission automation for Expo iOS projects",
  "type": "module",
  "main": "src/index.mjs",
  "types": "src/types.d.ts",
  "bin": { "app-store-kit": "bin/app-store-kit.mjs" },
  "exports": {
    ".": "./src/index.mjs",
    "./asc-client": "./src/asc-client.mjs",
    "./config": "./src/config.mjs"
  },
  "engines": { "node": ">=22.13.0" },
  "files": ["bin/", "src/", "templates/", "README.md", "LICENSE"],
  "publishConfig": { "access": "restricted" },
  "scripts": {
    "test": "node --test test/",
    "typecheck": "tsc --noEmit",
    "lint": "node --check bin/app-store-kit.mjs && for f in src/**/*.mjs; do node --check \"$f\"; done"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.7.0"
  },
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+ssh://git@github.com/TheScottyB/eas-app-store-kit.git"
  }
}
```

**Step 3: Write `.gitignore`**

```
node_modules/
*.log
.DS_Store
.env
.env.local
*.tgz
/coverage
/.nyc_output
```

**Step 4: Write `tsconfig.json` (for `tsc --noEmit` JSDoc checking)**

Create `~/code/eas-app-store-kit/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "allowJs": true,
    "checkJs": true,
    "noEmit": true,
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "esModuleInterop": true
  },
  "include": ["src/**/*", "bin/**/*", "test/**/*"]
}
```

**Step 5: Write `LICENSE`** (standard MIT — substitute your name)

**Step 6: Write minimal `README.md` (expanded in Task 14)**

```markdown
# @thescottyb/eas-app-store-kit

EAS-friendly App Store submission automation for Expo iOS projects.

Status: under construction. See [docs/plans/](docs/plans/) if/when this gets documented.

## Quickstart

```bash
pnpm add -D @thescottyb/eas-app-store-kit
pnpm exec app-store-kit doctor
pnpm exec app-store-kit submit --dry-run
```

See `app-store-kit help` for subcommand reference.
```

**Step 7: Install dev deps and commit**

```bash
cd ~/code/eas-app-store-kit
pnpm install
git add .
git commit -m "feat: scaffold @thescottyb/eas-app-store-kit"
```

**Expected:** `node --test test/` reports "no test files" (test dir doesn't exist yet — that's fine). `tsc --noEmit` exits 0 (no source files yet).

---

### Task 2: Create the src/ + test/ + templates/ skeleton

**Files:**
- Create: `~/code/eas-app-store-kit/src/index.mjs` (empty named exports)
- Create: `~/code/eas-app-store-kit/src/types.d.ts` (stub)
- Create: `~/code/eas-app-store-kit/src/helpers/` (dir)
- Create: `~/code/eas-app-store-kit/test/` (dir)
- Create: `~/code/eas-app-store-kit/templates/app-store-config.json` (copy from gemini-generic with redacted credentials)
- Create: `~/code/eas-app-store-kit/bin/app-store-kit.mjs` (stub that prints "not implemented yet")

**Step 1: Write the empty index**

`~/code/eas-app-store-kit/src/index.mjs`:

```js
// Public JS API. Re-exports populated as modules land.
export {};
```

**Step 2: Write the type-declaration stub**

`~/code/eas-app-store-kit/src/types.d.ts`:

```ts
// Hand-written ambient types for @thescottyb/eas-app-store-kit's JS API.
// Populated as modules land.

export interface Config {
  appId: string;
  bundleIdentifier: string;
  versionString: string;
  appName: string;
  keyId: string;
  issuerId: string;
  privateKey: string | object;
  privateKeyPath?: string;
  runLocalChecks: boolean;
  skipEasUpload: boolean;
  submitReview: boolean;
  dryRun: boolean;
  allowFirstIapUnattached: boolean;
  waitProcessingMinutes: number;
  pollIntervalSeconds: number;
  releaseType: 'AFTER_APPROVAL' | 'MANUAL' | 'SCHEDULED';
  ascBuildId?: string;
  projectRoot: string;
  // Optional blocks — schemas added in their respective tasks
  reviewDetails?: object;
  ageRatingDeclarations?: object;
  localization?: object;
  screenshots?: object[];
  screenshotsCapture?: object;
  eas?: object;
}
```

**Step 3: Copy the config template (redact credentials)**

```bash
cp ~/.gemini/antigravity/scratch/take-expo-to-appstore-skill/app-store-config.json \
   ~/code/eas-app-store-kit/templates/app-store-config.json
```

Then edit the file: replace `appId`, `keyId`, `privateKeyPath`, and any other real values with placeholders like `YOUR_APP_ID`, `YOUR_KEY_ID`, `/path/to/AuthKey_KEYID.p8`. Keep the schema shape.

**Step 4: Write the CLI stub**

`~/code/eas-app-store-kit/bin/app-store-kit.mjs`:

```js
#!/usr/bin/env node
console.error('app-store-kit: subcommand dispatch not yet implemented (Task 13).');
console.error('Run with --help once Task 13 lands.');
process.exit(2);
```

Make it executable:

```bash
chmod +x ~/code/eas-app-store-kit/bin/app-store-kit.mjs
```

**Step 5: Verify**

```bash
cd ~/code/eas-app-store-kit
pnpm run lint        # all .mjs files parse
pnpm run typecheck   # exit 0
pnpm run test        # "no test files" — fine
```

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: scaffold src/ + bin/ + templates/ skeletons"
```

---

## Phase B — Helper modules (Tasks 3–4, TDD)

Use @superpowers:test-driven-development for these. Each helper has a small, pure surface area that's easy to test.

### Task 3: `src/helpers/jwt.mjs` + `src/helpers/redact.mjs`

**Files:**
- Create: `~/code/eas-app-store-kit/src/helpers/jwt.mjs`
- Create: `~/code/eas-app-store-kit/src/helpers/redact.mjs`
- Create: `~/code/eas-app-store-kit/test/jwt.test.mjs`
- Create: `~/code/eas-app-store-kit/test/redact.test.mjs`

**Step 1: Write the failing redact test**

`test/redact.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redactSensitive, REDACTED_KEYS } from '../src/helpers/redact.mjs';

test('redacts known-sensitive keys recursively', () => {
  const input = {
    data: {
      attributes: {
        contactFirstName: 'Scott',
        contactEmail: 'a@b.com',
        demoAccountPassword: 'sup3rsecret',
        notes: 'safe',
      },
    },
  };
  const out = redactSensitive(input);
  assert.equal(out.data.attributes.contactEmail, '[REDACTED]');
  assert.equal(out.data.attributes.demoAccountPassword, '[REDACTED]');
  assert.equal(out.data.attributes.contactFirstName, 'Scott');
  assert.equal(out.data.attributes.notes, 'safe');
});

test('preserves null and undefined sensitive values', () => {
  const out = redactSensitive({ contactEmail: null, demoAccountPassword: '' });
  assert.equal(out.contactEmail, null);
  assert.equal(out.demoAccountPassword, '');
});

test('exposes REDACTED_KEYS as a Set', () => {
  assert.ok(REDACTED_KEYS instanceof Set);
  assert.ok(REDACTED_KEYS.has('demoAccountPassword'));
});
```

**Step 2: Run test to verify it fails**

```bash
cd ~/code/eas-app-store-kit
pnpm test
```

Expected: FAIL with `Cannot find module '../src/helpers/redact.mjs'`.

**Step 3: Implement `src/helpers/redact.mjs`**

```js
export const REDACTED_KEYS = new Set([
  'demoAccountPassword',
  'demoAccountName',
  'contactEmail',
  'contactPhone',
]);

/**
 * Recursively replace sensitive values with '[REDACTED]'.
 * Empty strings and null/undefined are left as-is so callers can
 * distinguish "had a value, redacted" from "no value present".
 *
 * @template T
 * @param {T} value
 * @returns {T}
 */
export function redactSensitive(value) {
  if (Array.isArray(value)) {
    return /** @type {T} */ (value.map(redactSensitive));
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = REDACTED_KEYS.has(k) && v != null && v !== '' ? '[REDACTED]' : redactSensitive(v);
    }
    return /** @type {T} */ (out);
  }
  return value;
}
```

**Step 4: Run test to verify it passes**

```bash
pnpm test
```

Expected: all 3 redact tests pass.

**Step 5: Write the failing JWT test**

`test/jwt.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPrivateKey, generateKeyPairSync } from 'node:crypto';
import { signES256Jwt } from '../src/helpers/jwt.mjs';

test('signES256Jwt produces a three-part dot-delimited token', () => {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const token = signES256Jwt({
    keyId: 'TESTKEY',
    issuerId: 'TESTISSUER',
    privateKey,
    audience: 'appstoreconnect-v1',
    ttlSeconds: 1200,
  });
  const parts = token.split('.');
  assert.equal(parts.length, 3);
  // base64url has no +, /, or = padding
  for (const p of parts) {
    assert.match(p, /^[A-Za-z0-9_-]+$/);
  }
});

test('signES256Jwt header uses ES256 and includes kid', () => {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const token = signES256Jwt({
    keyId: 'TESTKEY',
    issuerId: 'TESTISSUER',
    privateKey,
    audience: 'appstoreconnect-v1',
    ttlSeconds: 1200,
  });
  const header = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString());
  assert.equal(header.alg, 'ES256');
  assert.equal(header.kid, 'TESTKEY');
  assert.equal(header.typ, 'JWT');
});

test('signES256Jwt payload has iss, aud, iat, exp', () => {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const before = Math.floor(Date.now() / 1000);
  const token = signES256Jwt({
    keyId: 'TESTKEY',
    issuerId: 'TESTISSUER',
    privateKey,
    audience: 'appstoreconnect-v1',
    ttlSeconds: 1200,
  });
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
  assert.equal(payload.iss, 'TESTISSUER');
  assert.equal(payload.aud, 'appstoreconnect-v1');
  assert.ok(payload.iat >= before);
  assert.equal(payload.exp - payload.iat, 1200);
});
```

**Step 6: Run test to verify it fails**

Expected: FAIL with `Cannot find module '../src/helpers/jwt.mjs'`.

**Step 7: Implement `src/helpers/jwt.mjs`**

```js
import { sign as signJwt } from 'node:crypto';

/**
 * Encode a Buffer or string as base64url (RFC 4648 §5).
 * @param {Buffer|string} value
 * @returns {string}
 */
function base64Url(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

/**
 * JSON-encode then base64url-encode.
 * @param {object} value
 * @returns {string}
 */
function base64UrlJson(value) {
  return base64Url(Buffer.from(JSON.stringify(value)));
}

/**
 * Sign an ES256 JWT with Apple App Store Connect's expected shape:
 * header.kid, payload.iss/iat/exp/aud, signature in IEEE P-1363 format
 * (not DER — Apple rejects DER even though it's Node's default).
 *
 * @param {object} opts
 * @param {string} opts.keyId
 * @param {string} opts.issuerId
 * @param {string | import('node:crypto').KeyObject} opts.privateKey
 * @param {string} opts.audience
 * @param {number} opts.ttlSeconds
 * @returns {string}
 */
export function signES256Jwt({ keyId, issuerId, privateKey, audience, ttlSeconds }) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'ES256', kid: keyId, typ: 'JWT' };
  const payload = { iss: issuerId, iat: now, exp: now + ttlSeconds, aud: audience };
  const input = `${base64UrlJson(header)}.${base64UrlJson(payload)}`;
  const signature = signJwt('sha256', Buffer.from(input), {
    key: privateKey,
    dsaEncoding: 'ieee-p1363',
  });
  return `${input}.${base64Url(signature)}`;
}
```

**Step 8: Run tests; both pass**

```bash
pnpm test
```

Expected: 6 tests passing (3 redact + 3 jwt).

**Step 9: Commit**

```bash
git add -A
git commit -m "feat(helpers): jwt + redact with TDD"
```

---

### Task 4: `src/helpers/retry.mjs` + `src/helpers/env.mjs`

**Files:**
- Create: `~/code/eas-app-store-kit/src/helpers/retry.mjs`
- Create: `~/code/eas-app-store-kit/src/helpers/env.mjs`
- Create: `~/code/eas-app-store-kit/test/retry.test.mjs`
- Create: `~/code/eas-app-store-kit/test/env.test.mjs`

**Step 1: Write the failing retry test**

`test/retry.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { retryWithBackoff, computeBackoffMs } from '../src/helpers/retry.mjs';

test('retryWithBackoff returns the first successful attempt', async () => {
  let attempts = 0;
  const result = await retryWithBackoff(async () => {
    attempts++;
    return 'ok';
  }, { maxAttempts: 3, shouldRetry: () => false, sleep: () => {} });
  assert.equal(attempts, 1);
  assert.equal(result, 'ok');
});

test('retryWithBackoff retries until success', async () => {
  let attempts = 0;
  const result = await retryWithBackoff(async () => {
    attempts++;
    if (attempts < 3) throw new Error('transient');
    return 'ok';
  }, { maxAttempts: 4, shouldRetry: () => true, sleep: () => {} });
  assert.equal(attempts, 3);
  assert.equal(result, 'ok');
});

test('retryWithBackoff throws after exhaustion', async () => {
  let attempts = 0;
  await assert.rejects(
    retryWithBackoff(async () => {
      attempts++;
      throw new Error('persistent');
    }, { maxAttempts: 3, shouldRetry: () => true, sleep: () => {} }),
    /persistent/,
  );
  assert.equal(attempts, 3);
});

test('retryWithBackoff calls shouldRetry with the error', async () => {
  let observed = null;
  await assert.rejects(retryWithBackoff(async () => {
    throw new Error('boom');
  }, {
    maxAttempts: 2,
    shouldRetry: (err) => { observed = err; return false; },
    sleep: () => {},
  }), /boom/);
  assert.match(observed.message, /boom/);
});

test('computeBackoffMs is exponential with jitter', () => {
  // attempt=1 → base * 1 = 500, plus 0–250 jitter
  for (let i = 0; i < 10; i++) {
    const d = computeBackoffMs(1);
    assert.ok(d >= 500 && d < 750, `attempt=1 delay ${d} not in [500, 750)`);
  }
  for (let i = 0; i < 10; i++) {
    const d = computeBackoffMs(2);
    assert.ok(d >= 1000 && d < 1250);
  }
});
```

**Step 2: Run test, verify fail**

Expected: FAIL — module not found.

**Step 3: Implement `src/helpers/retry.mjs`**

```js
/**
 * Compute exponential backoff delay in ms with jitter.
 * @param {number} attempt - 1-indexed attempt number
 * @param {number} [baseMs=500]
 * @param {number} [jitterMs=250]
 * @returns {number}
 */
export function computeBackoffMs(attempt, baseMs = 500, jitterMs = 250) {
  return baseMs * 2 ** (attempt - 1) + Math.random() * jitterMs;
}

/**
 * Default sleep impl; injectable for tests.
 * @param {number} ms
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry an async function with exponential backoff.
 *
 * @template T
 * @param {() => Promise<T>} fn
 * @param {object} opts
 * @param {number} opts.maxAttempts
 * @param {(err: unknown) => boolean} opts.shouldRetry  - called only on error
 * @param {(ms: number) => Promise<void> | void} [opts.sleep]
 * @param {(msg: string) => void} [opts.log]
 * @returns {Promise<T>}
 */
export async function retryWithBackoff(fn, { maxAttempts, shouldRetry, sleep: sleepFn = sleep, log }) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === maxAttempts || !shouldRetry(err)) throw err;
      const delay = computeBackoffMs(attempt);
      if (log) log(`retry ${attempt}/${maxAttempts - 1}: ${err.message} (waiting ${Math.round(delay)}ms)`);
      await sleepFn(delay);
    }
  }
  throw lastError;
}
```

**Step 4: Write the failing env test**

`test/env.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { envBool, envString, envNumber, requireEnv } from '../src/helpers/env.mjs';

test('envBool parses truthy values', () => {
  for (const v of ['1', 'true', 'yes', 'on', 'TRUE', 'YES']) {
    assert.equal(envBool({ X: v }, 'X'), true, `expected ${v} → true`);
  }
});

test('envBool defaults to false on falsy / missing', () => {
  for (const v of ['', '0', 'false', 'no', 'off', undefined]) {
    assert.equal(envBool({ X: v }, 'X'), false);
  }
});

test('envString returns value or undefined', () => {
  assert.equal(envString({ X: 'hello' }, 'X'), 'hello');
  assert.equal(envString({}, 'X'), undefined);
  assert.equal(envString({ X: '' }, 'X'), undefined); // empty treated as missing
});

test('envNumber parses or returns fallback', () => {
  assert.equal(envNumber({ X: '42' }, 'X', 7), 42);
  assert.equal(envNumber({}, 'X', 7), 7);
  assert.equal(envNumber({ X: 'abc' }, 'X', 7), 7); // unparseable → fallback
});

test('requireEnv returns value or throws', () => {
  assert.equal(requireEnv({ X: 'hello' }, 'X'), 'hello');
  assert.throws(() => requireEnv({}, 'X'), /X is required/);
});
```

**Step 5: Run test, verify fail**

Expected: FAIL — module not found.

**Step 6: Implement `src/helpers/env.mjs`**

```js
const TRUTHY = new Set(['1', 'true', 'yes', 'on']);

/** @param {NodeJS.ProcessEnv|Record<string,string|undefined>} env, name @returns {boolean} */
export function envBool(env, name) {
  const v = env[name];
  if (!v) return false;
  return TRUTHY.has(String(v).toLowerCase());
}

/** @returns {string|undefined} */
export function envString(env, name) {
  const v = env[name];
  return v ? String(v) : undefined;
}

/** @returns {number} */
export function envNumber(env, name, fallback) {
  const v = env[name];
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** @returns {string} @throws {Error} if missing */
export function requireEnv(env, name) {
  const v = env[name];
  if (!v) throw new Error(`${name} is required`);
  return String(v);
}
```

**Step 7: Run tests; all 10 pass**

```bash
pnpm test
```

Expected: 10 tests passing.

**Step 8: Commit**

```bash
git add -A
git commit -m "feat(helpers): retry + env with TDD"
```

---

## Phase C — AppStoreConnect client (Task 5, TDD with mock fetch)

### Task 5: `src/asc-client.mjs` + tests

**Files:**
- Create: `~/code/eas-app-store-kit/src/asc-client.mjs`
- Create: `~/code/eas-app-store-kit/test/asc-client.test.mjs`

**Step 1: Write the failing test**

`test/asc-client.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { AppStoreConnectClient, AppStoreConnectError, formatAppleError } from '../src/asc-client.mjs';

function mkClient(opts = {}) {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  return new AppStoreConnectClient({
    keyId: 'K',
    issuerId: 'I',
    privateKey,
    dryRun: false,
    ...opts,
  });
}

test('successful GET returns the parsed body', async () => {
  let receivedUrl, receivedHeaders;
  const fetch = async (url, init) => {
    receivedUrl = url.toString();
    receivedHeaders = init.headers;
    return new Response(JSON.stringify({ data: { id: 'abc', type: 'apps' } }), { status: 200 });
  };
  const client = mkClient({ fetch });
  const out = await client.request('GET', '/apps/abc');
  assert.equal(out.data.id, 'abc');
  assert.ok(receivedUrl.endsWith('/v1/apps/abc'));
  assert.match(receivedHeaders.Authorization, /^Bearer /);
});

test('retries 5xx up to 4 times then throws', async () => {
  let calls = 0;
  const fetch = async () => {
    calls++;
    return new Response('{"errors":[{"code":"503","title":"Service Unavailable"}]}', { status: 503 });
  };
  const client = mkClient({ fetch, sleep: () => {} });
  await assert.rejects(client.request('GET', '/apps/abc'), AppStoreConnectError);
  assert.equal(calls, 4);
});

test('does not retry 4xx', async () => {
  let calls = 0;
  const fetch = async () => {
    calls++;
    return new Response('{"errors":[{"code":"401","title":"Unauthorized"}]}', { status: 401 });
  };
  const client = mkClient({ fetch, sleep: () => {} });
  await assert.rejects(client.request('GET', '/apps/abc'), AppStoreConnectError);
  assert.equal(calls, 1);
});

test('dry-run gates POST but lets GET through', async () => {
  let getCalls = 0, postCalls = 0;
  const fetch = async (url, init) => {
    if (init.method === 'POST') postCalls++;
    else getCalls++;
    return new Response('{"data":{"id":"x"}}', { status: 200 });
  };
  const client = mkClient({ fetch, dryRun: true });
  const getOut = await client.request('GET', '/apps/abc');
  assert.equal(getOut.data.id, 'x');
  const postOut = await client.request('POST', '/apps', { body: { data: { type: 'apps' } } });
  assert.match(postOut.data.id, /^dry-run-/);
  assert.equal(getCalls, 1);
  assert.equal(postCalls, 0);
});

test('formatAppleError redacts sensitive keys when echoed', () => {
  const err = formatAppleError({
    raw: undefined,
    extra: { demoAccountPassword: 'sup3r', contactEmail: 'a@b.com' },
  });
  assert.match(err, /\[REDACTED\]/);
  assert.doesNotMatch(err, /sup3r/);
  assert.doesNotMatch(err, /a@b\.com/);
});
```

**Step 2: Run test, verify fail**

Expected: FAIL — module not found.

**Step 3: Implement `src/asc-client.mjs`**

```js
import { signES256Jwt } from './helpers/jwt.mjs';
import { redactSensitive } from './helpers/redact.mjs';
import { retryWithBackoff } from './helpers/retry.mjs';

const ASC_BASE_URL = 'https://api.appstoreconnect.apple.com/v1';
const DEFAULT_TIMEOUT_MS = 30000;

export class AppStoreConnectError extends Error {
  /**
   * @param {string} message
   * @param {number} status
   * @param {unknown} payload
   */
  constructor(message, status, payload) {
    super(message);
    this.name = 'AppStoreConnectError';
    this.status = status;
    this.payload = payload;
  }
}

export function formatAppleError(payload) {
  if (Array.isArray(payload?.errors)) {
    return payload.errors
      .map((error) => {
        const parts = [error.code, error.title, error.detail];
        if (error.meta?.associatedErrors) parts.push(`Associated: ${JSON.stringify(error.meta.associatedErrors)}`);
        else if (error.meta) parts.push(`Meta: ${JSON.stringify(error.meta)}`);
        return parts.filter(Boolean).join(' - ');
      })
      .join('; ');
  }
  return payload?.raw ?? JSON.stringify(redactSensitive(payload));
}

function safeJson(text) {
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

export class AppStoreConnectClient {
  /**
   * @param {object} opts
   * @param {string} opts.keyId
   * @param {string} opts.issuerId
   * @param {string|import('node:crypto').KeyObject} opts.privateKey
   * @param {boolean} [opts.dryRun]
   * @param {typeof globalThis.fetch} [opts.fetch]
   * @param {(ms: number) => Promise<void> | void} [opts.sleep]
   * @param {(msg: string) => void} [opts.log]
   */
  constructor({ keyId, issuerId, privateKey, dryRun = false, fetch: fetchImpl = globalThis.fetch, sleep, log }) {
    this.keyId = keyId;
    this.issuerId = issuerId;
    this.privateKey = privateKey;
    this.dryRun = dryRun;
    this.fetch = fetchImpl;
    this.sleep = sleep;
    this.log = log;
  }

  token() {
    return signES256Jwt({
      keyId: this.keyId,
      issuerId: this.issuerId,
      privateKey: this.privateKey,
      audience: 'appstoreconnect-v1',
      ttlSeconds: 20 * 60,
    });
  }

  /**
   * Issue an ASC API request. Retries 5xx and network errors. 4xx surface immediately.
   * @param {'GET'|'POST'|'PATCH'|'DELETE'} method
   * @param {string} path - relative to /v1
   * @param {object} [opts]
   * @param {object} [opts.query]
   * @param {object} [opts.body]
   */
  async request(method, path, { query, body } = {}) {
    const url = new URL(`${ASC_BASE_URL}${path}`);
    for (const [k, v] of Object.entries(query ?? {})) {
      if (v === undefined || v === null || v === '') continue;
      url.searchParams.set(k, String(v));
    }

    if (this.dryRun && method !== 'GET') {
      if (this.log) this.log(`[dry-run] ${method} ${url.toString()}`);
      return {
        data: {
          id: `dry-run-${body?.data?.type ?? 'resource'}`,
          type: body?.data?.type ?? 'dryRunResources',
          attributes: {},
        },
      };
    }

    const sleepOpts = this.sleep ? { sleep: this.sleep } : {};
    return retryWithBackoff(async () => {
      let response;
      try {
        response = await this.fetch(url, {
          method,
          headers: {
            Authorization: `Bearer ${this.token()}`,
            'Content-Type': 'application/json',
          },
          body: body ? JSON.stringify(body) : undefined,
        });
      } catch (err) {
        // Re-throw network errors as-is so retry can decide.
        throw err;
      }
      const text = await response.text();
      const payload = text ? safeJson(text) : {};
      if (response.ok) return payload;
      throw new AppStoreConnectError(
        `${method} ${path} failed with ${response.status}: ${formatAppleError(payload)}`,
        response.status,
        payload,
      );
    }, {
      maxAttempts: 4,
      log: this.log,
      ...sleepOpts,
      shouldRetry: (err) => {
        if (err instanceof AppStoreConnectError) return err.status >= 500;
        // Network-level failure: retry
        return true;
      },
    });
  }
}
```

**Step 4: Run tests; all 5 ASC client tests pass**

```bash
pnpm test
```

Expected: all (5 ASC + 6 JWT/redact + 9 retry/env = 20) tests pass.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat(asc-client): client with retry + dry-run + redaction"
```

---

## Phase D — Configuration loader (Task 6, TDD)

### Task 6: `src/config.mjs` + tests

**Files:**
- Create: `~/code/eas-app-store-kit/src/config.mjs`
- Create: `~/code/eas-app-store-kit/test/config.test.mjs`

**Step 1: Write the failing test**

`test/config.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../src/config.mjs';

function makeFixture(files) {
  const dir = mkdtempSync(join(tmpdir(), 'kit-config-'));
  for (const [name, data] of Object.entries(files)) {
    writeFileSync(join(dir, name), typeof data === 'string' ? data : JSON.stringify(data));
  }
  return dir;
}

test('precedence: flag > env > config-json > app.json > defaults', async () => {
  const dir = makeFixture({
    'app.json': { expo: { name: 'AppName', version: '1.0.0', ios: { bundleIdentifier: 'com.x.y' } } },
    'eas.json': { submit: { production: { ios: { ascAppId: 'FROM_EAS' } } } },
    'app-store-config.json': { appId: 'FROM_CONFIG_JSON', versionString: '2.0.0' },
  });
  const cfg = await loadConfig({
    projectRoot: dir,
    argv: ['--app-id=FROM_FLAG'],
    env: { APP_STORE_CONNECT_APP_ID: 'FROM_ENV' },
  });
  assert.equal(cfg.appId, 'FROM_FLAG');
  assert.equal(cfg.versionString, '2.0.0'); // from config json
  assert.equal(cfg.bundleIdentifier, 'com.x.y'); // from app.json
});

test('lean mode (no config file)', async () => {
  const dir = makeFixture({
    'app.json': { expo: { name: 'Lean', version: '1.0.0', ios: { bundleIdentifier: 'com.lean.app' } } },
    'eas.json': { submit: { production: { ios: { ascAppId: 'LEAN_ID' } } } },
  });
  const cfg = await loadConfig({ projectRoot: dir, argv: [], env: {} });
  assert.equal(cfg.appId, 'LEAN_ID');
  assert.equal(cfg.versionString, '1.0.0');
  assert.equal(cfg.bundleIdentifier, 'com.lean.app');
});

test('built-in defaults for flow control', async () => {
  const dir = makeFixture({
    'app.json': { expo: { name: 'X', version: '1.0.0', ios: { bundleIdentifier: 'com.x' } } },
    'eas.json': { submit: { production: { ios: { ascAppId: 'X' } } } },
  });
  const cfg = await loadConfig({ projectRoot: dir, argv: [], env: {} });
  assert.equal(cfg.waitProcessingMinutes, 45);
  assert.equal(cfg.pollIntervalSeconds, 60);
  assert.equal(cfg.releaseType, 'AFTER_APPROVAL');
  assert.equal(cfg.dryRun, false);
  assert.equal(cfg.runLocalChecks, true);
  assert.equal(cfg.submitReview, true);
});

test('skip-* flags flip flow control', async () => {
  const dir = makeFixture({
    'app.json': { expo: { name: 'X', version: '1.0.0', ios: { bundleIdentifier: 'com.x' } } },
    'eas.json': { submit: { production: { ios: { ascAppId: 'X' } } } },
  });
  const cfg = await loadConfig({
    projectRoot: dir,
    argv: ['--skip-eas-upload', '--skip-local-checks', '--skip-review-submit', '--dry-run'],
    env: {},
  });
  assert.equal(cfg.skipEasUpload, true);
  assert.equal(cfg.runLocalChecks, false);
  assert.equal(cfg.submitReview, false);
  assert.equal(cfg.dryRun, true);
});
```

**Step 2: Run test, verify fail**

Expected: FAIL — module not found.

**Step 3: Implement `src/config.mjs`**

```js
import { readFile, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { envBool, envString, envNumber } from './helpers/env.mjs';

const KNOWN_FLAGS = {
  // strings
  'app-id': { type: 'string' },
  'version': { type: 'string' },
  'asc-build-id': { type: 'string' },
  'release-type': { type: 'string' },
  'config': { type: 'string' },
  'wait-processing-minutes': { type: 'string' },
  'poll-interval-seconds': { type: 'string' },
  // booleans
  'skip-eas-upload': { type: 'boolean' },
  'skip-review-submit': { type: 'boolean' },
  'skip-local-checks': { type: 'boolean' },
  'skip-screenshots': { type: 'boolean' },
  'skip-metadata': { type: 'boolean' },
  'resume': { type: 'boolean' },
  'dry-run': { type: 'boolean' },
  'allow-first-iap-unattached': { type: 'boolean' },
  'verbose': { type: 'boolean' },
  'quiet': { type: 'boolean' },
  'no-color': { type: 'boolean' },
  'help': { type: 'boolean' },
  'json': { type: 'boolean' },
  'force': { type: 'boolean' },
};

async function readJsonIfExists(path) {
  try {
    await access(path);
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return null;
  }
}

async function discoverConfigFile({ projectRoot, argv, env }) {
  const { values } = parseArgs({ args: argv, options: KNOWN_FLAGS, strict: false, allowPositionals: true });
  if (values.config) return resolve(values.config);
  if (env.APP_STORE_CONFIG_PATH) return resolve(env.APP_STORE_CONFIG_PATH);
  for (const candidate of ['app-store-config.json', '.app-store-config.json']) {
    const p = join(projectRoot, candidate);
    if (await readJsonIfExists(p)) return p;
  }
  return null;
}

/**
 * @param {object} opts
 * @param {string} opts.projectRoot
 * @param {string[]} opts.argv  - argv slice (no node, no script path)
 * @param {NodeJS.ProcessEnv|Record<string,string|undefined>} opts.env
 * @returns {Promise<import('./types.d.ts').Config>}
 */
export async function loadConfig({ projectRoot, argv, env }) {
  const { values: flags } = parseArgs({ args: argv, options: KNOWN_FLAGS, strict: false, allowPositionals: true });

  const appJson = await readJsonIfExists(join(projectRoot, 'app.json'));
  const easJson = await readJsonIfExists(join(projectRoot, 'eas.json'));

  const configFilePath = await discoverConfigFile({ projectRoot, argv, env });
  const configJson = configFilePath ? await readJsonIfExists(configFilePath) : null;

  const pick = (flag, envKey, configKey, ...fallbacks) => {
    if (flags[flag] !== undefined) return flags[flag];
    if (envKey && env[envKey]) return env[envKey];
    if (configKey && configJson && configJson[configKey] !== undefined) return configJson[configKey];
    for (const f of fallbacks) if (f !== undefined && f !== null) return f;
    return undefined;
  };

  const appId = pick(
    'app-id',
    'APP_STORE_CONNECT_APP_ID',
    'appId',
    easJson?.submit?.production?.ios?.ascAppId,
  );

  const versionString = pick(
    'version',
    'APP_STORE_VERSION',
    'versionString',
    appJson?.expo?.version,
  );

  return {
    appId,
    bundleIdentifier: appJson?.expo?.ios?.bundleIdentifier,
    versionString,
    appName: configJson?.appName ?? appJson?.expo?.name ?? '<unknown>',

    keyId: env.APP_STORE_CONNECT_KEY_ID ?? configJson?.keyId,
    issuerId: env.APP_STORE_CONNECT_ISSUER_ID,
    privateKey: env.APP_STORE_CONNECT_PRIVATE_KEY,
    privateKeyPath: env.APP_STORE_CONNECT_PRIVATE_KEY_PATH ?? configJson?.privateKeyPath,

    runLocalChecks: !flags['skip-local-checks'] && !flags.resume,
    skipEasUpload: !!(flags['skip-eas-upload'] || flags.resume),
    submitReview: !flags['skip-review-submit'],
    dryRun: !!flags['dry-run'],
    allowFirstIapUnattached: !!flags['allow-first-iap-unattached'] || envBool(env, 'APP_STORE_ALLOW_UNATTACHED_FIRST_IAP'),
    waitProcessingMinutes: Number(flags['wait-processing-minutes']) || envNumber(env, 'APP_STORE_WAIT_PROCESSING_MINUTES', 45),
    pollIntervalSeconds: Number(flags['poll-interval-seconds']) || envNumber(env, 'APP_STORE_POLL_INTERVAL_SECONDS', 60),
    releaseType: flags['release-type'] ?? envString(env, 'APP_STORE_RELEASE_TYPE') ?? configJson?.releaseType ?? 'AFTER_APPROVAL',
    ascBuildId: flags['asc-build-id'] ?? envString(env, 'ASC_BUILD_ID'),

    reviewDetails: configJson?.reviewDetails,
    ageRatingDeclarations: configJson?.ageRatingDeclarations,
    localization: configJson?.localization,
    screenshots: configJson?.screenshots,
    screenshotsCapture: configJson?.screenshotsCapture,

    projectRoot,
    eas: easJson,
  };
}
```

**Step 4: Run tests; all 4 config tests pass**

```bash
pnpm test
```

Expected: tests pass.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat(config): precedence-merged loader with TDD"
```

---

## Phase E — Per-resource modules (Tasks 7–11)

These are the App Store Connect resource wrappers. Each takes an `AppStoreConnectClient` + `Config` and exposes async functions. Tests are skinny — verify request shape via a mock fetch, plus one happy-path integration.

### Task 7: `src/version.mjs`

**Files:**
- Create: `~/code/eas-app-store-kit/src/version.mjs`
- Create: `~/code/eas-app-store-kit/test/version.test.mjs`

**Step 1: Write the failing test**

`test/version.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { AppStoreConnectClient } from '../src/asc-client.mjs';
import { findOrCreateVersion, EDITABLE_APP_STORE_STATES } from '../src/version.mjs';

function mkClient(fetchImpl) {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  return new AppStoreConnectClient({ keyId: 'K', issuerId: 'I', privateKey, fetch: fetchImpl });
}

test('reuses an existing version in editable state', async () => {
  let calls = 0;
  const client = mkClient(async (url) => {
    calls++;
    return new Response(JSON.stringify({
      data: [{ id: 'v1', type: 'appStoreVersions', attributes: { versionString: '1.0.0', appStoreState: 'PREPARE_FOR_SUBMISSION' } }],
    }), { status: 200 });
  });
  const v = await findOrCreateVersion(client, { appId: 'A1', versionString: '1.0.0', releaseType: 'AFTER_APPROVAL' });
  assert.equal(v.id, 'v1');
  assert.equal(calls, 1);
});

test('throws when existing version is in a terminal state', async () => {
  const client = mkClient(async () => new Response(JSON.stringify({
    data: [{ id: 'v1', type: 'appStoreVersions', attributes: { versionString: '1.0.0', appStoreState: 'READY_FOR_SALE' } }],
  }), { status: 200 }));
  await assert.rejects(
    findOrCreateVersion(client, { appId: 'A1', versionString: '1.0.0', releaseType: 'AFTER_APPROVAL' }),
    /READY_FOR_SALE/,
  );
});

test('creates a new version when none exists', async () => {
  let postBody;
  const client = mkClient(async (url, init) => {
    if (init.method === 'GET') return new Response(JSON.stringify({ data: [] }), { status: 200 });
    postBody = JSON.parse(init.body);
    return new Response(JSON.stringify({ data: { id: 'v2', type: 'appStoreVersions' } }), { status: 201 });
  });
  const v = await findOrCreateVersion(client, { appId: 'A1', versionString: '1.0.1', releaseType: 'AFTER_APPROVAL' });
  assert.equal(v.id, 'v2');
  assert.equal(postBody.data.type, 'appStoreVersions');
  assert.equal(postBody.data.attributes.versionString, '1.0.1');
  assert.equal(postBody.data.relationships.app.data.id, 'A1');
});

test('EDITABLE_APP_STORE_STATES is a Set with expected members', () => {
  assert.ok(EDITABLE_APP_STORE_STATES.has('PREPARE_FOR_SUBMISSION'));
  assert.ok(EDITABLE_APP_STORE_STATES.has('DEVELOPER_REJECTED'));
  assert.ok(!EDITABLE_APP_STORE_STATES.has('READY_FOR_SALE'));
});
```

**Step 2: Run test, verify fail**

Expected: FAIL.

**Step 3: Implement `src/version.mjs`**

```js
export const EDITABLE_APP_STORE_STATES = new Set([
  'PREPARE_FOR_SUBMISSION',
  'DEVELOPER_REJECTED',
  'REJECTED',
  'METADATA_REJECTED',
  'INVALID_BINARY',
  'DEVELOPER_REMOVED_FROM_SALE',
]);

/**
 * Find an existing iOS App Store version by version string, or create one.
 * Throws if an existing version is in a non-draftable state.
 *
 * @param {import('./asc-client.mjs').AppStoreConnectClient} client
 * @param {object} opts
 * @param {string} opts.appId
 * @param {string} opts.versionString
 * @param {string} opts.releaseType
 */
export async function findOrCreateVersion(client, { appId, versionString, releaseType }) {
  const list = await client.request('GET', `/apps/${appId}/appStoreVersions`, {
    query: {
      'fields[appStoreVersions]': 'platform,versionString,appVersionState,appStoreState,releaseType,createdDate',
      'filter[platform]': 'IOS',
      'filter[versionString]': versionString,
      limit: 1,
    },
  });

  if (list.data?.length) {
    const existing = list.data[0];
    const state = existing.attributes?.appStoreState;
    if (state && !EDITABLE_APP_STORE_STATES.has(state)) {
      throw new Error(
        `App Store version ${versionString} (${existing.id}) is in state ${state}. ` +
        `Cannot attach a new build to a version in this state. ` +
        `Bump expo.version in app.json or move the version back to a draftable state. ` +
        `Editable states: ${[...EDITABLE_APP_STORE_STATES].join(', ')}.`,
      );
    }
    return existing;
  }

  const created = await client.request('POST', '/appStoreVersions', {
    body: {
      data: {
        type: 'appStoreVersions',
        attributes: { platform: 'IOS', versionString, releaseType },
        relationships: { app: { data: { type: 'apps', id: appId } } },
      },
    },
  });
  return created.data;
}

/**
 * List recent versions for the app.
 *
 * @param {import('./asc-client.mjs').AppStoreConnectClient} client
 * @param {string} appId
 * @param {object} [opts]
 */
export async function listVersions(client, appId, { limit = 20 } = {}) {
  const out = await client.request('GET', `/apps/${appId}/appStoreVersions`, {
    query: { 'filter[platform]': 'IOS', limit, sort: '-createdDate' },
  });
  return out.data ?? [];
}
```

**Step 4: Verify tests pass**

```bash
pnpm test
```

**Step 5: Commit**

```bash
git add -A
git commit -m "feat(version): find/create with appStoreState validation"
```

---

### Task 8: `src/build.mjs`

**Files:**
- Create: `~/code/eas-app-store-kit/src/build.mjs`
- Create: `~/code/eas-app-store-kit/test/build.test.mjs`

**Step 1: Write the failing test**

`test/build.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { AppStoreConnectClient } from '../src/asc-client.mjs';
import { findValidBuild, attachBuildToVersion } from '../src/build.mjs';

function mkClient(fetchImpl) {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  return new AppStoreConnectClient({ keyId: 'K', issuerId: 'I', privateKey, fetch: fetchImpl, sleep: () => {} });
}

test('findValidBuild returns the first VALID build', async () => {
  const client = mkClient(async () => new Response(JSON.stringify({
    data: [
      { id: 'b1', type: 'builds', attributes: { processingState: 'VALID', uploadedDate: '2026-05-22T10:00:00Z' } },
    ],
  }), { status: 200 }));
  const build = await findValidBuild(client, { appId: 'A', versionString: '1.0.0', waitProcessingMs: 100, pollIntervalMs: 10 });
  assert.equal(build.id, 'b1');
});

test('findValidBuild bails fast on FAILED state', async () => {
  const client = mkClient(async () => new Response(JSON.stringify({
    data: [{ id: 'b1', attributes: { processingState: 'FAILED' } }],
  }), { status: 200 }));
  await assert.rejects(
    findValidBuild(client, { appId: 'A', versionString: '1.0.0', waitProcessingMs: 1000, pollIntervalMs: 10 }),
    /FAILED/,
  );
});

test('attachBuildToVersion no-ops when already attached', async () => {
  let patchCalls = 0;
  const client = mkClient(async (url, init) => {
    if (init.method === 'GET') {
      return new Response(JSON.stringify({ data: { id: 'b1', type: 'builds' } }), { status: 200 });
    }
    patchCalls++;
    return new Response('{}', { status: 200 });
  });
  await attachBuildToVersion(client, { appStoreVersionId: 'v1', buildId: 'b1' });
  assert.equal(patchCalls, 0);
});

test('attachBuildToVersion patches when not yet attached', async () => {
  let patchCalls = 0;
  const client = mkClient(async (url, init) => {
    if (init.method === 'GET') {
      return new Response(JSON.stringify({ data: { id: 'b-different', type: 'builds' } }), { status: 200 });
    }
    patchCalls++;
    return new Response('{}', { status: 200 });
  });
  await attachBuildToVersion(client, { appStoreVersionId: 'v1', buildId: 'b1' });
  assert.equal(patchCalls, 1);
});
```

**Step 2: Run test, fail expected.**

**Step 3: Implement `src/build.mjs`**

```js
import { AppStoreConnectError } from './asc-client.mjs';

const TERMINAL_BUILD_STATES = new Set(['FAILED', 'INVALID']);
const SUCCESS_BUILD_STATES = new Set(['VALID']);

/**
 * @param {import('./asc-client.mjs').AppStoreConnectClient} client
 * @param {object} opts
 * @param {string} opts.appId
 * @param {string} opts.versionString
 * @param {number} opts.waitProcessingMs
 * @param {number} opts.pollIntervalMs
 */
export async function findValidBuild(client, { appId, versionString, waitProcessingMs, pollIntervalMs }) {
  const deadline = Date.now() + waitProcessingMs;
  while (Date.now() < deadline) {
    const out = await client.request('GET', '/builds', {
      query: {
        'filter[app]': appId,
        'filter[preReleaseVersion.version]': versionString,
        limit: 10,
        sort: '-uploadedDate',
      },
    });
    const builds = out.data ?? [];
    const valid = builds.find((b) => SUCCESS_BUILD_STATES.has(b.attributes?.processingState));
    if (valid) return valid;
    const terminal = builds.find((b) => TERMINAL_BUILD_STATES.has(b.attributes?.processingState));
    if (terminal && !builds.some((b) => b.attributes?.processingState === 'PROCESSING')) {
      throw new Error(`Latest build for version ${versionString} is in state ${terminal.attributes.processingState}: ${terminal.id}`);
    }
    await sleep(pollIntervalMs);
  }
  throw new Error(`Timed out waiting for a VALID build for version ${versionString} after ${waitProcessingMs}ms`);
}

/**
 * Idempotently attach a build to an App Store version. No-ops if already attached.
 *
 * @param {import('./asc-client.mjs').AppStoreConnectClient} client
 * @param {object} opts
 * @param {string} opts.appStoreVersionId
 * @param {string} opts.buildId
 */
export async function attachBuildToVersion(client, { appStoreVersionId, buildId }) {
  let current;
  try {
    current = await client.request('GET', `/appStoreVersions/${appStoreVersionId}/relationships/build`);
  } catch (err) {
    if (!(err instanceof AppStoreConnectError) || err.status !== 404) throw err;
  }
  if (current?.data?.id === buildId) return;
  await client.request('PATCH', `/appStoreVersions/${appStoreVersionId}/relationships/build`, {
    body: { data: { type: 'builds', id: buildId } },
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
```

**Step 4: Tests pass. Commit.**

```bash
pnpm test
git add -A
git commit -m "feat(build): findValidBuild + idempotent attachBuildToVersion"
```

---

### Task 9: `src/review-details.mjs` + `src/submission.mjs`

These two go together because submission depends on review-details being upserted.

**Files:**
- Create: `~/code/eas-app-store-kit/src/review-details.mjs`
- Create: `~/code/eas-app-store-kit/src/submission.mjs`
- Create: `~/code/eas-app-store-kit/test/review-submission.test.mjs`

**Step 1: Write the failing test** (covers both modules — they're co-dependent)

`test/review-submission.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { AppStoreConnectClient } from '../src/asc-client.mjs';
import { ensureReviewDetails } from '../src/review-details.mjs';
import { submitForReview, cancelSubmit } from '../src/submission.mjs';

function mkClient(handler) {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  return new AppStoreConnectClient({ keyId: 'K', issuerId: 'I', privateKey, fetch: handler, sleep: () => {} });
}

test('ensureReviewDetails creates when none exists', async () => {
  let postBody;
  const client = mkClient(async (url, init) => {
    if (init.method === 'GET') {
      return new Response('{"errors":[{"code":"NOT_FOUND"}]}', { status: 404 });
    }
    postBody = JSON.parse(init.body);
    return new Response(JSON.stringify({ data: { id: 'rd1', type: 'appStoreReviewDetails' } }), { status: 201 });
  });
  await ensureReviewDetails(client, 'v1', {
    contactFirstName: 'Scott',
    contactLastName: 'Beilfuss',
    contactEmail: 'a@b.com',
    contactPhone: '+1...',
    notes: 'Test the flow',
  });
  assert.equal(postBody.data.type, 'appStoreReviewDetails');
  assert.equal(postBody.data.attributes.contactFirstName, 'Scott');
});

test('ensureReviewDetails patches when existing and attrs non-empty', async () => {
  let patchBody;
  const client = mkClient(async (url, init) => {
    if (init.method === 'GET') {
      return new Response(JSON.stringify({ data: { id: 'rd1' } }), { status: 200 });
    }
    patchBody = JSON.parse(init.body);
    return new Response('{}', { status: 200 });
  });
  await ensureReviewDetails(client, 'v1', { notes: 'updated' });
  assert.equal(patchBody.data.id, 'rd1');
  assert.equal(patchBody.data.attributes.notes, 'updated');
});

test('ensureReviewDetails skips PATCH when attrs are empty and existing', async () => {
  let mutations = 0;
  const client = mkClient(async (url, init) => {
    if (init.method !== 'GET') mutations++;
    if (init.method === 'GET') return new Response(JSON.stringify({ data: { id: 'rd1' } }), { status: 200 });
    return new Response('{}', { status: 200 });
  });
  await ensureReviewDetails(client, 'v1', {});
  assert.equal(mutations, 0);
});

test('submitForReview short-circuits on already-submitted submission', async () => {
  let mutations = 0;
  const client = mkClient(async (url, init) => {
    if (init.method !== 'GET') mutations++;
    if (url.toString().includes('/reviewSubmissions') && !url.toString().includes('/items')) {
      return new Response(JSON.stringify({
        data: [{ id: 's1', attributes: { state: 'WAITING_FOR_REVIEW' } }],
      }), { status: 200 });
    }
    if (url.toString().includes('/items')) {
      return new Response(JSON.stringify({
        data: [{ id: 'i1', relationships: { appStoreVersion: { data: { id: 'v1' } } } }],
      }), { status: 200 });
    }
    return new Response('{}', { status: 200 });
  });
  const result = await submitForReview(client, { appId: 'A', appStoreVersionId: 'v1' });
  assert.equal(result.alreadySubmitted, true);
  assert.equal(mutations, 0);
});

test('cancelSubmit PATCHes submitted=false', async () => {
  let patchBody;
  const client = mkClient(async (url, init) => {
    if (init.method === 'GET') return new Response(JSON.stringify({ data: { id: 's1' } }), { status: 200 });
    patchBody = JSON.parse(init.body);
    return new Response('{}', { status: 200 });
  });
  await cancelSubmit(client, 's1');
  assert.equal(patchBody.data.attributes.canceled, true);
});
```

**Step 2: Run test, fail expected.**

**Step 3: Implement `src/review-details.mjs`**

```js
import { AppStoreConnectError } from './asc-client.mjs';

const REVIEW_DETAIL_ATTRS = [
  'contactFirstName', 'contactLastName', 'contactEmail', 'contactPhone',
  'demoAccountName', 'demoAccountPassword', 'demoAccountRequired', 'notes',
];

function pickReviewAttrs(input) {
  const out = {};
  for (const k of REVIEW_DETAIL_ATTRS) {
    if (input?.[k] !== undefined && input?.[k] !== '') out[k] = input[k];
  }
  return out;
}

/**
 * Idempotently upsert App Review details on an App Store version.
 *
 * @param {import('./asc-client.mjs').AppStoreConnectClient} client
 * @param {string} appStoreVersionId
 * @param {object} reviewDetails
 */
export async function ensureReviewDetails(client, appStoreVersionId, reviewDetails) {
  const attrs = pickReviewAttrs(reviewDetails);
  let existing;
  try {
    existing = await client.request('GET', `/appStoreVersions/${appStoreVersionId}/appStoreReviewDetail`);
  } catch (err) {
    if (!(err instanceof AppStoreConnectError) || err.status !== 404) throw err;
  }

  if (existing?.data) {
    if (Object.keys(attrs).length === 0) return existing.data;
    return (await client.request('PATCH', `/appStoreReviewDetails/${existing.data.id}`, {
      body: { data: { type: 'appStoreReviewDetails', id: existing.data.id, attributes: attrs } },
    })).data;
  }

  return (await client.request('POST', '/appStoreReviewDetails', {
    body: {
      data: {
        type: 'appStoreReviewDetails',
        attributes: attrs,
        relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: appStoreVersionId } } },
      },
    },
  })).data;
}
```

**Step 4: Implement `src/submission.mjs`**

```js
/**
 * @param {import('./asc-client.mjs').AppStoreConnectClient} client
 * @param {object} opts
 * @param {string} opts.appId
 * @param {string} opts.appStoreVersionId
 */
export async function submitForReview(client, { appId, appStoreVersionId }) {
  // Find any in-flight submission for this app.
  const active = await client.request('GET', '/reviewSubmissions', {
    query: { 'filter[app]': appId, 'filter[state]': 'READY_FOR_REVIEW,WAITING_FOR_REVIEW,IN_REVIEW', limit: 5 },
  });

  for (const submission of active.data ?? []) {
    if (submission.attributes?.state === 'WAITING_FOR_REVIEW' || submission.attributes?.state === 'IN_REVIEW') {
      // Already submitted; check whether it includes our version.
      const items = await client.request('GET', `/reviewSubmissions/${submission.id}/items`);
      const includesUs = items.data?.some((i) => i.relationships?.appStoreVersion?.data?.id === appStoreVersionId);
      if (includesUs) return { id: submission.id, state: submission.attributes.state, alreadySubmitted: true };
    }
  }

  // Find a READY_FOR_REVIEW submission or create one.
  let submission = active.data?.find((s) => s.attributes?.state === 'READY_FOR_REVIEW');
  if (!submission) {
    submission = (await client.request('POST', '/reviewSubmissions', {
      body: { data: { type: 'reviewSubmissions', attributes: { platform: 'IOS' }, relationships: { app: { data: { type: 'apps', id: appId } } } } },
    })).data;
  }

  // Add the version as an item if not already present.
  const items = await client.request('GET', `/reviewSubmissions/${submission.id}/items`);
  const includesUs = items.data?.some((i) => i.relationships?.appStoreVersion?.data?.id === appStoreVersionId);
  if (!includesUs) {
    await client.request('POST', '/reviewSubmissionItems', {
      body: {
        data: {
          type: 'reviewSubmissionItems',
          relationships: {
            reviewSubmission: { data: { type: 'reviewSubmissions', id: submission.id } },
            appStoreVersion: { data: { type: 'appStoreVersions', id: appStoreVersionId } },
          },
        },
      },
    });
  }

  // Final submit.
  const final = await client.request('PATCH', `/reviewSubmissions/${submission.id}`, {
    body: { data: { type: 'reviewSubmissions', id: submission.id, attributes: { submitted: true } } },
  });
  return { id: submission.id, state: final.data?.attributes?.state, alreadySubmitted: false };
}

/**
 * Cancel an in-flight review submission.
 *
 * @param {import('./asc-client.mjs').AppStoreConnectClient} client
 * @param {string} submissionId
 */
export async function cancelSubmit(client, submissionId) {
  await client.request('GET', `/reviewSubmissions/${submissionId}`);
  return client.request('PATCH', `/reviewSubmissions/${submissionId}`, {
    body: { data: { type: 'reviewSubmissions', id: submissionId, attributes: { canceled: true } } },
  });
}
```

**Step 5: Verify + commit**

```bash
pnpm test
git add -A
git commit -m "feat(review): ensureReviewDetails + submit + cancel"
```

---

### Task 10: `src/screenshots.mjs` + `src/age-rating.mjs`

**Files:**
- Create: `~/code/eas-app-store-kit/src/screenshots.mjs` (port from gemini-generic, add retry via the client)
- Create: `~/code/eas-app-store-kit/src/age-rating.mjs` (port from gemini-generic)
- Create: `~/code/eas-app-store-kit/test/screenshots.test.mjs` (request-shape test only — chunked upload is mock-heavy; skip e2e here)

**Strategy:** Port the relevant functions verbatim from `~/.gemini/.../take-expo-to-appstore-skill/app-store-submit-generic.cjs` (the screenshot upload + polling routines) and gemini's age-rating PATCH. Adapt for ES modules + our `AppStoreConnectClient`. The screenshot upload uses Apple's chunked-upload flow (reserve URL → PUT chunks → commit) — that's intricate but well-trodden in gemini's code. Don't reimplement; port carefully.

**Step 1: Read gemini-generic's screenshot upload code**

```bash
sed -n '1,200p' ~/.gemini/antigravity/scratch/take-expo-to-appstore-skill/app-store-submit-generic.cjs | grep -A60 "uploadScreenshot\|pollScreenshots\|appScreenshotSets"
```

Identify the `uploadScreenshot`, `pollScreenshots`, and `appScreenshotSets` orchestration.

**Step 2: Port to ESM as `src/screenshots.mjs`**

Adapt the API to:
- Take an `AppStoreConnectClient` instead of raw fetch
- Take a `Config` with `screenshots: [{displayType, filePath}]`
- Expose `uploadScreenshots(client, { appStoreVersionId, screenshots })`, `pollScreenshots(client, { ids, maxAttempts })`, `deleteScreenshots(client, { appStoreVersionId, displayTypes })`

For the chunked upload, gemini's implementation uses `https.request` directly; we use native `fetch` with a `Uint8Array` body. The Apple-side flow is the same: reserve → upload chunks via the returned `uploadOperations` URLs → commit with `uploaded: true`.

**Step 3: Port age-rating to `src/age-rating.mjs`**

```js
/**
 * Set the age-rating declarations on a version.
 *
 * @param {import('./asc-client.mjs').AppStoreConnectClient} client
 * @param {string} appStoreVersionId
 * @param {object} declarations - the full ASC declarations block
 */
export async function setAgeRatingDeclarations(client, appStoreVersionId, declarations) {
  // ASC route: PATCH /appStoreVersions/{id}/relationships/ageRatingDeclaration
  // gemini-generic has the full block — port it here.
  // ... implementation ...
}
```

Refer to `~/.gemini/.../take-expo-to-appstore-skill/app-store-submit-generic.cjs` for the exact request shape Apple expects.

**Step 4: Tests + commit**

```bash
pnpm test
git add -A
git commit -m "feat(screenshots+age-rating): port gemini-generic resource modules to ESM"
```

---

### Task 11: `src/screenshots-capture.mjs` + `src/eas-runner.mjs`

**Files:**
- Create: `~/code/eas-app-store-kit/src/screenshots-capture.mjs` (port from `capture-screenshots-generic.cjs`)
- Create: `~/code/eas-app-store-kit/src/eas-runner.mjs` (spawn `eas build` with stdio inherit)

**Strategy:** Both modules involve shelling out (xcrun, eas-cli). Hard to unit-test cleanly. Carry verbatim with the smallest possible adaptation.

**Step 1: Port screenshots-capture from gemini-generic**

```bash
cp ~/.gemini/antigravity/scratch/take-expo-to-appstore-skill/capture-screenshots-generic.cjs \
   /tmp/capture-source.cjs
```

Rewrite as ESM:
- Replace `require()` with `import`
- Replace `module.exports` with named `export`
- Use `node:child_process` `execSync` / `spawn` as before
- Take a `ScreenshotsCaptureConfig` (per the design doc) and drive iOS sim

**Step 2: Implement `src/eas-runner.mjs`**

```js
import { spawn } from 'node:child_process';

/**
 * Run `eas build --platform ios --profile production --auto-submit --non-interactive --wait`.
 * Streams stdio to the caller. Resolves on exit code 0; rejects otherwise.
 *
 * @param {object} [opts]
 * @param {string} [opts.profile='production']
 * @param {boolean} [opts.autoSubmit=true]
 * @param {boolean} [opts.dryRun=false]
 */
export async function runEasBuild({ profile = 'production', autoSubmit = true, dryRun = false } = {}) {
  const args = ['exec', 'eas', 'build', '--platform', 'ios', '--profile', profile, '--non-interactive', '--wait'];
  if (autoSubmit) args.push('--auto-submit');
  if (dryRun) {
    console.error(`[dry-run] pnpm ${args.join(' ')}`);
    return;
  }
  await new Promise((resolve, reject) => {
    const child = spawn('pnpm', args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`pnpm exec eas build exited with ${code}`))));
  });
}
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat(screenshots-capture+eas-runner): port simulator drive + spawn eas build"
```

---

## Phase F — Top-level orchestration + CLI (Tasks 12–13)

### Task 12: `src/index.mjs` re-exports + `submit()` orchestrator in `src/submission.mjs`

**Files:**
- Modify: `~/code/eas-app-store-kit/src/index.mjs` (populate named exports)
- Modify: `~/code/eas-app-store-kit/src/submission.mjs` (add `submit()` top-level function that orchestrates the whole flow)

**Step 1: Populate `src/index.mjs`**

```js
export { AppStoreConnectClient, AppStoreConnectError, formatAppleError } from './asc-client.mjs';
export { loadConfig } from './config.mjs';
export { findOrCreateVersion, listVersions, EDITABLE_APP_STORE_STATES } from './version.mjs';
export { findValidBuild, attachBuildToVersion } from './build.mjs';
export { ensureReviewDetails } from './review-details.mjs';
export { submitForReview, cancelSubmit, submit, resumeSubmit } from './submission.mjs';
export { uploadScreenshots, pollScreenshots, deleteScreenshots } from './screenshots.mjs';
export { captureScreenshots } from './screenshots-capture.mjs';
export { setAgeRatingDeclarations } from './age-rating.mjs';
export { runEasBuild } from './eas-runner.mjs';
```

**Step 2: Add `submit()` to `src/submission.mjs`**

Add a top-level `submit(config)` function that walks the whole flow per the design doc §5. It uses every module Phase B–E built. Mirror flower-sandbox's `main()` structure:

```js
export async function submit(config, { log = console.log } = {}) {
  // 1. (optional) local checks
  // 2. (optional) EAS build + upload
  // 3. ASC API: confirm app, find/create version (validates state), poll build, attach
  // 4. (optional) age rating, localization, review details
  // 5. (optional) screenshots upload
  // 6. submit for review
  // Each step is independently skippable via config flags.
}

export async function resumeSubmit(config, opts) {
  return submit({ ...config, runLocalChecks: false, skipEasUpload: true }, opts);
}
```

Copy the corresponding logic from `~/workspace/flower-sandbox/scripts/app-store-submit-review.mjs:main()` and adapt to use the modular client + helpers.

**Step 3: Verify**

```bash
pnpm typecheck
pnpm test
node -e "import('@thescottyb/eas-app-store-kit').then(m => console.log(Object.keys(m)))" 2>/dev/null
```

(The node -e check won't work until the package is locally linked; verify imports parse instead via tsc.)

**Step 4: Commit**

```bash
git add -A
git commit -m "feat(orchestrator): submit() ties all modules together + index re-exports"
```

---

### Task 13: `bin/app-store-kit.mjs` CLI with subcommand dispatch

**Files:**
- Modify: `~/code/eas-app-store-kit/bin/app-store-kit.mjs`

**Strategy:** Single binary dispatching to subcommands via `node:util#parseArgs`. Each subcommand is a thin wrapper that calls into `src/index.mjs`.

**Step 1: Replace the stub with the real CLI**

```js
#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as kit from '../src/index.mjs';

const HELP = `
@thescottyb/eas-app-store-kit — App Store submission automation

Usage:
  app-store-kit <subcommand> [options]

Subcommands:
  submit                    Run the full release flow
  submission cancel <id>    Cancel an in-flight review submission
  versions list             List App Store versions
  builds wait <id>          Poll until a build is VALID
  screenshots upload        Upload pre-existing screenshots from config
  screenshots delete        Delete screenshots from a version
  metadata push             Push age-rating + localization + review-details
  metadata check            Diff config against ASC (does not mutate)
  doctor                    Validate config + reach Apple's API
  init                      Scaffold app-store-config.json
  help                      Show this message

Universal flags:
  --config <path>           override app-store-config.json discovery
  --app-id <id>             override appId
  --version <v>             override versionString
  --dry-run                 gate mutations (GETs still hit live API)
  --verbose, --quiet
  --json                    machine-readable output

Submit flags:
  --skip-eas-upload         do not run eas build
  --skip-review-submit      stop after build attach
  --skip-local-checks       skip pnpm typecheck + test
  --skip-screenshots
  --skip-metadata
  --resume                  alias for --skip-eas-upload --skip-local-checks
  --asc-build-id <id>
  --wait-processing-minutes <n>
  --poll-interval-seconds <n>
  --release-type <type>
  --allow-first-iap-unattached
`;

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === 'help') {
    process.stdout.write(HELP);
    return;
  }

  const [sub, ...rest] = argv;
  const projectRoot = process.cwd();

  switch (sub) {
    case 'submit': return cmdSubmit(rest, projectRoot);
    case 'submission': return cmdSubmission(rest, projectRoot);
    case 'versions': return cmdVersions(rest, projectRoot);
    case 'builds': return cmdBuilds(rest, projectRoot);
    case 'screenshots': return cmdScreenshots(rest, projectRoot);
    case 'metadata': return cmdMetadata(rest, projectRoot);
    case 'doctor': return cmdDoctor(rest, projectRoot);
    case 'init': return cmdInit(rest, projectRoot);
    default:
      console.error(`Unknown subcommand: ${sub}. Run app-store-kit --help.`);
      process.exit(2);
  }
}

async function loadClientFromConfig(argv, projectRoot) {
  const config = await kit.loadConfig({ projectRoot, argv, env: process.env });
  let privateKey = config.privateKey;
  if (!privateKey && config.privateKeyPath) privateKey = await readFile(resolve(config.privateKeyPath), 'utf8');
  if (!privateKey) throw new Error('Missing APP_STORE_CONNECT_PRIVATE_KEY or APP_STORE_CONNECT_PRIVATE_KEY_PATH.');
  if (!config.keyId) throw new Error('Missing APP_STORE_CONNECT_KEY_ID.');
  if (!config.issuerId) throw new Error('Missing APP_STORE_CONNECT_ISSUER_ID.');
  const client = new kit.AppStoreConnectClient({
    keyId: config.keyId,
    issuerId: config.issuerId,
    privateKey,
    dryRun: config.dryRun,
    log: config.dryRun || config.verbose ? console.log : undefined,
  });
  return { client, config };
}

async function cmdSubmit(argv, projectRoot) {
  const { client, config } = await loadClientFromConfig(argv, projectRoot);
  await kit.submit({ ...config, client });
}

async function cmdSubmission(argv, projectRoot) {
  const [action, id, ...rest] = argv;
  if (action === 'cancel') {
    const { client } = await loadClientFromConfig(rest, projectRoot);
    if (!id) throw new Error('Usage: app-store-kit submission cancel <submissionId>');
    await kit.cancelSubmit(client, id);
    console.log(`Cancelled submission ${id}.`);
    return;
  }
  throw new Error(`Unknown submission action: ${action}`);
}

async function cmdVersions(argv, projectRoot) {
  const [action, ...rest] = argv;
  if (action === 'list') {
    const { client, config } = await loadClientFromConfig(rest, projectRoot);
    const versions = await kit.listVersions(client, config.appId);
    console.log(JSON.stringify(versions.map((v) => ({
      id: v.id,
      versionString: v.attributes?.versionString,
      appStoreState: v.attributes?.appStoreState,
    })), null, 2));
    return;
  }
  throw new Error(`Unknown versions action: ${action}`);
}

async function cmdBuilds(argv, projectRoot) { /* builds wait/list as needed */ }

async function cmdScreenshots(argv, projectRoot) {
  const [action, ...rest] = argv;
  const { client, config } = await loadClientFromConfig(rest, projectRoot);
  if (action === 'upload') {
    const version = await kit.findOrCreateVersion(client, config);
    await kit.uploadScreenshots(client, { appStoreVersionId: version.id, screenshots: config.screenshots ?? [] });
    return;
  }
  if (action === 'delete') {
    const version = await kit.findOrCreateVersion(client, config);
    await kit.deleteScreenshots(client, { appStoreVersionId: version.id, displayTypes: (config.screenshots ?? []).map(s => s.displayType) });
    return;
  }
  throw new Error(`Unknown screenshots action: ${action}`);
}

async function cmdMetadata(argv, projectRoot) {
  const [action, ...rest] = argv;
  const { client, config } = await loadClientFromConfig(rest, projectRoot);
  if (action === 'push') {
    const version = await kit.findOrCreateVersion(client, config);
    if (config.ageRatingDeclarations) await kit.setAgeRatingDeclarations(client, version.id, config.ageRatingDeclarations);
    if (config.reviewDetails) await kit.ensureReviewDetails(client, version.id, config.reviewDetails);
    // localization push routed through review-details for now; expand later if needed
    return;
  }
  throw new Error(`metadata ${action} not implemented yet`);
}

async function cmdDoctor(argv, projectRoot) {
  const { client, config } = await loadClientFromConfig(argv, projectRoot);
  console.log(`App: ${config.appName} (${config.bundleIdentifier})`);
  console.log(`Version: ${config.versionString}`);
  console.log(`App Store Connect app ID: ${config.appId}`);
  const out = await client.request('GET', `/apps/${config.appId}`, { query: { 'fields[apps]': 'bundleId,name,sku' } });
  console.log(`ASC says: ${out.data?.attributes?.name} (${out.data?.attributes?.bundleId})`);
  console.log('All good.');
}

async function cmdInit(argv, projectRoot) {
  const templatePath = new URL('../templates/app-store-config.json', import.meta.url);
  const content = await readFile(templatePath, 'utf8');
  const target = resolve(projectRoot, 'app-store-config.json');
  const { writeFile, access } = await import('node:fs/promises');
  try {
    await access(target);
    console.error(`app-store-config.json already exists at ${target}. Remove it first.`);
    process.exit(1);
  } catch {}
  await writeFile(target, content);
  console.log(`Wrote ${target}. Edit it to match your app, then run app-store-kit doctor.`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(err.exitCode ?? 1);
});
```

**Step 2: Verify**

```bash
chmod +x bin/app-store-kit.mjs
node bin/app-store-kit.mjs --help    # prints HELP
node bin/app-store-kit.mjs unknown   # exits 2 with "Unknown subcommand"
node bin/app-store-kit.mjs init      # writes ./app-store-config.json
rm app-store-config.json             # cleanup
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat(cli): app-store-kit binary with subcommand dispatch"
```

---

## Phase G — Repo polish (Task 14)

### Task 14: README + CHANGELOG + GitHub Actions

**Files:**
- Modify: `~/code/eas-app-store-kit/README.md`
- Create: `~/code/eas-app-store-kit/CHANGELOG.md`
- Create: `~/code/eas-app-store-kit/.github/workflows/ci.yml`
- Create: `~/code/eas-app-store-kit/.github/workflows/release.yml`

**Step 1: Write the real README**

Cover: install, quickstart (`init` → `doctor` → `submit`), subcommand reference (one-line each), env-var contract, config-file schema reference, link to `app-store-config.json` template, semver promise, contribution rules. Target ~150 lines.

**Step 2: Write `CHANGELOG.md`**

```markdown
# Changelog

All notable changes to `@thescottyb/eas-app-store-kit` will be documented here.
This project follows [Semantic Versioning](https://semver.org/) and [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added
- Initial release: submit, screenshots, age-rating, localization, cancel, doctor, init subcommands
- ESM JS + JSDoc types
- Retry-on-5xx + sensitive-field redaction + dry-run + idempotency

## [0.1.0] - 2026-05-22

Initial development release. Not yet published to npm.
```

**Step 3: CI workflow**

`.github/workflows/ci.yml`:

```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: corepack enable
      - run: pnpm install --frozen-lockfile
      - run: pnpm run lint
      - run: pnpm run typecheck
      - run: pnpm run test
```

**Step 4: Release workflow** (publish on tag push)

`.github/workflows/release.yml`:

```yaml
name: Release
on:
  push:
    tags: ['v*']
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          registry-url: 'https://registry.npmjs.org'
      - run: corepack enable
      - run: pnpm install --frozen-lockfile
      - run: pnpm run typecheck && pnpm run test
      - run: npm publish --access restricted
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**Step 5: Commit**

```bash
git add -A
git commit -m "docs+ci: README + CHANGELOG + GitHub Actions workflows"
```

**Step 6: Push to a new GitHub repo**

```bash
gh repo create TheScottyB/eas-app-store-kit --private --source=. --remote=origin --push
```

**Step 7: Publish a 0.1.0-dev to npm (optional gate before consumer migration)**

```bash
npm login --scope=@thescottyb     # one-time
pnpm publish --tag dev --access restricted
```

Now consumers can `pnpm add @thescottyb/eas-app-store-kit@dev`.

---

## Phase H — Migrate consumers (Tasks 15–16)

### Task 15: Migrate `flower-sandbox`

**Files:**
- Modify: `~/workspace/flower-sandbox/package.json`
- Modify: `~/workspace/flower-sandbox/.eas/workflows/build-and-submit-ios.yml`
- Modify: `~/workspace/flower-sandbox/docs/release-to-app-store.md`
- Delete: `~/workspace/flower-sandbox/scripts/app-store-submit-review.mjs`

**Step 1: Pre-flight**

```bash
cd ~/workspace/flower-sandbox
git status --short    # expect clean
git log -1
pnpm typecheck && pnpm test
```

**Step 2: Add the kit as a dev dependency**

```bash
pnpm add -D @thescottyb/eas-app-store-kit@dev
```

**Step 3: Update `package.json` scripts**

Edit `scripts`:

```diff
-    "app-store:release": "node scripts/app-store-submit-review.mjs",
-    "app-store:submit-review": "node scripts/app-store-submit-review.mjs --skip-eas-upload --skip-local-checks",
+    "app-store:release": "app-store-kit submit",
+    "app-store:submit-review": "app-store-kit submit --resume",
```

**Step 4: Delete the old script**

```bash
git rm scripts/app-store-submit-review.mjs
```

(If `scripts/` becomes empty, remove the directory too.)

**Step 5: Update the EAS workflow**

`.eas/workflows/build-and-submit-ios.yml`, the `submit_review` job:

```diff
       - uses: eas/install_node_modules
       - name: Submit app version for review
-        run: pnpm run app-store:submit-review
+        run: pnpm exec app-store-kit submit --resume --asc-build-id ${{ needs.submit_ios.outputs.build_id }}
```

**Step 6: Update `docs/release-to-app-store.md`**

Replace the §5 "Scripted release path" section to reference the kit's CLI. Add a note that the kit is `@thescottyb/eas-app-store-kit` and the install command. Trim any duplication of usage that's now in the kit's README.

**Step 7: Verify (per @superpowers:verification-before-completion)**

```bash
pnpm typecheck && pnpm test
pnpm exec app-store-kit --version
pnpm exec app-store-kit doctor                                   # walks config + reaches Apple
pnpm exec app-store-kit submit --dry-run --skip-eas-upload       # walks flow without mutating
```

The doctor output must show the right app ID + bundle ID + version. The dry-run must print every POST/PATCH it would issue.

**Step 8: Commit**

```bash
git add -A
git commit -m "chore(deps): migrate to @thescottyb/eas-app-store-kit

Drop scripts/app-store-submit-review.mjs (840 lines). Add the kit
as a dev dependency and route app-store:release and app-store:submit-review
through its CLI. Update build-and-submit-ios.yml's submit_review step
to invoke app-store-kit directly with the upstream job's build_id.
Update docs/release-to-app-store.md to point at the kit."
git push
```

---

### Task 16: Migrate `Creative-Writing-Interface`

**Files:**
- Modify: `~/antigravity/Creative-Writing-Interface/package.json`
- Create: `~/antigravity/Creative-Writing-Interface/creative-writing.app-store-config.json`
- Create: `~/antigravity/Creative-Writing-Interface/mortgage.app-store-config.json`
- Delete: `~/antigravity/Creative-Writing-Interface/scripts/submit-to-app-store.cjs`
- Delete: `~/antigravity/Creative-Writing-Interface/scripts/submit-mortgage-to-app-store.cjs`
- Delete: `~/antigravity/Creative-Writing-Interface/scripts/check-metadata.cjs`
- Delete: `~/antigravity/Creative-Writing-Interface/scripts/check-mortgage-app.cjs`
- Delete: `~/antigravity/Creative-Writing-Interface/scripts/list-apps.cjs`
- (Keep or fold) `~/antigravity/Creative-Writing-Interface/scripts/capture-screenshots.cjs`
- Modify: `~/antigravity/Creative-Writing-Interface/take_expo_app_to_app_store_skill.md`

**Step 1: Pre-flight**

```bash
cd ~/antigravity/Creative-Writing-Interface
git status --short
```

**Step 2: Add the kit**

```bash
pnpm add -D @thescottyb/eas-app-store-kit@dev
# OR npm install --save-dev if it's npm-managed
```

**Step 3: Create the two app config files**

`creative-writing.app-store-config.json` — appId `6772141707`, full metadata block per gemini-generic's template. Reference the existing values in `scripts/submit-to-app-store.cjs` and `take_expo_app_to_app_store_skill.md`.

`mortgage.app-store-config.json` — appId `6772252912`, mortgage-app-specific values. Reference `scripts/submit-mortgage-to-app-store.cjs`.

Use `app-store-kit init` to scaffold, then edit values.

**Step 4: Update `package.json` scripts**

```diff
+    "app-store:cwi": "app-store-kit submit --config creative-writing.app-store-config.json",
+    "app-store:mortgage": "app-store-kit submit --config mortgage.app-store-config.json",
+    "app-store:cwi:dry": "app-store-kit submit --config creative-writing.app-store-config.json --dry-run",
+    "app-store:mortgage:dry": "app-store-kit submit --config mortgage.app-store-config.json --dry-run",
```

**Step 5: Delete the old app-specific scripts**

```bash
git rm scripts/submit-to-app-store.cjs
git rm scripts/submit-mortgage-to-app-store.cjs
git rm scripts/check-metadata.cjs
git rm scripts/check-mortgage-app.cjs
git rm scripts/list-apps.cjs
# Keep capture-screenshots.cjs IF its specific orchestration isn't covered
# by app-store-kit screenshots capture; otherwise delete too.
```

**Step 6: Rewrite `take_expo_app_to_app_store_skill.md`**

Down from 217 lines to ~60-80 lines. New shape:
- Install the kit
- Scaffold app-store-config.json via `app-store-kit init`
- Fill in app-specific values
- Run `app-store-kit doctor` to validate
- Run `app-store-kit submit` to ship
- Resume after partial failure via `app-store-kit submit --resume`

The deep ASC API steps the previous skill doc described are now hidden inside the kit; no need to repeat them.

**Step 7: Verify**

```bash
pnpm exec app-store-kit --version
pnpm exec app-store-kit doctor --config creative-writing.app-store-config.json
pnpm exec app-store-kit doctor --config mortgage.app-store-config.json
pnpm exec app-store-kit submit --config creative-writing.app-store-config.json --dry-run --skip-eas-upload
pnpm exec app-store-kit submit --config mortgage.app-store-config.json --dry-run --skip-eas-upload
```

All four should walk to completion without mutating.

**Step 8: Commit**

```bash
git add -A
git commit -m "chore(deps): migrate to @thescottyb/eas-app-store-kit

Drop two app-specific submit scripts and four supporting scripts (~1944
lines total). Replace with two app-store-config.json files and pnpm
scripts that route through app-store-kit's CLI. Rewrite the skill doc
to describe the kit workflow instead of the per-app script flow."
git push
```

---

## Phase I — Archive legacy (Task 17)

### Task 17: Archive the gemini scratch dir

**Files:**
- Move: `~/.gemini/antigravity/scratch/take-expo-to-appstore-skill/` → `~/.gemini/antigravity/.archive/take-expo-to-appstore-skill-2026-05-22/`

```bash
mkdir -p ~/.gemini/antigravity/.archive/
mv ~/.gemini/antigravity/scratch/take-expo-to-appstore-skill \
   ~/.gemini/antigravity/.archive/take-expo-to-appstore-skill-2026-05-22
```

This directory is not in any tracked git repo (it lives under `~/.gemini/`); the move is local-only. Future Claude/agent sessions discover the kit via the rewritten `take_expo_app_to_app_store_skill.md` in CWI and via `@thescottyb/eas-app-store-kit`'s README.

---

## Phase J — Tag + publish stable (Task 18)

### Task 18: Cut v0.1.0 from -dev

**Files:**
- Modify: `~/code/eas-app-store-kit/package.json` (version: 0.1.0-dev → 0.1.0)
- Modify: `~/code/eas-app-store-kit/CHANGELOG.md`

**Step 1: Confirm both consumers are green**

In each consumer repo:

```bash
pnpm exec app-store-kit doctor
pnpm exec app-store-kit submit --dry-run --skip-eas-upload
```

Both must complete without error.

**Step 2: Bump version + tag**

```bash
cd ~/code/eas-app-store-kit
# Edit package.json: "version": "0.1.0"
# Edit CHANGELOG.md: move Unreleased → 0.1.0
git add package.json CHANGELOG.md
git commit -m "chore: release v0.1.0"
git tag v0.1.0
git push --follow-tags
```

**Step 3: Verify CI release workflow publishes**

GitHub Actions `release.yml` runs on the v0.1.0 tag and publishes to npm. Verify with:

```bash
npm view @thescottyb/eas-app-store-kit@0.1.0
```

**Step 4: Pin consumers to 0.1.0 (not @dev)**

In both consumer repos:

```diff
-    "@thescottyb/eas-app-store-kit": "dev"
+    "@thescottyb/eas-app-store-kit": "^0.1.0"
```

Commit and push each.

---

## Done means

- `@thescottyb/eas-app-store-kit@0.1.0` published to npm (private scope)
- New GitHub repo: `TheScottyB/eas-app-store-kit` with CI + release workflow
- `flower-sandbox`: `scripts/app-store-submit-review.mjs` deleted; `app-store:release` + `app-store:submit-review` route through the kit; build-and-submit-ios.yml uses the CLI
- `Creative-Writing-Interface`: 5 cjs scripts deleted; 2 `app-store-config.json` files + 2 pnpm scripts; skill doc rewritten
- gemini scratch directory archived
- Both consumer repos: `pnpm exec app-store-kit doctor` returns success; `submit --dry-run --skip-eas-upload` walks the flow
- Net LoC: ~2700 lines deleted across both repos; kit holds ~1500 lines in one canonical place
- Kit-side: tests pass (~20+ unit tests across helpers, asc-client, version, build, review-submission, config)
- Both consumer repos' typecheck + jest still green

## Out of scope

- TypeScript build pipeline
- Public npm registry
- Inquirer / interactive prompts
- Auto-creation of the App Store Connect app record
- Privacy questionnaire automation
- Android / Google Play
- Stripe / Supabase / non-App-Store automation
- Migrating any third project beyond the two named here
