import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { stripe } from '@/lib/stripe';
import Stripe from 'stripe';
import { createClient as createAdminClient } from '@supabase/supabase-js';

// Use service role for syncing subscription status
const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_subscription_id')
      .eq('id', user.id)
      .single();

    console.log('[stripe-cancel] User:', user.id, 'Subscription ID:', profile?.stripe_subscription_id);

    if (!profile?.stripe_subscription_id) {
      return NextResponse.json({ error: 'No subscription found' }, { status: 400 });
    }

    // First, check the subscription status in Stripe
    const subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
    console.log('[stripe-cancel] Current Stripe status:', subscription.status);

    // If already canceled, sync the database and return success
    if (subscription.status === 'canceled') {
      console.log('[stripe-cancel] Subscription already canceled, syncing database');
      await supabaseAdmin
        .from('profiles')
        .update({
          stripe_subscription_status: 'canceled',
          cancel_at_period_end: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);
      return NextResponse.json({ success: true, alreadyCanceled: true });
    }

    // If already set to cancel at period end, return success
    if (subscription.cancel_at_period_end) {
      console.log('[stripe-cancel] Already set to cancel at period end');
      return NextResponse.json({ success: true });
    }

    // Cancel at period end (user keeps access until billing period ends)
    const updated = await stripe.subscriptions.update(profile.stripe_subscription_id, {
      cancel_at_period_end: true,
    });

    console.log('[stripe-cancel] Success, cancel_at_period_end:', updated.cancel_at_period_end);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('[stripe-cancel] Error:', error);

    // Handle Stripe-specific errors
    if (error instanceof Stripe.errors.StripeError) {
      console.error('[stripe-cancel] Stripe error type:', error.type, 'code:', error.code, 'message:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Handle generic errors
    if (error instanceof Error) {
      console.error('[stripe-cancel] Generic error:', error.name, error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ error: 'Failed to cancel subscription' }, { status: 500 });
  }
}
