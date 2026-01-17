"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

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
  inviter?: Profile | null;
  invitee?: Profile | null;
};

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

  const getInitials = (name: string | null, username: string) => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return username.slice(0, 2).toUpperCase();
  };

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
      {/* Avatar */}
      <Link href={`/profile/${otherUser.username}`}>
        {otherUser.avatar_url ? (
          <Image
            src={otherUser.avatar_url}
            alt={otherUser.display_name || otherUser.username}
            width={48}
            height={48}
            className="w-12 h-12 rounded-full object-cover"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-[var(--coral)] flex items-center justify-center text-[var(--night)] font-bold">
            {getInitials(otherUser.display_name, otherUser.username)}
          </div>
        )}
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
        {error && <p className="text-sm text-red-400 mt-1">{error}</p>}
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
                className="px-4 py-2 bg-transparent border border-[var(--muted)] text-[var(--muted)] rounded-lg text-sm font-medium hover:bg-[var(--muted)]/10 disabled:opacity-50 transition-colors"
              >
                {actionLoading === "decline" ? "..." : "Decline"}
              </button>
            </>
          ) : (
            <button
              onClick={handleCancel}
              disabled={!!actionLoading}
              className="px-4 py-2 bg-transparent border border-[var(--clay)] text-[var(--clay)] rounded text-sm font-medium hover:bg-[var(--clay)]/10 disabled:opacity-50"
            >
              {actionLoading === "cancel" ? "..." : "Cancel"}
            </button>
          )}
        </div>
      )}

      {request.status === "accepted" && (
        <span className="text-sm text-green-400">Friends</span>
      )}

      {request.status === "declined" && (
        <span className="text-sm text-[var(--muted)]">Declined</span>
      )}
    </div>
  );
}
