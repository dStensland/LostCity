"use client";

import { useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
};

type FriendRequest = {
  id: string;
  inviter_id: string;
  invitee_id: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
  responded_at: string | null;
  inviter?: Profile | null;
  invitee?: Profile | null;
};

type FriendRequestsResponse = {
  requests: FriendRequest[];
  pendingCount: number;
};

/**
 * Hook for real-time friend request updates via Supabase Realtime.
 *
 * Features:
 * - Subscribes to INSERT events on friend_requests table
 * - Filters for requests where invitee_id = current user
 * - Automatically updates TanStack Query cache
 * - Provides pending request count for nav badge
 * - Cleans up subscription on unmount
 *
 * Usage:
 * ```
 * const { pendingCount } = useRealtimeFriendRequests();
 * ```
 */
export function useRealtimeFriendRequests() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const supabase = createClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Get current pending count from cache
  const getCachedPendingCount = useCallback((): number => {
    // Check the "received" cache since that's what contains pending requests for the current user
    const cachedData = queryClient.getQueryData<FriendRequestsResponse>(["friend-requests", "received"]);
    if (!cachedData) return 0;

    return cachedData.pendingCount || 0;
  }, [queryClient]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!user?.id) {
      return;
    }

    // Clean up existing subscription
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // Create new channel for friend requests
    const channel = supabase
      .channel("friend-requests")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "friend_requests",
          filter: `invitee_id=eq.${user.id}`,
        },
        async (payload) => {
          const newRequest = payload.new as {
            id: string;
            inviter_id: string;
            invitee_id: string;
            status: "pending" | "accepted" | "declined";
            created_at: string;
            responded_at: string | null;
          };

          // Only process pending requests
          if (newRequest.status !== "pending") return;

          // Fetch the full request with inviter profile
          const { data: fullRequest } = await supabase
            .from("friend_requests")
            .select(`
              id,
              inviter_id,
              invitee_id,
              status,
              created_at,
              responded_at,
              inviter:profiles!friend_requests_inviter_id_fkey(
                id, username, display_name, avatar_url, bio
              )
            `)
            .eq("id", newRequest.id)
            .maybeSingle();

          if (!fullRequest) return;

          const typedRequest = fullRequest as FriendRequest;

          // Update the "received" cache (this is where pending requests for current user live)
          queryClient.setQueryData<FriendRequestsResponse>(
            ["friend-requests", "received"],
            (oldData) => {
              if (!oldData) {
                return {
                  requests: [typedRequest],
                  pendingCount: 1,
                };
              }

              // Add new request to the front of the list (avoid duplicates)
              const filtered = oldData.requests.filter((r) => r.id !== typedRequest.id);
              const updatedRequests = [typedRequest, ...filtered];

              // Recalculate pending count
              const pendingCount = updatedRequests.filter(
                (r) => r.status === "pending"
              ).length;

              return {
                requests: updatedRequests,
                pendingCount,
              };
            }
          );

          // Update "all" cache if it exists
          queryClient.setQueryData<FriendRequestsResponse>(
            ["friend-requests", "all"],
            (oldData) => {
              if (!oldData) return oldData;

              const filtered = oldData.requests.filter((r) => r.id !== typedRequest.id);
              const updatedRequests = [typedRequest, ...filtered];

              const pendingCount = updatedRequests.filter(
                (r) => r.status === "pending" && r.invitee_id === user.id
              ).length;

              return {
                requests: updatedRequests,
                pendingCount,
              };
            }
          );

          // Invalidate friendship queries for the inviter (the person who sent the request)
          // This ensures their profile shows the correct "request_sent" status
          queryClient.invalidateQueries({ queryKey: ["friendship", typedRequest.inviter_id] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "friend_requests",
          filter: `invitee_id=eq.${user.id}`,
        },
        (payload) => {
          const updatedRequest = payload.new as {
            id: string;
            status: "pending" | "accepted" | "declined";
          };

          // Update the "received" cache
          queryClient.setQueryData<FriendRequestsResponse>(
            ["friend-requests", "received"],
            (oldData) => {
              if (!oldData) return oldData;

              const updatedRequests = oldData.requests.map((r) =>
                r.id === updatedRequest.id ? { ...r, status: updatedRequest.status } : r
              );

              const pendingCount = updatedRequests.filter(
                (r) => r.status === "pending"
              ).length;

              return {
                requests: updatedRequests,
                pendingCount,
              };
            }
          );

          // Update "all" cache if it exists
          queryClient.setQueryData<FriendRequestsResponse>(
            ["friend-requests", "all"],
            (oldData) => {
              if (!oldData) return oldData;

              const updatedRequests = oldData.requests.map((r) =>
                r.id === updatedRequest.id ? { ...r, status: updatedRequest.status } : r
              );

              const pendingCount = updatedRequests.filter(
                (r) => r.status === "pending" && r.invitee_id === user.id
              ).length;

              return {
                requests: updatedRequests,
                pendingCount,
              };
            }
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "friend_requests",
          filter: `invitee_id=eq.${user.id}`,
        },
        (payload) => {
          const deletedRequest = payload.old as { id: string };

          // Remove from "received" cache
          queryClient.setQueryData<FriendRequestsResponse>(
            ["friend-requests", "received"],
            (oldData) => {
              if (!oldData) return oldData;

              const updatedRequests = oldData.requests.filter((r) => r.id !== deletedRequest.id);

              const pendingCount = updatedRequests.filter(
                (r) => r.status === "pending"
              ).length;

              return {
                requests: updatedRequests,
                pendingCount,
              };
            }
          );

          // Remove from "all" cache if it exists
          queryClient.setQueryData<FriendRequestsResponse>(
            ["friend-requests", "all"],
            (oldData) => {
              if (!oldData) return oldData;

              const updatedRequests = oldData.requests.filter((r) => r.id !== deletedRequest.id);

              const pendingCount = updatedRequests.filter(
                (r) => r.status === "pending" && r.invitee_id === user.id
              ).length;

              return {
                requests: updatedRequests,
                pendingCount,
              };
            }
          );
        }
      )
      .subscribe();

    channelRef.current = channel;

    // Cleanup on unmount
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [user?.id, supabase, queryClient]);

  return {
    pendingCount: getCachedPendingCount(),
  };
}
