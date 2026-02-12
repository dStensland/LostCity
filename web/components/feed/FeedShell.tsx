"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import ForYouView from "@/components/feed/ForYouView";
import Link from "next/link";

type FeedTab = "curated" | "foryou";

interface FeedShellProps {
  portalId: string;
  portalSlug: string;
  activeTab: FeedTab;
  curatedContent: React.ReactNode;
}

const TABS: { key: FeedTab; label: string; authRequired: boolean }[] = [
  { key: "curated", label: "Discover", authRequired: false },
  { key: "foryou", label: "For You", authRequired: true },
];

// Loading skeleton for auth-gated content - matches ForYouFeed/DashboardActivity style
function AuthLoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="p-3 rounded-lg border border-[var(--twilight)] bg-[var(--card-bg)]">
          <div className="flex gap-3">
            <div className="w-14 h-10 skeleton-shimmer rounded" />
            <div className="flex-1 space-y-2">
              <div className="h-4 skeleton-shimmer rounded w-3/4" />
              <div className="h-3 skeleton-shimmer rounded w-1/2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Compact inline sign-up prompt for For You tab when signed out
function ForYouSignUpPrompt({ portalSlug }: { portalSlug: string }) {
  return (
    <div className="mb-4 p-4 rounded-xl bg-gradient-to-r from-[var(--action-primary)]/10 via-[var(--action-primary-hover)]/5 to-transparent border border-[var(--action-primary)]/20">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-[var(--action-primary)]/15 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-[var(--action-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--cream)]">
            Get personalized picks
          </p>
          <p className="text-xs text-[var(--muted)]">
            Sign in to see events matched to your interests
          </p>
        </div>
        <Link
          href={`/auth/signup?redirect=/${portalSlug}?view=feed&tab=foryou`}
          className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 bg-[var(--action-primary)] text-[var(--btn-primary-text)] rounded-lg font-mono text-xs font-medium hover:bg-[var(--action-primary-hover)] transition-colors"
        >
          Join
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </Link>
      </div>
    </div>
  );
}


function FeedShellInner({ portalId, portalSlug, activeTab, curatedContent }: FeedShellProps) {
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
      // Explicitly force feed so stale Find filter params don't flip viewMode back to Find.
      params.set("view", "feed");
    } else {
      params.set("view", "feed");
      params.set("tab", tab);
    }
    const queryString = params.toString();
    router.push(`/${portalSlug}${queryString ? `?${queryString}` : ""}`);
  };

  // Render content based on auth state for protected tabs
  // Now shows content to everyone, with inline sign-up prompt for signed-out users
  const renderProtectedContent = (children: React.ReactNode, showSignUpPrompt: boolean = false) => {
    // If auth is still loading but hasn't timed out, show skeleton
    if (authLoading && !timedOut) {
      return <AuthLoadingSkeleton />;
    }
    // Show inline sign-up prompt for signed-out users, but still render content
    if (!user && showSignUpPrompt) {
      return (
        <>
          <ForYouSignUpPrompt portalSlug={portalSlug} />
          {children}
        </>
      );
    }
    return children;
  };

  return (
    <div className="py-6">
      {/* Sub-navigation tabs with improved styling */}
      <div className="mb-4 sm:mb-6">
        <div className="flex gap-1 p-1 bg-[var(--night)] rounded-xl border border-[var(--twilight)]/30">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const isLocked = tab.authRequired && !user && !authLoading;

            return (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg font-mono text-xs font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-[var(--twilight)] text-[var(--action-primary)] border border-[var(--action-primary)]/20"
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

      {activeTab === "foryou" && renderProtectedContent(<ForYouView portalSlug={portalSlug} portalId={portalId} />, true)}
    </div>
  );
}

export default function FeedShell(props: FeedShellProps) {
  return (
    <Suspense
      fallback={
        <div className="py-6 space-y-6">
          {/* Tab skeleton */}
          <div className="flex gap-1 p-1 bg-[var(--night)] rounded-lg">
            {[1, 2].map((i) => (
              <div key={i} className="flex-1 h-9 skeleton-shimmer rounded-md" />
            ))}
          </div>
          {/* Content skeleton - matches EventCard style */}
          <AuthLoadingSkeleton />
        </div>
      }
    >
      <FeedShellInner {...props} />
    </Suspense>
  );
}
