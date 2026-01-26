'use client';

import { useState } from 'react';

interface Profile {
  stripe_subscription_status: string | null;
  stripe_price_id: string | null;
  subscription_period_end: string | null;
  cancel_at_period_end: boolean;
}

interface Invoice {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created: number;
  invoice_pdf: string | null;
  hosted_invoice_url: string | null;
}

export default function SubscriptionManager({
  profile,
  userEmail,
  isPremium,
}: {
  profile: Profile | null;
  userEmail: string | undefined;
  isPremium: boolean;
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [showInvoices, setShowInvoices] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchInvoices = async () => {
    if (invoices.length > 0) {
      setShowInvoices(!showInvoices);
      return;
    }
    try {
      const res = await fetch('/api/stripe/invoices');
      const data = await res.json();
      setInvoices(data.invoices || []);
      setShowInvoices(true);
    } catch (error) {
      console.error('Error fetching invoices:', error);
    }
  };

  const handleSubscribe = async (interval: 'monthly' | 'yearly') => {
    setLoading('subscribe');
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interval }),
      });
      const { url, error } = await res.json();
      if (error) throw new Error(error);
      window.location.href = url;
    } catch (error) {
      console.error('Error:', error);
      setMessage({ type: 'error', text: 'Failed to start checkout. Please try again.' });
      setLoading(null);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel? You will keep access until the end of your billing period.')) {
      return;
    }
    setLoading('cancel');
    try {
      const res = await fetch('/api/stripe/cancel', { method: 'POST' });
      const { error } = await res.json();
      if (error) throw new Error(error);
      setMessage({ type: 'success', text: 'Subscription canceled. You will keep access until the end of your billing period.' });
      window.location.reload();
    } catch (error) {
      console.error('Error:', error);
      setMessage({ type: 'error', text: 'Failed to cancel subscription. Please try again.' });
      setLoading(null);
    }
  };

  const handleReactivate = async () => {
    setLoading('reactivate');
    try {
      const res = await fetch('/api/stripe/reactivate', { method: 'POST' });
      const { error } = await res.json();
      if (error) throw new Error(error);
      setMessage({ type: 'success', text: 'Subscription reactivated!' });
      window.location.reload();
    } catch (error) {
      console.error('Error:', error);
      setMessage({ type: 'error', text: 'Failed to reactivate subscription. Please try again.' });
      setLoading(null);
    }
  };

  const handleUpdatePayment = async () => {
    setLoading('payment');
    try {
      const res = await fetch('/api/stripe/update-payment', { method: 'POST' });
      const { url, error } = await res.json();
      if (error) throw new Error(error);
      window.location.href = url;
    } catch (error) {
      console.error('Error:', error);
      setMessage({ type: 'error', text: 'Failed to start payment update. Please try again.' });
      setLoading(null);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  // Not subscribed - show upgrade prompt with comparison
  if (!isPremium) {
    return (
      <div className="bg-[#202020] border border-white/10 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-[#f5f5f5] mb-4">Your Plan</h2>
        <p className="text-[#b4b4b4] mb-6">Logged in as: {userEmail}</p>

        {/* Comparison table */}
        <div className="mb-6 overflow-hidden rounded-lg border border-white/10">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 bg-[#3c3c3c]/30">
                <th className="px-4 py-3 text-left text-sm font-medium text-[#b4b4b4]">Feature</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-[#b4b4b4]">Free</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-[#18be5d]">Premium</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              <tr>
                <td className="px-4 py-3 text-sm text-[#f5f5f5]">Game Import Limit</td>
                <td className="px-4 py-3 text-center text-sm text-[#b4b4b4]">100 games</td>
                <td className="px-4 py-3 text-center text-sm text-[#18be5d]">1,000 games</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm text-[#f5f5f5]">Game Retention</td>
                <td className="px-4 py-3 text-center text-sm text-[#b4b4b4]">100 games</td>
                <td className="px-4 py-3 text-center text-sm text-[#18be5d]">Unlimited</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm text-[#f5f5f5]">Analysis Depth</td>
                <td className="px-4 py-3 text-center text-sm text-[#b4b4b4]">Depth 12</td>
                <td className="px-4 py-3 text-center text-sm text-[#18be5d]">Up to depth 25</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm text-[#f5f5f5]">Blunder Detection</td>
                <td className="px-4 py-3 text-center">
                  <svg className="w-5 h-5 text-[#18be5d] mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </td>
                <td className="px-4 py-3 text-center">
                  <svg className="w-5 h-5 text-[#18be5d] mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm text-[#f5f5f5]">Practice Puzzles</td>
                <td className="px-4 py-3 text-center">
                  <svg className="w-5 h-5 text-[#18be5d] mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </td>
                <td className="px-4 py-3 text-center">
                  <svg className="w-5 h-5 text-[#18be5d] mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Current plan indicator */}
        <div className="mb-6 p-3 rounded-lg bg-[#3c3c3c]/30 border border-white/10">
          <p className="text-sm text-[#b4b4b4]">
            Current plan: <span className="text-[#f5f5f5] font-medium">Free</span>
          </p>
        </div>

        {/* Upgrade buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => handleSubscribe('monthly')}
            disabled={loading !== null}
            className="inline-flex items-center justify-center rounded-md bg-[#ebebeb] px-6 py-2.5 text-sm font-medium text-[#202020] shadow-sm hover:bg-[#ebebeb]/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8c8c8c] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading === 'subscribe' ? 'Loading...' : 'Upgrade - $4.99/month'}
          </button>
          <button
            onClick={() => handleSubscribe('yearly')}
            disabled={loading !== null}
            className="inline-flex items-center justify-center rounded-md bg-[#18be5d] px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-[#18be5d]/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#18be5d] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading === 'subscribe' ? 'Loading...' : 'Upgrade - $39.99/year (Save 33%)'}
          </button>
        </div>
        {message && (
          <p className={`mt-4 text-sm ${message.type === 'error' ? 'text-[#f44336]' : 'text-[#18be5d]'}`}>
            {message.text}
          </p>
        )}
      </div>
    );
  }

  // Subscribed - show management options
  // isSetToCancel is true if:
  // 1. cancel_at_period_end is true (scheduled to cancel at end of period), OR
  // 2. stripe_subscription_status is 'canceled' (already fully canceled in Stripe)
  const isSetToCancel = profile?.cancel_at_period_end || profile?.stripe_subscription_status === 'canceled';
  // If subscription is fully canceled (not just scheduled), user cannot reactivate
  const isFullyCanceled = profile?.stripe_subscription_status === 'canceled';
  const periodEnd = profile?.subscription_period_end
    ? new Date(profile.subscription_period_end).toLocaleDateString()
    : null;

  return (
    <div className="bg-[#202020] border border-white/10 rounded-lg p-6">
      <h2 className="text-xl font-semibold text-[#f5f5f5] mb-4">Your Plan</h2>
      <p className="text-[#b4b4b4] mb-6">Logged in as: {userEmail}</p>

      {/* Current plan indicator */}
      <div className="mb-6 p-3 rounded-lg bg-[#18be5d]/10 border border-[#18be5d]/30">
        <p className="text-sm text-[#b4b4b4]">
          Current plan: <span className="text-[#18be5d] font-medium">Premium</span>
          {isSetToCancel && <span className="text-[#ff6f00] ml-2">(Canceling)</span>}
        </p>
        {periodEnd && (
          <p className="text-sm text-[#b4b4b4] mt-1">
            {isSetToCancel ? 'Access until:' : 'Next billing:'} {periodEnd}
          </p>
        )}
      </div>

      {isSetToCancel && (
        <div className="mb-6 p-3 rounded-lg bg-[#ff6f00]/10 border border-[#ff6f00]/30">
          <p className="text-sm text-[#ff6f00]">
            {isFullyCanceled
              ? `Your subscription has been canceled. You have access until ${periodEnd}.`
              : `Your subscription will end on ${periodEnd}. You can reactivate anytime before then.`}
          </p>
        </div>
      )}

      {/* What you get with Premium */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-[#b4b4b4] mb-3">Your Premium Benefits</h3>
        <ul className="space-y-2">
          <li className="flex items-center gap-3 text-sm text-[#f5f5f5]">
            <svg className="w-4 h-4 text-[#18be5d] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Import up to 1,000 games (vs 100 for free)
          </li>
          <li className="flex items-center gap-3 text-sm text-[#f5f5f5]">
            <svg className="w-4 h-4 text-[#18be5d] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Unlimited game retention (vs 100 for free)
          </li>
          <li className="flex items-center gap-3 text-sm text-[#f5f5f5]">
            <svg className="w-4 h-4 text-[#18be5d] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Analysis depth up to 25 (vs 12 for free)
          </li>
          <li className="flex items-center gap-3 text-sm text-[#f5f5f5]">
            <svg className="w-4 h-4 text-[#18be5d] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Blunder detection and practice puzzles
          </li>
        </ul>
      </div>

      {message && (
        <p className={`mb-4 text-sm ${message.type === 'error' ? 'text-[#f44336]' : 'text-[#18be5d]'}`}>
          {message.text}
        </p>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3 mb-6">
        {isFullyCanceled ? (
          // Subscription is fully canceled - no cancel/reactivate options
          <span className="inline-flex items-center justify-center rounded-md bg-[#3c3c3c] px-4 py-2 text-sm font-medium text-[#b4b4b4]">
            Subscription Canceled
          </span>
        ) : isSetToCancel ? (
          <button
            onClick={handleReactivate}
            disabled={loading !== null}
            className="inline-flex items-center justify-center rounded-md bg-[#18be5d] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#18be5d]/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#18be5d] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading === 'reactivate' ? 'Loading...' : 'Reactivate Subscription'}
          </button>
        ) : (
          <button
            onClick={handleCancel}
            disabled={loading !== null}
            className="inline-flex items-center justify-center rounded-md bg-[#f44336]/60 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#f44336]/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f44336] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading === 'cancel' ? 'Loading...' : 'Cancel Subscription'}
          </button>
        )}

        <button
          onClick={handleUpdatePayment}
          disabled={loading !== null}
          className="inline-flex items-center justify-center rounded-md bg-[#3c3c3c] border border-white/10 px-4 py-2 text-sm font-medium text-[#f5f5f5] shadow-sm hover:bg-[#3c3c3c]/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8c8c8c] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {loading === 'payment' ? 'Loading...' : 'Update Payment Method'}
        </button>

        <button
          onClick={fetchInvoices}
          className="inline-flex items-center justify-center rounded-md bg-[#3c3c3c] border border-white/10 px-4 py-2 text-sm font-medium text-[#f5f5f5] shadow-sm hover:bg-[#3c3c3c]/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8c8c8c] transition-all"
        >
          {showInvoices ? 'Hide Invoices' : 'View Invoices'}
        </button>
      </div>

      {/* Invoice history */}
      {showInvoices && (
        <div className="border-t border-white/10 pt-4">
          <h3 className="text-lg font-medium text-[#f5f5f5] mb-3">Invoice History</h3>
          {invoices.length === 0 ? (
            <p className="text-[#b4b4b4]">No invoices found.</p>
          ) : (
            <div className="space-y-2">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between bg-[#3c3c3c]/50 border border-white/5 rounded-md p-3"
                >
                  <div>
                    <span className="text-[#f5f5f5]">{formatCurrency(invoice.amount, invoice.currency)}</span>
                    <span className="text-[#b4b4b4] ml-3">{formatDate(invoice.created)}</span>
                    <span className={`ml-3 text-sm ${invoice.status === 'paid' ? 'text-[#18be5d]' : 'text-[#ff6f00]'}`}>
                      {invoice.status}
                    </span>
                  </div>
                  {invoice.hosted_invoice_url && (
                    <a
                      href={invoice.hosted_invoice_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#f44336] hover:text-[#f44336]/80 text-sm transition-colors"
                    >
                      View
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
