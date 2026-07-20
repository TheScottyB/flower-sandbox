/*
  # M2 Hardening — UNIQUE(checkout_session_id) on stripe_orders

  Context: the 2026-07-19 payments & auth audit (M2) added application-level
  idempotency to the webhook's one-time-payment path: the handler now queries for
  an existing row and skips insertion when it finds one. This migration adds the
  complementary DB-level constraint so the uniqueness is enforced even if that
  guard is ever bypassed (dashboard retries, direct DB writes, future bugs).

  Production data check performed 2026-07-20: zero rows in stripe_orders, so no
  dedup step is needed. If this migration is run against a database that somehow
  contains duplicates, the CREATE INDEX will fail with a uniqueness violation — run
  the dedup query below first:

    DELETE FROM stripe_orders
    WHERE id NOT IN (
      SELECT MIN(id) FROM stripe_orders GROUP BY checkout_session_id
    );

  We use a plain CREATE UNIQUE INDEX rather than CONCURRENTLY because:
  - Supabase migrations run inside a transaction, which CONCURRENTLY cannot do.
  - The table is small; the lock window is negligible.
*/

CREATE UNIQUE INDEX IF NOT EXISTS stripe_orders_checkout_session_id_key
  ON stripe_orders(checkout_session_id);

-- Also index payment_intent_id — used by the charge.refunded / charge.dispute.created
-- handler (markOrderCanceled) and currently unindexed, making that UPDATE a seq scan.
CREATE INDEX IF NOT EXISTS stripe_orders_payment_intent_id_idx
  ON stripe_orders(payment_intent_id);
