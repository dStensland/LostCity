"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import BestOfCategoryGrid from "@/components/best-of/BestOfCategoryGrid";
import PortalCommunityView from "@/components/PortalCommunityView";
import DashboardActivity from "@/components/dashboard/DashboardActivity";

type CommunityTab = "bestof" | "groups" | "people";

interface CommunityViewProps {
  portalId: string;
  portalSlug: string;
  portalName: string;
  activeTab: CommunityTab;
}

const TABS: { key: CommunityTab; label: string; icon: React.ReactNode; authRequired?: boolean; description?: string }[] = [
  {
    key: "people",
    label: "Friends",
    authRequired: true,
    description: "Activity from your friends",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    key: "bestof",
    label: "Best Of",
    description: "Community-ranked favorites",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
      </svg>
    ),
  },
  {
    key: "groups",
    label: "Groups",
    description: "Local organizations",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
];

function CommunityViewInner({ portalId, portalSlug, portalName, activeTab }: CommunityViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  // Track last viewed time for activity indicator
  const [hasNewActivity, setHasNewActivity] = useState(false);

  useEffect(() => {
    const lastViewed = localStorage.getItem("lastActivityViewedAt");
    if (!lastViewed) return;

    // Check crew-this-week for latest activity (fetched by the card)
    async function checkActivity() {
      try {
        const res = await fetch("/api/dashboard/crew-this-week");
        if (!res.ok) return;
        const data = await res.json();
        if (data.latestActivityAt && data.latestActivityAt > (lastViewed || "")) {
          setHasNewActivity(true);
        }
      } catch {
        /* ignore */
      }
    }
    checkActivity();
  }, []);

  const handleTabChange = (tab: CommunityTab) => {
    // Mark as viewed when Friends tab is clicked
    if (tab === "people") {
      setHasNewActivity(false);
      localStorage.setItem("lastActivityViewedAt", new Date().toISOString());
    }

    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("view", "community");
    if (tab === "people") {
      params.delete("tab");
    } else {
      params.set("tab", tab);
    }
    router.push(`/${portalSlug}?${params.toString()}`);
  };

  return (
    <div className="py-6">
      {/* Tab navigation */}
      <div className="mb-6">
        <div className="flex p-1 bg-[var(--night)] rounded-lg">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const isLocked = tab.authRequired && !user;
            return (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md font-mono text-xs transition-all ${
                  isActive
                    ? "bg-[var(--coral)] text-[var(--void)] font-medium shadow-[0_0_12px_var(--coral)/20]"
                    : "text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/50"
                }`}
              >
                <span className="relative">
                  {tab.icon}
                  {tab.key === "people" && hasNewActivity && !isActive && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[var(--coral)] animate-pulse" />
                  )}
                </span>
                <span className="hidden sm:inline">{tab.label}</span>
                {isLocked && (
                  <span className="ml-1 px-1.5 py-0.5 rounded text-[0.55rem] bg-[var(--coral)]/20 text-[var(--coral)] font-semibold">
                    Sign in
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {/* Tab description */}
        <p className="text-center text-[0.7rem] text-[var(--soft)] mt-2 font-mono">
          {TABS.find(t => t.key === activeTab)?.description}
        </p>
      </div>

      {/* Tab content */}
      {activeTab === "people" && (
        <Suspense fallback={<PeopleLoadingSkeleton />}>
          <DashboardActivity />
        </Suspense>
      )}

      {activeTab === "bestof" && (
        <Suspense fallback={<BestOfLoadingSkeleton />}>
          <BestOfCategoryGrid />
        </Suspense>
      )}

      {activeTab === "groups" && (
        <Suspense fallback={<GroupsLoadingSkeleton />}>
          <PortalCommunityView
            portalId={portalId}
            portalSlug={portalSlug}
            portalName={portalName}
          />
        </Suspense>
      )}
    </div>
  );
}

function PeopleLoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Search skeleton */}
      <div className="h-12 skeleton-shimmer rounded-xl" />
      {/* Activity skeleton */}
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-4 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 skeleton-shimmer rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 skeleton-shimmer rounded w-3/4" />
                <div className="h-3 skeleton-shimmer rounded w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BestOfLoadingSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="h-36 skeleton-shimmer rounded-xl" />
      ))}
    </div>
  );
}

function GroupsLoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="p-5 rounded-xl border border-[var(--twilight)] bg-[var(--card-bg)]">
          <div className="flex items-start gap-4">
            <div className="w-[72px] h-[72px] rounded-xl skeleton-shimmer" />
            <div className="flex-1 min-w-0 space-y-2">
              <div className="h-5 w-2/3 skeleton-shimmer rounded" />
              <div className="h-4 w-24 skeleton-shimmer rounded" />
              <div className="h-8 w-36 skeleton-shimmer rounded-lg" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function CommunityView(props: CommunityViewProps) {
  return (
    <Suspense fallback={<BestOfLoadingSkeleton />}>
      <CommunityViewInner {...props} />
    </Suspense>
  );
}
