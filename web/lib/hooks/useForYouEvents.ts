"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useMemo, useCallback } from "react";
import type { RecommendationReason } from "@/components/ReasonBadge";
import type { Event } from "@/lib/supabase";

/**
 * Feed event type from API response
 * Extends Event to be compatible with EventCard's EventCardEvent type
 */
export interface FeedEvent extends Event {
  score?: number;
  reasons?: RecommendationReason[];
  friends_going?: Array<{
    user_id: string;
    username: string;
    display_name: string | null;
  }>;
  going_count?: number;
  interested_count?: number;
  recommendation_count?: number;
  // EventCard optional extensions
  is_live?: boolean;
  category_data?: {
    typical_price_min: number | null;
    typical_price_max: number | null;
  } | null;
}

/**
 * Personalization metadata from API
 */
export interface PersonalizationInfo {
  followedVenueIds: number[];
  followedOrgIds: string[];
  favoriteNeighborhoods: string[];
  favoriteCategories: string[];
  favoriteGenres?: string[];
  needsAccessibility?: string[];
  needsDietary?: string[];
  needsFamily?: string[];
  hideAdultContent?: boolean;
  crossPortalRecommendations?: boolean;
  isPersonalized: boolean;
}

export interface FeedSection {
  id:
    | "tonight_for_you"
    | "this_week_fits_your_taste"
    | "from_places_people_you_follow"
    | "explore_something_new";
  title: string;
  description: string;
  events: FeedEvent[];
}

/**
 * Response from /api/feed with cursor pagination
 */
interface FeedResponse {
  events: FeedEvent[];
  sections?: FeedSection[];
  cursor: string | null;
  hasMore: boolean;
  hasPreferences: boolean;
  personalization: PersonalizationInfo;
}

/**
 * Options for useForYouEvents hook
 */
interface UseForYouEventsOptions {
  portalSlug?: string;
  enabled?: boolean;
}

/**
 * Hook for fetching For You feed events with infinite scroll
 *
 * Uses React Query's useInfiniteQuery with cursor-based pagination.
 * Builds query params from URL search params for filters.
 */
export function useForYouEvents(options: UseForYouEventsOptions = {}) {
  const { portalSlug, enabled = true } = options;
  const searchParams = useSearchParams();

  // Create stable query key from filter params
  const filtersKey = useMemo(() => {
    const params = new URLSearchParams();
    const filterKeys = [
      "search",
      "categories",
      "subcategories",
      "tags",
      "neighborhoods",
      "date",
      "free",
      "personalized",
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
      const params = new URLSearchParams();

      // Copy filter params
      const filterKeys = [
        "search",
        "categories",
        "subcategories",
        "tags",
        "neighborhoods",
        "date",
        "free",
        "personalized",
      ];
      filterKeys.forEach((key) => {
        const value = searchParams.get(key);
        if (value) params.set(key, value);
      });

      // Add portal
      if (portalSlug) {
        params.set("portal", portalSlug);
      }

      // Add cursor for pagination
      if (cursor) {
        params.set("cursor", cursor);
      }

      // Set a reasonable limit
      params.set("limit", "25");

      return params;
    },
    [searchParams, portalSlug],
  );

  // Infinite query for feed events
  const query = useInfiniteQuery<FeedResponse, Error>({
    queryKey: ["feed", "forYou", filtersKey, portalSlug],
    queryFn: async ({ pageParam, signal }) => {
      const params = buildApiParams(pageParam as string | null);
      const res = await fetch(`/api/feed?${params}`, { signal });

      if (res.status === 401) {
        return {
          events: [],
          sections: [],
          cursor: null,
          hasMore: false,
          hasPreferences: false,
          personalization: {
            followedVenueIds: [],
            followedOrgIds: [],
            favoriteNeighborhoods: [],
            favoriteCategories: [],
            isPersonalized: false,
          },
        };
      }

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || `Failed to fetch feed: ${res.status}`);
      }

      return res.json();
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.cursor,
    enabled,
    refetchOnWindowFocus: false,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    throwOnError: false,
  });

  // Flatten all pages into a single events array
  const events = useMemo(() => {
    if (!query.data?.pages) return [];

    const allEvents: FeedEvent[] = [];
    const seenIds = new Set<number>();

    query.data.pages.forEach((page) => {
      page.events.forEach((event) => {
        // Deduplicate events
        if (!seenIds.has(event.id)) {
          seenIds.add(event.id);
          allEvents.push(event);
        }
      });
    });

    return allEvents;
  }, [query.data]);

  // Get personalization info from first page
  const personalization = useMemo((): PersonalizationInfo | null => {
    const firstPage = query.data?.pages?.[0];
    return firstPage?.personalization || null;
  }, [query.data?.pages]);

  const sections = useMemo((): FeedSection[] => {
    const firstPage = query.data?.pages?.[0];
    return firstPage?.sections || [];
  }, [query.data?.pages]);

  // Get hasPreferences from first page
  const hasPreferences = useMemo(() => {
    const firstPage = query.data?.pages?.[0];
    return firstPage?.hasPreferences || false;
  }, [query.data?.pages]);

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
    sections,
    personalization,
    hasPreferences,
    isLoading,
    isFetchingNextPage,
    isRefetching,
    hasMore,
    error,
    loadMore,
    refresh,
    query,
  };
}

/**
 * Type for the return value of useForYouEvents
 */
export type UseForYouEventsReturn = ReturnType<typeof useForYouEvents>;
