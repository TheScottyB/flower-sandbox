import { assertEquals } from "jsr:@std/assert";
import { handler, stripe } from "./index.ts";

// Set required env vars for the client initialization
Deno.env.set("SUPABASE_URL", "https://mock-project.supabase.co");
Deno.env.set("SUPABASE_ANON_KEY", "mock-anon-key");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "mock-service-role-key");

const VALID_USER_UUID = "d3b07384-d113-4956-a5e2-aa66782c5a04";

Deno.test("delete-account: OPTIONS request returns 200 ok", async () => {
  const req = new Request("http://localhost/delete-account", {
    method: "OPTIONS",
  });
  const res = await handler(req);
  assertEquals(res.status, 200);
  const text = await res.text();
  assertEquals(text, "ok");
});

Deno.test("delete-account: non-POST request returns 405 Method Not Allowed", async () => {
  const req = new Request("http://localhost/delete-account", {
    method: "GET",
  });
  const res = await handler(req);
  assertEquals(res.status, 405);
  const data = await res.json();
  assertEquals(data.error, "Method not allowed");
});

Deno.test("delete-account: missing authorization header returns 401", async () => {
  const req = new Request("http://localhost/delete-account", {
    method: "POST",
  });
  const res = await handler(req);
  assertEquals(res.status, 401);
  const data = await res.json();
  assertEquals(data.error, "Missing authorization header");
});

Deno.test({
  name: "delete-account: cancels active Stripe subscriptions before deleting the account",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const originalFetch = globalThis.fetch;
    const originalList = stripe.subscriptions.list;
    const originalCancel = stripe.subscriptions.cancel;

    const canceledIds: string[] = [];
    let userDeleted = false;

    try {
      stripe.subscriptions.list = (() =>
        Promise.resolve({
          data: [
            { id: "sub_active", status: "active" },
            { id: "sub_already_gone", status: "canceled" },
          ],
        })) as any;

      stripe.subscriptions.cancel = ((id: string) => {
        canceledIds.push(id);
        return Promise.resolve({ id, status: "canceled" });
      }) as any;

      globalThis.fetch = ((url: string | URL | Request, options?: RequestInit) => {
        const urlStr = url.toString();
        const method = options?.method || "GET";

        if (urlStr.includes("/auth/v1/user")) {
          return Promise.resolve(
            new Response(JSON.stringify({ id: VALID_USER_UUID, email: "user@example.com" }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            })
          );
        }
        if (urlStr.includes("/rest/v1/stripe_customers") && method === "GET") {
          return Promise.resolve(
            new Response(JSON.stringify({ customer_id: "cus_123" }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            })
          );
        }
        if (urlStr.includes(`/auth/v1/admin/users/${VALID_USER_UUID}`) && method === "DELETE") {
          userDeleted = true;
          return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
        }
        return Promise.resolve(
          new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } })
        );
      }) as any;

      const req = new Request("http://localhost/delete-account", {
        method: "POST",
        headers: { Authorization: "Bearer valid-jwt-token" },
      });

      const res = await handler(req);
      assertEquals(res.status, 200);
      const data = await res.json();
      assertEquals(data.success, true);
      // Only the still-live subscription is canceled, not the already-canceled one.
      assertEquals(canceledIds, ["sub_active"]);
      assertEquals(userDeleted, true);
    } finally {
      globalThis.fetch = originalFetch;
      stripe.subscriptions.list = originalList;
      stripe.subscriptions.cancel = originalCancel;
    }
  },
});

Deno.test({
  name: "delete-account: keeps the customer mapping when auth-user deletion fails (retry-safe)",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const originalFetch = globalThis.fetch;
    const originalList = stripe.subscriptions.list;

    let customerMappingDeleted = false;

    try {
      stripe.subscriptions.list = (() => Promise.resolve({ data: [] })) as any;

      globalThis.fetch = ((url: string | URL | Request, options?: RequestInit) => {
        const urlStr = url.toString();
        const method = options?.method || "GET";

        if (urlStr.includes("/auth/v1/user") && !urlStr.includes("/admin/")) {
          return Promise.resolve(
            new Response(JSON.stringify({ id: VALID_USER_UUID, email: "user@example.com" }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            })
          );
        }
        if (urlStr.includes("/rest/v1/stripe_customers") && method === "GET") {
          return Promise.resolve(
            new Response(JSON.stringify({ customer_id: "cus_123" }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            })
          );
        }
        if (urlStr.includes("/rest/v1/stripe_customers") && method === "DELETE") {
          customerMappingDeleted = true;
          return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
        }
        // Auth admin user deletion fails.
        if (urlStr.includes(`/auth/v1/admin/users/${VALID_USER_UUID}`) && method === "DELETE") {
          return Promise.resolve(
            new Response(JSON.stringify({ message: "service unavailable" }), { status: 500 })
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } })
        );
      }) as any;

      const req = new Request("http://localhost/delete-account", {
        method: "POST",
        headers: { Authorization: "Bearer valid-jwt-token" },
      });

      const res = await handler(req);
      await res.body?.cancel();
      assertEquals(res.status, 500);
      // The mapping must survive so the retry can still find and finish the deletion.
      assertEquals(customerMappingDeleted, false);
    } finally {
      globalThis.fetch = originalFetch;
      stripe.subscriptions.list = originalList;
    }
  },
});

Deno.test({
  name: "delete-account: returns 500 and does not delete the user when Stripe cancellation fails",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const originalFetch = globalThis.fetch;
    const originalList = stripe.subscriptions.list;
    const originalCancel = stripe.subscriptions.cancel;

    let userDeleted = false;

    try {
      stripe.subscriptions.list = (() =>
        Promise.resolve({ data: [{ id: "sub_active", status: "active" }] })) as any;

      stripe.subscriptions.cancel = (() => {
        throw new Error("Stripe API unavailable");
      }) as any;

      globalThis.fetch = ((url: string | URL | Request, options?: RequestInit) => {
        const urlStr = url.toString();
        const method = options?.method || "GET";

        if (urlStr.includes("/auth/v1/user")) {
          return Promise.resolve(
            new Response(JSON.stringify({ id: VALID_USER_UUID, email: "user@example.com" }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            })
          );
        }
        if (urlStr.includes("/rest/v1/stripe_customers") && method === "GET") {
          return Promise.resolve(
            new Response(JSON.stringify({ customer_id: "cus_123" }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            })
          );
        }
        if (urlStr.includes(`/auth/v1/admin/users/${VALID_USER_UUID}`) && method === "DELETE") {
          userDeleted = true;
          return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
        }
        return Promise.resolve(
          new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } })
        );
      }) as any;

      const req = new Request("http://localhost/delete-account", {
        method: "POST",
        headers: { Authorization: "Bearer valid-jwt-token" },
      });

      const res = await handler(req);
      await res.body?.cancel();
      assertEquals(res.status, 500);
      // The account must survive so billing can be stopped on retry.
      assertEquals(userDeleted, false);
    } finally {
      globalThis.fetch = originalFetch;
      stripe.subscriptions.list = originalList;
      stripe.subscriptions.cancel = originalCancel;
    }
  },
});

Deno.test({
  name: "delete-account: successful user and data deletion",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const originalFetch = globalThis.fetch;
    const originalList = stripe.subscriptions.list;

    let subscriptionsUpdated = false;
    let ordersUpdated = false;
    let customerDeleted = false;
    let userDeleted = false;

    try {
      // No live subscriptions for this customer — isolates the DB/auth flow.
      stripe.subscriptions.list = (() => Promise.resolve({ data: [] })) as any;

      globalThis.fetch = ((url: string | URL | Request, options?: RequestInit) => {
        const urlStr = url.toString();
        const method = options?.method || "GET";

        // 1. Mock getUser auth verification
        if (urlStr.includes("/auth/v1/user")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                id: VALID_USER_UUID,
                email: "user@example.com",
              }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            )
          );
        }

        // 2. Mock customer_id query from stripe_customers
        if (urlStr.includes("/rest/v1/stripe_customers") && method === "GET") {
          return Promise.resolve(
            new Response(
              JSON.stringify({ customer_id: "cus_123" }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            )
          );
        }

        // 3. Mock subscription soft-delete PATCH
        if (urlStr.includes("/rest/v1/stripe_subscriptions") && method === "PATCH") {
          subscriptionsUpdated = true;
          return Promise.resolve(
            new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } })
          );
        }

        // 4. Mock order soft-delete PATCH
        if (urlStr.includes("/rest/v1/stripe_orders") && method === "PATCH") {
          ordersUpdated = true;
          return Promise.resolve(
            new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } })
          );
        }

        // 5. Mock customer mapping deletion DELETE
        if (urlStr.includes("/rest/v1/stripe_customers") && method === "DELETE") {
          customerDeleted = true;
          return Promise.resolve(
            new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } })
          );
        }

        // 6. Mock user deletion from auth admin DELETE
        if (urlStr.includes(`/auth/v1/admin/users/${VALID_USER_UUID}`) && method === "DELETE") {
          userDeleted = true;
          return Promise.resolve(
            new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } })
          );
        }

        // Fallback
        return Promise.resolve(
          new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } })
        );
      }) as any;

      const req = new Request("http://localhost/delete-account", {
        method: "POST",
        headers: {
          Authorization: "Bearer valid-jwt-token",
        },
      });

      const res = await handler(req);
      assertEquals(res.status, 200);

      const data = await res.json();
      assertEquals(data.success, true);
      assertEquals(subscriptionsUpdated, true);
      assertEquals(ordersUpdated, true);
      assertEquals(customerDeleted, true);
      assertEquals(userDeleted, true);
    } finally {
      globalThis.fetch = originalFetch;
      stripe.subscriptions.list = originalList;
    }
  }
});
