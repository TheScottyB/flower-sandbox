import { assertEquals } from "jsr:@std/assert";
import { handler, stripe, supabase } from "./index.ts";

Deno.test("stripe-webhook: CORS preflight (OPTIONS) returns 204", async () => {
  const req = new Request("http://localhost/stripe-webhook", {
    method: "OPTIONS",
  });
  const res = await handler(req);
  assertEquals(res.status, 204);
});

Deno.test("stripe-webhook: non-POST returns 405 Method Not Allowed", async () => {
  const req = new Request("http://localhost/stripe-webhook", {
    method: "GET",
  });
  const res = await handler(req);
  assertEquals(res.status, 405);
});

Deno.test("stripe-webhook: missing signature returns 400 Bad Request", async () => {
  const req = new Request("http://localhost/stripe-webhook", {
    method: "POST",
    body: "{}",
  });
  const res = await handler(req);
  assertEquals(res.status, 400);
  const text = await res.text();
  assertEquals(text, "No signature found");
});

Deno.test("stripe-webhook: invalid signature returns 400 Bad Request", async () => {
  const originalConstruct = stripe.webhooks.constructEvent;
  try {
    stripe.webhooks.constructEvent = (() => {
      throw new Error("Invalid signature");
    }) as any;

    const req = new Request("http://localhost/stripe-webhook", {
      method: "POST",
      headers: {
        "stripe-signature": "t=123,v1=bad",
      },
      body: "{}",
    });
    const res = await handler(req);
    assertEquals(res.status, 400);
    const text = await res.text();
    assertEquals(text.includes("Webhook signature verification failed"), true);
  } finally {
    stripe.webhooks.constructEvent = originalConstruct;
  }
});

Deno.test("stripe-webhook: processes one-time payment successfully", async () => {
  const originalConstruct = stripe.webhooks.constructEvent;
  const originalFrom = supabase.from;

  let orderInserted = false;

  try {
    // 1. Mock Stripe signature parsing
    stripe.webhooks.constructEvent = (() => {
      return {
        type: "checkout.session.completed",
        data: {
          object: {
            customer: "cus_one_time_123",
            id: "cs_test_123",
            payment_intent: "pi_123",
            amount_subtotal: 1000,
            amount_total: 1000,
            currency: "usd",
            payment_status: "paid",
            mode: "payment",
          },
        },
      };
    }) as any;

    // 2. Mock Supabase Database
    supabase.from = ((table: string) => {
      const builder = {
        // Idempotency existence check: no prior order for this session.
        select: () => ({
          eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
        }),
        insert: (data: any) => {
          if (table === "stripe_orders") {
            assertEquals(data.checkout_session_id, "cs_test_123");
            assertEquals(data.customer_id, "cus_one_time_123");
            assertEquals(data.amount_total, 1000);
            orderInserted = true;
          }
          return Promise.resolve({ error: null });
        },
      };
      return builder;
    }) as any;

    const req = new Request("http://localhost/stripe-webhook", {
      method: "POST",
      headers: {
        "stripe-signature": "t=123,v1=valid",
      },
      body: "{}",
    });

    const res = await handler(req);
    assertEquals(res.status, 200);
    const data = await res.json();
    assertEquals(data.received, true);

    // Wait a tiny amount for EdgeRuntime.waitUntil promise logic to complete
    await new Promise((resolve) => setTimeout(resolve, 5));
    assertEquals(orderInserted, true);
  } finally {
    stripe.webhooks.constructEvent = originalConstruct;
    supabase.from = originalFrom;
  }
});

Deno.test("stripe-webhook: ignores payment_intent.succeeded when the invoice field is absent (basil+)", async () => {
  const originalConstruct = stripe.webhooks.constructEvent;
  const originalFrom = supabase.from;
  const originalListSubscriptions = stripe.subscriptions.list;

  let subscriptionSynced = false;

  try {
    // Newer Stripe API versions omit `invoice` from PaymentIntent entirely.
    stripe.webhooks.constructEvent = (() => ({
      type: "payment_intent.succeeded",
      data: { object: { customer: "cus_donor" } },
    })) as any;

    stripe.subscriptions.list = (() => {
      subscriptionSynced = true;
      return Promise.resolve({ data: [] });
    }) as any;

    supabase.from = (() => ({
      upsert: () => {
        subscriptionSynced = true;
        return Promise.resolve({ error: null });
      },
    })) as any;

    const req = new Request("http://localhost/stripe-webhook", {
      method: "POST",
      headers: { "stripe-signature": "t=123,v1=valid" },
      body: "{}",
    });

    const res = await handler(req);
    await res.body?.cancel();
    assertEquals(res.status, 200);
    assertEquals(subscriptionSynced, false);
  } finally {
    stripe.webhooks.constructEvent = originalConstruct;
    supabase.from = originalFrom;
    stripe.subscriptions.list = originalListSubscriptions;
  }
});

Deno.test("stripe-webhook: does not insert a duplicate order when the session already exists", async () => {
  const originalConstruct = stripe.webhooks.constructEvent;
  const originalFrom = supabase.from;

  let insertCount = 0;

  try {
    stripe.webhooks.constructEvent = (() => ({
      type: "checkout.session.completed",
      data: {
        object: {
          customer: "cus_dup",
          id: "cs_dup",
          payment_intent: "pi_dup",
          amount_subtotal: 1000,
          amount_total: 1000,
          currency: "usd",
          payment_status: "paid",
          mode: "payment",
        },
      },
    })) as any;

    supabase.from = (() => ({
      // An order for this session already exists.
      select: () => ({
        eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: 1 }, error: null }) }),
      }),
      insert: () => {
        insertCount++;
        return Promise.resolve({ error: null });
      },
    })) as any;

    const req = new Request("http://localhost/stripe-webhook", {
      method: "POST",
      headers: { "stripe-signature": "t=123,v1=valid" },
      body: "{}",
    });

    const res = await handler(req);
    await res.body?.cancel();
    assertEquals(res.status, 200);
    assertEquals(insertCount, 0);
  } finally {
    stripe.webhooks.constructEvent = originalConstruct;
    supabase.from = originalFrom;
  }
});

Deno.test("stripe-webhook: marks the order canceled on charge.refunded", async () => {
  const originalConstruct = stripe.webhooks.constructEvent;
  const originalFrom = supabase.from;
  const originalListSubscriptions = stripe.subscriptions.list;

  let canceledPaymentIntent: string | null = null;
  let subscriptionSynced = false;

  try {
    stripe.webhooks.constructEvent = (() => ({
      type: "charge.refunded",
      data: { object: { customer: "cus_x", payment_intent: "pi_refunded" } },
    })) as any;

    stripe.subscriptions.list = (() => {
      subscriptionSynced = true;
      return Promise.resolve({ data: [] });
    }) as any;

    supabase.from = (() => ({
      update: (data: any) => ({
        eq: (_col: string, value: string) => {
          if (data.status === "canceled") canceledPaymentIntent = value;
          return Promise.resolve({ error: null });
        },
      }),
    })) as any;

    const req = new Request("http://localhost/stripe-webhook", {
      method: "POST",
      headers: { "stripe-signature": "t=123,v1=valid" },
      body: "{}",
    });

    const res = await handler(req);
    await res.body?.cancel();
    assertEquals(res.status, 200);
    assertEquals(canceledPaymentIntent, "pi_refunded");
    // A refund must not be misrouted into subscription sync.
    assertEquals(subscriptionSynced, false);
  } finally {
    stripe.webhooks.constructEvent = originalConstruct;
    supabase.from = originalFrom;
    stripe.subscriptions.list = originalListSubscriptions;
  }
});

Deno.test("stripe-webhook: syncs a customer with no subscriptions to not_started without crashing", async () => {
  const originalConstruct = stripe.webhooks.constructEvent;
  const originalFrom = supabase.from;
  const originalListSubscriptions = stripe.subscriptions.list;

  let upsertPayload: any = null;

  try {
    stripe.webhooks.constructEvent = (() => ({
      type: "customer.subscription.deleted",
      data: { object: { customer: "cus_nosub" } },
    })) as any;

    // Customer has zero subscriptions in Stripe (e.g. fully removed).
    stripe.subscriptions.list = (() => Promise.resolve({ data: [] })) as any;

    supabase.from = (() => ({
      upsert: (data: any) => {
        upsertPayload = data;
        return Promise.resolve({ error: null });
      },
    })) as any;

    const req = new Request("http://localhost/stripe-webhook", {
      method: "POST",
      headers: { "stripe-signature": "t=123,v1=valid" },
      body: "{}",
    });

    const res = await handler(req);
    await res.body?.cancel();
    assertEquals(res.status, 200);
    assertEquals(upsertPayload?.customer_id, "cus_nosub");
    // Must write the real column name (`status`), not the view alias.
    assertEquals(upsertPayload?.status, "not_started");
  } finally {
    stripe.webhooks.constructEvent = originalConstruct;
    supabase.from = originalFrom;
    stripe.subscriptions.list = originalListSubscriptions;
  }
});

Deno.test("stripe-webhook: returns 500 when subscription sync fails so Stripe retries", async () => {
  const originalConstruct = stripe.webhooks.constructEvent;
  const originalFrom = supabase.from;
  const originalListSubscriptions = stripe.subscriptions.list;

  try {
    stripe.webhooks.constructEvent = (() => ({
      type: "checkout.session.completed",
      data: {
        object: {
          customer: "cus_fail_sub",
          id: "cs_fail_sub",
          mode: "subscription",
          payment_status: "paid",
        },
      },
    })) as any;

    stripe.subscriptions.list = (() =>
      Promise.resolve({
        data: [
          {
            id: "sub_fail",
            status: "active",
            current_period_start: 1620000000,
            current_period_end: 1622000000,
            cancel_at_period_end: false,
            items: { data: [{ price: { id: "price_fail" } }] },
          },
        ],
      })) as any;

    // Simulate a transient DB failure on the subscription upsert.
    supabase.from = (() => ({
      upsert: () => Promise.resolve({ error: { message: "db unavailable" } }),
    })) as any;

    const req = new Request("http://localhost/stripe-webhook", {
      method: "POST",
      headers: { "stripe-signature": "t=123,v1=valid" },
      body: "{}",
    });

    const res = await handler(req);
    await res.body?.cancel();
    assertEquals(res.status, 500);
  } finally {
    stripe.webhooks.constructEvent = originalConstruct;
    supabase.from = originalFrom;
    stripe.subscriptions.list = originalListSubscriptions;
  }
});

Deno.test("stripe-webhook: returns 500 when one-time order insert fails so Stripe retries", async () => {
  const originalConstruct = stripe.webhooks.constructEvent;
  const originalFrom = supabase.from;

  try {
    stripe.webhooks.constructEvent = (() => ({
      type: "checkout.session.completed",
      data: {
        object: {
          customer: "cus_fail_order",
          id: "cs_fail_order",
          payment_intent: "pi_fail",
          amount_subtotal: 1000,
          amount_total: 1000,
          currency: "usd",
          payment_status: "paid",
          mode: "payment",
        },
      },
    })) as any;

    // Simulate a transient DB failure on the order insert.
    supabase.from = (() => ({
      insert: () => Promise.resolve({ error: { message: "db unavailable" } }),
    })) as any;

    const req = new Request("http://localhost/stripe-webhook", {
      method: "POST",
      headers: { "stripe-signature": "t=123,v1=valid" },
      body: "{}",
    });

    const res = await handler(req);
    await res.body?.cancel();
    assertEquals(res.status, 500);
  } finally {
    stripe.webhooks.constructEvent = originalConstruct;
    supabase.from = originalFrom;
  }
});

Deno.test("stripe-webhook: processes subscription session successfully", async () => {
  const originalConstruct = stripe.webhooks.constructEvent;
  const originalFrom = supabase.from;
  const originalListSubscriptions = stripe.subscriptions.list;

  let subscriptionUpserted = false;

  try {
    // 1. Mock Stripe Signature
    stripe.webhooks.constructEvent = (() => {
      return {
        type: "checkout.session.completed",
        data: {
          object: {
            customer: "cus_sub_123",
            id: "cs_test_sub_123",
            mode: "subscription",
            payment_status: "paid",
          },
        },
      };
    }) as any;

    // 2. Mock Stripe Subscription List
    stripe.subscriptions.list = (() => {
      return Promise.resolve({
        data: [
          {
            id: "sub_123",
            status: "active",
            current_period_start: 1620000000,
            current_period_end: 1622000000,
            cancel_at_period_end: false,
            items: {
              data: [
                {
                  price: { id: "price_sub_123" },
                },
              ],
            },
            default_payment_method: {
              card: {
                brand: "visa",
                last4: "4242",
              },
            },
          },
        ],
      });
    }) as any;

    // 3. Mock Supabase Database
    supabase.from = ((table: string) => {
      const builder = {
        upsert: (data: any, options: any) => {
          if (table === "stripe_subscriptions") {
            assertEquals(data.customer_id, "cus_sub_123");
            assertEquals(data.subscription_id, "sub_123");
            assertEquals(data.price_id, "price_sub_123");
            assertEquals(data.status, "active");
            assertEquals(options.onConflict, "customer_id");
            subscriptionUpserted = true;
          }
          return Promise.resolve({ error: null });
        },
      };
      return builder;
    }) as any;

    const req = new Request("http://localhost/stripe-webhook", {
      method: "POST",
      headers: {
        "stripe-signature": "t=123,v1=valid",
      },
      body: "{}",
    });

    const res = await handler(req);
    assertEquals(res.status, 200);

    // Wait for async task execution
    await new Promise((resolve) => setTimeout(resolve, 5));
    assertEquals(subscriptionUpserted, true);
  } finally {
    stripe.webhooks.constructEvent = originalConstruct;
    supabase.from = originalFrom;
    stripe.subscriptions.list = originalListSubscriptions;
  }
});
