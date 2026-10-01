'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { CHESS_USERNAME_RE } from '@/lib/chess-username';

interface Stats {
  total_games: number;
  analyzed_games: number;
  total_blunders: number;
}

type Check = 'idle' | 'checking' | 'found' | 'missing';

export default function ChessAccountCard() {
  const { profile, refreshProfile } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState('');
  const [check, setCheck] = useState<Check>('idle');
  const [deleteGames, setDeleteGames] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);

  const current = profile?.chess_username || '';

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/user');
      const data = await res.json();
      setStats(data.stats);
    } catch {}
  };

  useEffect(() => {
    fetchStats();
  }, []);

  // Check the username exists on Chess.com shortly after the user stops typing
  useEffect(() => {
    const name = username.trim();
    if (!name || !CHESS_USERNAME_RE.test(name)) {
      setCheck(name ? 'missing' : 'idle');
      return;
    }
    setCheck('checking');
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/user/check-username?u=${encodeURIComponent(name)}`);
        const data = await res.json();
        setCheck(data.exists ? 'found' : 'missing');
      } catch {
        setCheck('missing');
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [username]);

  const startEditing = () => {
    setUsername('');
    setDeleteGames(false);
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const newName = username.trim();
      const res = await fetch('/api/user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chessUsername: newName, deleteGames }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to change account');
        return;
      }
      toast.success(
        deleteGames
          ? `Switched to ${newName} and deleted ${(data.deletedGames || 0).toLocaleString()} old games`
          : `Switched to ${newName}`
      );
      setEditing(false);
      setConfirming(false);
      await refreshProfile();
      fetchStats();
    } catch {
      toast.error('Failed to change account');
    } finally {
      setSaving(false);
    }
  };

  const onSave = () => (deleteGames ? setConfirming(true) : save());

  const games = stats?.total_games ?? 0;
  const analyses = stats?.analyzed_games ?? 0;
  const puzzles = stats?.total_blunders ?? 0;
  const canSave = check === 'found' && username.trim().toLowerCase() !== current.toLowerCase() && !saving;

  return (
    <div className="bg-[#202020] border border-white/10 rounded-lg p-6 mb-6">
      <h2 className="text-xl font-semibold text-[#f5f5f5] mb-1">Chess.com Account</h2>

      {!editing ? (
        <>
          <p className="text-[#b4b4b4] text-sm mb-5">Games are imported from this Chess.com account.</p>
          <div className="flex items-center justify-between gap-4 bg-[#3c3c3c]/30 border border-white/10 rounded-md px-4 py-3">
            <div className="min-w-0">
              <p className="font-medium text-[#f5f5f5] truncate">{current || 'Not set'}</p>
              <p className="text-xs text-[#b4b4b4]">
                {games > 0 ? (
                  `${games.toLocaleString()} games imported`
                ) : (
                  <>
                    No games imported yet ·{' '}
                    <Link href="/games" className="underline text-[#f44336]">Import games</Link>
                  </>
                )}
              </p>
            </div>
            <button
              onClick={startEditing}
              className="rounded-md border border-white/15 px-4 py-2 text-sm text-[#f5f5f5] hover:bg-white/5 transition-colors"
            >
              Change
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-[#b4b4b4] text-sm mb-5">
            Currently <b className="text-[#f5f5f5]">{current}</b>. Enter the account you want to import from instead.
          </p>

          <label htmlFor="chess-username" className="block text-sm text-[#b4b4b4] mb-1.5">New Chess.com username</label>
          <input
            id="chess-username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="off"
            autoFocus
            disabled={saving}
            className="w-full bg-[#3c3c3c]/30 border border-white/10 rounded-md px-4 py-2.5 text-sm text-[#f5f5f5] placeholder-[#707070] focus:outline-none focus:ring-2 focus:ring-[#f44336] focus:border-transparent transition-all"
          />
          <p className="text-xs mt-1.5 h-4" aria-live="polite">
            {check === 'checking' && <span className="text-[#b4b4b4]">Checking Chess.com...</span>}
            {check === 'found' && <span className="text-[#18be5d]">✓ Found on Chess.com</span>}
            {check === 'missing' && <span className="text-[#f44336]">No Chess.com player with that username</span>}
          </p>

          {games > 0 && (
            <label className="flex items-start gap-3 mt-4 p-4 rounded-md border border-[#f44336]/30 bg-[#f44336]/5 cursor-pointer">
              <input
                type="checkbox"
                checked={deleteGames}
                onChange={(e) => setDeleteGames(e.target.checked)}
                disabled={saving}
                className="mt-0.5 accent-[#f44336] w-4 h-4"
              />
              <span className="text-sm text-[#f5f5f5]">
                <span className="font-medium">Also delete all my imported games</span>
                <span className="block text-[#b4b4b4] mt-1">
                  Removes {games.toLocaleString()} games, {analyses.toLocaleString()} analyses, and the{' '}
                  {puzzles.toLocaleString()} practice puzzles made from them, including your practice history.
                  Use this if they came from the wrong account. Leave it unchecked to keep them alongside the new
                  account&apos;s games.
                </span>
              </span>
            </label>
          )}

          <div className="flex gap-3 mt-6">
            <button
              onClick={onSave}
              disabled={!canSave}
              className="rounded-md bg-[#ebebeb] px-5 py-2.5 text-sm font-medium text-[#202020] hover:bg-[#ebebeb]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => setEditing(false)}
              disabled={saving}
              className="rounded-md px-5 py-2.5 text-sm text-[#b4b4b4] hover:text-[#f5f5f5] transition-colors"
            >
              Cancel
            </button>
          </div>
        </>
      )}

      {confirming && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
          <div className="bg-[#202020] border border-white/10 rounded-lg p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-semibold text-[#f5f5f5] mb-2">Delete {games.toLocaleString()} games?</h3>
            <p className="text-sm text-[#b4b4b4] mb-4">
              This permanently deletes all of your imported games, plus their {analyses.toLocaleString()} analyses,{' '}
              {puzzles.toLocaleString()} practice puzzles, and your practice history on them. This can&apos;t be undone.
            </p>
            <p className="text-xs text-[#b4b4b4] mb-5">Deleted analyses still count toward this month&apos;s free analyses.</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirming(false)}
                disabled={saving}
                className="rounded-md px-4 py-2 text-sm text-[#b4b4b4] hover:text-[#f5f5f5] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="rounded-md bg-[#f44336] px-4 py-2 text-sm font-medium text-white hover:bg-[#f44336]/90 disabled:opacity-50 transition-all"
              >
                {saving ? 'Deleting...' : 'Delete and switch'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
