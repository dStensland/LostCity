"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import UserAvatar from "@/components/UserAvatar";
import { useToast } from "@/components/Toast";
import { formatDistanceToNow } from "date-fns";
import { useRealtimeFriendRequests } from "@/lib/hooks/useRealtimeFriendRequests";

export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
};

export type FriendRequest = {
  id: string;
  inviter_id: string;
  invitee_id: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
  inviter?: Profile | null;
};

interface PendingRequestsProps {
  requests: FriendRequest[];
}

type FriendRequestsResponse = {
  requests: FriendRequest[];
  pendingCount: number;
};

export function PendingRequests({ requests }: PendingRequestsProps) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  // Enable real-time updates
  useRealtimeFriendRequests();

  const acceptMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const res = await fetch(`/api/friend-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept" }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to accept");
      }

      return res.json();
    },
    onMutate: async (requestId) => {
      await queryClient.cancelQueries({ queryKey: ["friend-requests"] });

      const previousData = queryClient.getQueryData<FriendRequestsResponse>([
        "friend-requests",
        "received",
      ]);

      queryClient.setQueryData<FriendRequestsResponse>(
        ["friend-requests", "received"],
        (oldData) => {
          if (!oldData) return oldData;

          const updatedRequests = oldData.requests.map((r) =>
            r.id === requestId ? { ...r, status: "accepted" as const } : r
          );

          const pendingCount = updatedRequests.filter((r) => r.status === "pending").length;

          return {
            requests: updatedRequests,
            pendingCount,
          };
        }
      );

      return { previousData };
    },
    onSuccess: () => {
      showToast("Friend request accepted!");
    },
    onError: (error, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(["friend-requests", "received"], context.previousData);
      }
      showToast(error instanceof Error ? error.message : "Failed to accept", "error");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["friend-requests"] });
    },
  });

  const declineMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const res = await fetch(`/api/friend-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "decline" }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to decline");
      }

      return res.json();
    },
    onMutate: async (requestId) => {
      await queryClient.cancelQueries({ queryKey: ["friend-requests"] });

      const previousData = queryClient.getQueryData<FriendRequestsResponse>([
        "friend-requests",
        "received",
      ]);

      queryClient.setQueryData<FriendRequestsResponse>(
        ["friend-requests", "received"],
        (oldData) => {
          if (!oldData) return oldData;

          const updatedRequests = oldData.requests.map((r) =>
            r.id === requestId ? { ...r, status: "declined" as const } : r
          );

          const pendingCount = updatedRequests.filter((r) => r.status === "pending").length;

          return {
            requests: updatedRequests,
            pendingCount,
          };
        }
      );

      return { previousData };
    },
    onSuccess: () => {
      showToast("Request declined");
    },
    onError: (error, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(["friend-requests", "received"], context.previousData);
      }
      showToast(error instanceof Error ? error.message : "Failed to decline", "error");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["friend-requests"] });
    },
  });

  const handleAcceptRequest = (requestId: string) => {
    acceptMutation.mutate(requestId);
  };

  const handleDeclineRequest = (requestId: string) => {
    declineMutation.mutate(requestId);
  };

  if (requests.length === 0) {
    return null;
  }

  return (
    <section>
      <h2 className="font-mono text-sm font-medium text-[var(--cream)] uppercase tracking-wider mb-4">
        Friend Requests ({requests.length})
      </h2>
      <div className="space-y-3">
        {requests.map((request) => {
          const otherUser = request.inviter;
          if (!otherUser) return null;

          return (
            <div
              key={request.id}
              className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 p-4 bg-[var(--dusk)] border border-[var(--coral)]/30 rounded-lg"
            >
              <Link href={`/profile/${otherUser.username}`} className="flex-shrink-0">
                <UserAvatar
                  src={otherUser.avatar_url}
                  name={otherUser.display_name || otherUser.username}
                  size="md"
                  glow
                />
              </Link>

              <div className="flex-1 min-w-0 w-full sm:w-auto">
                <Link
                  href={`/profile/${otherUser.username}`}
                  className="font-medium text-[var(--cream)] hover:text-[var(--coral)] transition-colors block truncate"
                >
                  {otherUser.display_name || `@${otherUser.username}`}
                </Link>
                <p className="text-xs text-[var(--muted)] truncate">
                  {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <button
                  onClick={() => handleAcceptRequest(request.id)}
                  className="px-3 py-1.5 bg-[var(--coral)] text-[var(--void)] rounded-lg text-xs font-mono font-medium hover:bg-[var(--rose)] transition-colors min-h-[36px] w-full sm:w-auto"
                >
                  Accept
                </button>
                <button
                  onClick={() => handleDeclineRequest(request.id)}
                  className="px-3 py-1.5 bg-transparent border border-[var(--muted)] text-[var(--muted)] rounded-lg text-xs font-mono font-medium hover:bg-[var(--muted)]/10 transition-colors min-h-[36px] w-full sm:w-auto"
                >
                  Decline
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export type { PendingRequestsProps };
