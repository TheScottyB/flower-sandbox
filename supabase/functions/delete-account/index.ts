import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'npm:stripe@17.7.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? 'sk_test_mock');

// Stripe statuses that are already terminal — no cancellation needed/possible.
const TERMINAL_SUBSCRIPTION_STATUSES = new Set(['canceled', 'incomplete_expired']);

export async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    // Verify the JWT and get the user identity
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    // Use service role to delete the user
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: customer, error: customerError } = await supabaseAdmin
      .from('stripe_customers')
      .select('customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (customerError) {
      console.error('Error fetching customer before account deletion:', customerError);
      return new Response(JSON.stringify({ error: 'Failed to prepare account deletion' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    if (customer?.customer_id) {
      // Cancel any live Stripe subscriptions BEFORE destroying local data, so a
      // deleted account can never keep getting billed. This runs first: if it
      // fails we return 500 without touching the DB or auth user, so the account
      // survives and the operation can be safely retried. We list from Stripe
      // (not our DB) so hidden/duplicate subscriptions are also caught.
      try {
        const subscriptions = await stripe.subscriptions.list({
          customer: customer.customer_id,
          status: 'all',
          limit: 100,
        });

        for (const subscription of subscriptions.data) {
          if (!TERMINAL_SUBSCRIPTION_STATUSES.has(subscription.status)) {
            await stripe.subscriptions.cancel(subscription.id);
          }
        }
      } catch (stripeError) {
        console.error('Error canceling Stripe subscriptions before account deletion:', stripeError);
        return new Response(JSON.stringify({ error: 'Failed to cancel active subscription' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        });
      }

      const deletedAt = new Date().toISOString();

      const { error: subscriptionsError } = await supabaseAdmin
        .from('stripe_subscriptions')
        .update({ deleted_at: deletedAt })
        .eq('customer_id', customer.customer_id);

      if (subscriptionsError) {
        console.error('Error marking subscriptions deleted:', subscriptionsError);
        return new Response(JSON.stringify({ error: 'Failed to delete account data' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        });
      }

      const { error: ordersError } = await supabaseAdmin
        .from('stripe_orders')
        .update({ deleted_at: deletedAt })
        .eq('customer_id', customer.customer_id);

      if (ordersError) {
        console.error('Error marking orders deleted:', ordersError);
        return new Response(JSON.stringify({ error: 'Failed to delete account data' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        });
      }
    }

    // Delete the auth user before hard-deleting the customer mapping. If this
    // fails, the mapping still exists so a retry can re-find the customer and
    // finish cleanly, rather than orphaning a live account with no mapping.
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);

    if (deleteError) {
      console.error('Error deleting user:', deleteError);
      return new Response(JSON.stringify({ error: deleteError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const { error: customerDeleteError } = await supabaseAdmin
      .from('stripe_customers')
      .delete()
      .eq('user_id', user.id);

    if (customerDeleteError) {
      // The user is already gone and billing already stopped; a leftover mapping
      // row is harmless. Log it but still report success to the client.
      console.error('Error deleting customer mapping after user deletion:', customerDeleteError);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
