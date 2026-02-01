"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { useMemo, useCallback } from "react";
import type { ActivityItem, GroupedEventActivity } from "./useActivities";

/**
 * Response from /api/dashboard/activity with cursor pagination
 */
interface ActivitiesResponse {
  activities: ActivityItem[];
  groupedByEvent: GroupedEventActivity[];
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * Options for useInfiniteActivities hook
 */
interface UseInfiniteActivitiesOptions {
  limit?: number;
  enabled?: boolean;
}

/**
 * Hook for fetching dashboard activity feed with infinite scroll
 *
 * Uses TanStack Query's useInfiniteQuery with cursor-based pagination.
 * Fetches activities from friends (RSVPs, follows, saved events) and
 * supports smooth infinite scrolling.
 *
 * Features:
 * - Cursor-based pagination for stable results
 * - Automatic deduplication across pages
 * - 30s stale time for consistent caching
 * - Only fetches when user is authenticated
 *
 * Usage:
 * ```tsx
 * const { activities, hasMore, loadMore, isLoading, isFetchingNextPage } = useInfiniteActivities();
 * ```
 */
export function useInfiniteActivities(options: UseInfiniteActivitiesOptions = {}) {
  const { limit = 30, enabled = true } = options;
  const { user } = useAuth();

  const query = useInfiniteQuery<ActivitiesResponse, Error>({
    queryKey: ["activities", "infinite", limit],
    queryFn: async ({ pageParam, signal }) => {
      const params = new URLSearchParams({ limit: limit.toString() });
      if (pageParam) {
        params.set("cursor", pageParam as string);
      }

      const res = await fetch(`/api/dashboard/activity?${params}`, { signal });

      if (!res.ok) {
        throw new Error(`Failed to fetch activities: ${res.status}`);
      }

      return res.json();
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: enabled && !!user,
    staleTime: 30 * 1000, // Consider fresh for 30s
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    retry: 2,
    refetchOnWindowFocus: false,
    throwOnError: (error) => {
      if (error.name === "AbortError") return false;
      return true;
    },
  });

  // Flatten all pages into a single activities array
  const activities = useMemo(() => {
    if (!query.data?.pages) return [];

    const allActivities: ActivityItem[] = [];
    const seenIds = new Set<string>();

    query.data.pages.forEach((page) => {
      page.activities.forEach((activity) => {
        // Deduplicate activities across pages
        if (!seenIds.has(activity.id)) {
          seenIds.add(activity.id);
          allActivities.push(activity);
        }
      });
    });

    return allActivities;
  }, [query.data]);

  // Get grouped events from the first page only (for "Friends Are Going" section)
  const groupedByEvent = useMemo(() => {
    const firstPage = query.data?.pages?.[0];
    return firstPage?.groupedByEvent || [];
  }, [query.data?.pages]);

  // Get hasMore from the last page
  const hasMore = useMemo(() => {
    const pages = query.data?.pages;
    if (!pages || pages.length === 0) return false;
    return pages[pages.length - 1].hasMore;
  }, [query.data?.pages]);

  // Combined loading states
  const isLoading = query.isLoading;
  const isFetchingNextPage = query.isFetchingNextPage;
  const isRefetching = query.isRefetching && !query.isFetchingNextPage;

  // Error handling
  const error = query.error?.message || null;

  // Load more function
  const loadMore = useCallback(() => {
    if (!query.isFetchingNextPage && hasMore) {
      query.fetchNextPage();
    }
  }, [query, hasMore]);

  // Refresh function (refetch from beginning)
  const refresh = useCallback(() => {
    query.refetch();
  }, [query]);

  return {
    activities,
    groupedByEvent,
    isLoading,
    isFetchingNextPage,
    isRefetching,
    hasMore,
    error,
    loadMore,
    refresh,
    // Expose raw query for advanced use cases
    query,
  };
}

/**
 * Type for the return value of useInfiniteActivities
 */
export type UseInfiniteActivitiesReturn = ReturnType<typeof useInfiniteActivities>;
