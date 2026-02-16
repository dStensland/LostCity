"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useMemo, useCallback } from "react";
import type { EventWithLocation } from "@/lib/search";
import type { Festival } from "@/lib/festivals";
import { fetchWithRetry } from "@/lib/fetchWithRetry";

/**
 * Response from /api/timeline — events + festivals in one stream
 */
interface TimelineResponse {
  events: EventWithLocation[];
  festivals: Festival[];
  cursor: string | null;
  hasMore: boolean;
}

interface UseTimelineOptions {
  portalId?: string;
  portalExclusive?: boolean;
  initialData?: EventWithLocation[];
  enabled?: boolean;
}

/**
 * Unified hook for fetching events and festivals together via /api/timeline.
 *
 * Replaces the previous dual-hook pattern (useEventsList + useFestivalsList).
 * The server merges both data streams and filters festivals to the loaded
 * event date range when more pages are available, preventing the old issue
 * where future festivals pushed the infinite-scroll sentinel out of view.
 */
export function useTimeline(options: UseTimelineOptions = {}) {
  const { portalId, portalExclusive, initialData, enabled = true } = options;
  const searchParams = useSearchParams();

  // Stable query key from filter params (exclude view param)
  const filtersKey = useMemo(() => {
    const params = new URLSearchParams();
    const filterKeys = [
      "search",
      "categories",
      "subcategories",
      "genres",
      "tags",
      "vibes",
      "neighborhoods",
      "price",
      "free",
      "date",
      "mood",
    ];
    filterKeys.forEach((key) => {
      const value = searchParams.get(key);
      if (value) params.set(key, value);
    });
    return params.toString();
  }, [searchParams]);

  // Build API params from search params
  const buildApiParams = useCallback(
    (cursor: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("view");

      if (cursor) {
        params.set("cursor", cursor);
      }

      if (portalId && portalId !== "default") {
        params.set("portal_id", portalId);
      }
      if (portalExclusive) {
        params.set("portal_exclusive", "true");
      }

      return params;
    },
    [searchParams, portalId, portalExclusive]
  );

  const query = useInfiniteQuery<TimelineResponse, Error>({
    queryKey: ["timeline", filtersKey, portalId, portalExclusive],
    queryFn: async ({ pageParam, signal }) => {
      const params = buildApiParams(pageParam as string | null);
      const res = await fetchWithRetry(
        `/api/timeline?${params}`,
        { signal },
        {
          maxRetries: 3,
          baseDelay: 1000,
          shouldRetry: (error, response) => {
            if (error.name === "AbortError") return false;
            if (!response) return true;
            if (response.status >= 500) return true;
            return false;
          },
        }
      );

      if (!res.ok) {
        throw new Error(`Failed to fetch timeline: ${res.status}`);
      }

      return res.json();
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.cursor,
    enabled,
    refetchOnWindowFocus: false,
    retry: false,
    throwOnError: (error) => {
      if (error.name === "AbortError") return false;
      return true;
    },
  });

  // Flatten all pages into a single events array (deduped)
  const events = useMemo(() => {
    if (!query.data?.pages) return initialData || [];

    const allEvents: EventWithLocation[] = [];
    const seenIds = new Set<number>();

    query.data.pages.forEach((page) => {
      page.events.forEach((event) => {
        if (!seenIds.has(event.id)) {
          seenIds.add(event.id);
          allEvents.push(event);
        }
      });
    });

    return allEvents;
  }, [query.data, initialData]);

  // Merge festivals from all pages (deduped) — the server already filters
  // festivals to the loaded event date range when hasMore is true
  const festivals = useMemo(() => {
    if (!query.data?.pages) return [];

    const allFestivals: Festival[] = [];
    const seenIds = new Set<string>();

    query.data.pages.forEach((page) => {
      page.festivals.forEach((festival) => {
        if (!seenIds.has(festival.id)) {
          seenIds.add(festival.id);
          allFestivals.push(festival);
        }
      });
    });

    return allFestivals;
  }, [query.data]);

  const hasMore = useMemo(() => {
    const pages = query.data?.pages;
    if (!pages || pages.length === 0) return true;
    return pages[pages.length - 1].hasMore;
  }, [query.data?.pages]);

  const isLoading = query.isLoading;
  const isFetchingNextPage = query.isFetchingNextPage;
  const isRefetching = query.isRefetching && !query.isFetchingNextPage;
  const error = query.error?.message || null;

  const loadMore = useCallback(() => {
    if (!query.isFetchingNextPage && hasMore) {
      query.fetchNextPage();
    }
  }, [query, hasMore]);

  const refresh = useCallback(() => {
    query.refetch();
  }, [query]);

  return {
    events,
    festivals,
    isLoading,
    isFetchingNextPage,
    isRefetching,
    hasMore,
    error,
    loadMore,
    refresh,
  };
}
