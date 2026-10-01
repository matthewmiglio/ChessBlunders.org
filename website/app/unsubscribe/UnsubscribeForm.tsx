'use client';

import { useState } from 'react';

type State = 'idle' | 'saving' | 'done' | 'error';

export default function UnsubscribeForm({ email, token }: { email: string; token: string }) {
  const [state, setState] = useState<State>('idle');

  if (!email || !token) {
    return <p className="text-[#b4b4b4]">This unsubscribe link is incomplete. Use the link from the bottom of the email.</p>;
  }

  if (state === 'done') {
    return (
      <div className="bg-[#202020] border border-white/10 rounded-lg p-6">
        <p className="text-[#f5f5f5] font-medium mb-1">You&apos;re unsubscribed.</p>
        <p className="text-sm text-[#b4b4b4]">We won&apos;t send {email} any more marketing emails.</p>
      </div>
    );
  }

  const confirm = async () => {
    setState('saving');
    try {
      const res = await fetch('/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token }),
      });
      setState(res.ok ? 'done' : 'error');
    } catch {
      setState('error');
    }
  };

  return (
    <div className="bg-[#202020] border border-white/10 rounded-lg p-6">
      <p className="text-[#b4b4b4] mb-5">
        Stop sending ChessBlunders emails to <b className="text-[#f5f5f5]">{email}</b>?
      </p>
      <button
        onClick={confirm}
        disabled={state === 'saving'}
        className="rounded-md bg-[#f44336] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#f44336]/90 disabled:opacity-50 transition-all"
      >
        {state === 'saving' ? 'Unsubscribing...' : 'Confirm unsubscribe'}
      </button>
      {state === 'error' && (
        <p className="text-sm text-[#f44336] mt-3">That link didn&apos;t work. Try the link from the email again.</p>
      )}
    </div>
  );
}
