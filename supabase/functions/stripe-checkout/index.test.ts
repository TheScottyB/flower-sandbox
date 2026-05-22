import { assertEquals } from "jsr:@std/assert";
import { handler, supabase, stripe } from "./index.ts";

Deno.test("stripe-checkout: CORS preflight (OPTIONS) returns 204", async () => {
  const req = new Request("http://localhost/stripe-checkout", {
    method: "OPTIONS",
  });
  const res = await handler(req);
  assertEquals(res.status, 204);
});

Deno.test("stripe-checkout: non-POST returns 405 Method Not Allowed", async () => {
  const req = new Request("http://localhost/stripe-checkout", {
    method: "GET",
  });
  const res = await handler(req);
  assertEquals(res.status, 405);
  const data = await res.json();
  assertEquals(data.error, "Method not allowed");
});

Deno.test("stripe-checkout: missing parameters returns 400 Bad Request", async () => {
  const req = new Request("http://localhost/stripe-checkout", {
    method: "POST",
    body: JSON.stringify({ mode: "subscription" }), // Missing price_id, success_url, cancel_url
  });
  const res = await handler(req);
  assertEquals(res.status, 400);
});

Deno.test("stripe-checkout: invalid token returns 401 Unauthorized", async () => {
  const originalGetUser = supabase.auth.getUser;
  try {
    supabase.auth.getUser = (() => {
      return Promise.resolve({ data: { user: null }, error: new Error("Invalid token") });
    }) as any;

    const req = new Request("http://localhost/stripe-checkout", {
      method: "POST",
      headers: {
        Authorization: "Bearer invalid-token",
      },
      body: JSON.stringify({
        price_id: "price_123",
        success_url: "https://example.com/success",
        cancel_url: "https://example.com/cancel",
        mode: "payment",
      }),
    });

    const res = await handler(req);
    assertEquals(res.status, 401);
    const data = await res.json();
    assertEquals(data.error, "Failed to authenticate user");
  } finally {
    supabase.auth.getUser = originalGetUser;
  }
});

Deno.test("stripe-checkout: successful session creation for new customer", async () => {
  const originalGetUser = supabase.auth.getUser;
  const originalFrom = supabase.from;
  const originalStripeCustomersCreate = stripe.customers.create;
  const originalStripeCheckoutSessionsCreate = stripe.checkout.sessions.create;

  try {
    // 1. Mock Authentication
    supabase.auth.getUser = (() => {
      return Promise.resolve({
        data: {
          user: { id: "user_123", email: "user@example.com" },
        },
        error: null,
      });
    }) as any;

    // 2. Mock Supabase Database
    let databaseCustomerInserted = false;
    supabase.from = ((table: string) => {
      const builder = {
        select: () => builder,
        eq: () => builder,
        is: () => builder,
        maybeSingle: () => {
          if (table === "stripe_customers") {
            // Return null customer to trigger new customer creation path
            return Promise.resolve({ data: null, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
        insert: (data: any) => {
          if (table === "stripe_customers" && data.user_id === "user_123" && data.customer_id === "cus_123") {
            databaseCustomerInserted = true;
          }
          return Promise.resolve({ error: null });
        },
      };
      return builder;
    }) as any;

    // 3. Mock Stripe customer creation
    stripe.customers.create = (() => {
      return Promise.resolve({ id: "cus_123", email: "user@example.com" });
    }) as any;

    // 4. Mock Stripe Checkout Session creation
    stripe.checkout.sessions.create = ((params: any) => {
      assertEquals(params.customer, "cus_123");
      assertEquals(params.mode, "payment");
      assertEquals(params.line_items[0].price, "price_123");
      return Promise.resolve({ id: "sess_123", url: "https://checkout.stripe.com/pay/sess_123" });
    }) as any;

    const req = new Request("http://localhost/stripe-checkout", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
      },
      body: JSON.stringify({
        price_id: "price_123",
        success_url: "https://example.com/success",
        cancel_url: "https://example.com/cancel",
        mode: "payment",
      }),
    });

    const res = await handler(req);
    assertEquals(res.status, 200);

    const data = await res.json();
    assertEquals(data.sessionId, "sess_123");
    assertEquals(data.url, "https://checkout.stripe.com/pay/sess_123");
    assertEquals(databaseCustomerInserted, true);
  } finally {
    supabase.auth.getUser = originalGetUser;
    supabase.from = originalFrom;
    stripe.customers.create = originalStripeCustomersCreate;
    stripe.checkout.sessions.create = originalStripeCheckoutSessionsCreate;
  }
});
