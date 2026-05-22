# Repo Hygiene Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Address the 14 follow-up findings from the post-CI-debugging repo review in atomic, easily-revertible commits.

**Architecture:** Each task is one logical commit with verification (`pnpm typecheck && pnpm test`). Independent tasks ordered by risk: highest-impact / lowest-risk first (CI gates, code fixes), file removals last (irreversible). No new tests required — most changes are config/file/dead-code removal that the existing test suite + typecheck already covers.

**Tech Stack:** TypeScript, Expo SDK 56, EAS Build, pnpm 11, GitHub Actions.

**Source:** Findings from three parallel review agents on commit range `1680bcd..1418b77` (see chat session 2026-05-22).

---

## Pre-flight

Before starting any task:

```bash
cd /Users/scottybe/workspace/flower-sandbox
git status --short    # Expect clean
git log -1            # Expect HEAD at 1418b77 or later
pnpm test             # Expect 1/1 pass
pnpm typecheck        # Expect exit 0
```

If `git status` is not clean, stop and ask. We're working on `main` directly per the user's iteration style; if that changes (e.g., user wants a worktree), update this plan first.

---

## Task 1: Unify Node version across the repo

**Files:**
- Modify: `eas.json` (move `node` from production-only to a position that covers preview too)
- Modify: `package.json` (add `engines.node`)

**Problem:** Currently `eas.json` pins `node: "22.13.0"` only in the `production` profile. The `preview` and `development` profiles default to whatever Node EAS gives them — including macOS-Sonoma-stable's Node 18, which lacks `Array.toReversed()` (the bug we just fixed for production). Next PR will trigger preview build → same failure.

**Step 1: Add `engines.node` to package.json**

Edit `package.json`, add right before `"dependencies":`:

```json
  "engines": {
    "node": ">=22.13.0"
  },
```

EAS reads this as a fallback Node-version constraint across all profiles. Volta locally still uses 24.16.0 (above the floor, fine).

**Step 2: Remove the production-profile `node` override (now redundant)**

Edit `eas.json`, in the `production` profile, delete the `"node": "22.13.0",` line that was added in commit `164f766`/`1418b77`. The `engines.node` field now covers all profiles uniformly.

**Step 3: Verify**

```bash
pnpm install                # Verify lockfile / engine check passes
pnpm typecheck              # Expect exit 0
pnpm test                   # Expect 1/1 pass
git diff eas.json package.json
```

**Step 4: Commit**

```bash
git add eas.json package.json
git commit -m "fix(node): unify Node version pin via package.json#engines.node

Previously only the EAS production profile pinned Node 22.13.0 (commit
164f766 + 1418b77). The preview profile defaults to whatever the EAS
image ships, which is Node 18 on macOS-Sonoma-stable — same bug we just
fixed for production. Lift the constraint into package.json#engines.node
so EAS reads it for every profile and Volta-vs-EAS dev parity is
documented in one place."
```

---

## Task 2: Wire EAS Update properly (channel + url)

**Files:**
- Modify: `app.json` (add `expo.updates.url`)
- Modify: `eas.json` (add `channel` to production profile)

**Problem:** `app.json` has `expo.updates.enabled: true` but no `expo.updates.url`. EAS Update needs the URL to know where to fetch updates from. Without it, installed clients silently ignore `pnpm update:production`. Additionally, the production profile in eas.json doesn't declare `channel: "production"` — only the workflow file does. Direct `eas build` invocations (per `package.json` script `build:production`) go to the default channel instead.

**Step 1: Add `expo.updates.url` to app.json**

In `app.json`, change:

```json
    "updates": {
      "enabled": true
    },
```

to:

```json
    "updates": {
      "enabled": true,
      "url": "https://u.expo.dev/1539cc0b-c507-4fac-8383-979f12f5bdd8"
    },
```

(The UUID matches `extra.eas.projectId`.)

**Step 2: Add `channel` to eas.json production profile**

In `eas.json`, in the `production` profile block, after `"distribution": "store",`, add:

```json
      "channel": "production",
```

So the block reads:

```json
    "production": {
      "distribution": "store",
      "channel": "production",
      "ios": { ... },
      ...
    },
```

**Step 3: Verify**

```bash
pnpm typecheck    # exit 0
pnpm test         # 1/1 pass
git diff app.json eas.json
```

Optional: try `npx eas-cli@latest update:configure --non-interactive` to confirm EAS recognizes the wired update channel. (Don't run an actual update.)

**Step 4: Commit**

```bash
git add app.json eas.json
git commit -m "fix(eas-update): wire updates.url and production channel

app.json had updates.enabled=true but no url → installed clients had
no endpoint to fetch updates from, so pnpm update:production was a
no-op for users. Add the canonical EAS Update URL with the projectId.

eas.json production profile didn't declare channel → direct
eas build --profile production invocations went to the default channel
rather than 'production'. Adding the field at profile level makes
both workflow-driven and CLI-driven builds agree."
```

---

## Task 3: Clean placeholder envs in eas.json dev/preview profiles

**Files:**
- Modify: `eas.json`

**Problem:** The `development` and `preview` profiles have placeholder env values like `"SUPABASE_PROJECT_ID": "your_dev_project_id"` and `"EXPO_PUBLIC_SUPABASE_URL": "https://your_dev_project_id.supabase.co"`. If anyone runs `eas build --profile development`, these literal strings end up in the bundle — the app will fail at `createClient(supabaseUrl, supabaseAnonKey)` because the URL doesn't resolve.

**Decision:** Remove the placeholder `env` blocks entirely from `development`, `preview`, and `development-simulator` profiles. EAS will fall back to local `.env` values during build, which is what the project actually uses in practice.

**Step 1: Read current eas.json**

```bash
cat /Users/scottybe/workspace/flower-sandbox/eas.json
```

Confirm three profiles have placeholder `env` blocks: `development`, `preview`, `development-simulator`.

**Step 2: Remove the placeholder env blocks**

Edit `eas.json`. For each of `development`, `preview`, and `development-simulator`, delete the entire `"env": { ... }` block. **Keep production's env block as-is** (that's real live config, separate decision in follow-up).

The shape becomes:

```json
"development": {
  "developmentClient": true,
  "distribution": "internal",
  "ios": { "simulator": true, "resourceClass": "m-medium" }
},
"preview": {
  "distribution": "internal",
  "ios": { "resourceClass": "m-medium" }
},
...
"development-simulator": {
  "developmentClient": true,
  "distribution": "internal",
  "ios": { "simulator": true },
  "environment": "development"
}
```

**Step 3: Verify**

```bash
python3 -c "import json; json.load(open('eas.json'))"   # Valid JSON
pnpm typecheck    # exit 0
pnpm test         # pass
```

**Step 4: Commit**

```bash
git add eas.json
git commit -m "fix(eas): remove placeholder envs from dev/preview profiles

The development, preview, and development-simulator profiles had
'env' blocks full of literal placeholder strings ('your_dev_project_id'
etc.). Anyone running 'eas build --profile development' got those
strings baked into the bundle, causing Supabase init to fail.

Removed entirely so EAS falls back to local .env values, which is what
this project actually uses. Production profile env block unchanged
(real live config; moving it to EAS dashboard env vars is a separate
follow-up)."
```

---

## Task 4: Remove ignored ios.buildNumber + cruft from app.json

**Files:**
- Modify: `app.json`

**Problem:** `app.json#ios.buildNumber: "1"` is ignored when `eas.json#cli.appVersionSource: "remote"` (which it is). `app.json#ios.LSApplicationQueriesSchemes: ["https", "http"]` is no-op — `LSApplicationQueriesSchemes` is for declaring intent to query other apps' URL schemes via `canOpenURL:`, and `https`/`http` are not other apps. Both fields are cruft that may trigger App Review questions.

**Step 1: Remove buildNumber**

Edit `app.json`, in the `ios` block, delete the line:

```json
      "buildNumber": "1",
```

**Step 2: Remove LSApplicationQueriesSchemes**

Edit `app.json`, in `ios.infoPlist`, delete:

```json
        "LSApplicationQueriesSchemes": [
          "https",
          "http"
        ],
```

**Step 3: Verify**

```bash
python3 -c "import json; json.load(open('app.json'))"
pnpm typecheck
pnpm test
```

**Step 4: Commit**

```bash
git add app.json
git commit -m "chore(app.json): remove ignored buildNumber + no-op queries schemes

ios.buildNumber: '1' is ignored under eas.json#cli.appVersionSource:
'remote' (EAS owns the build number). Leaving it is misleading.

ios.infoPlist.LSApplicationQueriesSchemes: ['https', 'http'] is no-op;
that key declares intent to query OTHER apps' URL schemes via
canOpenURL: — https/http are universal schemes that don't go through
that mechanism. Apple's review tooling may flag it as a permissions
overreach. Removed."
```

---

## Task 5: Memoize stem randomization in Flower.tsx

**Files:**
- Modify: `src/components/Flower.tsx` (lines ~130-134)

**Problem:** `Flower.tsx` computes `stemHeight = 40 + (Math.random() * 20)` and a string `.replace()` on every render. Result: each existing flower's stem visibly shifts when the parent re-renders (e.g., when a new flower is planted, all existing flowers' stems wiggle). Computation is also wasted.

**Step 1: Locate the code**

```bash
sed -n '125,140p' /Users/scottybe/workspace/flower-sandbox/src/components/Flower.tsx
```

You should see:

```tsx
  // Random stem height variation
  const stemHeight = 40 + (Math.random() * 20);
  const adjustedStem = flowerData.stem.replace(
    'M50 100 C50 100, 50 80, 50 60',
    `M50 100 C50 100, 50 ${80 - (stemHeight - 40)}, 50 ${60 - (stemHeight - 40)}`
  );
```

**Step 2: Wrap in useMemo**

Replace those lines with:

```tsx
  // Random stem height — computed once per mount so existing flowers don't wiggle on parent re-renders.
  const adjustedStem = React.useMemo(() => {
    const stemHeight = 40 + Math.random() * 20;
    return flowerData.stem.replace(
      'M50 100 C50 100, 50 80, 50 60',
      `M50 100 C50 100, 50 ${80 - (stemHeight - 40)}, 50 ${60 - (stemHeight - 40)}`,
    );
  }, [flowerData.stem]);
```

(If `flowerData.stem` is a constant per `type` and `type` is a prop, `[flowerData.stem]` correctly busts the memo when type changes — though type rarely changes for a mounted flower.)

**Step 3: Verify**

```bash
pnpm typecheck
pnpm test
```

The existing PetalBurst test should still pass. The visual fix is hand-verifiable but doesn't need a new automated test (per YAGNI).

**Step 4: Commit**

```bash
git add src/components/Flower.tsx
git commit -m "perf(flower): memoize stem randomization

Previously Flower computed stemHeight via Math.random() and a string
replace on every render. Each existing flower's stem visibly wiggled
whenever the parent (FlowerField) re-rendered. Wrap in useMemo keyed
on flowerData.stem so it runs once per mount.

Tested via PetalBurst test suite (still passes); visual regression
verifiable by planting a 2nd flower and watching existing ones — they
should now sit still."
```

---

## Task 6: Decide useFrameworkReady — keep + fix, or delete

**Files:**
- Modify: `hooks/useFrameworkReady.ts` (one-line fix if keeping) OR delete
- Modify: `app/_layout.tsx` (only if deleting useFrameworkReady)

**Problem:** `useFrameworkReady` calls `window.frameworkReady?.()` — a Bolt.new template artifact. On native, `window` and `frameworkReady` are undefined; the hook is effectively a no-op. The current `useEffect` has no deps array, so it fires after every render of the root layout (cheap but unidiomatic).

**Two viable paths:**

**Path A (recommended): Delete it.** Bolt.new is no longer the active platform; the hook is dead-code carrying a brand signal from a previous tool.

**Path B: Keep + fix the deps.** If there's a non-obvious reason to keep the framework-ready signal (e.g., for hot-reload integration), add `[]` deps so it only fires once on mount.

**Decision criterion:** check `.bolt/config.json`. If you don't intend to bolt back to Bolt.new, choose Path A.

### Path A — Delete

**Step A1:** Delete `hooks/useFrameworkReady.ts`:

```bash
rm /Users/scottybe/workspace/flower-sandbox/hooks/useFrameworkReady.ts
```

If `hooks/` becomes empty after this, also remove it:

```bash
rmdir /Users/scottybe/workspace/flower-sandbox/hooks 2>/dev/null || true
```

**Step A2:** Edit `/Users/scottybe/workspace/flower-sandbox/app/_layout.tsx`. Delete the import line at line 7:

```tsx
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
```

And the call inside `RootLayout()` (around line 12):

```tsx
  useFrameworkReady();
```

**Step A3:** Verify:

```bash
pnpm typecheck    # exit 0 (no other consumers)
pnpm test         # pass
```

**Step A4:** Commit:

```bash
git add hooks app/_layout.tsx
git commit -m "chore: remove Bolt.new useFrameworkReady artifact

The useFrameworkReady hook was a Bolt.new template signal calling
window.frameworkReady?.() — a no-op on native (no window global) and
unused anywhere else. The project is no longer scaffolded via Bolt.
Delete the hook and its single caller in app/_layout.tsx."
```

### Path B — Keep + fix deps

**Step B1:** Edit `hooks/useFrameworkReady.ts`, change:

```tsx
  useEffect(() => {
    window.frameworkReady?.();
  });
```

to:

```tsx
  useEffect(() => {
    window.frameworkReady?.();
  }, []);
```

**Step B2:** Verify + commit:

```bash
pnpm typecheck
pnpm test
git add hooks/useFrameworkReady.ts
git commit -m "fix(hooks): add empty deps to useFrameworkReady so it only fires once on mount"
```

---

## Task 7: Remove dead code (verified unreferenced)

**Files:**
- Delete: `src/hooks/useStripeProducts.ts`
- Delete: `scripts/verify-stripe-setup.js`
- Delete: `scripts/update-supabase-env.js`
- Delete: `test-url.js`
- Modify: `src/utils/polyfills.ts` (remove `ensurePolyfills()` and `console.log`)

**Problem:** All four files have zero callers (verified by grep across `*.ts/tsx/js/json/yml/md` excluding `node_modules`). `polyfills.ts` exports `ensurePolyfills` that no one imports, and logs `console.log('Polyfills initialized')` on every app launch in every environment.

**Pre-flight verification (do this BEFORE deleting — it might have changed):**

```bash
cd /Users/scottybe/workspace/flower-sandbox
echo "useStripeProducts callers:"
grep -rn "useStripeProducts" --include="*.ts" --include="*.tsx" --include="*.js" . 2>/dev/null | grep -v node_modules | grep -v "src/hooks/useStripeProducts" | head
echo ""
echo "verify-stripe-setup callers:"
grep -rn "verify-stripe-setup" --include="*.json" --include="*.yml" --include="*.yaml" --include="*.md" --include="*.ts" --include="*.tsx" --include="*.js" . 2>/dev/null | grep -v node_modules | grep -v "scripts/verify-stripe-setup.js" | head
echo ""
echo "update-supabase-env callers:"
grep -rn "update-supabase-env" --include="*.json" --include="*.yml" --include="*.yaml" --include="*.md" --include="*.ts" --include="*.tsx" --include="*.js" . 2>/dev/null | grep -v node_modules | grep -v "scripts/update-supabase-env.js" | head
echo ""
echo "test-url callers:"
grep -rn "test-url" --include="*.json" --include="*.yml" --include="*.yaml" --include="*.md" --include="*.ts" --include="*.tsx" --include="*.js" . 2>/dev/null | grep -v node_modules | grep -v "^./test-url.js" | head
echo ""
echo "ensurePolyfills callers:"
grep -rn "ensurePolyfills" --include="*.ts" --include="*.tsx" --include="*.js" . 2>/dev/null | grep -v node_modules | head
```

All five greps should return ZERO results (besides the definitions themselves). If any returns a hit, STOP and investigate before deleting.

**Step 1: Delete the four files**

```bash
rm src/hooks/useStripeProducts.ts
rm scripts/verify-stripe-setup.js
rm scripts/update-supabase-env.js
rm test-url.js
```

If `scripts/` or `src/hooks/` becomes empty, remove the dir too:

```bash
rmdir scripts 2>/dev/null || true
rmdir src/hooks 2>/dev/null || true
```

**Step 2: Clean up `src/utils/polyfills.ts`**

Replace the entire file content with:

```ts
/**
 * Polyfills for React Native compatibility.
 * Must be imported before any other module that touches URL or web streams.
 */

import 'react-native-url-polyfill/auto';
import 'web-streams-polyfill/ponyfill/es6';
```

(Removes the `console.log` that fires on every launch and the unused `ensurePolyfills` export.)

**Step 3: Verify**

```bash
pnpm typecheck    # Expect exit 0
pnpm test         # Expect 1/1 pass
git status --short
```

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove dead code (5 unreferenced files + 2 dead exports)

Verified unreferenced via repo-wide grep:
- src/hooks/useStripeProducts.ts: 124 lines, no callers; product fetching
  is done by app/(tabs)/* directly via the stripe-products edge function
- scripts/verify-stripe-setup.js: 156 lines, no callers anywhere (not
  in npm scripts, not in EAS workflows, not in GitHub Actions). Wraps
  the Stripe CLI for one-off checks.
- scripts/update-supabase-env.js: 261 lines, no callers; same secret-set
  flow is done in .github/workflows/deploy-and-update-env.yml.
- test-url.js: debug leftover from URL polyfill testing.
- src/utils/polyfills.ts ensurePolyfills() + the console.log('Polyfills
  initialized') line that fired on every app cold-start in production.

Total: ~570 lines of dead code removed."
```

---

## Task 8: Untrack `supabase/.temp/linked-project.json`

**Files:**
- Modify: git index (untrack the file; leave on disk)

**Problem:** `.gitignore:49` says `supabase/.temp/` which should ignore the dir, but the file was committed before the gitignore rule. It contains `{"ref":"srtlalaecgejgghwwfmk", ...}` — local Supabase CLI cache that shouldn't be source-controlled.

**Step 1: Verify it's tracked**

```bash
git ls-files supabase/.temp/
```

If this returns `supabase/.temp/linked-project.json`, proceed.

**Step 2: Untrack**

```bash
git rm --cached supabase/.temp/linked-project.json
```

**Step 3: Verify .gitignore catches it**

```bash
git check-ignore -v supabase/.temp/linked-project.json
# Expect: .gitignore:NN:supabase/.temp/  supabase/.temp/linked-project.json
```

**Step 4: Commit**

```bash
git add supabase/.temp 2>/dev/null  # No-op if already untracked
git commit -m "chore: untrack supabase/.temp/linked-project.json

The .temp/ directory is CLI-generated state already covered by
.gitignore:49 (supabase/.temp/), but this file was committed before
the gitignore rule existed. Remove from tracking; the file stays on
disk for local Supabase CLI but is no longer committed."
```

---

## Task 9: Archive merged petal-burst plan docs

**Files:**
- Move: `docs/plans/2026-05-22-petal-burst-design.md` → `docs/plans/archive/2026-05-22-petal-burst-design.md`
- Move: `docs/plans/2026-05-22-petal-burst.md` → `docs/plans/archive/2026-05-22-petal-burst.md`

**Problem:** PR #2 (petal-burst feature) was merged on 2026-05-22. The design + plan docs sit at the top of `docs/plans/` next to active work, making it harder to find the current plan. Standard archive pattern: move merged plans under `docs/plans/archive/`.

**Step 1: Create archive dir + move**

```bash
mkdir -p docs/plans/archive
git mv docs/plans/2026-05-22-petal-burst-design.md docs/plans/archive/
git mv docs/plans/2026-05-22-petal-burst.md docs/plans/archive/
```

**Step 2: Verify no internal links break**

```bash
grep -rn "2026-05-22-petal-burst" --include="*.md" --include="*.ts" --include="*.tsx" . 2>/dev/null | grep -v node_modules | grep -v "docs/plans/archive"
```

Any hits outside `docs/plans/archive/` need their paths updated. Likely candidates: commit messages in `git log` (no action needed — git rewrites paths), README references (update if present).

**Step 3: Verify + commit**

```bash
ls docs/plans/
ls docs/plans/archive/
git status --short
git commit -m "chore(docs): archive merged petal-burst plan docs

PR #2 (feat: petal-burst on each tap-to-plant) was merged 2026-05-22.
Move the design + plan docs to docs/plans/archive/ so the top-level
plans dir reflects only active/in-progress work. References preserved
via git history; no in-tree links broken (verified)."
```

---

## Task 10: Remove stale empty dirs and the Bolt.new scaffolding

**Files:**
- Delete: `.worktrees/` (if empty)
- Delete: `dist/` (if empty)
- Delete: `.bolt/` (Bolt.new scaffolding marker)
- Delete: `.claude/launch.json` (stale worktree reference)

**Problem:** Four directories/files are vestigial:
- `.worktrees/` — empty (the petal-burst worktree was cleaned up when PR #2 merged)
- `dist/` — empty (last touched April 2025, well before current iteration)
- `.bolt/` — Bolt.new scaffolding tracker, no longer relevant
- `.claude/launch.json` — references `.worktrees/feat-petal-burst/` which doesn't exist

**Step 1: Verify they're truly empty/stale before deleting**

```bash
ls -la /Users/scottybe/workspace/flower-sandbox/.worktrees 2>/dev/null
ls -la /Users/scottybe/workspace/flower-sandbox/dist 2>/dev/null
cat /Users/scottybe/workspace/flower-sandbox/.bolt/config.json 2>/dev/null
cat /Users/scottybe/workspace/flower-sandbox/.claude/launch.json 2>/dev/null
git ls-files .bolt .claude 2>/dev/null   # See what's tracked
```

If `.worktrees/` or `dist/` has files, STOP — investigate first.

**Step 2: Remove**

```bash
# Empty dirs (safe)
rmdir .worktrees 2>/dev/null || true
rmdir dist 2>/dev/null || true

# Bolt scaffolding
rm -rf .bolt

# Stale Claude launch.json (worktree it referenced no longer exists)
rm -f .claude/launch.json
```

`.claude/` may have other content (settings, skills cache) — only delete the `launch.json` file, not the whole directory.

**Step 3: Verify**

```bash
ls -la .worktrees dist .bolt .claude/launch.json 2>&1 | head
# Expect "No such file or directory" for all 4
pnpm typecheck    # exit 0
pnpm test         # pass
```

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove stale dirs and scaffolding artifacts

- .worktrees/: empty, the petal-burst worktree was cleaned up after PR #2
- dist/: empty, last touched April 2025 (way before current iteration)
- .bolt/: Bolt.new scaffolding marker, project is no longer on Bolt
- .claude/launch.json: referenced a worktree that no longer exists

None had any references in active code or workflows."
```

---

## Done means

After all 9 tasks land:

- `pnpm typecheck` exits 0
- `pnpm test` passes 1/1
- `git status --short` is clean
- Total ~10 atomic commits added to `main`, each easily revertible
- 4 dead-code files + 1 dir of scaffolding removed (~570 lines of code)
- 3 config files (`app.json`, `eas.json`, `package.json`) tightened
- 1 perf fix (Flower stem memoization)
- 2 docs (`EAS_WORKFLOWS.md`, `APP_STORE_SUBMISSION_CHECKLIST.md`) — fixed in earlier session commit `1418b77`
- 2 merged plans moved to archive

---

## Explicitly out of scope (deferred — user decision needed)

Items from the review that I'm NOT auto-applying:

1. **Pause per-push EAS production builds** (`.eas/workflows/build-*-production.yml` `on: push` → `on: workflow_dispatch`). This is a workflow-policy change. User may prefer to keep auto-builds running as a green/red signal. Bring it up after Task 1 lands so the user can decide whether the iteration cost still warrants pausing.

2. **Move inline live keys from `eas.json` env block to EAS dashboard env vars.** Requires interactive `eas env:create` per key per environment. The keys are publishable (anon JWT, pk_live), so this is a defense-in-depth hardening, not a leak fix. Defer to user.

3. **Switch supabase-js to `pnpm.overrides` with exact pin instead of dependencies tilde range.** Marginal hardening; current pin works.

4. **Remove `babel-plugin-module-resolver`** if tsconfig `paths` are sufficient under Expo SDK 56. Needs verification (try a Metro bundle without it). Low value, real risk.

5. **Reconsider `pnpm-workspace.yaml#minimumReleaseAge: 0`** — supply-chain defense. Reset to e.g. 7 days and use `minimumReleaseAgeExclude` for SDK 56 packages specifically.

6. **Conditional `useIAP()` hook rules-of-hooks violation** in `app/(tabs)/index.tsx:22` and `subscription.tsx:24`. Idiomatic fix is to make `useIAP` short-circuit internally and always call it. Touches 3 files; defer to feature work.

7. **Lazy-init the Supabase client** in `lib/supabase.ts`. Currently eager at module-evaluation time. Performance-marginal on cold start (~5-15ms); refactor cost would touch ~10 import sites.

8. **Stale docs sweep**: `PRIVACY_POLICY.md`, `TERMS_OF_SERVICE.md`, `APP_STORE_REQUIREMENTS_2024.md` — date-stamped 2024, may need refresh before App Store submission.

These deserve user attention but not as part of this hygiene batch.
