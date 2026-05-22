# FlowerSandbox

FlowerSandbox is an Expo mobile app with Supabase auth, Stripe Checkout
for web/Android donations + subscriptions, and StoreKit (via `expo-iap`)
for iOS subscriptions.

## Stack

| Layer | Technology |
| --- | --- |
| Framework | Expo SDK 56, expo-router (file-based routing) |
| Language | TypeScript strict, React 19 |
| Runtime | React Native 0.85 (New Architecture enabled) |
| Backend | Supabase (auth, Postgres, Edge Functions) |
| Payments | Stripe Checkout Sessions + signed webhooks; StoreKit on iOS via `expo-iap` |
| Package manager | pnpm 11 (`node-linker=hoisted`) |
| Node | ≥ 22.13.0 (pinned via `engines.node` and Volta) |
| Builds / OTA | EAS Build + EAS Update |

## Quickstart

```bash
pnpm install
cp .env.template .env       # fill in EXPO_PUBLIC_* values; never commit secrets
pnpm run dev                # Metro dev server
pnpm typecheck && pnpm test # CI gates
```

Run on a target:

```bash
pnpm run dev          # Expo Go / dev client (default)
pnpm run dev:web      # Web (Metro web bundler)
pnpm run dev:tunnel   # Tunnel for physical devices
```

## Documentation

| Topic | Doc |
| --- | --- |
| Live Stripe + Supabase operations | [docs/stripe-live-mode.md](./docs/stripe-live-mode.md) |
| App Store release (scripted + manual + workflows) | [docs/release-to-app-store.md](./docs/release-to-app-store.md) |
| EAS Workflows (non-submission) | [docs/eas-workflows.md](./docs/eas-workflows.md) |
| Active plans + archive | [docs/plans/](./docs/plans/) |

## Agentic assistants

Working in this repo with an AI assistant? See:
- [CLAUDE.md](./CLAUDE.md) — project conventions for Claude (and similar coding agents)
- [AGENTS.md](./AGENTS.md) — Stripe Projects CLI integration (auto-managed)

## Automation

The GitHub Actions workflow at `.github/workflows/deploy-and-update-env.yml`
deploys all Supabase Edge Functions and synchronises Supabase secrets from
GitHub Actions secrets.

Required GitHub secrets:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_ID`
- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` (live)
- `STRIPE_TEST_SECRET_KEY` and `STRIPE_TEST_WEBHOOK_SECRET`

## Legal

- [Privacy Policy](./PRIVACY_POLICY.md)
- [Terms of Service](./TERMS_OF_SERVICE.md)
