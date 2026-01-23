"use client";

import { useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export type DashboardTab = "feed" | "activity" | "planning";

export function useDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const currentTab = (searchParams?.get("tab") as DashboardTab) || "feed";

  const setTab = useCallback(
    (tab: DashboardTab) => {
      const params = new URLSearchParams();
      if (tab !== "feed") {
        params.set("tab", tab);
      }
      router.push(`/dashboard${params.toString() ? `?${params.toString()}` : ""}`);
    },
    [router]
  );

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    // Trigger a refresh by navigating to the same URL
    router.refresh();
    // Reset after a short delay
    setTimeout(() => setIsRefreshing(false), 1000);
  }, [router]);

  return {
    currentTab,
    setTab,
    isRefreshing,
    refresh,
  };
}
