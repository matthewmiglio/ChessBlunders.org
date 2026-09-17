import Stripe from 'stripe';

// Uses the restricted API key with limited permissions
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-12-15.clover',
  typescript: true,
});

// The Stripe account is shared with FishBot and ChessPecker, and every event reaches
// every app's webhook. Only act on ChessBlunders subscriptions.
export const CHESSBLUNDERS_PRODUCT_ID = 'prod_TrJBZpNHqMaLWZ';

export function isChessBlundersSubscription(subscription: Stripe.Subscription): boolean {
  const product = subscription.items?.data?.[0]?.price?.product;
  const productId = typeof product === 'string' ? product : product?.id;
  return productId === CHESSBLUNDERS_PRODUCT_ID;
}
