"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase, validatePassword } from "@/lib/supabase";
import { LoadingSpinner } from "@/components/LoadingSpinner";

function SignInContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
      } else {
        router.push(callbackUrl);
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    // Validate password
    const validation = validatePassword(password);
    if (!validation.valid) {
      setError(validation.errors.join(". "));
      setLoading(false);
      return;
    }

    // Check password match
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(callbackUrl)}`,
        },
      });

      if (error) {
        setError(error.message);
      } else {
        setMessage("Check your email for a verification link to complete your registration.");
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center relative">
      {/* Background glow */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,rgba(244,67,54,0.1),transparent_50%)]" />

      <div className="bg-[#202020] border border-white/10 rounded-lg p-8 max-w-md w-full mx-4 shadow-xl">
        <h1 className="text-2xl font-semibold tracking-tight text-[#f5f5f5] text-center mb-2">
          {isSignUp ? "Create an Account" : "Welcome Back"}
        </h1>
        <p className="text-[#b4b4b4] text-center mb-8 text-sm">
          {isSignUp
            ? "Create an account to start training"
            : "Sign in to continue your training"}
        </p>

        {error && (
          <div className="bg-[#f44336]/10 border border-[#f44336]/30 text-[#f44336] px-4 py-3 rounded-md mb-6 text-sm">
            {error}
          </div>
        )}

        {message && (
          <div className="bg-[#18be5d]/10 border border-[#18be5d]/30 text-[#18be5d] px-4 py-3 rounded-md mb-6 text-sm">
            {message}
          </div>
        )}

        <form onSubmit={isSignUp ? handleSignUp : handleSignIn} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-[#b4b4b4] mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-4 py-2.5 bg-[#3c3c3c]/30 border border-white/10 rounded-md text-[#f5f5f5] placeholder-[#b4b4b4] focus:outline-none focus:ring-2 focus:ring-[#f44336] focus:border-transparent transition-all"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-[#b4b4b4] mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={isSignUp ? "new-password" : "current-password"}
              className="w-full px-4 py-2.5 bg-[#3c3c3c]/30 border border-white/10 rounded-md text-[#f5f5f5] placeholder-[#b4b4b4] focus:outline-none focus:ring-2 focus:ring-[#f44336] focus:border-transparent transition-all"
              placeholder="Your password"
            />
            {isSignUp && (
              <p className="text-xs text-[#b4b4b4] mt-2">
                At least 8 characters with uppercase, lowercase, and a number
              </p>
            )}
          </div>

          {isSignUp && (
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-[#b4b4b4] mb-2">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="w-full px-4 py-2.5 bg-[#3c3c3c]/30 border border-white/10 rounded-md text-[#f5f5f5] placeholder-[#b4b4b4] focus:outline-none focus:ring-2 focus:ring-[#f44336] focus:border-transparent transition-all"
                placeholder="Confirm your password"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center rounded-md bg-[#ebebeb] px-4 py-3 text-sm font-medium text-[#202020] shadow-sm hover:bg-[#ebebeb]/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8c8c8c] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading
              ? "Please wait..."
              : isSignUp
              ? "Create Account"
              : "Sign In"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError("");
              setMessage("");
            }}
            className="text-[#f44336] hover:text-[#f44336]/80 text-sm transition-colors"
          >
            {isSignUp
              ? "Already have an account? Sign in"
              : "Don't have an account? Sign up"}
          </button>
        </div>

        <div className="mt-4">
          <Link
            href="/"
            className="block w-full text-center text-[#b4b4b4] hover:text-[#f5f5f5] text-sm transition-colors"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <SignInContent />
    </Suspense>
  );
}
