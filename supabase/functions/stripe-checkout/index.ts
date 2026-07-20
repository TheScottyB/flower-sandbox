import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

export const supabase = createClient(Deno.env.get('SUPABASE_URL') || 'https://mock-project.supabase.co', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 'mock-key');
export const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY') || 'sk_test_mock';
export const stripe = new Stripe(stripeSecret);

// Stripe statuses under which the customer already holds a live subscription.
// Starting a new subscription-mode checkout in these states creates a second
// concurrent subscription (double billing), so we block it. Kept in sync with
// the client's ENTITLED_SUBSCRIPTION_STATUSES in src/stripe-config.ts.
const LIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing', 'past_due']);

// Helper function to create responses with CORS headers
function corsResponse(body: string | object | null, status = 200) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };

  // For 204 No Content, don't include Content-Type or body
  if (status === 204) {
    return new Response(null, { status, headers });
  }

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
  });
}

export async function handler(req: Request): Promise<Response> {
  try {
    if (req.method === 'OPTIONS') {
      return corsResponse({}, 204);
    }

    if (req.method !== 'POST') {
      return corsResponse({ error: 'Method not allowed' }, 405);
    }

    const { price_id, success_url, cancel_url, mode } = await req.json();

    const error = validateParameters(
      { price_id, success_url, cancel_url, mode },
      {
        cancel_url: 'string',
        price_id: 'string',
        success_url: 'string',
        mode: { values: ['payment', 'subscription'] },
      },
    );

    if (error) {
      return corsResponse({ error }, 400);
    }

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error: getUserError,
    } = await supabase.auth.getUser(token);

    if (getUserError) {
      return corsResponse({ error: 'Failed to authenticate user' }, 401);
    }

    if (!user) {
      return corsResponse({ error: 'User not found' }, 404);
    }

    const { data: customer, error: getCustomerError } = await supabase
      .from('stripe_customers')
      .select('customer_id')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .maybeSingle();

    if (getCustomerError) {
      console.error('Failed to fetch customer information from the database', getCustomerError);

      return corsResponse({ error: 'Failed to fetch customer information' }, 500);
    }

    let customerId;

    /**
     * In case we don't have a mapping yet, the customer does not exist and we need to create one.
     */
    if (!customer || !customer.customer_id) {
      const newCustomer = await stripe.customers.create({
        email: user.email,
        metadata: {
          userId: user.id,
        },
      });

      console.log(`Created new Stripe customer ${newCustomer.id} for user ${user.id}`);

      const { error: createCustomerError } = await supabase.from('stripe_customers').insert({
        user_id: user.id,
        customer_id: newCustomer.id,
      });

      if (createCustomerError) {
        console.error('Failed to save customer information in the database', createCustomerError);

        // Try to clean up both the Stripe customer and subscription record
        try {
          await stripe.customers.del(newCustomer.id);
          await supabase.from('stripe_subscriptions').delete().eq('customer_id', newCustomer.id);
        } catch (deleteError) {
          console.error('Failed to clean up after customer mapping error:', deleteError);
        }

        // A concurrent request (double-tap / two devices) already created the
        // mapping — recover by reusing it instead of failing a legitimate
        // checkout with a spurious 500.
        if (createCustomerError.code === '23505') {
          const { data: existingCustomer, error: refetchError } = await supabase
            .from('stripe_customers')
            .select('customer_id')
            .eq('user_id', user.id)
            .is('deleted_at', null)
            .maybeSingle();

          if (refetchError || !existingCustomer?.customer_id) {
            return corsResponse({ error: 'Failed to create customer mapping' }, 500);
          }

          customerId = existingCustomer.customer_id;
        } else {
          return corsResponse({ error: 'Failed to create customer mapping' }, 500);
        }
      } else {
        if (mode === 'subscription') {
          const { error: createSubscriptionError } = await supabase.from('stripe_subscriptions').insert({
            customer_id: newCustomer.id,
            status: 'not_started',
          });

          if (createSubscriptionError) {
            console.error('Failed to save subscription in the database', createSubscriptionError);

            // Try to clean up the Stripe customer since we couldn't create the subscription
            try {
              await stripe.customers.del(newCustomer.id);
            } catch (deleteError) {
              console.error('Failed to delete Stripe customer after subscription creation error:', deleteError);
            }

            return corsResponse({ error: 'Unable to save the subscription in the database' }, 500);
          }
        }

        customerId = newCustomer.id;

        console.log(`Successfully set up new customer ${customerId} with subscription record`);
      }
    } else {
      customerId = customer.customer_id;

      if (mode === 'subscription') {
        // Verify subscription exists for existing customer
        const { data: subscription, error: getSubscriptionError } = await supabase
          .from('stripe_subscriptions')
          .select('status')
          .eq('customer_id', customerId)
          .maybeSingle();

        if (getSubscriptionError) {
          console.error('Failed to fetch subscription information from the database', getSubscriptionError);

          return corsResponse({ error: 'Failed to fetch subscription information' }, 500);
        }

        // Block a second subscription while one is already live, so the customer
        // is never double-billed (the DB row can only track a single subscription).
        if (subscription && LIVE_SUBSCRIPTION_STATUSES.has(subscription.status)) {
          return corsResponse({ error: 'You already have an active subscription.' }, 409);
        }

        if (!subscription) {
          // Create subscription record for existing customer if missing
          const { error: createSubscriptionError } = await supabase.from('stripe_subscriptions').insert({
            customer_id: customerId,
            status: 'not_started',
          });

          if (createSubscriptionError) {
            console.error('Failed to create subscription record for existing customer', createSubscriptionError);

            return corsResponse({ error: 'Failed to create subscription record for existing customer' }, 500);
          }
        }
      }
    }

    // create Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price: price_id,
          quantity: 1,
        },
      ],
      mode,
      success_url,
      cancel_url,
    });

    console.log(`Created checkout session ${session.id} for customer ${customerId}`);

    return corsResponse({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    console.error(`Checkout error: ${error.type} - ${error.message}`);
    const isClientError = ['StripeInvalidRequestError', 'StripePermissionError', 'StripeAuthenticationError'].includes(error.type);
    return corsResponse({ error: isClientError ? error.message : 'Payment service error. Please try again later.' }, isClientError ? (error.statusCode || 400) : 500);
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}

type ExpectedType = 'string' | { values: string[] };
type Expectations<T> = { [K in keyof T]: ExpectedType };

function validateParameters<T extends Record<string, any>>(values: T, expected: Expectations<T>): string | undefined {
  for (const parameter in values) {
    const expectation = expected[parameter];
    const value = values[parameter];

    if (expectation === 'string') {
      if (value == null) {
        return `Missing required parameter ${parameter}`;
      }
      if (typeof value !== 'string') {
        return `Expected parameter ${parameter} to be a string got ${JSON.stringify(value)}`;
      }
    } else {
      if (!expectation.values.includes(value)) {
        return `Expected parameter ${parameter} to be one of ${expectation.values.join(', ')}`;
      }
    }
  }

  return undefined;
}