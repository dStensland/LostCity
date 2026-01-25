"use client";

import { useState } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import { createClient } from "@/lib/supabase/client";
import { getAuthErrorMessage } from "@/lib/auth-errors";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      }
    );

    setLoading(false);

    if (resetError) {
      setError(getAuthErrorMessage(resetError.message));
      return;
    }

    setSuccess(true);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="px-4 sm:px-6 py-4 flex justify-between items-center border-b border-[var(--twilight)]">
        <Logo />
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold text-[var(--cream)]">
              Forgot password?
            </h1>
            <p className="font-mono text-xs text-[var(--muted)] mt-2">
              Enter your email and we&apos;ll send you a reset link
            </p>
          </div>

          {error && (
            <div className="mb-6 p-3 rounded-lg bg-[var(--coral)]/10 border border-[var(--coral)] text-[var(--coral)] font-mono text-xs">
              {error}
            </div>
          )}

          {success ? (
            <div className="text-center">
              <div className="mb-6 p-4 rounded-lg bg-green-500/10 border border-green-500">
                <svg
                  className="w-12 h-12 text-green-500 mx-auto mb-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                <h2 className="font-mono text-sm font-medium text-green-400 mb-2">
                  Check your email
                </h2>
                <p className="font-mono text-xs text-[var(--muted)]">
                  We&apos;ve sent a password reset link to{" "}
                  <span className="text-[var(--cream)]">{email}</span>
                </p>
              </div>
              <p className="font-mono text-xs text-[var(--muted)] mb-4">
                Didn&apos;t receive the email? Check your spam folder or{" "}
                <button
                  onClick={() => setSuccess(false)}
                  className="text-[var(--coral)] hover:text-[var(--rose)] transition-colors"
                >
                  try again
                </button>
              </p>
              <Link
                href="/auth/login"
                className="inline-block px-4 py-2.5 rounded-lg font-mono text-sm text-[var(--coral)] hover:text-[var(--rose)] transition-colors"
              >
                Back to login
              </Link>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="email"
                    className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5"
                  >
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm focus:outline-none focus:border-[var(--coral)] transition-colors"
                    placeholder="you@example.com"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-4 py-3 rounded-lg bg-[var(--coral)] text-[var(--void)] font-mono text-sm font-medium hover:bg-[var(--rose)] transition-colors disabled:opacity-50"
                >
                  {loading ? "Sending..." : "Send reset link"}
                </button>
              </form>

              <p className="mt-6 text-center font-mono text-xs text-[var(--muted)]">
                Remember your password?{" "}
                <Link
                  href="/auth/login"
                  className="text-[var(--coral)] hover:text-[var(--rose)] transition-colors"
                >
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
