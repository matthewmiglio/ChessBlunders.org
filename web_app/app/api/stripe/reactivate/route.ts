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
      .select('stripe_subscription_id, cancel_at_period_end')
      .eq('id', user.id)
      .single();

    console.log('[stripe-reactivate] User:', user.id, 'Subscription ID:', profile?.stripe_subscription_id);

    if (!profile?.stripe_subscription_id) {
      return NextResponse.json({ error: 'No subscription found' }, { status: 400 });
    }

    if (!profile.cancel_at_period_end) {
      return NextResponse.json({ error: 'Subscription is not set to cancel' }, { status: 400 });
    }

    // Remove the cancellation
    const updated = await stripe.subscriptions.update(profile.stripe_subscription_id, {
      cancel_at_period_end: false,
    });

    console.log('[stripe-reactivate] Success, cancel_at_period_end:', updated.cancel_at_period_end);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('[stripe-reactivate] Error:', error);

    // Handle Stripe-specific errors
    if (error instanceof Stripe.errors.StripeError) {
      console.error('[stripe-reactivate] Stripe error type:', error.type, 'code:', error.code);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const message = error instanceof Error ? error.message : 'Failed to reactivate subscription';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
