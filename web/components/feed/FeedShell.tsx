"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import ForYouFeed from "@/components/feed/ForYouFeed";
import DashboardActivity from "@/components/dashboard/DashboardActivity";
import Link from "next/link";

type FeedTab = "curated" | "foryou" | "activity";

interface FeedShellProps {
  portalId: string;
  portalSlug: string;
  activeTab: FeedTab;
  curatedContent: React.ReactNode;
}

const TABS: { key: FeedTab; label: string; authRequired: boolean }[] = [
  { key: "curated", label: "Curated", authRequired: false },
  { key: "foryou", label: "For You", authRequired: true },
  { key: "activity", label: "Your People", authRequired: true },
];

// Loading skeleton for auth-gated content - minimal to avoid double skeletons
// Child components (ForYouFeed, DashboardActivity) have their own loading states
function AuthLoadingSkeleton() {
  return null; // Let child components handle their own loading
}

// Empty state for For You tab when signed out
function ForYouSignedOut({ portalSlug }: { portalSlug: string }) {
  return (
    <div className="py-8">
      {/* Hero section */}
      <div className="text-center mb-8">
        <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-[var(--neon-magenta)]/20 via-[var(--coral)]/20 to-[var(--neon-amber)]/20 border border-[var(--twilight)] flex items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--neon-magenta)]/10 to-transparent animate-pulse" />
          <span className="text-3xl relative z-10">✨</span>
        </div>
        <h3 className="font-serif text-xl text-[var(--cream)] mb-2">
          Your city, curated
        </h3>
        <p className="text-sm text-[var(--soft)] max-w-sm mx-auto">
          Tell us what you&apos;re into and we&apos;ll surface the good stuff—the shows your friends are hitting, the spots that match your vibe, the weird little things you didn&apos;t know you needed.
        </p>
      </div>

      {/* Feature preview cards */}
      <div className="grid grid-cols-1 gap-3 mb-8">
        <div className="flex items-center gap-4 p-4 rounded-xl bg-[var(--dusk)]/50 border border-[var(--twilight)]">
          <div className="w-10 h-10 rounded-lg bg-[var(--coral)]/10 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-[var(--coral)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--cream)]">Events that match your energy</p>
            <p className="text-xs text-[var(--muted)]">Lowkey hangouts or full send—your call</p>
          </div>
        </div>

        <div className="flex items-center gap-4 p-4 rounded-xl bg-[var(--dusk)]/50 border border-[var(--twilight)]">
          <div className="w-10 h-10 rounded-lg bg-[var(--neon-magenta)]/10 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-[var(--neon-magenta)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--cream)]">See where your people are going</p>
            <p className="text-xs text-[var(--muted)]">Never miss a thing your crew is doing</p>
          </div>
        </div>

        <div className="flex items-center gap-4 p-4 rounded-xl bg-[var(--dusk)]/50 border border-[var(--twilight)]">
          <div className="w-10 h-10 rounded-lg bg-[var(--neon-amber)]/10 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-[var(--neon-amber)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--cream)]">Spots in your neighborhoods</p>
            <p className="text-xs text-[var(--muted)]">Local gems, not tourist traps</p>
          </div>
        </div>
      </div>

      {/* CTA buttons */}
      <div className="flex flex-col gap-3 max-w-xs mx-auto">
        <Link
          href={`/auth/signup?redirect=/${portalSlug}?view=feed&tab=foryou`}
          className="flex items-center justify-center gap-2 px-5 py-3 bg-[var(--coral)] text-[var(--void)] rounded-lg font-mono text-sm font-medium hover:bg-[var(--rose)] transition-colors"
        >
          Join the City
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </Link>
        <Link
          href={`/auth/login?redirect=/${portalSlug}?view=feed&tab=foryou`}
          className="flex items-center justify-center px-5 py-2.5 text-[var(--soft)] rounded-lg font-mono text-sm hover:text-[var(--cream)] transition-colors"
        >
          Already in? Sign in
        </Link>
      </div>
    </div>
  );
}

// Empty state for Activity tab when signed out
function ActivitySignedOut({ portalSlug }: { portalSlug: string }) {
  return (
    <div className="py-10 text-center">
      <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-[var(--twilight)] to-[var(--dusk)] border border-[var(--twilight)] flex items-center justify-center">
        <svg className="w-8 h-8 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      </div>
      <h3 className="font-serif text-lg text-[var(--cream)] mb-2">
        The scene is quiet... for now
      </h3>
      <p className="text-sm text-[var(--muted)] mb-6 max-w-xs mx-auto">
        Sign in to see what your people are up to—who&apos;s going where, what&apos;s popping off, and who just found your new favorite spot.
      </p>
      <Link
        href={`/auth/login?redirect=/${portalSlug}?view=feed&tab=activity`}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--coral)] text-[var(--void)] rounded-lg font-mono text-sm font-medium hover:bg-[var(--rose)] transition-colors"
      >
        Sign In
      </Link>
    </div>
  );
}

function FeedShellInner({ portalSlug, activeTab, curatedContent }: FeedShellProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [timedOut, setTimedOut] = useState(false);

  // Fallback timeout for auth loading - auth context has its own 6s timeout,
  // this is a defense-in-depth backup in case something else hangs
  useEffect(() => {
    if (!authLoading) return;
    const timer = setTimeout(() => setTimedOut(true), 8000);
    return () => clearTimeout(timer);
  }, [authLoading]);

  const handleTabChange = (tab: FeedTab) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    if (tab === "curated") {
      params.delete("tab");
      params.delete("view");
    } else {
      params.set("view", "feed");
      params.set("tab", tab);
    }
    const queryString = params.toString();
    router.push(`/${portalSlug}${queryString ? `?${queryString}` : ""}`);
  };

  // Render content based on auth state for protected tabs
  const renderProtectedContent = (tab: "foryou" | "activity", children: React.ReactNode) => {
    // If auth is still loading but hasn't timed out, show skeleton
    if (authLoading && !timedOut) {
      return <AuthLoadingSkeleton />;
    }
    // If no user (either auth finished or timed out), show signed out state
    if (!user) {
      return tab === "foryou"
        ? <ForYouSignedOut portalSlug={portalSlug} />
        : <ActivitySignedOut portalSlug={portalSlug} />;
    }
    return children;
  };

  return (
    <div className="py-6">
      {/* Sub-navigation tabs */}
      <div className="mb-6">
        <div className="flex gap-1 p-1 bg-[var(--night)] rounded-lg">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const isLocked = tab.authRequired && !user && !authLoading;

            return (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md font-mono text-xs transition-all duration-200 ${
                  isActive
                    ? "bg-[var(--coral)] text-[var(--void)] font-medium shadow-[0_0_12px_var(--coral)/20]"
                    : "text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/50"
                }`}
              >
                {tab.label}
                {isLocked && (
                  <svg className="w-3 h-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "curated" && curatedContent}

      {activeTab === "foryou" && renderProtectedContent("foryou", <ForYouFeed portalSlug={portalSlug} />)}

      {activeTab === "activity" && renderProtectedContent("activity", <DashboardActivity />)}
    </div>
  );
}

export default function FeedShell(props: FeedShellProps) {
  // Suspense is needed for useSearchParams, but we use a minimal fallback
  // since child components (ForYouFeed, DashboardActivity) handle their own loading
  return (
    <Suspense fallback={null}>
      <FeedShellInner {...props} />
    </Suspense>
  );
}
