import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { stripe, CHESSBLUNDERS_PRICE_IDS } from "@/lib/stripe";
import Stripe from "stripe";

export async function GET() {
  try {
    // User stats from Supabase
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select(
        "stripe_subscription_status, cancel_at_period_end, stripe_subscription_id"
      );

    if (profilesError) {
      return NextResponse.json(
        { error: profilesError.message },
        { status: 500 }
      );
    }

    const totalUsers = profiles?.length || 0;
    const everSubscribed =
      profiles?.filter((p) => p.stripe_subscription_id).length || 0;
    const activeSubscribers =
      profiles?.filter((p) => p.stripe_subscription_status === "active")
        .length || 0;
    const cancelingSoon =
      profiles?.filter(
        (p) =>
          p.stripe_subscription_status === "active" && p.cancel_at_period_end
      ).length || 0;
    const canceled =
      profiles?.filter((p) => p.stripe_subscription_status === "canceled")
        .length || 0;

    // Revenue from Stripe (filtered by ChessBlunders)
    let totalRevenue = 0;
    let thisMonthRevenue = 0;
    let lastMonthRevenue = 0;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Fetch all paid invoices and filter by ChessBlunders products
    for await (const invoice of stripe.invoices.list({
      limit: 100,
      status: "paid",
    })) {
      const hasChessBlunders = invoice.lines.data.some((line) => {
        // Access price from the line item (cast to access price property)
        const lineItem = line as Stripe.InvoiceLineItem & { price?: { id: string } };
        return CHESSBLUNDERS_PRICE_IDS.includes(lineItem.price?.id || "");
      });

      if (hasChessBlunders) {
        const amount = invoice.amount_paid / 100;
        totalRevenue += amount;

        const invoiceDate = new Date(invoice.created * 1000);
        if (invoiceDate >= startOfMonth) {
          thisMonthRevenue += amount;
        } else if (
          invoiceDate >= startOfLastMonth &&
          invoiceDate < startOfMonth
        ) {
          lastMonthRevenue += amount;
        }
      }
    }

    // Calculate MRR based on subscription type
    // Monthly = $4.99, Yearly = $49.90/12 = $4.16/month
    const monthlyPrice = 4.99;
    const yearlyMonthlyEquivalent = 49.9 / 12;

    // For simplicity, assume all active are monthly (could be refined by querying Stripe)
    const mrr = activeSubscribers * monthlyPrice;

    return NextResponse.json({
      users: {
        total: totalUsers,
        everSubscribed,
        activeSubscribers,
        cancelingSoon,
        canceled,
        healthySubscribers: activeSubscribers - cancelingSoon,
        subscriptionRate:
          totalUsers > 0
            ? ((activeSubscribers / totalUsers) * 100).toFixed(1)
            : "0",
        churnRate:
          everSubscribed > 0
            ? ((canceled / everSubscribed) * 100).toFixed(1)
            : "0",
      },
      revenue: {
        total: totalRevenue.toFixed(2),
        thisMonth: thisMonthRevenue.toFixed(2),
        lastMonth: lastMonthRevenue.toFixed(2),
        mrr: mrr.toFixed(2),
        arpu: totalUsers > 0 ? (totalRevenue / totalUsers).toFixed(2) : "0",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
