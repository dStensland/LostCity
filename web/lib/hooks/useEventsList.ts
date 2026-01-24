"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useMemo, useCallback } from "react";
import type { EventWithLocation } from "@/lib/search";

/**
 * Response from /api/events with cursor pagination
 */
interface EventsResponse {
  events: EventWithLocation[];
  cursor: string | null;
  hasMore: boolean;
}

/**
 * Options for useEventsList hook
 */
interface UseEventsListOptions {
  portalId?: string;
  portalExclusive?: boolean;
  initialData?: EventWithLocation[];
  enabled?: boolean;
}

/**
 * Hook for fetching events with infinite scroll using cursor-based pagination
 *
 * Uses React Query's useInfiniteQuery which handles:
 * - Automatic caching and deduplication
 * - Background refetching
 * - Retry with exponential backoff
 * - Cursor-based pagination
 *
 * The cursor ensures stable pagination even when data changes
 */
export function useEventsList(options: UseEventsListOptions = {}) {
  const { portalId, portalExclusive, initialData, enabled = true } = options;
  const searchParams = useSearchParams();

  // Create stable query key from filter params (exclude view param)
  const filtersKey = useMemo(() => {
    const params = new URLSearchParams();
    const filterKeys = [
      "search",
      "categories",
      "subcategories",
      "tags",
      "vibes",
      "neighborhoods",
      "price",
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

      // Remove view param (not needed for API)
      params.delete("view");

      // Add cursor for pagination
      if (cursor) {
        params.set("cursor", cursor);
      } else {
        // Signal to use cursor-based pagination
        params.set("useCursor", "true");
      }

      // Add portal params
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

  // Infinite query for events
  const query = useInfiniteQuery<EventsResponse, Error>({
    queryKey: ["events", "list", filtersKey, portalId, portalExclusive],
    queryFn: async ({ pageParam, signal }) => {
      const params = buildApiParams(pageParam as string | null);
      const res = await fetch(`/api/events?${params}`, { signal });

      if (!res.ok) {
        throw new Error(`Failed to fetch events: ${res.status}`);
      }

      return res.json();
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.cursor,
    enabled,
    // Don't refetch all pages on window focus
    refetchOnWindowFocus: false,
    // Retry failed requests
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    // Treat abort as a non-error (happens during view switching)
    throwOnError: (error) => {
      if (error.name === "AbortError") return false;
      return true;
    },
  });

  // Flatten all pages into a single events array
  const events = useMemo(() => {
    if (!query.data?.pages) return initialData || [];

    const allEvents: EventWithLocation[] = [];
    const seenIds = new Set<number>();

    query.data.pages.forEach((page) => {
      page.events.forEach((event) => {
        // Deduplicate events (safety for any edge cases)
        if (!seenIds.has(event.id)) {
          seenIds.add(event.id);
          allEvents.push(event);
        }
      });
    });

    return allEvents;
  }, [query.data, initialData]);

  // Get hasMore from the last page
  const hasMore = useMemo(() => {
    const pages = query.data?.pages;
    if (!pages || pages.length === 0) return true;
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
    events,
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
 * Type for the return value of useEventsList
 */
export type UseEventsListReturn = ReturnType<typeof useEventsList>;
