"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import DashboardShell from "@/components/dashboard/DashboardShell";
import DashboardFeed from "@/components/dashboard/DashboardFeed";
import DashboardActivity from "@/components/dashboard/DashboardActivity";
import DashboardPlanning from "@/components/dashboard/DashboardPlanning";

type DashboardTab = "feed" | "activity" | "planning";

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const currentTab = (searchParams?.get("tab") as DashboardTab) || "feed";

  const handleTabChange = (tab: DashboardTab) => {
    const params = new URLSearchParams();
    if (tab !== "feed") {
      params.set("tab", tab);
    }
    router.push(`/dashboard${params.toString() ? `?${params.toString()}` : ""}`);
  };

  return (
    <DashboardShell currentTab={currentTab} onTabChange={handleTabChange}>
      {currentTab === "feed" && <DashboardFeed />}
      {currentTab === "activity" && <DashboardActivity />}
      {currentTab === "planning" && <DashboardPlanning />}
    </DashboardShell>
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
