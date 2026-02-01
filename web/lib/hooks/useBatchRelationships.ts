"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedFetch } from "./useAuthenticatedFetch";

export type RelationshipStatus =
  | "none"
  | "friends"
  | "following"
  | "followed_by"
  | "request_sent"
  | "request_received";

export type BatchRelationshipsResponse = {
  relationships: Record<string, RelationshipStatus>;
};

/**
 * Hook for fetching relationship statuses for multiple users in a single API call.
 *
 * Features:
 * - Batch fetching to reduce API calls
 * - TanStack Query caching and deduplication
 * - Automatic refetching on stale data
 * - Type-safe relationship status
 *
 * Usage:
 * ```typescript
 * const userIds = ['user-id-1', 'user-id-2', 'user-id-3'];
 * const { relationships, isLoading, error } = useBatchRelationships(userIds);
 *
 * // Access individual relationships
 * const status = relationships['user-id-1']; // 'friends' | 'following' | etc.
 * ```
 *
 * Performance tips:
 * - Memoize the userIds array to prevent unnecessary refetches
 * - Use with React.useMemo(() => [id1, id2], [id1, id2])
 * - Max 100 user IDs per request
 *
 * @param userIds - Array of user IDs to fetch relationships for
 * @param options - Optional configuration
 * @returns Relationship statuses and query state
 */
export function useBatchRelationships(
  userIds: string[],
  options?: {
    enabled?: boolean;
    staleTime?: number;
    gcTime?: number;
  }
) {
  const { authFetch, user } = useAuthenticatedFetch();

  // Create a stable query key based on sorted user IDs
  // This ensures cache hits regardless of array order
  const sortedUserIds = [...userIds].sort();
  const queryKey = ["relationships", "batch", sortedUserIds.join(",")];

  const {
    data,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useQuery<BatchRelationshipsResponse, Error>({
    queryKey,
    queryFn: async () => {
      // Don't make request if no user IDs
      if (userIds.length === 0) {
        return { relationships: {} };
      }

      const result = await authFetch<BatchRelationshipsResponse>(
        "/api/relationships/batch",
        {
          method: "POST",
          body: { userIds },
          timeout: 10000,
        }
      );

      if (result.error) {
        throw new Error(result.error);
      }

      return result.data!;
    },
    enabled: options?.enabled !== false && !!user && userIds.length > 0,
    staleTime: options?.staleTime ?? 30 * 1000, // Consider fresh for 30s
    gcTime: options?.gcTime ?? 5 * 60 * 1000,   // Keep in cache for 5 minutes
    retry: 2,
  });

  // Helper function to get relationship for a specific user
  const getRelationship = (userId: string): RelationshipStatus => {
    return data?.relationships[userId] ?? "none";
  };

  // Helper function to check if user is a friend
  const isFriend = (userId: string): boolean => {
    return getRelationship(userId) === "friends";
  };

  // Helper function to check if following
  const isFollowing = (userId: string): boolean => {
    const status = getRelationship(userId);
    return status === "following" || status === "friends";
  };

  // Helper function to check if followed by
  const isFollowedBy = (userId: string): boolean => {
    const status = getRelationship(userId);
    return status === "followed_by" || status === "friends";
  };

  return {
    // Raw data
    relationships: data?.relationships ?? {},

    // Query state
    isLoading,
    isRefetching,
    error: error?.message ?? null,

    // Helper functions
    getRelationship,
    isFriend,
    isFollowing,
    isFollowedBy,

    // Refetch function
    refetch,
  };
}

/**
 * Type for the return value of useBatchRelationships
 */
export type UseBatchRelationshipsReturn = ReturnType<typeof useBatchRelationships>;

/**
 * Example usage in a component:
 *
 * ```typescript
 * import { useBatchRelationships } from '@/lib/hooks/useBatchRelationships';
 *
 * function FriendsList({ userIds }: { userIds: string[] }) {
 *   const { relationships, isLoading, getRelationship, isFriend } = useBatchRelationships(userIds);
 *
 *   if (isLoading) return <div>Loading...</div>;
 *
 *   return (
 *     <div>
 *       {userIds.map(userId => {
 *         const status = getRelationship(userId);
 *         return (
 *           <div key={userId}>
 *             User {userId}: {status}
 *             {isFriend(userId) && <span>⭐️</span>}
 *           </div>
 *         );
 *       })}
 *     </div>
 *   );
 * }
 * ```
 */
