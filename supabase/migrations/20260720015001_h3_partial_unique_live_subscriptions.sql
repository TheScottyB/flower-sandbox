/*
  # H3 Hardening — Partial unique index for live subscriptions

  Context: H3 (2026-07-19 audit) added a server-side 409 guard in stripe-checkout
  that blocks a second subscription when the DB-synced status is already
  'active', 'trialing', or 'past_due'. That guard closes the common cases (stale
  client UI, cross-device double-subscribe). A "pure race" remains: two
  simultaneous first-completion webhooks for the same customer arriving before
  either has written its result. The UPSERT on customer_id means the second write
  simply overwrites the first, so the DB ends up with one row reflecting the
  newer subscription_id while the older Stripe subscription keeps billing
  silently.

  This partial unique index does NOT close that Stripe-level race (the index
  enforces DB uniqueness, not Stripe uniqueness). What it does provide:

  1. Belt-and-suspenders uniqueness: if the full UNIQUE(customer_id) column
     constraint on stripe_subscriptions is ever relaxed (e.g., to support
     subscription history rows), this index remains as an invariant that only
     one *live* subscription row per customer can exist.

  2. Query performance: the stripe-checkout H3 check and any future dashboard
     queries filtering on (customer_id, status IN (...)) can use this smaller
     partial index instead of scanning the full-table index.

  3. Documented intent: the index name is the business rule.

  To fully close the simultaneous-webhook race, the complementary fix is a
  Stripe-side live-subscription check in stripe-checkout (call
  stripe.subscriptions.list before creating a session) — that is tracked as a
  separate code-level follow-up.

  NOTE: stripe_subscriptions already has a UNIQUE column constraint on
  customer_id, which prevents any two rows (live or not) for the same customer.
  This partial index is therefore redundant as a constraint against the current
  schema, but meaningful for the future-proofing and performance reasons above.
*/

CREATE UNIQUE INDEX IF NOT EXISTS stripe_subscriptions_one_live_per_customer
  ON stripe_subscriptions(customer_id)
  WHERE status IN ('active', 'trialing', 'past_due')
    AND deleted_at IS NULL;
