"use client";

import Link from "next/link";
import UserAvatar from "@/components/UserAvatar";
import { useToast } from "@/components/Toast";
import { formatDistanceToNow } from "date-fns";

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
  onRequestHandled: () => void;
}

export function PendingRequests({ requests, onRequestHandled }: PendingRequestsProps) {
  const { showToast } = useToast();

  const handleAcceptRequest = async (requestId: string) => {
    try {
      const res = await fetch(`/api/friend-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept" }),
      });

      if (res.ok) {
        showToast("Friend request accepted!");
        onRequestHandled();
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to accept", "error");
      }
    } catch {
      showToast("Failed to accept request", "error");
    }
  };

  const handleDeclineRequest = async (requestId: string) => {
    try {
      const res = await fetch(`/api/friend-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "decline" }),
      });

      if (res.ok) {
        showToast("Request declined");
        onRequestHandled();
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to decline", "error");
      }
    } catch {
      showToast("Failed to decline request", "error");
    }
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
              className="flex items-center gap-4 p-4 bg-[var(--dusk)] border border-[var(--coral)]/30 rounded-lg"
            >
              <Link href={`/profile/${otherUser.username}`}>
                <UserAvatar
                  src={otherUser.avatar_url}
                  name={otherUser.display_name || otherUser.username}
                  size="md"
                  glow
                />
              </Link>

              <div className="flex-1 min-w-0">
                <Link
                  href={`/profile/${otherUser.username}`}
                  className="font-medium text-[var(--cream)] hover:text-[var(--coral)] transition-colors block truncate"
                >
                  {otherUser.display_name || `@${otherUser.username}`}
                </Link>
                <p className="text-xs text-[var(--muted)]">
                  {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleAcceptRequest(request.id)}
                  className="px-3 py-1.5 bg-[var(--coral)] text-[var(--void)] rounded-lg text-xs font-mono font-medium hover:bg-[var(--rose)] transition-colors min-h-[36px]"
                >
                  Accept
                </button>
                <button
                  onClick={() => handleDeclineRequest(request.id)}
                  className="px-3 py-1.5 bg-transparent border border-[var(--muted)] text-[var(--muted)] rounded-lg text-xs font-mono font-medium hover:bg-[var(--muted)]/10 transition-colors min-h-[36px]"
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
