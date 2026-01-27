"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import DashboardShell from "@/components/dashboard/DashboardShell";
import DashboardFeed from "@/components/dashboard/DashboardFeed";
import DashboardActivity from "@/components/dashboard/DashboardActivity";
import DashboardPlanning from "@/components/dashboard/DashboardPlanning";
import { usePortalOptional, DEFAULT_PORTAL_SLUG } from "@/lib/portal-context";

type DashboardTab = "feed" | "activity" | "planning";

function RedirectBanner() {
  const portalContext = usePortalOptional();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const newUrl = `/${portalContext?.portal?.slug || DEFAULT_PORTAL_SLUG}?view=feed&tab=foryou`;

  return (
    <div className="mb-4 p-3 rounded-lg bg-[var(--coral)]/10 border border-[var(--coral)]/30 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <svg className="w-5 h-5 text-[var(--coral)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p className="text-sm text-[var(--cream)]">
            Dashboard has moved!
          </p>
          <p className="text-xs text-[var(--muted)]">
            Find your personalized feed under Feed &rarr; For You
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href={newUrl}
          className="px-3 py-1.5 bg-[var(--coral)] text-[var(--void)] rounded-lg font-mono text-xs font-medium hover:bg-[var(--rose)] transition-colors whitespace-nowrap"
        >
          Go there
        </Link>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const currentTab = (searchParams?.get("tab") as DashboardTab) || "feed";
  const [showRedirect, setShowRedirect] = useState(false);

  // Show redirect banner after a moment
  useEffect(() => {
    const timer = setTimeout(() => setShowRedirect(true), 500);
    return () => clearTimeout(timer);
  }, []);

  const handleTabChange = (tab: DashboardTab) => {
    const params = new URLSearchParams();
    if (tab !== "feed") {
      params.set("tab", tab);
    }
    router.push(`/dashboard${params.toString() ? `?${params.toString()}` : ""}`);
  };

  return (
    <>
      {showRedirect && <RedirectBanner />}
      <DashboardShell currentTab={currentTab} onTabChange={handleTabChange}>
        {currentTab === "feed" && <DashboardFeed />}
        {currentTab === "activity" && <DashboardActivity />}
        {currentTab === "planning" && <DashboardPlanning />}
      </DashboardShell>
    </>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-4xl mx-auto px-4 py-6">
          {/* Header skeleton */}
          <div className="flex items-center justify-between mb-6">
            <div className="h-8 w-32 skeleton-shimmer rounded" />
            <div className="h-8 w-8 skeleton-shimmer rounded-full" />
          </div>
          {/* Tabs skeleton */}
          <div className="flex gap-1 p-1 bg-[var(--night)] rounded-lg mb-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex-1 h-10 skeleton-shimmer rounded-md" />
            ))}
          </div>
          {/* Content skeleton */}
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="p-4 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg"
              >
                <div className="flex gap-4">
                  <div className="w-20 h-20 skeleton-shimmer rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="h-5 skeleton-shimmer rounded w-3/4" />
                    <div className="h-4 skeleton-shimmer rounded w-1/2" />
                    <div className="h-3 skeleton-shimmer rounded w-1/3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
