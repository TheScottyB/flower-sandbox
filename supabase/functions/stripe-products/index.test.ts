import { assertEquals } from "jsr:@std/assert";
import { handler, stripe } from "./index.ts";

Deno.test("stripe-products: CORS preflight (OPTIONS) returns 204", async () => {
  const req = new Request("http://localhost/stripe-products", {
    method: "OPTIONS",
  });
  const res = await handler(req);
  assertEquals(res.status, 204);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("stripe-products: non-GET method returns 405 Method Not Allowed", async () => {
  const req = new Request("http://localhost/stripe-products", {
    method: "POST",
  });
  const res = await handler(req);
  assertEquals(res.status, 405);
  const data = await res.json();
  assertEquals(data.error, "Method not allowed");
});

Deno.test("stripe-products: GET returns filtered products and formatted pricing", async () => {
  const originalProductsList = stripe.products.list;
  const originalPricesList = stripe.prices.list;

  try {
    stripe.products.list = (() => {
      return Promise.resolve({
        data: [
          {
            id: "prod_1",
            name: "Premium Flower",
            description: "A beautiful rose",
            metadata: { type: "flower" },
            images: ["https://example.com/rose.png"],
          },
          {
            id: "prod_2",
            name: "Other Product",
            description: "Not a flower",
            metadata: { type: "other" },
            images: [],
          },
        ],
      });
    }) as any;

    stripe.prices.list = ((params: any) => {
      if (params.product === "prod_1") {
        return Promise.resolve({
          data: [
            {
              id: "price_1",
              currency: "usd",
              type: "recurring",
              unit_amount: 1999,
              recurring: { interval: "month", interval_count: 1 },
            },
          ],
        });
      }
      return Promise.resolve({ data: [] });
    }) as any;

    // Test filtering by type=flower
    const req = new Request("http://localhost/stripe-products?type=flower", {
      method: "GET",
    });
    const res = await handler(req);
    assertEquals(res.status, 200);

    const data = await res.json();
    assertEquals(data.products.length, 1);
    const p1 = data.products[0];
    assertEquals(p1.id, "prod_1");
    assertEquals(p1.name, "Premium Flower");
    assertEquals(p1.priceId, "price_1");
    assertEquals(p1.price, "$19.99/month");
    assertEquals(p1.mode, "subscription");
  } finally {
    stripe.products.list = originalProductsList;
    stripe.prices.list = originalPricesList;
  }
});

Deno.test("stripe-products: formats one-time prices correctly", async () => {
  const originalProductsList = stripe.products.list;
  const originalPricesList = stripe.prices.list;

  try {
    stripe.products.list = (() => {
      return Promise.resolve({
        data: [
          {
            id: "prod_one_time",
            name: "Single Rose",
            description: "One single rose",
            metadata: {},
            images: [],
          },
        ],
      });
    }) as any;

    stripe.prices.list = (() => {
      return Promise.resolve({
        data: [
          {
            id: "price_2",
            currency: "usd",
            type: "one_time",
            unit_amount: 500,
          },
        ],
      });
    }) as any;

    const req = new Request("http://localhost/stripe-products", {
      method: "GET",
    });
    const res = await handler(req);
    assertEquals(res.status, 200);

    const data = await res.json();
    assertEquals(data.products.length, 1);
    const p = data.products[0];
    assertEquals(p.price, "$5");
    assertEquals(p.mode, "payment");
  } finally {
    stripe.products.list = originalProductsList;
    stripe.prices.list = originalPricesList;
  }
});

Deno.test("stripe-products: handles Stripe API errors gracefully", async () => {
  const originalProductsList = stripe.products.list;

  try {
    stripe.products.list = (() => {
      return Promise.reject(new Error("Stripe network error"));
    }) as any;

    const req = new Request("http://localhost/stripe-products", {
      method: "GET",
    });
    const res = await handler(req);
    assertEquals(res.status, 500);

    const data = await res.json();
    assertEquals(data.error, "Failed to fetch products");
  } finally {
    stripe.products.list = originalProductsList;
  }
});
