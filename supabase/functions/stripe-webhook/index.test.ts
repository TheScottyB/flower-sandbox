import { assertEquals } from "jsr:@std/assert";
import { handler, stripe, supabase } from "./index.ts";

// Set up EdgeRuntime global mock
(globalThis as any).EdgeRuntime = {
  waitUntil: (promise: Promise<any>) => {
    // Just run/await the promise to verify its logic in tests
    return promise;
  },
};

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
