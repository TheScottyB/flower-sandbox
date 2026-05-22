# EAS Workflows

Non-submission EAS Workflows. For App Store submission workflows
(`build-ios-production`, `build-android-production`, `submit-ios`,
`build-and-submit-ios`), see
[release-to-app-store.md](./release-to-app-store.md).

All workflows live in `.eas/workflows/` and run via `eas workflow:run <file>.yml`
or from the EAS dashboard.

## test-and-build.yml

PR-triggered. Runs typecheck + Jest, then preview builds for iOS and Android.
The CI gate before merging to `main`.

```bash
eas workflow:run test-and-build.yml
```

## publish-update.yml

Publishes an over-the-air update when triggered. Publishes to a channel that
matches the current branch name.

```bash
eas workflow:run publish-update.yml
```

## update-production.yml

Publishes an EAS Update to the `production` channel for OTA delivery to
installed builds.

```bash
eas workflow:run update-production.yml
```

## Workflow types reference

| Type | Description |
|------|-------------|
| `build` | Creates app builds (iOS / Android) |
| `submit` | Submits builds to app stores |
| `update` | Creates and publishes updates to EAS Update |
| `get-build` | Fetches an existing build by filter (used in submit-only workflows) |

## Adding a new workflow

1. Add YAML to `.eas/workflows/<name>.yml`.
2. Add a section here describing what it does and the manual-run command.
3. If submission-related, document it in `release-to-app-store.md` instead.
