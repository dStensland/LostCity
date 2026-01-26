"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/Logo";
import { PasswordStrength } from "@/components/PasswordStrength";
import { createClient } from "@/lib/supabase/client";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import type { Database } from "@/lib/types";

type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];
type PreferencesInsert = Database["public"]["Tables"]["user_preferences"]["Insert"];

// Validate redirect URL to prevent Open Redirect attacks
function isValidRedirect(redirect: string): boolean {
  return redirect.startsWith("/") && !redirect.startsWith("//") && !redirect.includes(":");
}

// Extract portal slug from redirect URL (e.g., "/piedmont/events" -> "piedmont")
function extractPortalFromRedirect(redirect: string): string | null {
  // Known non-portal routes that start with a slug-like segment
  const nonPortalRoutes = ["auth", "api", "events", "spots", "profile", "settings", "friends", "people", "foryou", "welcome", "community", "saved", "notifications"];

  const match = redirect.match(/^\/([a-z0-9-]+)/);
  if (match && !nonPortalRoutes.includes(match[1])) {
    return match[1];
  }
  return null;
}

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get("redirect") || "/";
  const redirect = isValidRedirect(rawRedirect) ? rawRedirect : "/";

  // Capture portal context for onboarding
  const portalSlug = searchParams.get("portal") || extractPortalFromRedirect(rawRedirect);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  const supabase = createClient();

  // Validate username format
  const isValidUsername = (u: string) => /^[a-z0-9_]{3,30}$/.test(u);

  // Check if username is available
  const checkUsername = async (u: string) => {
    if (!isValidUsername(u)) {
      setUsernameAvailable(null);
      return;
    }

    setCheckingUsername(true);
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", u)
      .single();

    setUsernameAvailable(!data);
    setCheckingUsername(false);
  };

  const handleUsernameChange = (value: string) => {
    const lowercase = value.toLowerCase().replace(/[^a-z0-9_]/g, "");
    setUsername(lowercase);
    setUsernameAvailable(null);

    // Debounce the check
    if (lowercase.length >= 3) {
      const timeoutId = setTimeout(() => checkUsername(lowercase), 300);
      return () => clearTimeout(timeoutId);
    }
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isValidUsername(username)) {
      setError("Username must be 3-30 characters, lowercase letters, numbers, and underscores only");
      return;
    }

    if (usernameAvailable === false) {
      setError("Username is already taken");
      return;
    }

    setLoading(true);

    // Sign up the user
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`,
        data: {
          username,
        },
      },
    });

    if (signUpError) {
      setError(getAuthErrorMessage(signUpError.message));
      setLoading(false);
      return;
    }

    // Check if we have a session (email confirmation disabled) or need email confirmation
    if (authData.session && authData.user) {
      // Email confirmation is disabled - user is logged in immediately
      // Create the profile with retry logic for username conflicts
      let finalUsername = username;
      let profileCreated = false;
      let attempts = 0;
      const maxAttempts = 5;

      while (!profileCreated && attempts < maxAttempts) {
        const profileData: ProfileInsert = {
          id: authData.user.id,
          username: finalUsername,
          display_name: null,
        };
        const { error: profileError } = await supabase
          .from("profiles")
          .insert(profileData as never);

        if (!profileError) {
          profileCreated = true;
        } else if (profileError.code === "23505") {
          // Unique constraint violation - try with a suffix
          attempts++;
          finalUsername = `${username.slice(0, 25)}_${Math.floor(Math.random() * 10000)}`;
        } else {
          console.error("Profile creation error:", profileError);
          setError("Failed to create profile. Please try again.");
          setLoading(false);
          return;
        }
      }

      if (!profileCreated) {
        setError("Unable to create a unique username. Please try a different one.");
        setLoading(false);
        return;
      }

      // Create default preferences with error handling
      try {
        const prefsData: PreferencesInsert = {
          user_id: authData.user.id,
        };
        const { error: prefsError } = await supabase
          .from("user_preferences")
          .insert(prefsData as never);

        if (prefsError) {
          // Log but don't block signup - preferences can be created later
          console.error("Preferences creation error:", prefsError);
        }
      } catch (err) {
        // Log but don't block signup - preferences can be created later
        console.error("Preferences creation exception:", err);
      }

      // Redirect new users to onboarding
      const onboardingUrl = portalSlug ? `/onboarding?portal=${portalSlug}` : "/onboarding";
      router.push(onboardingUrl);
      router.refresh();
    } else if (authData.user) {
      // Email confirmation is enabled - show confirmation message
      // Profile will be created in auth callback when user confirms email
      setEmailSent(true);
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setError(null);
    setLoading(true);

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}&new=true`,
      },
    });

    if (oauthError) {
      setError(getAuthErrorMessage(oauthError.message));
      setLoading(false);
    }
  };

  // Show email confirmation screen
  if (emailSent) {
    return (
      <div className="min-h-screen flex flex-col">
        <header className="px-4 sm:px-6 py-4 flex justify-between items-center border-b border-[var(--twilight)]">
          <Logo />
        </header>
        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-sm text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[var(--coral)]/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-[var(--coral)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold text-[var(--cream)] mb-4">
              Check your email
            </h1>
            <p className="font-mono text-sm text-[var(--muted)] mb-6">
              We sent a confirmation link to<br />
              <span className="text-[var(--cream)]">{email}</span>
            </p>
            <p className="font-mono text-xs text-[var(--muted)]">
              Click the link in your email to finish creating your account.
            </p>
            <button
              onClick={() => setEmailSent(false)}
              className="mt-8 font-mono text-xs text-[var(--coral)] hover:text-[var(--rose)] transition-colors"
            >
              Use a different email
            </button>
          </div>
        </main>
      </div>
    );
  }

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
              Join Lost City
            </h1>
            <p className="font-mono text-xs text-[var(--muted)] mt-2">
              Discover your city&apos;s hidden gems
            </p>
          </div>

          {error && (
            <div className="mb-6 p-3 rounded-lg bg-[var(--coral)]/10 border border-[var(--coral)] text-[var(--coral)] font-mono text-xs">
              {error}
            </div>
          )}

          {/* Google OAuth */}
          <button
            onClick={handleGoogleSignup}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg bg-[var(--cream)] text-[var(--void)] font-mono text-sm font-medium hover:bg-[var(--soft)] transition-colors disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--twilight)]" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-2 bg-[var(--night)] font-mono text-xs text-[var(--muted)]">
                or
              </span>
            </div>
          </div>

          {/* Email form */}
          <form onSubmit={handleEmailSignup} className="space-y-4">
            <div>
              <label
                htmlFor="username"
                className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5"
              >
                Username
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] font-mono text-sm">
                  @
                </span>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  onBlur={() => username.length >= 3 && checkUsername(username)}
                  required
                  autoFocus
                  autoComplete="username"
                  aria-describedby={username && !isValidUsername(username) ? "username-error" : undefined}
                  aria-invalid={username && !isValidUsername(username) ? true : undefined}
                  className="w-full pl-7 pr-10 py-2.5 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm focus:outline-none focus:border-[var(--coral)] transition-colors"
                  placeholder="yourname"
                />
                {username.length >= 3 && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2">
                    {checkingUsername ? (
                      <svg className="w-4 h-4 animate-spin text-[var(--muted)]" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : usernameAvailable === true ? (
                      <svg className="w-4 h-4 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : usernameAvailable === false ? (
                      <svg className="w-4 h-4 text-[var(--coral)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    ) : null}
                  </span>
                )}
              </div>
              {username && !isValidUsername(username) && (
                <p id="username-error" role="alert" className="mt-1 font-mono text-[0.65rem] text-[var(--coral)]">
                  3-30 characters, lowercase letters, numbers, underscores
                </p>
              )}
            </div>

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
                autoComplete="email"
                className="w-full px-3 py-2.5 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm focus:outline-none focus:border-[var(--coral)] transition-colors"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  aria-describedby="password-hint"
                  className="w-full px-3 py-2.5 pr-12 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm focus:outline-none focus:border-[var(--coral)] transition-colors"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              <PasswordStrength password={password} />
            </div>

            <button
              type="submit"
              disabled={loading || usernameAvailable === false}
              className="w-full px-4 py-3 rounded-lg bg-[var(--coral)] text-[var(--void)] font-mono text-sm font-medium hover:bg-[var(--rose)] transition-colors disabled:opacity-50"
            >
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-center font-mono text-xs text-[var(--muted)]">
            Already have an account?{" "}
            <Link
              href={`/auth/login${redirect !== "/" ? `?redirect=${encodeURIComponent(redirect)}` : ""}`}
              className="text-[var(--coral)] hover:text-[var(--rose)] transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-[var(--muted)]">Loading...</div>
      </div>
    }>
      <SignupForm />
    </Suspense>
  );
}
