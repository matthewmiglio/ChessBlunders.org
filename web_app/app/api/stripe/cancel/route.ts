import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { stripe } from '@/lib/stripe';
import Stripe from 'stripe';

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
      console.error('[stripe-cancel] Stripe error type:', error.type, 'code:', error.code);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const message = error instanceof Error ? error.message : 'Failed to cancel subscription';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
