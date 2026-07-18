# Docs Consolidation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use @superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce 11 top-level `.md` files to 6 by consolidating the App Store cluster into one doc, trimming EAS_WORKFLOWS to non-submission workflows, moving topic docs under `docs/`, and rewriting README as a true entry point.

**Architecture:** Six atomic commits, each independent and revertible. Order chosen so the riskiest commit (the 5-file App Store merge) is preceded by easier renames that warm up the routine. Final verification confirms zero dangling references.

**Tech Stack:** Markdown, git mv, grep verification. No code changes — pure docs consolidation.

**Design doc:** `docs/plans/2026-05-22-docs-consolidation-design.md`

---

## Pre-flight

Before starting:

```bash
cd /Users/scottybe/workspace/flower-sandbox
git status --short    # Expect clean
git log -1            # Expect HEAD at 724ec2c (design doc) or later
pnpm test             # Expect 1/1 pass
pnpm typecheck        # Expect exit 0
```

If working tree is dirty, stop and ask. Working on `main` per session pattern.

---

## Task 1: Archive the completed repo-hygiene plan

**Files:**
- Move: `docs/plans/2026-05-22-repo-hygiene-cleanup.md` → `docs/plans/archive/2026-05-22-repo-hygiene-cleanup.md`

**Rationale:** All 9 tasks in that plan landed in commits between `a505c8b` and `5b2872f` (verified in earlier session). Sitting at top level of `docs/plans/` clutters the active-work view.

**Step 1: Move with `git mv`**

```bash
git mv docs/plans/2026-05-22-repo-hygiene-cleanup.md docs/plans/archive/
```

**Step 2: Verify**

```bash
ls docs/plans/                  # Expect: just the active design + plan files
ls docs/plans/archive/          # Expect: petal-burst-design.md, petal-burst.md, repo-hygiene-cleanup.md
git status --short              # Expect: one R (renamed) entry
```

**Step 3: Commit**

```bash
git commit -m "chore(docs): archive completed repo-hygiene cleanup plan

All 9 tasks in the plan landed between a505c8b and 5b2872f. Move to
docs/plans/archive/ alongside the petal-burst plans."
```

---

## Task 2: Move stripe-live-mode under docs/

**Files:**
- Move: `STRIPE_LIVE_MODE_SETUP.md` → `docs/stripe-live-mode.md`
- Possible cross-reference updates in other docs

**Step 1: Rename**

```bash
git mv STRIPE_LIVE_MODE_SETUP.md docs/stripe-live-mode.md
```

**Step 2: Update any references to the old path**

Find them:

```bash
grep -rln "STRIPE_LIVE_MODE_SETUP" --include="*.md" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" --include="*.yml" --include="*.yaml" . | grep -v node_modules | grep -v docs/plans/archive | grep -v "STRIPE_LIVE_MODE_SETUP.md"
```

Likely hits: `README.md`, possibly `CLAUDE.md`. For each hit, update the path:
- `STRIPE_LIVE_MODE_SETUP.md` → `docs/stripe-live-mode.md`
- `./STRIPE_LIVE_MODE_SETUP.md` → `docs/stripe-live-mode.md` (relative to repo root)

If a file in `docs/` references it, the path becomes `./stripe-live-mode.md` (same dir).

**Step 3: Verify no internal references remain to the old name**

```bash
grep -rln "STRIPE_LIVE_MODE_SETUP" --include="*.md" . | grep -v node_modules | grep -v docs/plans/archive
```

Should return zero matches outside archive.

**Step 4: Run sanity checks**

```bash
pnpm typecheck && pnpm test
```

Both should still pass (no code changes).

**Step 5: Commit**

```bash
git add -A
git commit -m "docs: move STRIPE_LIVE_MODE_SETUP.md to docs/stripe-live-mode.md

Pure rename; updated internal cross-references. Live ops are a topic
doc, not a repo entry point — belongs under docs/."
```

---

## Task 3: Move + trim EAS_WORKFLOWS to non-submission workflows

**Files:**
- Move: `EAS_WORKFLOWS.md` → `docs/eas-workflows.md`
- Modify: `docs/eas-workflows.md` after move — strip submission-workflow sections
- Possible cross-reference updates

**Strategy:** Move first (preserves history), then edit content in a second commit. Or do it in one commit — the content edit is straightforward enough.

**Step 1: Move**

```bash
git mv EAS_WORKFLOWS.md docs/eas-workflows.md
```

**Step 2: Read the current content**

```bash
cat docs/eas-workflows.md
```

Identify the sections about:
- `build-ios-production.yml` → DELETE from this file (moves to release-to-app-store.md in Task 4)
- `build-android-production.yml` → DELETE (App Store submission territory)
- `submit-ios.yml` → DELETE (App Store submission)
- `build-and-submit-ios.yml` → DELETE (App Store submission)
- `test-and-build.yml` → KEEP (CI for PRs)
- `update-production.yml` → KEEP (EAS Update)
- `publish-update.yml` → KEEP if exists

**Step 3: Rewrite as the trimmed catalog**

Replace the contents of `docs/eas-workflows.md` with this template (adjust based on actual content):

```markdown
# EAS Workflows

Non-submission EAS Workflows. For App Store submission workflows
(`build-ios-production`, `submit-ios`, `build-and-submit-ios`), see
[release-to-app-store.md](./release-to-app-store.md).

All workflows live in `.eas/workflows/` and run via `eas workflow:run <file>.yml`
or `pnpm exec eas workflow:run <file>.yml` from the EAS dashboard.

## test-and-build.yml

PR-triggered. Runs typecheck + Jest, then a preview build for iOS and Android.
Used as the CI gate before merging to `main`.

Trigger: `pull_request` to `main`.

Manual run:
\`\`\`bash
eas workflow:run test-and-build.yml
\`\`\`

## update-production.yml

Publishes an EAS Update to the `production` channel for OTA delivery to
installed builds.

Trigger: manual.

Manual run:
\`\`\`bash
eas workflow:run update-production.yml
\`\`\`

## publish-update.yml

Generic EAS Update publisher. Triggers as configured in the workflow file.

Manual run:
\`\`\`bash
eas workflow:run publish-update.yml
\`\`\`

## Adding a new workflow

1. Add YAML to `.eas/workflows/<name>.yml`.
2. Add a section here describing trigger, purpose, and manual-run command.
3. If submission-related, add to `release-to-app-store.md` instead.
```

**Step 4: Update cross-references**

```bash
grep -rln "EAS_WORKFLOWS" --include="*.md" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" --include="*.yml" --include="*.yaml" . | grep -v node_modules | grep -v docs/plans/archive | grep -v "docs/eas-workflows.md"
```

Update each hit: `EAS_WORKFLOWS.md` → `docs/eas-workflows.md` or `./eas-workflows.md` (depending on the referrer's location).

Likely files: `README.md`, possibly `CLAUDE.md`, possibly `APP_STORE_*.md` (which are about to be deleted/merged in Task 4 — references will move with that content).

**Step 5: Verify**

```bash
grep -rln "EAS_WORKFLOWS" --include="*.md" . | grep -v node_modules | grep -v docs/plans/archive
# Should return zero matches outside archive.
pnpm typecheck && pnpm test
```

**Step 6: Commit**

```bash
git add -A
git commit -m "docs: trim EAS_WORKFLOWS to non-submission workflows + move to docs/

Submission workflows (build-ios-production, submit-ios,
build-and-submit-ios) will live in docs/release-to-app-store.md (Task 4).
This file is now the catalog for test-and-build, update-production, and
publish-update only. Updated cross-references."
```

---

## Task 4: Consolidate the 5-file App Store cluster into one doc

**This is the big one.** ~646 lines across 5 source files merge into one ~300-400 line doc.

**Files:**
- Move: `APP_STORE_SUBMISSION_PLAN.md` → `docs/release-to-app-store.md` (longest source = best history-preserving choice)
- Delete: `APP_STORE_SUBMISSION_CHECKLIST.md`
- Delete: `APP_STORE_AUTOMATION.md`
- Delete: `APP_STORE_REQUIREMENTS.md`
- Modify: `docs/release-to-app-store.md` (rewrite as consolidated guide)
- Possible cross-reference updates

**Step 1: Move the longest source file**

```bash
git mv APP_STORE_SUBMISSION_PLAN.md docs/release-to-app-store.md
```

This preserves history for the largest single source.

**Step 2: Read all 5 source files (the moved one + the 3 still-existing siblings)**

```bash
cat docs/release-to-app-store.md
cat APP_STORE_SUBMISSION_CHECKLIST.md
cat APP_STORE_AUTOMATION.md
cat APP_STORE_REQUIREMENTS.md
cat EAS_WORKFLOWS.md  # Now at docs/eas-workflows.md after Task 3 — but read what submission-workflow content existed there originally
```

You may also want `git log --follow` on each to see context.

**Step 3: Rewrite `docs/release-to-app-store.md` as the consolidated guide**

Use this section structure (per the approved design):

```markdown
# Release to App Store

End-to-end iOS submission guide. Covers the one-time App Store Connect
setup, pre-submission checklist, scripted release flow, manual release
flow, and EAS Workflow runners.

## 1. Prerequisites

[From APP_STORE_SUBMISSION_PLAN.md §1: Apple Developer Account, Team ID,
Bundle ID, ASC app record, ascAppId in eas.json]

## 2. One-time App Store Connect setup

[From PLAN + CHECKLIST: app record creation, first IAP/subscription
attachment via browser, App Privacy declaration, age rating, pricing tier]

### First IAP attachment (one-time browser step)

[From AUTOMATION: the browser-only step Apple requires for the first
subscription. After completing it once, set APP_STORE_FIRST_IAP_ATTACHED=1
in your .env]

## 3. Pre-submission asset checklist

[From CHECKLIST: screenshots, app icon, description, keywords, support URL,
privacy URL, terms URL, app preview videos (optional)]

## 4. Apple's asset requirements reference

[From REQUIREMENTS, condensed:
- Screenshot dimensions per device class (table)
- App icon dimensions + format
- Image format specs (PNG, color profile, etc.)]

## 5. Scripted release path (recommended)

[From AUTOMATION:
- `pnpm run app-store:release` overview
- Required env vars table (APP_STORE_CONNECT_*, APP_REVIEW_*)
- Resume path after failure: `pnpm run app-store:submit-review`
- Useful flags: --dry-run, --skip-eas-upload, --skip-review-submit,
  --allow-first-iap-unattached]

## 6. Manual release path

[From PLAN §5:
- `eas build --platform ios --profile production`
- `eas submit --platform ios --profile production`
- Browser steps for App Review submission]

## 7. EAS workflow runners for submission

[From EAS_WORKFLOWS (the submission entries):
- `build-ios-production.yml` — just build, no submit (manual)
- `submit-ios.yml` — submit existing build (manual)
- `build-and-submit-ios.yml` — full pipeline: checks + build + submit + review (manual)
Each: trigger, what it does, manual run command.]

## 8. Troubleshooting

[From PLAN + AUTOMATION:
- "First IAP not attached" — what it means, how to fix
- "Build processing taking forever" — typical wait times, escalation
- "Version in non-draftable state" — when this happens, how to reset]
```

**Step 4: Delete the 3 source files whose content has been folded in**

```bash
git rm APP_STORE_SUBMISSION_CHECKLIST.md
git rm APP_STORE_AUTOMATION.md
git rm APP_STORE_REQUIREMENTS.md
```

**Step 5: Update cross-references**

```bash
grep -rln "APP_STORE_SUBMISSION_PLAN\|APP_STORE_SUBMISSION_CHECKLIST\|APP_STORE_AUTOMATION\|APP_STORE_REQUIREMENTS" --include="*.md" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" --include="*.yml" --include="*.yaml" . | grep -v node_modules | grep -v docs/plans/archive
```

Update each hit. Likely places: `README.md`, `CLAUDE.md`, `docs/eas-workflows.md` if it cross-references.

**Step 6: Verify**

```bash
# Zero dangling references outside archive.
grep -rln "APP_STORE_SUBMISSION_PLAN\|APP_STORE_SUBMISSION_CHECKLIST\|APP_STORE_AUTOMATION\|APP_STORE_REQUIREMENTS" --include="*.md" . | grep -v node_modules | grep -v docs/plans/archive

# History walks through the rename.
git log --follow docs/release-to-app-store.md | head -10

# Sanity.
pnpm typecheck && pnpm test
```

**Step 7: Commit**

```bash
git add -A
git commit -m "docs: consolidate 5-file App Store cluster into docs/release-to-app-store.md

APP_STORE_SUBMISSION_PLAN (renamed via git mv to preserve history) +
APP_STORE_SUBMISSION_CHECKLIST + APP_STORE_AUTOMATION +
APP_STORE_REQUIREMENTS + submission entries from EAS_WORKFLOWS now live
in a single docs/release-to-app-store.md.

Structure: prerequisites, one-time ASC setup (including first-IAP
browser step), pre-submission asset checklist, Apple's requirements
reference, scripted release path, manual release path, EAS workflow
runners, troubleshooting.

Deleted (content folded): APP_STORE_SUBMISSION_CHECKLIST.md,
APP_STORE_AUTOMATION.md, APP_STORE_REQUIREMENTS.md.

Clean break — no stub redirects."
```

---

## Task 5: Rewrite README as the project entry point

**Files:**
- Modify: `README.md`

**Strategy:** Keep the existing stack table + add a clean documentation index. Drop the extensive deploy-command list (that's in release-to-app-store.md now).

**Step 1: Read current README**

```bash
cat README.md
```

Identify: title/description (keep), stack table (keep), commands (trim to quickstart only), deploy details (delete — link to docs/), license/contact (keep if present).

**Step 2: Rewrite as ~60-80 lines**

Template:

```markdown
# FlowerSandbox

FlowerSandbox is an Expo mobile app with Supabase auth and Stripe Checkout
payments for a monthly subscription and one-time donations.

## Stack

| Layer | Technology |
| --- | --- |
| Framework | Expo SDK 56, expo-router (file-based routing) |
| Language | TypeScript (strict), React 19 |
| Runtime | React Native 0.85 (New Architecture enabled) |
| Backend | Supabase (auth, Postgres, Edge Functions) |
| Payments | Stripe (Checkout Sessions, webhooks) + StoreKit (iOS subscription via expo-iap) |
| Package manager | pnpm 11 (`node-linker=hoisted`) |
| Node | ≥ 22.13.0 (pinned via `engines.node`) |
| Builds / OTA | EAS Build + EAS Update |

## Quickstart

\`\`\`bash
pnpm install
pnpm run dev              # Start Expo dev server
pnpm typecheck && pnpm test
\`\`\`

See [docs/](./docs/) for full documentation.

## Documentation

| Topic | Doc |
| --- | --- |
| Live Stripe + Supabase operations | [docs/stripe-live-mode.md](./docs/stripe-live-mode.md) |
| App Store release (scripted + manual) | [docs/release-to-app-store.md](./docs/release-to-app-store.md) |
| EAS Workflows (non-submission) | [docs/eas-workflows.md](./docs/eas-workflows.md) |
| Active plans + archive | [docs/plans/](./docs/plans/) |

## Agentic assistants

Working in this repo with an AI assistant? See [CLAUDE.md](./CLAUDE.md) for
project conventions and [AGENTS.md](./AGENTS.md) for Stripe Projects CLI
integration.

## Legal

- [Privacy Policy](./PRIVACY_POLICY.md)
- [Terms of Service](./TERMS_OF_SERVICE.md)
```

Tune the wording to match the existing README's voice; keep what's good, drop what's redundant.

**Step 3: Verify**

```bash
# Read it.
cat README.md

# Make sure all internal links resolve.
grep -oE '\]\([^)]+\)' README.md | sed 's/^](//; s/)$//' | while read -r path; do
  case "$path" in
    http*) ;;  # external link, skip
    *) [ -e "$path" ] || echo "BROKEN: $path" ;;
  esac
done

pnpm typecheck && pnpm test
```

**Step 4: Commit**

```bash
git add README.md
git commit -m "docs(readme): rewrite as project entry point with documentation index

Trim the extensive deploy-command list (now in docs/release-to-app-store.md).
Keep stack table + quickstart. Add a Documentation table linking into
docs/. Add explicit Agentic-assistants section pointing at CLAUDE.md and
AGENTS.md. Reduced from 136 to ~60-80 lines."
```

---

## Task 6: Final verification + push

**Files:** none (verification only)

**Step 1: Confirm the new top-level layout**

```bash
ls *.md
```

Expect exactly 5 files: `README.md`, `AGENTS.md`, `CLAUDE.md`, `PRIVACY_POLICY.md`, `TERMS_OF_SERVICE.md`.

(Original target was 6; AGENTS.md is auto-managed by stripe-projects-cli.
The other "top-level" files are these 5.)

**Step 2: Confirm the new docs/ layout**

```bash
ls docs/
```

Expect: `release-to-app-store.md`, `eas-workflows.md`, `stripe-live-mode.md`, `plans/`.

```bash
ls docs/plans/
```

Expect: design docs (`2026-05-22-docs-consolidation-design.md`, possibly others), `archive/`.

```bash
ls docs/plans/archive/
```

Expect: `2026-05-22-petal-burst-design.md`, `2026-05-22-petal-burst.md`, `2026-05-22-repo-hygiene-cleanup.md`.

**Step 3: Zero dangling references**

```bash
grep -rln "APP_STORE_SUBMISSION_PLAN\|APP_STORE_SUBMISSION_CHECKLIST\|APP_STORE_AUTOMATION\|APP_STORE_REQUIREMENTS\|EAS_WORKFLOWS\|STRIPE_LIVE_MODE_SETUP" --include="*.md" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" --include="*.yml" --include="*.yaml" . | grep -v node_modules | grep -v docs/plans/archive
```

Should return zero matches outside archive.

**Step 4: Content coverage walk**

Open the design doc's "Source-content tracking" table. For each row:
- Open the destination file
- `grep` for a key phrase from the source content
- Confirm it's there (with at most light editing for flow)

If any row is missing → return to Task 4 and add the missing content.

**Step 5: History walks**

```bash
git log --follow docs/release-to-app-store.md | head -5
git log --follow docs/stripe-live-mode.md | head -5
git log --follow docs/eas-workflows.md | head -5
```

Each should show commits from the original filename (proves `git mv` was used).

**Step 6: Final test+typecheck**

```bash
pnpm typecheck && pnpm test
```

Both pass.

**Step 7: Push**

```bash
git push origin main
```

---

## Done means

- 5 top-level `.md` files (down from 11): `README.md`, `AGENTS.md`, `CLAUDE.md`, `PRIVACY_POLICY.md`, `TERMS_OF_SERVICE.md`
- 3 topic docs under `docs/`: `release-to-app-store.md`, `eas-workflows.md`, `stripe-live-mode.md`
- `docs/plans/archive/` contains all completed plans
- Zero references to old filenames outside `docs/plans/archive/`
- `git log --follow` walks through the renames
- All source content from the 5 App-Store files is present in `docs/release-to-app-store.md`
- README is ~60-80 lines, has a Documentation index
- `pnpm typecheck && pnpm test` still pass
- 6 commits land cleanly (one per Task)

---

## Out of scope

- `.agents/skills/**/*.md` — stripe-projects-cli auto-managed
- Rewriting content for style beyond consolidation
- Adding new documentation that doesn't exist today
- Translation of legal docs
