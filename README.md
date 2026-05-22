# FlowerSandbox

FlowerSandbox is an Expo mobile app with Supabase auth and Stripe Checkout payments for a monthly subscription and one-time donations.

## Stack

| Layer | Technology |
| --- | --- |
| App | Expo SDK 56, expo-router, React Native 0.85 |
| Language | TypeScript strict mode |
| Backend | Supabase Auth, Postgres, Edge Functions |
| Payments | Stripe Checkout Sessions and signed webhooks |
| Tooling | pnpm 11, Node 24.16.0 via Volta, EAS Build/Update |

## Current Production Resources

| Resource | Value |
| --- | --- |
| Canonical Supabase project | `srtlalaecgejgghwwfmk` (`flower-sandbox`) |
| Supabase URL | `https://srtlalaecgejgghwwfmk.supabase.co` |
| Stripe webhook URL | `https://srtlalaecgejgghwwfmk.supabase.co/functions/v1/stripe-webhook` |
| Stripe webhook ID | `we_1TZnBlDesriQyUxdpD4Vku99` |
| Subscription price | `price_1RCQr6DesriQyUxd0aR0MNGG` (`$1/month`) |
| Donation price | `price_1RCQskDesriQyUxdWlqf7eQZ` |

Use `srtlalaecgejgghwwfmk` as the source of truth. A Stripe-Projects-created Supabase project exists separately, but it does not contain the migrated schema, deployed functions, or live Stripe secrets.

## Local Development

```bash
pnpm install
cp .env.template .env
pnpm run dev
```

Fill `.env` with public app values only. Do not put Stripe secret keys, restricted keys, webhook secrets, or Supabase service-role keys in app env files.

Useful commands:

```bash
pnpm run dev          # Metro dev server
pnpm run dev:go       # Expo Go mode
pnpm run dev:tunnel   # Tunnel for physical devices
pnpm run dev:web      # Web target
pnpm run typecheck    # TypeScript validation
pnpm run test         # Jest once
pnpm run test:watch   # Jest watch mode
```

## Project Layout

```text
app/                  expo-router routes
lib/supabase.ts       Supabase client
src/stripe-config.ts  live product and price IDs
src/hooks/            Stripe product loading
supabase/functions/   Deno Edge Functions
supabase/migrations/  Postgres schema and RLS
```

## Supabase

The migration `supabase/migrations/20250410183514_fierce_frog.sql` creates the Stripe customer, subscription, and order tables plus RLS-protected user views.

| Function | Auth | Purpose |
| --- | --- | --- |
| `stripe-products` | Anon key | Lists active Stripe products and prices |
| `stripe-checkout` | User JWT | Creates authenticated subscription Checkout Sessions |
| `stripe-checkout-anonymous` | Anon key | Creates donation Checkout Sessions |
| `stripe-webhook` | Stripe signature | Syncs checkout, payment, and subscription events |

Deploy the current Supabase backend:

```bash
supabase db push --project-ref srtlalaecgejgghwwfmk
supabase functions deploy stripe-products --project-ref srtlalaecgejgghwwfmk
supabase functions deploy stripe-checkout --project-ref srtlalaecgejgghwwfmk
supabase functions deploy stripe-checkout-anonymous --project-ref srtlalaecgejgghwwfmk
supabase functions deploy stripe-webhook --no-verify-jwt --project-ref srtlalaecgejgghwwfmk
```

Set production Edge Function secrets with Supabase secrets, not app env files:

```bash
supabase secrets set \
  STRIPE_SECRET_KEY=rk_live_... \
  STRIPE_WEBHOOK_SECRET=whsec_... \
  --project-ref srtlalaecgejgghwwfmk
```

## Stripe

Use a restricted API key (`rk_live_...`) for Edge Functions. The required live permissions are:

- Checkout Sessions: write
- Customers: write
- Products: read
- Prices: read
- Subscriptions: read

Create the webhook in the [Stripe Dashboard](https://dashboard.stripe.com/webhooks/create) with these events:

- `checkout.session.completed`
- `payment_intent.succeeded`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Detailed payment operations live in [STRIPE_LIVE_MODE_SETUP.md](./STRIPE_LIVE_MODE_SETUP.md).

## Build And Release

```bash
pnpm run build:ios
pnpm run build:preview
pnpm run build:production
pnpm run submit:ios
pnpm run app-store:release
pnpm run update:preview
pnpm run update:production
```

See [EAS_WORKFLOWS.md](./EAS_WORKFLOWS.md) for EAS workflow commands and [APP_STORE_AUTOMATION.md](./APP_STORE_AUTOMATION.md) for scripted App Review submission.

## Automation

The GitHub Actions workflow at `.github/workflows/deploy-and-update-env.yml` deploys all Edge Functions and updates Supabase secrets from GitHub Actions secrets.

Required GitHub secrets:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_ID`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_TEST_SECRET_KEY`
- `STRIPE_TEST_WEBHOOK_SECRET`
