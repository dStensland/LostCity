"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";

/**
 * Profile type for user data
 */
export type ProfileData = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

/**
 * Event type for event data
 */
export type EventData = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  is_all_day: boolean;
  category: string | null;
  image_url: string | null;
  venue?: { name: string } | null;
};

/**
 * Venue type for venue data
 */
export type VenueData = {
  id: number;
  name: string;
  slug: string | null;
  neighborhood: string | null;
};

/**
 * Target user type
 */
export type TargetUserData = {
  id: string;
  username: string;
  display_name: string | null;
};

/**
 * Activity item type
 */
export type ActivityItem = {
  id: string;
  activity_type: "rsvp" | "follow" | "save";
  created_at: string;
  user: ProfileData;
  event?: EventData | null;
  venue?: VenueData | null;
  target_user?: TargetUserData | null;
  metadata?: {
    status?: string;
  };
};

/**
 * Grouped event type
 */
export type GroupedEventActivity = {
  event: EventData;
  users: ProfileData[];
  latestActivity: string;
};

/**
 * Response from /api/dashboard/activity
 */
interface ActivitiesResponse {
  activities: ActivityItem[];
  groupedByEvent: GroupedEventActivity[];
}

/**
 * Options for useActivities hook
 */
interface UseActivitiesOptions {
  limit?: number;
  enabled?: boolean;
}

/**
 * Hook for fetching dashboard activity feed using TanStack Query.
 *
 * Features:
 * - Fetches activities from friends (RSVPs, follows, saved events)
 * - Includes grouped activities by event
 * - 30s stale time for consistent caching
 * - 5 minute garbage collection time
 * - Only fetches when user is authenticated
 *
 * Usage:
 * ```tsx
 * const { activities, groupedByEvent, isLoading, error } = useActivities({ limit: 30 });
 * ```
 */
export function useActivities(options: UseActivitiesOptions = {}) {
  const { limit = 30, enabled = true } = options;
  const { user } = useAuth();

  const query = useQuery<ActivitiesResponse, Error>({
    queryKey: ["activities", limit],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: limit.toString() });
      const res = await fetch(`/api/dashboard/activity?${params}`);

      if (!res.ok) {
        throw new Error(`Failed to fetch activities: ${res.status}`);
      }

      return res.json();
    },
    enabled: enabled && !!user,
    staleTime: 30 * 1000, // Consider fresh for 30s
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    retry: 2,
  });

  return {
    activities: query.data?.activities || [],
    groupedByEvent: query.data?.groupedByEvent || [],
    isLoading: query.isLoading,
    error: query.error?.message || null,
    refetch: query.refetch,
  };
}

/**
 * Type for the return value of useActivities
 */
export type UseActivitiesReturn = ReturnType<typeof useActivities>;
