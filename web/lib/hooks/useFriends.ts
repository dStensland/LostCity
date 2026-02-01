"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";

/**
 * Profile type for friend data
 */
export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
};

/**
 * Response from /api/friends
 */
interface FriendsResponse {
  friends: Profile[];
  count: number;
}

/**
 * Options for useFriends hook
 */
interface UseFriendsOptions {
  enabled?: boolean;
}

/**
 * Hook for fetching current user's friends using TanStack Query.
 *
 * Features:
 * - Fetches friends from the friendships table
 * - 30s stale time for consistent caching
 * - 5 minute garbage collection time
 * - Only fetches when user is authenticated
 *
 * Usage:
 * ```tsx
 * const { friends, count, isLoading, error } = useFriends();
 * ```
 */
export function useFriends(options: UseFriendsOptions = {}) {
  const { enabled = true } = options;
  const { user } = useAuth();

  const query = useQuery<FriendsResponse, Error>({
    queryKey: ["friends"],
    queryFn: async () => {
      const res = await fetch("/api/friends");

      if (!res.ok) {
        throw new Error(`Failed to fetch friends: ${res.status}`);
      }

      return res.json();
    },
    enabled: enabled && !!user,
    staleTime: 30 * 1000, // Consider fresh for 30s
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    retry: 2,
  });

  return {
    friends: query.data?.friends || [],
    count: query.data?.count || 0,
    isLoading: query.isLoading,
    error: query.error?.message || null,
    refetch: query.refetch,
  };
}

/**
 * Type for the return value of useFriends
 */
export type UseFriendsReturn = ReturnType<typeof useFriends>;
