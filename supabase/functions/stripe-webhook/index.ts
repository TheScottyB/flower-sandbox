import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

// Import Stripe types
type StripeEvent = any;
type StripeCheckoutSession = any;

export const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY') || 'sk_test_mock';
export const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || 'whsec_mock';
export const stripe = new Stripe(stripeSecret);

export const supabase = createClient(Deno.env.get('SUPABASE_URL') || 'https://mock-project.supabase.co', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 'mock-key');

export async function handler(req: Request): Promise<Response> {
  try {
    // Handle OPTIONS request for CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204 });
    }

    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // get the signature from the header
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      return new Response('No signature found', { status: 400 });
    }

    // get the raw body
    const body = await req.text();

    // verify the webhook signature
    let event: StripeEvent;

    try {
      event = stripe.webhooks.constructEvent(body, signature, stripeWebhookSecret);
    } catch (error: any) {
      console.error(`Webhook signature verification failed: ${error.message}`);
      return new Response(`Webhook signature verification failed: ${error.message}`, { status: 400 });
    }

    // Process synchronously and only ACK once the DB write succeeds. Returning a
    // 5xx on failure lets Stripe honour its at-least-once retry contract instead
    // of dropping the event (a paid subscription/order that never gets recorded).
    await handleEvent(event);

    return Response.json({ received: true });
  } catch (error: any) {
    console.error('Error processing webhook:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}

async function handleEvent(event: StripeEvent) {
  const stripeData = event?.data?.object ?? {};

  if (!stripeData) {
    return;
  }

  // Refunds and disputes cancel a previously-recorded order. Handle these first:
  // their object shapes differ from checkout sessions, and they must never fall
  // through into the subscription-sync path below.
  if (event.type === 'charge.refunded' || event.type === 'charge.dispute.created') {
    const paymentIntentId = typeof stripeData.payment_intent === 'string' ? stripeData.payment_intent : null;
    if (paymentIntentId) {
      await markOrderCanceled('payment_intent_id', paymentIntentId);
    }
    return;
  }

  if (!('customer' in stripeData)) {
    return;
  }

  // for one time payments, we only listen for the checkout.session.completed event.
  // Use a loose null check: newer Stripe API versions omit `invoice` from
  // PaymentIntent entirely, so `=== null` would let those fall through to sync.
  if (event.type === 'payment_intent.succeeded' && !event.data.object.invoice) {
    return;
  }

  const { customer: customerId } = stripeData;

  if (!customerId || typeof customerId !== 'string') {
    console.error(`No customer received on event: ${JSON.stringify(event)}`);
  } else {
    let isSubscription = true;

    if (event.type === 'checkout.session.completed') {
      const { mode } = stripeData as StripeCheckoutSession;

      isSubscription = mode === 'subscription';

      console.info(`Processing ${isSubscription ? 'subscription' : 'one-time payment'} checkout session`);
    }

    const { mode, payment_status } = stripeData as StripeCheckoutSession;

    if (isSubscription) {
      console.info(`Starting subscription sync for customer: ${customerId}`);
      await syncCustomerFromStripe(customerId);
    } else if (mode === 'payment' && payment_status === 'paid') {
      try {
        // Extract the necessary information from the session
        const {
          id: checkout_session_id,
          payment_intent,
          amount_subtotal,
          amount_total,
          currency,
        } = stripeData as StripeCheckoutSession;

        // Idempotency: Stripe delivers at-least-once (retries, dashboard "Resend"),
        // so skip if this session's order is already recorded to avoid duplicates.
        const { data: existingOrder, error: existingOrderError } = await supabase
          .from('stripe_orders')
          .select('id')
          .eq('checkout_session_id', checkout_session_id)
          .maybeSingle();

        if (existingOrderError) {
          console.error('Error checking for existing order:', existingOrderError);
          throw new Error('Failed to check for existing order in database');
        }

        if (existingOrder) {
          console.info(`Order already recorded for session ${checkout_session_id}; skipping duplicate.`);
          return;
        }

        // Insert the order into the stripe_orders table
        const { error: orderError } = await supabase.from('stripe_orders').insert({
          checkout_session_id,
          payment_intent_id: payment_intent,
          customer_id: customerId,
          amount_subtotal,
          amount_total,
          currency,
          payment_status,
          status: 'completed', // assuming we want to mark it as completed since payment is successful
        });

        if (orderError) {
          console.error('Error inserting order:', orderError);
          throw new Error('Failed to insert order in database');
        }
        console.info(`Successfully processed one-time payment for session: ${checkout_session_id}`);
      } catch (error) {
        console.error('Error processing one-time payment:', error);
        throw error;
      }
    }
  }
}

// based on the excellent https://github.com/t3dotgg/stripe-recommendations
async function syncCustomerFromStripe(customerId: string) {
  try {
    // fetch latest subscription data from Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 1,
      status: 'all',
      expand: ['data.default_payment_method'],
    });

    if (subscriptions.data.length === 0) {
      console.info(`No active subscriptions found for customer: ${customerId}`);
      const { error: noSubError } = await supabase.from('stripe_subscriptions').upsert(
        {
          customer_id: customerId,
          status: 'not_started',
        },
        {
          onConflict: 'customer_id',
        },
      );

      if (noSubError) {
        console.error('Error updating subscription status:', noSubError);
        throw new Error('Failed to update subscription status in database');
      }
      return;
    }

    // assumes that a customer can only have a single subscription
    const subscription = subscriptions.data[0];

    // store subscription state
    const { error: subError } = await supabase.from('stripe_subscriptions').upsert(
      {
        customer_id: customerId,
        subscription_id: subscription.id,
        price_id: subscription.items.data[0].price.id,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        cancel_at_period_end: subscription.cancel_at_period_end,
        ...(subscription.default_payment_method && typeof subscription.default_payment_method !== 'string'
          ? {
              payment_method_brand: subscription.default_payment_method.card?.brand ?? null,
              payment_method_last4: subscription.default_payment_method.card?.last4 ?? null,
            }
          : {}),
        status: subscription.status,
      },
      {
        onConflict: 'customer_id',
      },
    );

    if (subError) {
      console.error('Error syncing subscription:', subError);
      throw new Error('Failed to sync subscription in database');
    }
    console.info(`Successfully synced subscription for customer: ${customerId}`);
  } catch (error) {
    console.error(`Failed to sync subscription for customer ${customerId}:`, error);
    throw error;
  }
}

// Mark a recorded order as canceled (refund/dispute). Matches on the given column
// so it works whether we key by payment intent or checkout session.
async function markOrderCanceled(column: 'payment_intent_id' | 'checkout_session_id', value: string) {
  const { error } = await supabase
    .from('stripe_orders')
    .update({ status: 'canceled' })
    .eq(column, value);

  if (error) {
    console.error('Error canceling order:', error);
    throw new Error('Failed to cancel order in database');
  }
  console.info(`Marked order canceled where ${column}=${value}`);
}