"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useAuthenticatedFetch } from "./useAuthenticatedFetch";

export type RelationshipStatus =
  | "none"
  | "friends"
  | "following"
  | "followed_by"
  | "request_sent"
  | "request_received";

type FriendshipData = {
  relationship: RelationshipStatus;
  requestId: string | null;
};

type UserProfileResponse = {
  profile: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    bio: string | null;
    location: string | null;
  };
  relationship: RelationshipStatus | null;
  isFollowing: boolean;
  isFollowedBy: boolean;
};

type FriendRequestsResponse = {
  requests: Array<{
    id: string;
    inviter_id: string;
    invitee_id: string;
    status: string;
  }>;
  pendingCount: number;
};

type SendRequestResponse = {
  success: boolean;
  accepted?: boolean;
  request?: { id: string };
};

/**
 * Hook for managing friend relationships with caching and optimistic updates.
 *
 * Features:
 * - Consolidated API calls (fetch relationship + request ID in single query)
 * - TanStack Query caching and deduplication
 * - Optimistic updates for instant UI feedback
 * - Automatic rollback on error
 *
 * Usage:
 * ```
 * const {
 *   relationship,
 *   requestId,
 *   isLoading,
 *   error,
 *   sendRequest,
 *   acceptRequest,
 *   declineRequest,
 *   unfriend,
 * } = useFriendship(targetUserId, targetUsername);
 * ```
 */
export function useFriendship(targetUserId: string, targetUsername: string) {
  const { authFetch, user } = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  // Query key for this friendship
  const queryKey = ["friendship", targetUserId];

  // Fetch relationship status and request ID
  const {
    data,
    isLoading,
    error: queryError,
  } = useQuery<FriendshipData, Error>({
    queryKey,
    queryFn: async () => {
      // Fetch user profile (includes relationship status)
      const profileRes = await fetch(`/api/users/${targetUsername}`);
      if (!profileRes.ok) {
        throw new Error("Failed to fetch relationship");
      }

      const profileData: UserProfileResponse = await profileRes.json();
      const relationship = profileData.relationship || "none";

      // If there's a pending request, fetch request ID
      let requestId: string | null = null;
      if (relationship === "request_sent" || relationship === "request_received") {
        const requestsRes = await fetch("/api/friend-requests?type=all");
        if (requestsRes.ok) {
          const requestsData: FriendRequestsResponse = await requestsRes.json();
          const request = requestsData.requests?.find(
            (r) =>
              r.status === "pending" &&
              ((r.inviter_id === targetUserId && r.invitee_id === user?.id) ||
                (r.inviter_id === user?.id && r.invitee_id === targetUserId))
          );
          requestId = request?.id || null;
        }
      }

      return { relationship, requestId };
    },
    enabled: !!user && user.id !== targetUserId,
    staleTime: 30 * 1000, // Consider fresh for 30s
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    retry: 2,
  });

  // Send friend request mutation
  const sendRequestMutation = useMutation({
    mutationFn: async () => {
      const result = await authFetch<SendRequestResponse>("/api/friend-requests", {
        method: "POST",
        body: { invitee_id: targetUserId },
      });

      if (result.error) {
        throw new Error(result.error);
      }

      return result.data!;
    },
    onMutate: async () => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot previous value
      const previousData = queryClient.getQueryData<FriendshipData>(queryKey);

      // Optimistically update to "request_sent"
      queryClient.setQueryData<FriendshipData>(queryKey, (old) => ({
        relationship: "request_sent",
        requestId: old?.requestId || null,
      }));

      return { previousData };
    },
    onSuccess: (response) => {
      // Update with actual response - DON'T invalidate, trust the server response
      queryClient.setQueryData<FriendshipData>(queryKey, {
        relationship: response.accepted ? "friends" : "request_sent",
        requestId: response.request?.id || null,
      });
      // Invalidate friend-requests lists to update dashboard
      queryClient.invalidateQueries({ queryKey: ["friend-requests", "sent"] });
      queryClient.invalidateQueries({ queryKey: ["friend-requests", "all"] });
    },
    onError: (_error, _variables, context) => {
      // Rollback to previous state
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
  });

  // Accept request mutation
  const acceptRequestMutation = useMutation({
    mutationFn: async (reqId: string) => {
      const result = await authFetch(`/api/friend-requests/${reqId}`, {
        method: "PATCH",
        body: { action: "accept" },
      });

      if (result.error) {
        throw new Error(result.error);
      }

      return result.data;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey });

      const previousData = queryClient.getQueryData<FriendshipData>(queryKey);

      // Optimistically update to "friends"
      queryClient.setQueryData<FriendshipData>(queryKey, {
        relationship: "friends",
        requestId: null,
      });

      return { previousData };
    },
    onSuccess: () => {
      // Keep the optimistic update, invalidate friend requests lists
      queryClient.invalidateQueries({ queryKey: ["friend-requests", "received"] });
      queryClient.invalidateQueries({ queryKey: ["friend-requests", "all"] });
    },
    onError: (_error, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
  });

  // Decline request mutation
  const declineRequestMutation = useMutation({
    mutationFn: async (reqId: string) => {
      const result = await authFetch(`/api/friend-requests/${reqId}`, {
        method: "PATCH",
        body: { action: "decline" },
      });

      if (result.error) {
        throw new Error(result.error);
      }

      return result.data;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey });

      const previousData = queryClient.getQueryData<FriendshipData>(queryKey);

      // Optimistically update to "none"
      queryClient.setQueryData<FriendshipData>(queryKey, {
        relationship: "none",
        requestId: null,
      });

      return { previousData };
    },
    onSuccess: () => {
      // Keep the optimistic update, invalidate friend requests lists
      queryClient.invalidateQueries({ queryKey: ["friend-requests", "received"] });
      queryClient.invalidateQueries({ queryKey: ["friend-requests", "all"] });
    },
    onError: (_error, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
  });

  // Cancel request mutation
  const cancelRequestMutation = useMutation({
    mutationFn: async (reqId: string) => {
      const result = await authFetch(`/api/friend-requests/${reqId}`, {
        method: "DELETE",
      });

      if (result.error) {
        throw new Error(result.error);
      }

      return result.data;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey });

      const previousData = queryClient.getQueryData<FriendshipData>(queryKey);

      // Optimistically update to "none"
      queryClient.setQueryData<FriendshipData>(queryKey, {
        relationship: "none",
        requestId: null,
      });

      return { previousData };
    },
    onSuccess: () => {
      // Keep the optimistic update, invalidate friend requests lists
      queryClient.invalidateQueries({ queryKey: ["friend-requests", "sent"] });
      queryClient.invalidateQueries({ queryKey: ["friend-requests", "all"] });
    },
    onError: (_error, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
  });

  // Unfriend mutation
  const unfriendMutation = useMutation({
    mutationFn: async () => {
      const result = await authFetch("/api/friends/unfriend", {
        method: "POST",
        body: { targetUserId },
      });

      if (result.error) {
        throw new Error(result.error);
      }

      // Fetch updated relationship status after unfriending
      const profileRes = await fetch(`/api/users/${targetUsername}`);
      if (profileRes.ok) {
        const profileData: UserProfileResponse = await profileRes.json();
        return { relationship: profileData.relationship || "none" };
      }

      return { relationship: "none" as RelationshipStatus };
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey });

      const previousData = queryClient.getQueryData<FriendshipData>(queryKey);

      // Optimistically update to "none" (may be following/followed_by)
      queryClient.setQueryData<FriendshipData>(queryKey, {
        relationship: "none",
        requestId: null,
      });

      return { previousData };
    },
    onSuccess: (response) => {
      // Update with actual relationship (might be following/followed_by)
      // No need to invalidate - we just set the correct value from the server
      queryClient.setQueryData<FriendshipData>(queryKey, {
        relationship: response.relationship,
        requestId: null,
      });
    },
    onError: (_error, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
  });

  // Wrapper functions
  const sendRequest = useCallback(() => {
    sendRequestMutation.mutate();
  }, [sendRequestMutation]);

  const acceptRequest = useCallback(() => {
    if (!data?.requestId) {
      throw new Error("No request ID available");
    }
    acceptRequestMutation.mutate(data.requestId);
  }, [acceptRequestMutation, data]);

  const declineRequest = useCallback(() => {
    if (!data?.requestId) {
      throw new Error("No request ID available");
    }
    declineRequestMutation.mutate(data.requestId);
  }, [declineRequestMutation, data]);

  const cancelRequest = useCallback(() => {
    if (!data?.requestId) {
      throw new Error("No request ID available");
    }
    cancelRequestMutation.mutate(data.requestId);
  }, [cancelRequestMutation, data]);

  const unfriend = useCallback(() => {
    unfriendMutation.mutate();
  }, [unfriendMutation]);

  // Determine if any mutation is in progress
  const isActionLoading =
    sendRequestMutation.isPending ||
    acceptRequestMutation.isPending ||
    declineRequestMutation.isPending ||
    cancelRequestMutation.isPending ||
    unfriendMutation.isPending;

  // Get error from any mutation or query
  const error =
    queryError?.message ||
    sendRequestMutation.error?.message ||
    acceptRequestMutation.error?.message ||
    declineRequestMutation.error?.message ||
    cancelRequestMutation.error?.message ||
    unfriendMutation.error?.message ||
    null;

  return {
    relationship: data?.relationship || "none",
    requestId: data?.requestId || null,
    isLoading,
    isActionLoading,
    error,
    sendRequest,
    acceptRequest,
    declineRequest,
    cancelRequest,
    unfriend,
  };
}

/**
 * Type for the return value of useFriendship
 */
export type UseFriendshipReturn = ReturnType<typeof useFriendship>;
