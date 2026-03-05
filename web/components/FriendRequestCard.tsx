"use client";

import { useState } from "react";
import Link from "next/link";
import UserAvatar from "@/components/UserAvatar";
import type { FriendRequest } from "@/lib/types/profile";

type FriendRequestCardProps = {
  request: FriendRequest;
  currentUserId: string;
  onAccept?: () => void;
  onDecline?: () => void;
  onCancel?: () => void;
};

export default function FriendRequestCard({
  request,
  currentUserId,
  onAccept,
  onDecline,
  onCancel,
}: FriendRequestCardProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isReceived = request.invitee_id === currentUserId;
  const otherUser = isReceived ? request.inviter : request.invitee;

  if (!otherUser) return null;

  const handleAccept = async () => {
    setActionLoading("accept");
    setError(null);

    try {
      const response = await fetch(`/api/friend-requests/${request.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept" }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Failed to accept");
        setActionLoading(null);
        return;
      }

      onAccept?.();
    } catch {
      setError("Failed to accept");
    }
    setActionLoading(null);
  };

  const handleDecline = async () => {
    setActionLoading("decline");
    setError(null);

    try {
      const response = await fetch(`/api/friend-requests/${request.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "decline" }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Failed to decline");
        setActionLoading(null);
        return;
      }

      onDecline?.();
    } catch {
      setError("Failed to decline");
    }
    setActionLoading(null);
  };

  const handleCancel = async () => {
    setActionLoading("cancel");
    setError(null);

    try {
      const response = await fetch(`/api/friend-requests/${request.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Failed to cancel");
        setActionLoading(null);
        return;
      }

      onCancel?.();
    } catch {
      setError("Failed to cancel");
    }
    setActionLoading(null);
  };

  return (
    <div className="flex items-center gap-4 p-4 bg-[var(--dusk)] rounded-lg">
      <Link href={`/profile/${otherUser.username}`}>
        <UserAvatar
          src={otherUser.avatar_url}
          name={otherUser.display_name || otherUser.username}
          size="lg"
        />
      </Link>

      {/* User Info */}
      <div className="flex-1 min-w-0">
        <Link
          href={`/profile/${otherUser.username}`}
          className="font-medium text-[var(--cream)] hover:underline block truncate"
        >
          {otherUser.display_name || `@${otherUser.username}`}
        </Link>
        <p className="text-sm text-[var(--muted)] truncate">
          @{otherUser.username}
        </p>
        {error && <p className="text-sm text-[var(--neon-red)] mt-1">{error}</p>}
      </div>

      {/* Actions */}
      {request.status === "pending" && (
        <div className="flex gap-2">
          {isReceived ? (
            <>
              <button
                onClick={handleAccept}
                disabled={!!actionLoading}
                className="px-4 py-2 bg-[var(--coral)] text-[var(--void)] rounded-lg text-sm font-medium hover:bg-[var(--rose)] disabled:opacity-50 transition-colors"
              >
                {actionLoading === "accept" ? "..." : "Accept"}
              </button>
              <button
                onClick={handleDecline}
                disabled={!!actionLoading}
                className="px-4 py-2 bg-transparent border border-[var(--twilight)] text-[var(--muted)] rounded-lg text-sm font-medium hover:bg-[var(--twilight)]/10 disabled:opacity-50 transition-colors"
              >
                {actionLoading === "decline" ? "..." : "Decline"}
              </button>
            </>
          ) : (
            <button
              onClick={handleCancel}
              disabled={!!actionLoading}
              className="px-4 py-2 bg-transparent border border-[var(--twilight)] text-[var(--muted)] rounded text-sm font-medium hover:bg-[var(--twilight)]/10 disabled:opacity-50"
            >
              {actionLoading === "cancel" ? "..." : "Cancel"}
            </button>
          )}
        </div>
      )}

      {request.status === "accepted" && (
        <span className="text-sm text-[var(--neon-green)]">Friends</span>
      )}

      {request.status === "declined" && (
        <span className="text-sm text-[var(--muted)]">Declined</span>
      )}
    </div>
  );
}
