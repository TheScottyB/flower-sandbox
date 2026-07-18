# Docs consolidation design

**Status:** Approved 2026-05-22, ready for implementation plan
**Goal:** Reduce 11 top-level `.md` files to 6, with no duplication and no lost content. Move topic docs under `docs/`. Make `README.md` a true entry point.

## Current state (11 root + docs/ subtree)

```
README.md
AGENTS.md                          ← auto-managed by stripe-projects-cli
CLAUDE.md
EAS_WORKFLOWS.md                   ← 134 lines, mixed submission + ops workflows
APP_STORE_SUBMISSION_PLAN.md       ← 182 lines
APP_STORE_SUBMISSION_CHECKLIST.md  ← 93 lines
APP_STORE_AUTOMATION.md            ← 74 lines
APP_STORE_REQUIREMENTS.md          ← 163 lines
STRIPE_LIVE_MODE_SETUP.md          ← 118 lines
PRIVACY_POLICY.md
TERMS_OF_SERVICE.md
docs/plans/2026-05-22-repo-hygiene-cleanup.md       ← 716 lines, fully complete
docs/plans/archive/2026-05-22-petal-burst*.md       ← already archived ✓
```

## Target state (6 root + organized docs/)

```
README.md                          ← rewritten as entry point (~60-80 lines)
AGENTS.md                          ← unchanged (auto-managed)
CLAUDE.md                          ← unchanged
PRIVACY_POLICY.md                  ← unchanged (App Store + raw GitHub URLs)
TERMS_OF_SERVICE.md                ← unchanged

docs/
├── release-to-app-store.md        ← NEW: consolidates 5 source files (~300-400 lines)
├── eas-workflows.md               ← trimmed (~50-80 lines)
├── stripe-live-mode.md            ← moved from root
└── plans/
    ├── 2026-05-22-docs-consolidation-design.md   ← this file
    └── archive/
        ├── 2026-05-22-petal-burst-design.md
        ├── 2026-05-22-petal-burst.md
        └── 2026-05-22-repo-hygiene-cleanup.md    ← moved here (complete)
```

## Content allocation

### `docs/release-to-app-store.md` (NEW, ~300-400 lines)

Single-stop guide. Sections:

1. Prerequisites — Apple Developer account, Team ID, Bundle ID, ASC app record + ID (from `APP_STORE_SUBMISSION_PLAN.md` §1)
2. One-time ASC setup — app record creation, first IAP attachment (browser-only), privacy declaration, age rating, pricing tier (from `CHECKLIST` + `PLAN`)
3. Pre-submission asset checklist — screenshots, icon, description, keywords, support URL, privacy/terms URLs (from `CHECKLIST` + `REQUIREMENTS`)
4. Apple's asset requirements reference — screenshot dimensions table, format specs (condensed from `REQUIREMENTS`)
5. Scripted release path (`pnpm run app-store:release`) — full pipeline, required env vars, resume path (from `AUTOMATION`)
6. Manual release path — `eas build`, `eas submit`, browser steps (from `PLAN`)
7. EAS workflow runners for submission — `build-and-submit-ios.yml`, `submit-ios.yml`, `build-ios-production.yml` (from `EAS_WORKFLOWS`)
8. First-IAP browser-step guard — Apple's limitation + `APP_STORE_FIRST_IAP_ATTACHED=1` (from `AUTOMATION`)
9. Troubleshooting — common errors + fixes

### `docs/eas-workflows.md` (TRIMMED, ~50-80 lines)

Only non-submission workflows:
- `test-and-build.yml` — PR-triggered test + preview build
- `update-production.yml` — EAS Update to production channel
- `publish-update.yml` — generic update publishing

Each: trigger + what it does + how to run manually. Submission workflows get a pointer to `docs/release-to-app-store.md`.

### `docs/stripe-live-mode.md` (MOVED, ~118 lines)

Mostly a rename of `STRIPE_LIVE_MODE_SETUP.md`. Update internal cross-references where they pointed at top-level paths.

### `README.md` (REWRITTEN, ~60-80 lines)

- 2-3 sentence project description
- Stack table (kept)
- Quickstart (4 commands max)
- Documentation index linking into `docs/`
- License/contact

### Source-content tracking (nothing lost)

| Source content | Destination |
|---|---|
| `APP_STORE_SUBMISSION_PLAN.md` § 1–4 prerequisites | release-to-app-store.md §1–2 |
| `APP_STORE_SUBMISSION_PLAN.md` § 5 build/submit steps | release-to-app-store.md §6 |
| `APP_STORE_SUBMISSION_CHECKLIST.md` screenshots/metadata | release-to-app-store.md §3 |
| `APP_STORE_AUTOMATION.md` script doc | release-to-app-store.md §5, §8 |
| `APP_STORE_REQUIREMENTS.md` dimensions tables | release-to-app-store.md §4 |
| `EAS_WORKFLOWS.md` submission entries | release-to-app-store.md §7 |
| `EAS_WORKFLOWS.md` non-submission entries | eas-workflows.md |
| `STRIPE_LIVE_MODE_SETUP.md` | docs/stripe-live-mode.md (renamed) |
| `README.md` stack table + commands | README.md (kept) |
| `README.md` extensive deploy commands | release-to-app-store.md §6 |

## Migration mechanics

Use `git mv` (not delete+create) for the files we're renaming so `git log --follow` walks history. Pick the longest source file for each merge:

| Action | Command |
|---|---|
| Rename | `git mv STRIPE_LIVE_MODE_SETUP.md docs/stripe-live-mode.md` |
| Rename + trim later | `git mv EAS_WORKFLOWS.md docs/eas-workflows.md` |
| Rename + expand into merged doc | `git mv APP_STORE_SUBMISSION_PLAN.md docs/release-to-app-store.md` (longest of the 5; preserves history) |
| Delete (content folded) | `git rm APP_STORE_SUBMISSION_CHECKLIST.md` |
| Delete (content folded) | `git rm APP_STORE_AUTOMATION.md` |
| Delete (content folded) | `git rm APP_STORE_REQUIREMENTS.md` |
| Archive completed plan | `git mv docs/plans/2026-05-22-repo-hygiene-cleanup.md docs/plans/archive/` |
| In-place rewrite | `README.md` |

**Clean break, no stub redirects.** Commit message documents the move; muscle memory adjusts quickly.

## Verification

1. Zero dangling references after migration:
   ```bash
   grep -rln "APP_STORE_SUBMISSION_PLAN\|APP_STORE_SUBMISSION_CHECKLIST\|APP_STORE_AUTOMATION\|APP_STORE_REQUIREMENTS\|EAS_WORKFLOWS\|STRIPE_LIVE_MODE_SETUP" . --include="*.md" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" --include="*.yml" --include="*.yaml" | grep -v node_modules | grep -v docs/plans/archive
   ```
   Should return zero matches outside archive.

2. Content coverage: walk the source-content tracking table; every row's left side has a destination.

3. `pnpm typecheck && pnpm test`: still pass (sanity — no docs are referenced in code, but verify).

4. `git log --follow docs/release-to-app-store.md`: shows history from `APP_STORE_SUBMISSION_PLAN.md`.

5. README's "Documentation" section: every link resolves to a real file under `docs/`.

## Out of scope

- `.agents/skills/**/*.md` — auto-managed by Stripe Projects CLI, don't touch
- `node_modules/**/*.md` — third-party
- Content edits beyond dedup and cross-reference updates — just consolidate; don't rewrite for style
- Translation of policy / legal docs
- Adding new docs that don't exist today
