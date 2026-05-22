# Release to App Store

End-to-end iOS submission guide. Covers the one-time App Store Connect
setup, pre-submission asset checklist, scripted release flow, manual
release flow, EAS Workflow runners for submission, and troubleshooting.

For non-submission EAS Workflows (test-and-build, publish-update,
update-production), see [eas-workflows.md](./eas-workflows.md).

## 1. Prerequisites

- [x] Apple Developer Account (`beilsco@gmail.com`)
- [x] Apple Team ID: `3X872JR6P3`
- [x] Bundle ID registered: `com.djscottyb.flowersandbox`
- [x] App Store Connect app record created (App ID: `6772106139`)
- [x] `ascAppId` populated in `eas.json` `submit.production.ios`

## 2. One-time App Store Connect setup

These steps run once per app, in the [App Store Connect web UI](https://appstoreconnect.apple.com).
Most are already done for FlowerSandbox; checklist below for reference.

### 2.1 Create the app record

1. App Store Connect → **My Apps** → **+** → **New App**
2. Fill in:
   - Platform: iOS
   - Name: `FlowerSandbox`
   - Primary language: English (U.S.)
   - Bundle ID: `com.djscottyb.flowersandbox`
   - SKU: `FLOWERSANDBOX2026`
3. Save. The numeric App ID appears in the URL — copy it.
4. Add it to `eas.json` under `submit.production.ios.ascAppId`.

### 2.2 Create the IAP subscription product

- Product ID: `com.djscottyb.flowersandbox.premium.monthly`
- Subscription Group ID: `22106738`
- Still required before submission:
  - Add a price tier (ASC → subscription → Subscription Prices)
  - Add English localization: Display Name + Description
    (ASC → subscription → Subscription Localizations → Create)

### 2.3 First IAP/subscription attachment (one-time browser step)

Apple requires the first subscription or IAP for an app to be attached
to the app version via the App Store Connect web UI before submission.
The public Review Submission API does **not** expose a relationship for
this attachment. The scripted release path therefore refuses to proceed
until you've done this once.

1. Complete the subscription price, localization, and App Review screenshot in App Store Connect.
2. On the app's version page (under the "In-App Purchases and Subscriptions" section), attach the subscription to the version.
3. Set `APP_STORE_FIRST_IAP_ATTACHED=1` in your `.env` (or EAS production environment for workflow runs).

After the first IAP is approved, future app version submissions don't
need this step again.

### 2.4 App Privacy declaration, age rating, pricing

These are one-time UI steps in App Store Connect's app page:

- App Privacy → fill out data collection and usage
- Age Rating Questionnaire
- Pricing and Availability → set tier

## 3. Pre-submission asset checklist

Before triggering a release, make sure these exist:

### Screenshots
- [ ] iPhone 6.7" (1290×2796): home, subscription view, sandbox, donation
- [ ] iPad Pro 13" (2064×2752) — if supporting iPad

### App Store Connect metadata
- [ ] App Name: `FlowerSandbox`
- [ ] Subtitle (max 30 chars)
- [ ] Description (max 4000 chars; no pricing, no competing-platform names)
- [ ] Keywords (max 100 chars, comma-separated)
- [ ] Support URL
- [ ] Privacy Policy URL — host `PRIVACY_POLICY.md`
- [ ] Terms of Service URL — host `TERMS_OF_SERVICE.md`
- [ ] Marketing URL (optional)
- [ ] Copyright

### App icon
- [ ] 1024×1024 PNG, no alpha, no rounded corners

### Demo account for App Review
- [ ] Test account in App Store Connect → Users & Access → Sandbox
- [ ] Demo instructions: how to access subscription flow + restore purchases

### Technical (already in place)
- [x] iOS 17 deployment target
- [x] iPhone + iPad universal
- [x] Encryption declaration (`ITSAppUsesNonExemptEncryption: false` in `app.json`)
- [x] Privacy manifests for third-party SDKs
- [x] Bundle ID: `com.djscottyb.flowersandbox`
- [x] Build number sourced remotely (`eas.json#cli.appVersionSource: "remote"`)

## 4. Apple's asset requirements reference

| Asset | Dimensions | Format |
|---|---|---|
| App icon | 1024×1024 | PNG, no alpha, no rounded corners, RGB |
| iPhone 6.9" screenshot (iPhone 16 Pro Max) | 1320×2868 | PNG/JPEG, RGB, no alpha |
| iPhone 6.7" screenshot (iPhone 14 Pro Max) | 1290×2796 | PNG/JPEG, RGB, no alpha |
| iPad Pro 13" screenshot | 2064×2752 | PNG/JPEG, RGB, no alpha |
| iPad Pro 12.9" (6th gen) screenshot | 2048×2732 | PNG/JPEG, RGB, no alpha |
| App Preview Video (optional) | per device | 15–30s, no people interacting with the device |

Min 1, max 10 screenshots per device size. Orientation must match the
app's supported orientations.

Initial download size < 200 MB; performance targets: <5s launch,
60fps scrolling, reasonable battery use.

Authoritative spec: <https://developer.apple.com/app-store/review/guidelines/>

## 5. Scripted release path (recommended)

The script at `scripts/app-store-submit-review.mjs` drives end-to-end:
local checks → EAS build + upload → App Store Connect version
create/find → build attach → review-detail upsert → submit for review.

### One command:

```bash
pnpm run app-store:release
```

Performs:

1. Local `pnpm typecheck` + `pnpm test`
2. `eas build --platform ios --profile production --auto-submit --non-interactive --wait` (build + upload to App Store Connect)
3. App Store Connect API:
   - Find or create the iOS App Store version for `expo.version`
   - Validate the version's `appStoreState` is in a draftable state
   - Poll the build until it leaves `PROCESSING`
   - Attach the build to the version (idempotent)
   - Upsert App Review contact details from `APP_REVIEW_*` env
   - Create or reuse a review submission, attach the version item, send

### Resume after partial failure

If the script dies after the EAS build succeeded but before review
submission completes:

```bash
pnpm run app-store:submit-review
```

This skips local checks and EAS upload; runs only the App Store
Connect review-submission flow against the existing build.

### Useful flags

| Flag | Purpose |
|---|---|
| `--dry-run` | Print mutating API calls + the EAS command, don't execute. GETs still hit the live API. |
| `--skip-eas-upload` | Don't run the EAS build/upload step. |
| `--skip-review-submit` | Run local checks + EAS upload, then stop. |
| `--skip-local-checks` | Don't run typecheck + tests. |
| `--allow-first-iap-unattached` | Bypass the first-IAP guard. Use only if the IAP is already approved or intentionally not in this review. |
| `--version=<v>` | Override the App Store version string (default: `app.json` `expo.version`). |
| `--asc-build-id=<id>` | Attach a specific App Store Connect build resource ID. |
| `--wait-processing-minutes=<n>` | Build-processing wait cap (default: 45). |
| `--release-type=<type>` | New-version release type (default: `AFTER_APPROVAL`). |

Run with `--help` to see all flags.

### Required environment

Set in `.env` for local runs; on the EAS dashboard for workflow runs.
**Never commit the `.p8` private key.**

```bash
# App Store Connect API
APP_STORE_CONNECT_KEY_ID=...
APP_STORE_CONNECT_ISSUER_ID=...
APP_STORE_CONNECT_PRIVATE_KEY_PATH=/absolute/path/to/AuthKey_XXXXXXXXXX.p8
APP_STORE_CONNECT_APP_ID=6772106139
APP_STORE_FIRST_IAP_ATTACHED=1   # set 1 after the one-time browser step in §2.3

# App Review contact info (required when creating review details)
APP_REVIEW_CONTACT_FIRST_NAME=...
APP_REVIEW_CONTACT_LAST_NAME=...
APP_REVIEW_CONTACT_EMAIL=...
APP_REVIEW_CONTACT_PHONE=...
APP_REVIEW_DEMO_ACCOUNT_REQUIRED=false
APP_REVIEW_NOTES="Test the iOS subscription flow from the Premium Subscription screen and use Restore Purchases to validate restore behavior."
```

Use `APP_STORE_CONNECT_PRIVATE_KEY` instead of `APP_STORE_CONNECT_PRIVATE_KEY_PATH` if CI injects the key inline.

## 6. Manual release path

Prefer the scripted path unless you need to debug a single step. The
manual path requires browser steps for the final App Review submission.

### Build

```bash
# Manual build
eas build --platform ios --profile production

# Or trigger the build-only workflow
eas workflow:run build-ios-production.yml
```

### Upload to App Store Connect

```bash
# Prompts for build ID
eas submit --platform ios --profile production

# Or via the convenience npm script
pnpm run submit:ios
```

### Submit for review (browser)

1. App Store Connect → My Apps → FlowerSandbox → current version
2. Select the newly uploaded build under the "Build" section
3. Fill in App Review contact info + notes
4. Submit for Review

The scripted path automates the last three sub-steps via the App Store
Connect Review Submission API.

## 7. EAS Workflow runners for submission

All four submission workflows are manual-trigger only
(`on: workflow_dispatch`) until the release pipeline is stable. To
re-enable push triggers, uncomment the `on.push` block in the
workflow YAML.

### `build-ios-production.yml`

Just builds the iOS production binary. No upload, no submit.

```bash
eas workflow:run build-ios-production.yml
```

### `build-android-production.yml`

Same for Android.

```bash
eas workflow:run build-android-production.yml
```

### `submit-ios.yml`

Fetches the latest VALID iOS production build and uploads it to App
Store Connect. Does not submit for review.

```bash
eas workflow:run submit-ios.yml
```

### `build-and-submit-ios.yml`

Full pipeline: checks → build → upload → review submit. Runs the
scripted review-submission step against the just-uploaded build.

```bash
eas workflow:run build-and-submit-ios.yml
```

Requires the same `APP_STORE_CONNECT_*` and `APP_REVIEW_*` env vars
(see §5) configured on the EAS production environment as sensitive
values. The `.p8` private key must be uploaded to EAS env as
`APP_STORE_CONNECT_PRIVATE_KEY` (not the path).

## 8. Troubleshooting

### "App Store version is in state READY_FOR_SALE / IN_REVIEW / etc."

The version you're targeting is no longer editable. Either:
- Bump `expo.version` in `app.json` to a new version string, or
- Reset the existing version in App Store Connect back to a draftable state.

Editable states: `PREPARE_FOR_SUBMISSION`, `DEVELOPER_REJECTED`,
`REJECTED`, `METADATA_REJECTED`, `INVALID_BINARY`,
`DEVELOPER_REMOVED_FROM_SALE`.

### "First IAP/subscription not attached"

Complete the steps in §2.3 once, then set `APP_STORE_FIRST_IAP_ATTACHED=1`.
Use `--allow-first-iap-unattached` only if the IAP has already cleared
review or is intentionally excluded from this submission.

### Build processing taking forever

The script polls for up to `--wait-processing-minutes` (default 45).
Typical wait is 5–20 minutes. If you hit the cap:
- Check the build in App Store Connect — it may be stuck or rejected
- Re-run `pnpm run app-store:submit-review` once it finishes
- Override the wait cap: `--wait-processing-minutes=90`

### Transient Apple 5xx errors

The HTTP client retries 5xx and network errors 3 times with
exponential backoff. If you see a hard failure, re-run the script —
Apple's API has documented intermittent outages.

### `--dry-run` requires credentials

Dry-run gates POST/PATCH/DELETE only — GETs still hit the live App
Store Connect API. You need valid `APP_STORE_CONNECT_*` env vars even
for a dry run.

### Rejection from App Review

1. Read the rejection reason carefully (App Store Connect → Resolution Center)
2. Address each point in the rejection
3. Document the changes
4. Resubmit with detailed notes — request expedited review if it's a
   blocker

Common rejection causes:
- Missing privacy declarations
- Incomplete subscription flow / unclear pricing
- Demo account credentials don't work
- App crashes on launch or during demo flow

## Compliance notes

- Subscriptions: clear terms, transparent pricing, no external payment links
- Privacy: data collection disclosed in App Privacy declaration; GDPR/CCPA
- Authentication: provide an account-deletion path (already implemented in
  this app's Account screen via the `delete-account` edge function)

## References

- App Store Review Guidelines: <https://developer.apple.com/app-store/review/guidelines/>
- EAS Submit docs: <https://docs.expo.dev/submit/introduction/>
- App Store Connect API: <https://developer.apple.com/documentation/appstoreconnectapi>
