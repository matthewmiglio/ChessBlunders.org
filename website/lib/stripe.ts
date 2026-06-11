import Stripe from 'stripe';

// Uses the restricted API key with limited permissions
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-12-15.clover',
  typescript: true,
});
