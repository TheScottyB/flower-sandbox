import { assertEquals } from "jsr:@std/assert";
import { handler, stripe } from "./index.ts";

Deno.test("stripe-checkout-anonymous: CORS preflight (OPTIONS) returns 204", async () => {
  const req = new Request("http://localhost/stripe-checkout-anonymous", {
    method: "OPTIONS",
  });
  const res = await handler(req);
  assertEquals(res.status, 204);
});

Deno.test("stripe-checkout-anonymous: non-POST returns 405 Method Not Allowed", async () => {
  const req = new Request("http://localhost/stripe-checkout-anonymous", {
    method: "GET",
  });
  const res = await handler(req);
  assertEquals(res.status, 405);
  const data = await res.json();
  assertEquals(data.error, "Method not allowed");
});

Deno.test("stripe-checkout-anonymous: missing parameters returns 400 Bad Request", async () => {
  const req = new Request("http://localhost/stripe-checkout-anonymous", {
    method: "POST",
    body: JSON.stringify({ mode: "payment" }), // Missing price_id, success_url, cancel_url
  });
  const res = await handler(req);
  assertEquals(res.status, 400);
});

Deno.test("stripe-checkout-anonymous: successful Checkout Session creation", async () => {
  const originalStripeCheckoutSessionsCreate = stripe.checkout.sessions.create;

  try {
    stripe.checkout.sessions.create = ((params: any) => {
      assertEquals(params.mode, "payment");
      assertEquals(params.line_items[0].price, "price_abc");
      return Promise.resolve({
        id: "sess_abc",
        url: "https://checkout.stripe.com/pay/sess_abc",
      });
    }) as any;

    const req = new Request("http://localhost/stripe-checkout-anonymous", {
      method: "POST",
      body: JSON.stringify({
        price_id: "price_abc",
        success_url: "https://example.com/success",
        cancel_url: "https://example.com/cancel",
        mode: "payment",
      }),
    });

    const res = await handler(req);
    assertEquals(res.status, 200);

    const data = await res.json();
    assertEquals(data.sessionId, "sess_abc");
    assertEquals(data.url, "https://checkout.stripe.com/pay/sess_abc");
  } finally {
    stripe.checkout.sessions.create = originalStripeCheckoutSessionsCreate;
  }
});
