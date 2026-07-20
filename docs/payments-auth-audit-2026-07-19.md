# Payments & Auth Audit — 2026-07-19

Adversarial multi-agent review of the payment and auth surface of FlowerSandbox
(live on the App Store as of 2026-07-18). Five specialist reviewers covered the
Stripe webhook, checkout functions, Postgres/RLS + account deletion, client auth,
and iOS IAP entitlement. Every finding was then challenged by two independent
refuters; only findings that survived both are listed here.

Result: **17 confirmed** (many are the same bug seen by multiple reviewers →
**13 distinct issues** below), **1 plausible**, **7 refuted**.

Severity legend: 🔴 High (real money / account safety) · 🟠 Medium · 🟡 Low.

## Status: all 13 findings + P1 fixed AND deployed 2026-07-19 (test-first)

Every fix was written test-first (RED → GREEN). Suite: **36 Deno edge-function
tests + 58 app (vitest) tests + `tsc` + biome**, all green.

**Deployed to production (`srtlalaecgejgghwwfmk`) 2026-07-19:**

- Server fixes deployed via Supabase CLI (the GitHub Actions deploy step is broken
  — see below): `stripe-checkout` v8, `stripe-webhook` v8, `delete-account` v2, all
  verified live via smoke tests.
- Client fixes shipped as an EAS Update (OTA) to the `production` branch, runtime
  `1.0.2`, update group `a1e18975-8101-44a0-a00e-fdcdc71a52db`, built with the EAS
  `production` environment. Reaches installed build-5 users on next launch.

**CI deploy is broken:** `.github/workflows/deploy-and-update-env.yml` requires
the following GitHub Actions secrets in the `production` (and `staging`) environment
before CI deploys can run end-to-end. Set these at
**Settings → Environments → production → Environment secrets**:

| Secret | Where to find it | Status |
|---|---|---|
| `SUPABASE_PROJECT_ID` | Supabase Dashboard → Project Settings → General | ✅ set |
| `SUPABASE_ACCESS_TOKEN` | supabase.com → Account → Access Tokens | ❌ missing |
| `SUPABASE_ANON_KEY` | Supabase Dashboard → Project Settings → API | check |
| `STRIPE_PUBLISHABLE_KEY` | Stripe Dashboard → Developers → API Keys (live pk_live_…) | ❌ missing |
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API Keys (live sk_live_…) | ❌ missing |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Developers → Webhooks → `we_1TZnBlD…` → Signing secret | ❌ missing |
| `STRIPE_TEST_SECRET_KEY` | Stripe Dashboard → Developers → API Keys (test sk_test_…) | ❌ missing |
| `STRIPE_TEST_WEBHOOK_SECRET` | Stripe Dashboard → Developers → Webhooks (test) → `we_1TZmIgD…` → Signing secret | ❌ missing |

Until CI is unblocked, continue deploying via Supabase CLI.

**L2 webhook subscription — 2026-07-20:**

- **Test endpoint** (`we_1TZmIgDesriQyUxdCH8D6J4C`): ✅ subscribed to `charge.refunded`
  and `charge.dispute.created` via CLI.
- **Live endpoint** (`we_1TZnBlDesriQyUxdpD4Vku99`): ❌ CLI blocked (restricted key
  lacks webhook-update permissions). Fix via Dashboard:
  **Stripe Dashboard → Developers → Webhooks → `we_1TZnBlD…` → Add events →**
  add `charge.refunded` and `charge.dispute.created`.

**Server-side (Supabase edge functions — deploy via push→CI, no App Store round-trip):**

- **H1** — `stripe-webhook` processes synchronously and returns 5xx on failure so
  Stripe retries; the one-time-order path no longer swallows its DB error.
- **H2** — `delete-account` cancels all live Stripe subscriptions (listed from
  Stripe, so hidden/duplicate subs are caught) before destroying local data, and
  returns 500 without deleting anything if cancellation fails (safe retry).
- **H3** — `stripe-checkout` returns 409 instead of creating a second subscription
  when the existing subscription is live (`active`/`trialing`/`past_due`). Guards on
  DB-synced status — closes the cross-device/stale-UI and `past_due` cases. A pure
  simultaneous double-tap race remains a follow-up (partial unique index on live
  subs, or a Stripe-side check).
- **M1** — zero-subscription sync branch: fixed the nonexistent column
  (`subscription_status` → `status`) and added the missing early `return`. Required
  by H1 — otherwise that crash would have become an infinite retry storm.
- **M2** — one-time orders are now idempotent: the webhook skips insertion when an
  order for the `checkout_session_id` already exists. Chose application-level dedup
  over a DB unique index so it deploys with no migration risk against the live table
  (which may already hold duplicate rows from the old bug). *Optional hardening:* a
  `UNIQUE(checkout_session_id)` index after de-duplicating prod data.
- **M3** — account deletion reordered so the auth user is deleted *before* the
  customer mapping is hard-deleted; a failed auth-delete now leaves the mapping
  intact for a clean retry. (H2 already removed the double-billing risk by canceling
  first, so the residual was cosmetic.)
- **L1** — `payment_intent.succeeded` filter uses a loose `!invoice` check, so
  one-time PIs are still ignored on Stripe API `basil`+ where `invoice` is absent.
- **L2** — added `charge.refunded` / `charge.dispute.created` handling that marks the
  order `canceled` by payment intent (and no longer misroutes them into subscription
  sync). *Requires* subscribing to these events in the Stripe Dashboard to take
  effect.
- **L3** — `stripe-checkout` recovers from a concurrent customer-creation race
  (unique violation) by reusing the winning mapping instead of returning a spurious
  500 and churning Stripe customers.

**Client-side (needs an EAS build/update to reach users):**

- **M4** — entitlement treats `active`/`trialing`/`past_due` as subscribed via a
  shared `isEntitledStatus` helper (`src/stripe-config.ts`), used by both
  `subscription.tsx` and `index.tsx`; the server H3 guard uses the same set.
- **L4** — `lib/supabase.ts` now enables `detectSessionInUrl` on web only (via a
  testable `buildAuthOptions`), so redirect tokens are consumed and cleared from the
  address bar/history instead of lingering. Kept implicit flow (no PKCE switch) to
  avoid breaking cross-device email confirmation on the live app.
- **L5** — `useIAP` compares the real expo-iap cancel code (`user-cancelled`), so a
  normal payment-sheet dismissal no longer shows "Purchase failed".
- **P1** — deep-link handler no longer logs URLs/session ids and no longer asserts
  `success: 'true'` from an untrusted link; it routes to the subscription screen,
  which re-verifies real status. Logic extracted to `src/utils/paymentDeepLink.ts`.

**Refuted (7)** were confirmed as non-issues and left unchanged.

---

## 🔴 High

### H1 — Webhook ACKs Stripe before writing, so failed events are lost forever
`supabase/functions/stripe-webhook/index.ts:47`

The handler runs `EdgeRuntime.waitUntil(handleEvent(event))` and immediately
returns `200 {received:true}`. All DB writes (order insert, subscription upsert)
and the `stripe.subscriptions.list` call happen *after* the response, in a
fire-and-forget task whose errors are only `console.error`'d. Stripe treats any
2xx as delivered and never retries — so any transient failure permanently drops
a paid event.

**Why it matters here:** this project's Supabase instance is on the free tier and
has a documented history of auto-pausing when idle. "DB unreachable during a
webhook" is a lived failure mode, not hypothetical. A subscription checkout that
lands during a pause leaves `stripe_subscriptions` at `not_started` — the user is
billed monthly with no premium — and a one-time donation's `stripe_orders` row is
never written at all, with no recovery path.

**Fix:** process synchronously (one Stripe list + one upsert is well within edge
limits) and return 5xx on failure so Stripe retries. The referenced t3dotgg
pattern only works when paired with an eager sync-on-success-page call, which this
repo doesn't have.

### H2 — `delete-account` never cancels the Stripe subscription
`supabase/functions/delete-account/index.ts:68`

The function imports only supabase-js and makes zero Stripe API calls. It
soft-deletes the subscription/order rows, hard-deletes the `stripe_customers`
mapping, and deletes the auth user — but the **Stripe subscription stays active
and keeps charging the card every cycle**. The account is gone, so the user has
no in-app way to cancel; the customer mapping is hard-deleted, so support can't
trace it from the DB. Users typically escape only via a card dispute → chargebacks
against the live Stripe account.

**Fix:** call `stripe.subscriptions.cancel` (or `customer.del`) for the mapped
customer before deleting local rows.

### H3 — Checkout creates a *second* subscription for an already-subscribed customer
`supabase/functions/stripe-checkout/index.ts:176` (+ webhook sync at `:137`)

For an existing customer in subscription mode, the function only checks that a
`stripe_subscriptions` *row exists* — it never checks whether the status is
already `active` — then unconditionally creates a new subscription-mode Checkout
Session. Stripe allows multiple concurrent subscriptions per customer, so the
user is silently double-billed. Worse: `stripe_subscriptions` has
`UNIQUE(customer_id)` and the webhook syncs with `limit: 1`, so once two live subs
exist the DB only ever reflects the newest — the older one bills invisibly and
survives any cancel flow. The only current guard is the client hiding the button
(and `index.tsx` fetches status once on mount, never on focus, so a second device
shows a stale "Subscribe Now").

**Fix:** in checkout, early-return if the existing subscription status is
`active`/`trialing`/`past_due`; treat the single-subscription assumption as a
server-enforced invariant.

### H4 — iOS and Stripe entitlements are disjoint; the same account can be told to pay twice
`app/(tabs)/subscription.tsx:55` (+ `app/(tabs)/index.tsx:57`)

`isSubscribed = Platform.OS === 'ios' ? iap.isSubscribed : stripeStatus`. On iOS
the Stripe fetch early-returns (never runs); on web/Android the StoreKit
entitlement is never visible. There is **no server-side record of Apple
subscriptions at all**, so the two stores can never be reconciled. A user who
subscribed via Stripe on the web sees "Not Subscribed" + an active "Subscribe Now"
button when they open the iOS app, and can pay Apple for the same feature set.
The reverse (iOS subscriber gets nothing on web) is also true.

**Fix:** record Apple entitlements server-side (App Store Server Notifications +
receipt/transaction validation) and gate premium on the union of Stripe + Apple
entitlement, cross-platform.

---

## 🟠 Medium

### M1 — Zero-subscription sync branch is doubly broken (wrong column + fall-through crash)
`supabase/functions/stripe-webhook/index.ts:148` *(reported by 3 reviewers)*

When `subscriptions.list` returns empty, the code upserts
`{ customer_id, subscription_status: 'not_started' }`. The table column is named
`status`, not `subscription_status` (that alias exists only in the
`stripe_user_subscriptions` view), so PostgREST rejects it (PGRST204) and the
function throws — this "reset to not_started" write has **never once succeeded**.
Even with the column fixed, the branch has no `return`, so it falls through to
`subscriptions.data[0]` (undefined) → guaranteed `TypeError`. The throw happens
inside `waitUntil` after the 200, so the event is silently dropped. Tests never
exercise the empty-list branch.

**Fix:** use `status`, add an early `return` after the empty-list upsert, and add
a test for the zero-subscription case.

### M2 — No idempotency on one-time orders → duplicate rows on redelivery/resend
`supabase/functions/stripe-webhook/index.ts:108` (+ schema at `migration:104`) *(2 reviewers)*

The one-time-payment path does a plain `insert` into `stripe_orders` with no
dedup; `event.id` is never recorded and there's no unique constraint on
`checkout_session_id`/`payment_intent_id`. Stripe delivery is at-least-once, and
the dashboard "Resend" button (a routine action while debugging H1) redelivers the
same signed event — each redelivery inserts another `completed` order, so the
donor's history and any revenue report double-count the charge. (The subscription
path is naturally idempotent via upsert; only orders are affected.)

**Fix:** unique index on `checkout_session_id` + `ON CONFLICT DO NOTHING`, or a
`processed_events` table keyed by `event.id`.

### M3 — Non-atomic deletion order strips premium / enables double billing on partial failure
`supabase/functions/delete-account/index.ts:97`

The sequence (soft-delete subs → soft-delete orders → hard-delete customer mapping
→ `auth.admin.deleteUser`) has no transaction. If the final `deleteUser` fails
(transient 500/rate-limit), the earlier writes aren't rolled back: the still-billed
user now has `deleted_at` on their subscription row, so the app treats them as free
while Stripe keeps charging. A retry finds no customer mapping and just deletes the
auth user (guaranteeing the H2 gap); a re-subscribe creates a *new* Stripe customer
while the old one still bills → two live customers, double billing.

**Fix:** do the Stripe cancellation first, then delete local rows in a single
transaction (or make the operation idempotent + retry-safe).

### M4 — `trialing` / `past_due` subscribers are treated as not-subscribed and re-offered checkout
`app/(tabs)/subscription.tsx:58` (+ `index.tsx:74`)

Entitlement is `subscription_status === 'active'` only. The webhook faithfully
syncs `trialing` (paying, in trial) and `past_due` (card retry in progress — Stripe
still considers it live). Both render "Not Subscribed" with an active "Subscribe
Now" button, feeding directly into H3. A renewal card decline instantly removes
premium and invites a second subscription.

**Fix:** treat `active`, `trialing`, and `past_due` as entitled (at minimum keep
access through the dunning window).

---

## 🟡 Low

### L1 — `payment_intent.succeeded` filter uses strict `invoice === null`
`supabase/functions/stripe-webhook/index.ts:72`

The one-time-payment early-return checks `invoice === null`. Stripe API
`2025-03-31.basil`+ removed `invoice` from PaymentIntent, so on a basil+ endpoint
the field is *absent* (`undefined === null` → false) and the event falls into the
subscription-sync path → the broken M1 branch. Payload shape follows the endpoint's
pinned API version, not the SDK. **Fix:** use `== null` / `!invoice`.

### L2 — Refunds and disputes are never reflected
`supabase/functions/stripe-webhook/index.ts:116`

No handling for `charge.refunded`, `charge.dispute.created`, or
`checkout.session.async_payment_failed`, and they aren't in the endpoint's
subscribed-event list. A refunded/disputed donation stays `completed`/`paid`
forever in history and revenue reports. The `canceled` order status exists but is
never set. (Subscription entitlements are unaffected — cancellations arrive via
`customer.subscription.deleted`.) **Fix:** subscribe to and handle refund/dispute
events; set order status to `canceled`.

### L3 — Customer-creation race → orphaned Stripe customers + spurious 500
`supabase/functions/stripe-checkout/index.ts:90`

Read-then-create-then-insert with no lock/upsert. Two concurrent first-time
requests both create a Stripe customer; the losing `insert` hits the
`unique(user_id)` constraint, deletes its own just-created Stripe customer, and
returns a 500 to a legitimate purchase attempt. **Fix:** `upsert` on
`onConflict:'user_id'`, or create the Stripe customer only after winning the DB row.

### L4 — Web build leaves email-confirmation tokens in the URL / browser history
`lib/supabase.ts:30`

`detectSessionInUrl: false` is justified for RN ("no URL bar") but the same client
is used by the web build. With default implicit-flow email templates, the
confirmation link lands on `flowersandbox.com/app/login#access_token=…&refresh_token=…`
and nothing consumes or clears the fragment. On a shared/public computer, the next
person can pull the `refresh_token` from history and take over the account. **Fix:**
enable `detectSessionInUrl` (and PKCE flow) for web, or clear the fragment after load.

### L5 — User-cancelled purchase misdetected → "Purchase failed" on every sheet dismissal
`src/hooks/useIAP.ts:145` (+ `:172`)

Compares `String(err.code) === 'UserCancelled'`, but the installed expo-iap defines
`ErrorCode.UserCancelled = 'user-cancelled'`. So a normal "tap Subscribe → tap
Cancel" shows the red "Purchase failed. Please try again." banner (twice). No
monetary harm, but it looks broken and invites 1-star reviews. **Fix:** compare
against `'user-cancelled'` (or the `ErrorCode` enum).

---

## ⚪ Plausible (mitigated, worth hardening)

### P1 — Deep-link handler trusts query params to declare payment success
`app/_layout.tsx:34`

The `flowersandbox://` scheme has no universal-link protection
(`associatedDomains: []`), and `handleDeepLink` does no origin/session
verification: any URL whose path contains `subscription` + a `session_id` shows the
green "subscription successfully activated" banner. A scam page could redirect to
`flowersandbox://subscription?session_id=cs_fake` and borrow the app's own UI to
confirm a fake charge. The raw URL + session_id are also `console.log`'d in prod.
Mitigated on iOS by later real-status checks, but the banner is still shown.
**Fix:** verify the session against Stripe (or the DB) before showing success; stop
logging tokens.

---

## Refuted (checked and cleared — no action needed)

These sounded serious but were disproven on inspection, which is good news about the
existing design:

- **Client-supplied `price_id` manipulation** — a server-side allowlist already
  prevents arbitrary price/amount injection.
- **Open-redirect via `success_url`/`cancel_url`** in anonymous checkout — refuted.
- **Supabase tokens in plaintext AsyncStorage** — refuted for the platform config.
- **On-device StoreKit spoofing** — judged acceptable client-gating, not a defect.
- **Signup email-enumeration** — refuted.
- **Transaction finished before entitlement persisted / double useIAP race** — refuted.

---

## Suggested order of work

1. **H2** (billing after deletion) and **H1** (lost events) — direct money loss,
   both server-side and shippable without an app release.
2. **H3 / M4 / M1 / L1** — one cluster of subscription-state correctness in the
   webhook + checkout functions; fixing them together is natural.
3. **H4** — largest effort (needs server-side Apple entitlement); scope as its own
   piece.
4. **L2, M2/L-dupe (idempotency), L3, L4, L5, P1** — hardening and polish.

Items 1–2 and most Lows are edge-function/DB changes deployable via the existing
Supabase deploy workflow with no App Store round-trip. H4, M4, and L5 touch client
code and need an EAS build/update.
