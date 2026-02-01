"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";

/**
 * Profile type for user data
 */
export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
};

/**
 * Friend request type
 */
export type FriendRequest = {
  id: string;
  inviter_id: string;
  invitee_id: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
  responded_at: string | null;
  inviter?: Profile | null;
  invitee?: Profile | null;
};

/**
 * Response from /api/friend-requests
 */
interface FriendRequestsResponse {
  requests: FriendRequest[];
  pendingCount: number;
}

/**
 * Options for useFriendRequests hook
 */
interface UseFriendRequestsOptions {
  type?: "received" | "sent" | "all";
  enabled?: boolean;
}

/**
 * Hook for fetching friend requests using TanStack Query.
 *
 * Features:
 * - Fetches friend requests (received, sent, or all)
 * - Includes pending count
 * - 30s stale time for consistent caching
 * - 5 minute garbage collection time
 * - Only fetches when user is authenticated
 *
 * Usage:
 * ```tsx
 * const { requests, pendingRequests, pendingCount, isLoading, error } = useFriendRequests({ type: "received" });
 * ```
 */
export function useFriendRequests(options: UseFriendRequestsOptions = {}) {
  const { type = "received", enabled = true } = options;
  const { user } = useAuth();

  const query = useQuery<FriendRequestsResponse, Error>({
    queryKey: ["friend-requests", type],
    queryFn: async () => {
      const params = new URLSearchParams({ type });
      const res = await fetch(`/api/friend-requests?${params}`);

      if (!res.ok) {
        throw new Error(`Failed to fetch friend requests: ${res.status}`);
      }

      return res.json();
    },
    enabled: enabled && !!user,
    staleTime: 30 * 1000, // Consider fresh for 30s
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    retry: 2,
  });

  // Filter pending requests from the response
  const pendingRequests =
    query.data?.requests.filter((r) => r.status === "pending") || [];

  return {
    requests: query.data?.requests || [],
    pendingRequests,
    pendingCount: query.data?.pendingCount || 0,
    isLoading: query.isLoading,
    error: query.error?.message || null,
    refetch: query.refetch,
  };
}

/**
 * Type for the return value of useFriendRequests
 */
export type UseFriendRequestsReturn = ReturnType<typeof useFriendRequests>;
