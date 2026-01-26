import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { createClient } from '@supabase/supabase-js';

// Type workarounds for Stripe SDK type issues
// Note: Stripe deprecated subscription-level current_period_start/end in API version 2025-03-31
// These fields now live on subscription items instead
interface SubscriptionItemWithPeriod {
  current_period_start?: number;
  current_period_end?: number;
}

interface InvoiceWithSubscription extends Stripe.Invoice {
  subscription: string | null;
}

// Helper to safely convert Unix timestamp to ISO string
function timestampToISO(timestamp: number | undefined | null): string | null {
  if (!timestamp || typeof timestamp !== 'number') {
    return null;
  }
  try {
    return new Date(timestamp * 1000).toISOString();
  } catch {
    return null;
  }
}

// Helper to extract period values from subscription
// Stripe moved these from subscription level to subscription item level
function getSubscriptionPeriod(subscription: Stripe.Subscription): { start: number | null; end: number | null } {
  // First try subscription item level (new location as of API 2025-03-31)
  const item = subscription.items?.data?.[0] as unknown as SubscriptionItemWithPeriod | undefined;
  if (item?.current_period_start && item?.current_period_end) {
    return {
      start: item.current_period_start,
      end: item.current_period_end,
    };
  }

  // Fallback to subscription level (deprecated but may still work on older API versions)
  const sub = subscription as unknown as { current_period_start?: number; current_period_end?: number };
  return {
    start: sub.current_period_start || null,
    end: sub.current_period_end || null,
  };
}

// Use service role for webhook updates (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  console.log('[stripe-webhook] Received webhook request');
  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
    console.log('[stripe-webhook] Event verified:', event.type);
  } catch (err) {
    console.error('[stripe-webhook] Signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as InvoiceWithSubscription;
        await handleInvoicePaid(invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as InvoiceWithSubscription;
        await handlePaymentFailed(invoice);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  console.log('[stripe-webhook] handleCheckoutCompleted called');
  console.log('[stripe-webhook] Session:', { id: session.id, customer: session.customer, subscription: session.subscription });

  const subscriptionId = session.subscription as string;
  const customerId = session.customer as string;

  if (!subscriptionId) {
    console.error('[stripe-webhook] No subscription ID in session');
    return;
  }

  // Fetch full subscription details
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const userId = subscription.metadata.supabase_user_id;

  console.log('[stripe-webhook] Subscription:', { id: subscription.id, status: subscription.status, userId });

  if (!userId) {
    console.error('[stripe-webhook] No supabase_user_id in subscription metadata');
    return;
  }

  // Get period values from subscription items (Stripe moved these in API 2025-03-31)
  const period = getSubscriptionPeriod(subscription);
  console.log('[stripe-webhook] Period values:', period);

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      stripe_subscription_status: subscription.status,
      stripe_price_id: subscription.items.data[0]?.price?.id || null,
      subscription_period_start: timestampToISO(period.start),
      subscription_period_end: timestampToISO(period.end),
      cancel_at_period_end: subscription.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    console.error('[stripe-webhook] Failed to update profile:', error);
  } else {
    console.log('[stripe-webhook] Profile updated successfully for user:', userId);
  }
}

async function handleInvoicePaid(invoice: InvoiceWithSubscription) {
  console.log('[stripe-webhook] handleInvoicePaid called');
  const subscriptionId = invoice.subscription;
  if (!subscriptionId) {
    console.log('[stripe-webhook] No subscription ID in invoice, skipping');
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const userId = subscription.metadata.supabase_user_id;

  if (!userId) {
    console.error('[stripe-webhook] No supabase_user_id in subscription metadata for invoice.paid');
    return;
  }

  const period = getSubscriptionPeriod(subscription);

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      stripe_subscription_status: 'active',
      subscription_period_start: timestampToISO(period.start),
      subscription_period_end: timestampToISO(period.end),
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    console.error('[stripe-webhook] Failed to update profile for invoice.paid:', error);
    throw error;
  } else {
    console.log('[stripe-webhook] Invoice paid processed for user:', userId);
  }
}

async function handlePaymentFailed(invoice: InvoiceWithSubscription) {
  console.log('[stripe-webhook] handlePaymentFailed called');
  const subscriptionId = invoice.subscription;
  if (!subscriptionId) {
    console.log('[stripe-webhook] No subscription ID in invoice, skipping');
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const userId = subscription.metadata.supabase_user_id;

  if (!userId) {
    console.error('[stripe-webhook] No supabase_user_id in subscription metadata for payment.failed');
    return;
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      stripe_subscription_status: subscription.status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    console.error('[stripe-webhook] Failed to update profile for payment.failed:', error);
    throw error;
  } else {
    console.log('[stripe-webhook] Payment failed processed for user:', userId);
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log('[stripe-webhook] handleSubscriptionUpdated called');
  const userId = subscription.metadata.supabase_user_id;
  const period = getSubscriptionPeriod(subscription);

  console.log('[stripe-webhook] Subscription update data:', {
    id: subscription.id,
    status: subscription.status,
    userId,
    cancel_at_period_end: subscription.cancel_at_period_end,
    period,
  });

  if (!userId) {
    console.error('[stripe-webhook] No supabase_user_id in subscription metadata for subscription.updated');
    return;
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      stripe_subscription_status: subscription.status,
      stripe_price_id: subscription.items.data[0]?.price?.id || null,
      subscription_period_start: timestampToISO(period.start),
      subscription_period_end: timestampToISO(period.end),
      cancel_at_period_end: subscription.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    console.error('[stripe-webhook] Failed to update subscription:', error);
    throw error;
  } else {
    console.log('[stripe-webhook] Subscription updated successfully for user:', userId);
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log('[stripe-webhook] handleSubscriptionDeleted called');
  const userId = subscription.metadata.supabase_user_id;

  if (!userId) {
    console.error('[stripe-webhook] No supabase_user_id in subscription metadata for subscription.deleted');
    return;
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      stripe_subscription_status: 'canceled',
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    console.error('[stripe-webhook] Failed to update profile for subscription.deleted:', error);
    throw error;
  } else {
    console.log('[stripe-webhook] Subscription deleted processed for user:', userId);
  }
}
