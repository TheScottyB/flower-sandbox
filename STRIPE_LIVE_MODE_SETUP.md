# Stripe And Supabase Live Operations

This repository is currently wired to the live Stripe account and the canonical Supabase project:

- Supabase project: `srtlalaecgejgghwwfmk` (`flower-sandbox`)
- Supabase URL: `https://srtlalaecgejgghwwfmk.supabase.co`
- Stripe webhook ID: `we_1TZnBlDesriQyUxdpD4Vku99`
- Stripe webhook URL: `https://srtlalaecgejgghwwfmk.supabase.co/functions/v1/stripe-webhook`

## Products And Prices

| Product | Product ID | Price ID | Mode |
| --- | --- | --- | --- |
| A nice sandbox to play in | `prod_S6e967ZpzPhGdd` | `price_1RCQr6DesriQyUxd0aR0MNGG` | subscription |
| Donation to the cause | `prod_S6eB9eAVlOPA2N` | `price_1RCQskDesriQyUxdWlqf7eQZ` | payment |

The app keeps these IDs in `src/stripe-config.ts`, while `stripe-products` fetches current product and price details dynamically from Stripe.

## Stripe Restricted Key

Use a restricted API key (`rk_live_...`) instead of a full secret key. The Edge Functions need only:

- Checkout Sessions: write
- Customers: write
- Products: read
- Prices: read
- Subscriptions: read

Do not give the checkout RAK webhook write permission just to create a webhook. Create and manage webhook endpoints in the Stripe Dashboard, then store the signing secret in Supabase.

## Webhook

Create or edit the webhook at [Stripe Dashboard > Webhooks](https://dashboard.stripe.com/webhooks).

Endpoint:

```text
https://srtlalaecgejgghwwfmk.supabase.co/functions/v1/stripe-webhook
```

Events:

- `checkout.session.completed`
- `payment_intent.succeeded`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

After creating a webhook, copy its signing secret once and set it in Supabase:

```bash
supabase secrets set \
  STRIPE_WEBHOOK_SECRET=whsec_... \
  --project-ref srtlalaecgejgghwwfmk
```

## Supabase Deployment

Apply migrations and deploy functions:

```bash
supabase db push --project-ref srtlalaecgejgghwwfmk
supabase functions deploy stripe-products --project-ref srtlalaecgejgghwwfmk
supabase functions deploy stripe-checkout --project-ref srtlalaecgejgghwwfmk
supabase functions deploy stripe-checkout-anonymous --project-ref srtlalaecgejgghwwfmk
supabase functions deploy stripe-webhook --no-verify-jwt --project-ref srtlalaecgejgghwwfmk
```

Set Stripe secrets:

```bash
supabase secrets set \
  STRIPE_SECRET_KEY=rk_live_... \
  STRIPE_WEBHOOK_SECRET=whsec_... \
  --project-ref srtlalaecgejgghwwfmk
```

Check deployed secrets without revealing values:

```bash
supabase secrets list --project-ref srtlalaecgejgghwwfmk
```

## Smoke Tests

Fetch products:

```bash
curl -s "https://srtlalaecgejgghwwfmk.supabase.co/functions/v1/stripe-products" \
  -H "Authorization: Bearer $EXPO_PUBLIC_SUPABASE_ANON_KEY"
```

Create an anonymous live donation Checkout Session:

```bash
curl -s "https://srtlalaecgejgghwwfmk.supabase.co/functions/v1/stripe-checkout-anonymous" \
  -X POST \
  -H "Authorization: Bearer $EXPO_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "price_id":"price_1RCQskDesriQyUxdWlqf7eQZ",
    "mode":"payment",
    "success_url":"https://flowersandbox.app/donation-success",
    "cancel_url":"https://flowersandbox.app/"
  }'
```

A successful live response returns a `cs_live_...` session ID and a `checkout.stripe.com` URL.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `StripePermissionError` | The RAK is missing one of the permissions above. |
| Generic payment error | Check Edge Function logs and Stripe Workbench request logs. |
| Webhook 401/403 from Supabase | Redeploy `stripe-webhook` with `--no-verify-jwt`. |
| Webhook signature verification failure | Confirm `STRIPE_WEBHOOK_SECRET` matches the live webhook endpoint. |
| Products load but checkout fails | Product read permissions are present, but Checkout Sessions write may be missing. |
