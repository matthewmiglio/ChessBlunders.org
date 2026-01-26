import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { createClient } from '@supabase/supabase-js';

// Type workarounds for Stripe SDK v20 type issues
interface SubscriptionWithPeriod extends Stripe.Subscription {
  current_period_start: number;
  current_period_end: number;
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
        const subscription = event.data.object as SubscriptionWithPeriod;
        await handleSubscriptionUpdated(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as SubscriptionWithPeriod;
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
  const subscription = await stripe.subscriptions.retrieve(subscriptionId) as unknown as SubscriptionWithPeriod;
  const userId = subscription.metadata.supabase_user_id;

  console.log('[stripe-webhook] Subscription:', { id: subscription.id, status: subscription.status, userId });

  if (!userId) {
    console.error('[stripe-webhook] No supabase_user_id in subscription metadata');
    return;
  }

  // Log the period values for debugging
  console.log('[stripe-webhook] Period values:', {
    current_period_start: subscription.current_period_start,
    current_period_end: subscription.current_period_end,
  });

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      stripe_subscription_status: subscription.status,
      stripe_price_id: subscription.items.data[0]?.price?.id || null,
      subscription_period_start: timestampToISO(subscription.current_period_start),
      subscription_period_end: timestampToISO(subscription.current_period_end),
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
  const subscriptionId = invoice.subscription;
  if (!subscriptionId) return;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId) as unknown as SubscriptionWithPeriod;
  const userId = subscription.metadata.supabase_user_id;

  if (!userId) {
    console.error('[stripe-webhook] No supabase_user_id in subscription metadata for invoice.paid');
    return;
  }

  await supabaseAdmin
    .from('profiles')
    .update({
      stripe_subscription_status: 'active',
      subscription_period_start: timestampToISO(subscription.current_period_start),
      subscription_period_end: timestampToISO(subscription.current_period_end),
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);
}

async function handlePaymentFailed(invoice: InvoiceWithSubscription) {
  const subscriptionId = invoice.subscription;
  if (!subscriptionId) return;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId) as unknown as SubscriptionWithPeriod;
  const userId = subscription.metadata.supabase_user_id;

  await supabaseAdmin
    .from('profiles')
    .update({
      stripe_subscription_status: subscription.status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);
}

async function handleSubscriptionUpdated(subscription: SubscriptionWithPeriod) {
  const userId = subscription.metadata.supabase_user_id;

  if (!userId) {
    console.error('[stripe-webhook] No supabase_user_id in subscription metadata for subscription.updated');
    return;
  }

  await supabaseAdmin
    .from('profiles')
    .update({
      stripe_subscription_status: subscription.status,
      stripe_price_id: subscription.items.data[0]?.price?.id || null,
      subscription_period_start: timestampToISO(subscription.current_period_start),
      subscription_period_end: timestampToISO(subscription.current_period_end),
      cancel_at_period_end: subscription.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);
}

async function handleSubscriptionDeleted(subscription: SubscriptionWithPeriod) {
  const userId = subscription.metadata.supabase_user_id;

  await supabaseAdmin
    .from('profiles')
    .update({
      stripe_subscription_status: 'canceled',
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);
}
