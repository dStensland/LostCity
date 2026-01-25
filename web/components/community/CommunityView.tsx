"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ListsView from "./ListsView";
import PortalCommunityView from "@/components/PortalCommunityView";

type CommunityTab = "lists" | "groups";

interface CommunityViewProps {
  portalId: string;
  portalSlug: string;
  portalName: string;
  activeTab: CommunityTab;
}

const TABS: { key: CommunityTab; label: string; icon: React.ReactNode }[] = [
  {
    key: "lists",
    label: "Lists",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    key: "groups",
    label: "Groups",
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

  const handleTabChange = (tab: CommunityTab) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("view", "community");
    if (tab === "lists") {
      params.delete("tab");
    } else {
      params.set("tab", tab);
    }
    router.push(`/${portalSlug}?${params.toString()}`);
  };

  return (
    <div className="py-6">
      {/* Tab navigation */}
      <div className="flex p-1 mb-6 bg-[var(--night)] rounded-lg max-w-xs">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md font-mono text-xs transition-all ${
                isActive
                  ? "bg-[var(--coral)] text-[var(--void)] font-medium shadow-[0_0_12px_var(--coral)/20]"
                  : "text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/50"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === "lists" && (
        <Suspense fallback={<ListsLoadingSkeleton />}>
          <ListsView portalId={portalId} portalSlug={portalSlug} />
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

function ListsLoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="p-4 rounded-xl border border-[var(--twilight)] bg-[var(--card-bg)]">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg skeleton-shimmer" />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-2/3 skeleton-shimmer rounded" />
              <div className="h-4 w-1/2 skeleton-shimmer rounded" />
              <div className="h-3 w-1/4 skeleton-shimmer rounded" />
            </div>
          </div>
        </div>
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
    <Suspense fallback={<ListsLoadingSkeleton />}>
      <CommunityViewInner {...props} />
    </Suspense>
  );
}
