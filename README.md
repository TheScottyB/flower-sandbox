# FlowerSandbox

A React Native / Expo mobile app with Supabase auth and Stripe payments (subscriptions + donations). iOS, Android, and Web.

## Stack

| Layer | Technology |
|---|---|
| Framework | Expo SDK 56, expo-router (file-based routing) |
| Language | TypeScript (strict), React 19 |
| Runtime | React Native 0.85 (New Architecture enabled) |
| Backend | Supabase (auth, Postgres, Edge Functions) |
| Payments | Stripe (Checkout Sessions, webhooks) |
| Package manager | pnpm 11 (`node-linker=hoisted`) |
| Node | 24.16.0 (pinned via Volta) |
| Builds / OTA | EAS Build + EAS Update |

## Features

- Auth (sign up / sign in) via Supabase
- Monthly subscription ($1/mo) via Stripe Checkout
- One-time donation via Stripe Checkout (anonymous)
- Premium flower planting experience — more flowers, premium colors
- Haptic feedback, blur views, linear gradients
- Deep link handling for payment return URLs

## Local Development

### Prerequisites

- [Volta](https://volta.sh) — pins Node and manages toolchain versions automatically
- [pnpm](https://pnpm.io) — `npm install -g pnpm` or `volta install pnpm`
- [Expo Go](https://expo.dev/go) or an iOS/Android simulator

### Setup

```bash
git clone https://github.com/TheScottyB/flower-sandbox.git
cd flower-sandbox
pnpm install
```

Copy the env template and fill in your values:

```bash
cp .env.template .env
```

Required `.env` variables:

```
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
SUPABASE_PROJECT_ID=<project-ref>
```

### Running

```bash
pnpm run dev          # start Metro (scan QR with Expo Go)
pnpm run dev:go       # Expo Go mode
pnpm run dev:tunnel   # tunnel for physical devices on different networks
pnpm run dev:clear    # clear Metro cache and restart
```

## Project Structure

```
app/                  expo-router file-based routes
  _layout.tsx         root layout — deep link handler
  (auth)/             login, signup screens
  (tabs)/             home, about, subscription tabs
  donation-success.tsx
hooks/                useFrameworkReady
lib/
  supabase.ts         Supabase client
src/
  components/         Flower, FlowerField SVG components
  hooks/              useStripeProducts
  stripe-config.ts    live product + price IDs
  utils/polyfills.ts  URL + stream polyfills
supabase/
  functions/          Edge Functions (Deno)
    stripe-checkout/
    stripe-checkout-anonymous/
    stripe-products/
    stripe-webhook/
  migrations/         Postgres schema (stripe tables + RLS)
```

## Supabase

### Database schema

The migration at `supabase/migrations/20250410183514_fierce_frog.sql` creates:

- `stripe_customers` — maps Supabase user IDs to Stripe customer IDs
- `stripe_subscriptions` — subscription state (synced from Stripe webhooks)
- `stripe_orders` — one-time payment records
- `stripe_user_subscriptions` view — RLS-filtered view used by the app
- `stripe_user_orders` view — RLS-filtered view used by the app

### Edge Functions

| Function | Auth required | Description |
|---|---|---|
| `stripe-products` | Anon key | Lists active Stripe products and prices |
| `stripe-checkout` | User JWT | Creates checkout session for authenticated subscription |
| `stripe-checkout-anonymous` | Anon key | Creates checkout session for anonymous donation |
| `stripe-webhook` | None (sig verified) | Handles Stripe events; syncs subscription state |

### Deploying Supabase from scratch

```bash
# Install CLI
brew install supabase/tap/supabase

# Authenticate
supabase login

# Link to project
supabase link --project-ref <project-ref>

# Apply migrations
supabase db push

# Deploy all edge functions
supabase functions deploy stripe-checkout stripe-checkout-anonymous \
  stripe-products stripe-webhook

# stripe-webhook must skip JWT verification (Stripe has no Supabase token)
supabase functions deploy stripe-webhook --no-verify-jwt

# Set Stripe secrets in Supabase
supabase secrets set \
  STRIPE_SECRET_KEY=rk_live_... \
  STRIPE_WEBHOOK_SECRET=whsec_...
```

> **Stripe key scope** — Use a restricted API key (`rk_live_...`) with only the permissions the functions need: Checkout Sessions (write), Customers (write), Products (read), Prices (read), Subscriptions (read).

## Stripe

### Products

| Product | Price ID | Mode |
|---|---|---|
| A nice sandbox to play in | `price_1RCQr6DesriQyUxd0aR0MNGG` | subscription ($1/mo) |
| Donation to the cause | `price_1RCQskDesriQyUxdWlqf7eQZ` | payment (custom amount) |

### Webhook

Endpoint: `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`

Events to enable:
- `checkout.session.completed`
- `payment_intent.succeeded`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Create the webhook from the [Stripe Dashboard](https://dashboard.stripe.com/webhooks/create), copy the signing secret, and set `STRIPE_WEBHOOK_SECRET` in Supabase.

## Builds & Deployment

### iOS

```bash
pnpm run build:ios             # default profile
pnpm run build:preview         # ad-hoc (internal testing)
pnpm run build:production      # App Store
```

### OTA updates

```bash
pnpm run update:preview        # push to preview branch
pnpm run update:production     # push to production branch
```

### EAS Workflows

See [EAS_WORKFLOWS.md](./EAS_WORKFLOWS.md) for automated build + submit pipelines.

```bash
pnpm run build:ios:workflow    # trigger build-ios-production.yml
pnpm run build:submit:workflow # trigger build-and-submit-ios.yml
```

## Environment Variables Reference

| Variable | Where set | Description |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | `.env` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `.env` | Supabase anon (public) key |
| `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `.env` | Stripe publishable key (`pk_live_...`) |
| `EXPO_PUBLIC_APP_ENV` | `.env` | `production` or `development` |
| `SUPABASE_PROJECT_ID` | `.env` / `.env.development` | Supabase project ref |
| `STRIPE_SECRET_KEY` | Supabase secret | Stripe restricted key for edge functions |
| `STRIPE_WEBHOOK_SECRET` | Supabase secret | Stripe webhook signing secret |

See `.env.template` for a complete example.

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit with co-author: `git commit -m 'feat: description\n\nCo-Authored-By: ...'`
4. Push and open a Pull Request

## License

MIT — see LICENSE file for details.
