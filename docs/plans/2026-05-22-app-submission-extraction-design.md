# App-submission automation extraction design

**Status:** Approved 2026-05-22, ready for implementation plan
**Goal:** Extract the App Store submission automation that exists in three forms across `flower-sandbox`, `Creative-Writing-Interface`, and `~/.gemini/antigravity/scratch/take-expo-to-appstore-skill/` into one shared, semver-versioned npm package consumed by all current and future Expo iOS projects.

## Inventory of what exists today

| Location | What | Lines | Strengths | Gaps |
|---|---|---|---|---|
| `~/.gemini/.../take-expo-to-appstore-skill/` | 5 "generic" CJS scripts + `app-store-config.json` | ~1304 | feature breadth: screenshots, age rating, localization, cancel, list-versions, delete-screenshots; configuration-driven via `app-store-config.json` | in a `scratch/` dir; CJS only; no retry, no redaction, no dry-run, no idempotency guarantees |
| `Creative-Writing-Interface/scripts/` | 2 app-specific CJS submit scripts (`submit-to-app-store.cjs`, `submit-mortgage-to-app-store.cjs`) + helpers (`check-metadata.cjs`, `list-apps.cjs`, `capture-screenshots.cjs`) | ~1944 | concrete usage examples for two real apps | hardcoded `APP_ID`, `VERSION_STRING`, `KEY_ID`, `PRIVATE_KEY_PATH` per script; CJS; no retry/dry-run/redaction |
| `flower-sandbox/scripts/app-store-submit-review.mjs` | ESM single-file script | ~840 | retry on 5xx + network errors, sensitive-field redaction, idempotency at every step, `appStoreState` validation, first-IAP guard, `--dry-run`, hard-fail on unknown flags, class-based architecture | no screenshot upload, no age rating declarations, no localization, no cancel |

Each implementation has features the others lack. The cost of carrying all three forward is real: every fix has to land in three places.

## Decisions (locked during brainstorm)

1. **Distribution:** Standalone Git repo at `~/code/eas-app-store-kit`; private npm package `@thescottyb/eas-app-store-kit`.
2. **Feature scope (v1):** Full kit — everything both repos currently need (submit + screenshots + age rating + localization + cancel + list-versions).
3. **Language:** Pure ESM JavaScript with JSDoc types; `tsc --checkJs` in CI. No build step.
4. **CLI:** Single binary `app-store-kit` with subcommand dispatch via `node:util#parseArgs`.
5. **JS API:** Named exports from `src/index.mjs` for programmatic use.
6. **npm scope:** `@thescottyb/` (restricted access).
7. **Source merge:** flower-sandbox's robustness layer (retry, redact, dry-run, idempotency, ESM, fetch) + gemini-generic's feature breadth (screenshots, age rating, localization, cancel) + new `config.mjs` to merge precedence.

## Architecture

### Repo layout

```
~/code/eas-app-store-kit/
├── README.md
├── CHANGELOG.md
├── LICENSE                    (MIT)
├── package.json               @thescottyb/eas-app-store-kit
├── pnpm-lock.yaml
├── bin/
│   └── app-store-kit.mjs      CLI entry; subcommand dispatch via node:util#parseArgs
├── src/
│   ├── index.mjs              public JS API (named exports)
│   ├── asc-client.mjs         ES256 JWT + fetch + retry + redaction
│   ├── config.mjs             precedence-merge config from flag/env/json/app.json
│   ├── version.mjs            find/create/validate appStoreState
│   ├── build.mjs              poll, attach, terminal-state detection
│   ├── review-details.mjs     contact info, demo account, localization
│   ├── submission.mjs         create/find/submit/cancel review submissions
│   ├── screenshots.mjs        upload + poll + delete
│   ├── screenshots-capture.mjs  drive iOS sim via xcrun simctl
│   ├── age-rating.mjs         declarations PATCH
│   ├── eas-runner.mjs         spawn `eas build` with stdio: inherit
│   ├── helpers/
│   │   ├── jwt.mjs            ES256 helpers (createPrivateKey, ieee-p1363 sign)
│   │   ├── retry.mjs          exponential backoff + jitter
│   │   ├── redact.mjs         REDACTED_KEYS + recursive redact
│   │   └── env.mjs            envBool, etc.
│   └── types.d.ts             hand-written ambient types for the JS API
├── templates/
│   └── app-store-config.json  scaffold target for `app-store-kit init`
├── test/
│   ├── asc-client.test.mjs    mock fetch; verify retry behavior, redaction
│   ├── config.test.mjs        precedence + merge semantics
│   ├── jwt.test.mjs           JWT shape + ieee-p1363 signature
│   └── e2e/                   optional, gated behind ASC creds env
└── .github/
    └── workflows/
        ├── ci.yml             typecheck + tests on push
        └── release.yml        npm publish on tag
```

### `package.json` shape

```json
{
  "name": "@thescottyb/eas-app-store-kit",
  "version": "0.1.0",
  "type": "module",
  "main": "src/index.mjs",
  "types": "src/types.d.ts",
  "bin": { "app-store-kit": "bin/app-store-kit.mjs" },
  "exports": {
    ".": "./src/index.mjs",
    "./asc-client": "./src/asc-client.mjs"
  },
  "engines": { "node": ">=22.13.0" },
  "publishConfig": { "access": "restricted" },
  "files": ["bin/", "src/", "templates/", "README.md", "LICENSE"]
}
```

### Public JS API (from `src/index.mjs`)

```js
export { AppStoreConnectClient, AppStoreConnectError } from './asc-client.mjs';
export { loadConfig } from './config.mjs';
export { submit, resumeSubmit, cancelSubmit } from './submission.mjs';
export { uploadScreenshots, captureScreenshots, deleteScreenshots } from './screenshots.mjs';
export { findOrCreateVersion, listVersions } from './version.mjs';
export { setAgeRatingDeclarations } from './age-rating.mjs';
export { setLocalization } from './review-details.mjs';
```

### Module merge strategy

| Module | Primary source | Hardening / merge from |
|---|---|---|
| `asc-client.mjs` | flower-sandbox | + 5xx retry, redaction, dry-run gating |
| `version.mjs` | flower-sandbox | + appStoreState whitelist |
| `build.mjs` | flower-sandbox | + terminal-state detection |
| `review-details.mjs` | flower-sandbox + gemini-generic | merge: localization fields, demo account |
| `submission.mjs` | flower-sandbox + gemini-generic | merge: cancel + resume + idempotent submission |
| `screenshots.mjs` | gemini-generic | + flower-sandbox-style retry |
| `screenshots-capture.mjs` | gemini-generic | as-is (no flower-sandbox analog) |
| `age-rating.mjs` | gemini-generic | as-is |
| `config.mjs` | new | merges flag/env/config-json/app.json/defaults |
| `bin/app-store-kit.mjs` | new | `node:util#parseArgs` + subcommand dispatch |

## Configuration system

### Precedence (highest wins)

```
1. CLI flag                    (e.g. --version=1.0.8)
2. Process env var             (e.g. APP_STORE_CONNECT_KEY_ID)
3. app-store-config.json       (project-rooted, gemini-generic's pattern)
4. app.json / eas.json         (Expo defaults — bundle ID, version, ascAppId)
5. Built-in defaults           (waitProcessingMinutes=45, releaseType=AFTER_APPROVAL)
```

`loadConfig({ projectRoot, argv, env })` returns one normalized `Config` object. All downstream functions take that object; no scattered `process.env` reads.

### Canonical `Config` shape

```ts
type Config = {
  // Identity
  appId: string;
  bundleIdentifier: string;
  versionString: string;
  appName: string;

  // Credentials
  keyId: string;
  issuerId: string;
  privateKey: string | KeyObject;
  privateKeyPath?: string;

  // Flow control
  runLocalChecks: boolean;
  skipEasUpload: boolean;
  submitReview: boolean;
  dryRun: boolean;
  allowFirstIapUnattached: boolean;
  waitProcessingMinutes: number;
  pollIntervalSeconds: number;
  releaseType: 'AFTER_APPROVAL' | 'MANUAL' | 'SCHEDULED';
  ascBuildId?: string;

  // Optional features (omitted block → that step is skipped)
  reviewDetails?: ReviewDetails;
  ageRatingDeclarations?: AgeRatingDeclarations;
  localization?: Localization;
  screenshots?: ScreenshotConfig[];
  screenshotsCapture?: ScreenshotsCaptureConfig;

  // Project paths
  projectRoot: string;
  eas?: object;
};
```

### `app-store-config.json` schema (user-facing)

```jsonc
{
  "appId": "6772106139",
  "versionString": "1.0.0",
  "keyId": "XT32ZS8GHR",
  "copyright": "© 2026 Scott Beilfuss",
  "primaryCategory": "BOOKS",
  "contentRightsDeclaration": "DOES_NOT_USE_THIRD_PARTY_CONTENT",
  "releaseType": "AFTER_APPROVAL",

  "reviewDetails": {
    "contactFirstName": "...",
    "contactLastName": "...",
    "contactEmail": "...",
    "contactPhone": "+1...",
    "demoAccountRequired": false,
    "demoAccountName": "...",
    "demoAccountPassword": "...",
    "notes": "..."
  },

  "ageRatingDeclarations": { /* full ASC block */ },

  "localization": {
    "locale": "en-US",
    "description": "...",
    "keywords": "...",
    "subtitle": "...",
    "supportUrl": "https://...",
    "marketingUrl": "https://...",
    "privacyPolicyUrl": "https://..."
  },

  "screenshots": [
    { "displayType": "APP_IPHONE_69", "filePath": "./assets/iphone69.png" }
  ],

  "screenshotsCapture": {
    "expoUrl": "exp://127.0.0.1:8081",
    "devices": [/* per-device targets */]
  }
}
```

### Environment variables

```
APP_STORE_CONNECT_KEY_ID
APP_STORE_CONNECT_ISSUER_ID
APP_STORE_CONNECT_PRIVATE_KEY_PATH     # OR
APP_STORE_CONNECT_PRIVATE_KEY          # inline (CI secrets)
APP_STORE_CONNECT_APP_ID
APP_STORE_FIRST_IAP_ATTACHED=1
APP_STORE_VERSION
APP_STORE_RELEASE_TYPE
APP_STORE_ALLOW_UNATTACHED_FIRST_IAP
APP_STORE_CONFIG_PATH                  # override config-file discovery
```

### `app-store-config.json` discovery

```
1. CLI: --config <path>
2. $APP_STORE_CONFIG_PATH
3. <projectRoot>/app-store-config.json
4. <projectRoot>/.app-store-config.json
5. No config file → "lean mode" using app.json + eas.json + env + defaults
```

## CLI surface

Single binary `app-store-kit` with subcommand dispatch.

### Subcommand catalog

```
app-store-kit init                       scaffold app-store-config.json from template
app-store-kit submit [options]           main flow
app-store-kit submit --resume            skip eas-upload + local-checks
app-store-kit submission cancel <id>     withdraw an active review submission
app-store-kit submission status [id]     show state of latest or specified submission
app-store-kit versions list              list app store versions
app-store-kit versions show <version>    show details for one version
app-store-kit builds list                list recent App Store Connect builds
app-store-kit builds wait <build-id>     poll until VALID, exit 0; exit 1 on FAILED
app-store-kit screenshots upload         upload pre-existing files declared in config
app-store-kit screenshots capture        drive iOS sim per config; produce files
app-store-kit screenshots list           list current screenshots for the version
app-store-kit screenshots delete         delete declared display types from version
app-store-kit metadata push              set ageRating + localization + reviewDetails
app-store-kit metadata check             diff config against ASC (does NOT mutate)
app-store-kit doctor                     validate config + reach Apple's API + report
app-store-kit help [subcommand]          built-in help
```

### Universal flags

```
--config <path>     override app-store-config.json discovery
--app-id <id>       override appId
--version <v>       override versionString
--dry-run           gate all mutations; still hits real API for GETs
--verbose           log every API call's method + URL (sans tokens)
--quiet             suppress non-error output (for CI)
--no-color          disable ANSI color
--help              subcommand-aware help
--json              machine-readable output where applicable
```

### `submit` flags

```
--skip-eas-upload
--skip-review-submit
--skip-local-checks
--skip-screenshots
--skip-metadata
--resume                          alias for --skip-eas-upload --skip-local-checks
--asc-build-id <id>
--wait-processing-minutes <n>     default 45
--poll-interval-seconds <n>       default 60
--release-type <type>             default AFTER_APPROVAL
--allow-first-iap-unattached
```

### Exit codes

```
0   success
1   runtime failure (Apple error, EAS error, network)
2   CLI usage error (unknown flag, missing arg)
3   config error (file not found / unparseable / required field missing)
```

### YAGNI list (not in v1)

- Interactive prompts (`inquirer`/`readline`).
- Auto-creation of the App Store Connect app record.
- Privacy questionnaire automation.
- Building the binary itself (`eas build` is invoked via spawn; not replaced).
- Stripe / Supabase / non-App-Store automation.
- Android / Google Play.

## Per-repo migration

### `flower-sandbox`

```
─ Remove: scripts/app-store-submit-review.mjs                (≈ −840 lines)
─ Add:    package.json#devDependencies "@thescottyb/eas-app-store-kit": "^0.1.0"
─ Edit:   package.json#scripts:
            "app-store:release"       → "app-store-kit submit"
            "app-store:submit-review" → "app-store-kit submit --resume"
            "submit:ios"              → stays (low-level eas submit escape hatch)
─ Optional: add .app-store-config.json for localization + review-details
            (deferred; works without one)
─ Edit:   .eas/workflows/build-and-submit-ios.yml
            "run: pnpm run app-store:release"
            ↓
            "run: pnpm exec app-store-kit submit --resume \
                  --asc-build-id ${{ needs.submit_ios.outputs.build_id }}"
─ Edit:   docs/release-to-app-store.md
            §5 commands update; new "App Store Connect kit" subsection
─ Verify: pnpm typecheck && pnpm test && app-store-kit doctor
```

Net diff: −~830 lines (the script) + ~10 lines (deps + scripts + workflow + doc updates).

### `Creative-Writing-Interface`

```
─ Remove: scripts/submit-to-app-store.cjs           (683 lines)
─ Remove: scripts/submit-mortgage-to-app-store.cjs  (751 lines)
─ Remove: scripts/check-metadata.cjs                (90 lines)
─ Remove: scripts/check-mortgage-app.cjs            (112 lines)
─ Remove: scripts/list-apps.cjs                     (84 lines)
─ Remove: scripts/capture-screenshots.cjs           (224 lines; if needed beyond
                                                     gemini-generic's, keep)
─ Add:    package.json#devDependencies "@thescottyb/eas-app-store-kit": "^0.1.0"
─ Add:    creative-writing.app-store-config.json   (appId 6772141707, full metadata)
─ Add:    mortgage.app-store-config.json           (appId 6772252912)
─ Add:    package.json#scripts:
            "app-store:cwi"      = "app-store-kit submit --config creative-writing.app-store-config.json"
            "app-store:mortgage" = "app-store-kit submit --config mortgage.app-store-config.json"
─ Edit:   take_expo_app_to_app_store_skill.md
            Rewrite as: "install the kit, point it at a config, run submit"
            (down from 217 lines to ~60-80 lines)
─ Verify: app-store-kit doctor --config creative-writing.app-store-config.json
          app-store-kit doctor --config mortgage.app-store-config.json
```

Net diff: −~1944 lines + ~150 lines of config + shorter skill doc.

### `~/.gemini/antigravity/scratch/take-expo-to-appstore-skill/`

```
─ Move to ~/.gemini/antigravity/.archive/take-expo-to-appstore-skill-2026-05-22/
─ The rewritten skill doc in CWI becomes the canonical "how to ship an Expo app" reference
─ Future agents discover @thescottyb/eas-app-store-kit via the skill doc, install + use it
```

## Error handling

- **Apple API 5xx + network errors:** 4-attempt exponential backoff with jitter (500ms → 1s → 2s + jitter); exit 1 after exhaustion. Carried verbatim from flower-sandbox's hardening.
- **Apple API 4xx:** no retry; surface immediately; `formatAppleError` extracts `errors[].{code,title,detail}` + `meta.associatedErrors`.
- **Sensitive-field redaction:** error output replaces `demoAccountPassword`, `demoAccountName`, `contactEmail`, `contactPhone` with `[REDACTED]` before stringifying. API requests still send real values.
- **Unrecoverable state errors** (e.g. `appStoreState === READY_FOR_SALE`): exit 1 with named-list message; recommend bumping `expo.version` or resetting version in ASC UI.
- **First-IAP guard:** refuse to submit unless `APP_STORE_FIRST_IAP_ATTACHED=1` OR `--allow-first-iap-unattached`. Runs before any mutating API call.
- **Token TTL:** re-signed per request (20-min JWT); negligible cost vs. 45-min polling windows.
- **`--dry-run`:** gates all POST/PATCH/DELETE; GETs still hit Apple to read real state. Documented in `--help`.
- **Idempotency:** every step is rerunnable. Find-or-create on version. Skip-if-attached on build attachment. Detect-existing on review submission. Resume-after-failure via `submit --resume`.

## Verification

### Kit-side CI (the `eas-app-store-kit` repo)

```
─ tsc --noEmit (over JSDoc-typed JS)
─ jest / node:test:
    asc-client.retry — mock fetch returning 503 → assert 4 attempts then throw
    config.precedence — flag overrides env overrides json overrides app.json
    jwt.shape — ES256 header, ieee-p1363 sig length, payload claims
    redact — REDACTED_KEYS replaced recursively
─ optional e2e (gated behind ASC creds env): doctor + dry-run submit
─ semver: 0.x prerelease while integrating; 1.0.0 after both repos migrate cleanly
```

### Per-repo verification

```
─ pnpm install                         resolves the kit
─ pnpm typecheck && pnpm test          existing project gates still pass
─ app-store-kit --version              CLI installed via bin
─ app-store-kit doctor                 config loads, ASC reachable, all envs set
─ app-store-kit submit --dry-run       walks entire flow without mutating;
                                       prints every POST/PATCH it would do
─ EAS Workflow dry-run via
  `eas workflow:run build-and-submit-ios.yml`
  with submit_review step pointing at the new CLI
```

### Done means

- Kit published at `@thescottyb/eas-app-store-kit@0.1.0` (private scope)
- `flower-sandbox`: `pnpm app-store:release` routes through the kit; tests + typecheck pass
- `Creative-Writing-Interface`: two config files; either app submits via the kit
- Both repos' old scripts deleted (clean break)
- LoC reduction across both repos: ~2700 lines removed; kit adds ~1500 lines in one place
- `docs/release-to-app-store.md` in flower-sandbox updated to reference the kit's CLI

## Out of scope (explicit YAGNI)

- TypeScript build pipeline. Pure ESM JS with JSDoc + `tsc --checkJs` only.
- Inquirer / readline interactive prompts.
- ASC app-record creation. Browser-only.
- Privacy questionnaire automation.
- Stripe / Supabase / non-App-Store automation.
- Android / Google Play.
- Hosting the npm package on a public registry (private scope wins).
