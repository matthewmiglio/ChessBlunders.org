import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export const CHESSBLUNDERS_PRICE_IDS = [
  "price_1StaZ3RpTvYYS9hR2jfIOp5g", // monthly
  "price_1StaZ3RpTvYYS9hR97iaYtYC", // yearly
];
