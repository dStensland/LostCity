"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";

type RelationshipStatus =
  | "none"
  | "friends"
  | "following"
  | "followed_by"
  | "request_sent"
  | "request_received";

type FriendButtonProps = {
  targetUserId: string;
  targetUsername: string;
  initialRelationship?: RelationshipStatus;
  size?: "sm" | "md";
  className?: string;
  onRelationshipChange?: (newStatus: RelationshipStatus) => void;
};

export default function FriendButton({
  targetUserId,
  targetUsername,
  initialRelationship,
  size = "md",
  className = "",
  onRelationshipChange,
}: FriendButtonProps) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();

  const [relationship, setRelationship] = useState<RelationshipStatus>(
    initialRelationship || "none"
  );
  const [loading, setLoading] = useState(!initialRelationship);
  const [actionLoading, setActionLoading] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);

  // Fetch relationship status
  const fetchRelationship = useCallback(async () => {
    if (!user || user.id === targetUserId) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/users/${targetUsername}`);
      if (res.ok) {
        const data = await res.json();
        setRelationship(data.relationship || "none");
      }
    } catch (error) {
      console.error("Failed to fetch relationship:", error);
    } finally {
      setLoading(false);
    }
  }, [user, targetUserId, targetUsername]);

  // Fetch pending request ID if needed
  const fetchRequestId = useCallback(async () => {
    if (!user || (relationship !== "request_sent" && relationship !== "request_received")) {
      return;
    }

    try {
      const res = await fetch("/api/friend-requests?type=all");
      if (res.ok) {
        const data = await res.json();
        const request = data.requests?.find(
          (r: { inviter_id: string; invitee_id: string; status: string }) =>
            r.status === "pending" &&
            ((r.inviter_id === targetUserId && r.invitee_id === user.id) ||
              (r.inviter_id === user.id && r.invitee_id === targetUserId))
        );
        if (request) {
          setRequestId(request.id);
        }
      }
    } catch (error) {
      console.error("Failed to fetch request ID:", error);
    }
  }, [user, targetUserId, relationship]);

  useEffect(() => {
    if (!initialRelationship && !authLoading) {
      fetchRelationship();
    }
  }, [initialRelationship, authLoading, fetchRelationship]);

  useEffect(() => {
    fetchRequestId();
  }, [fetchRequestId]);

  // Don't show for own profile
  if (user?.id === targetUserId) {
    return null;
  }

  const handleSendRequest = async () => {
    if (!user) {
      router.push(`/auth/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    setActionLoading(true);

    try {
      const res = await fetch("/api/friend-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviter_id: targetUserId }),
      });

      const data = await res.json();

      if (res.ok) {
        if (data.accepted) {
          setRelationship("friends");
          showToast("You are now friends!");
          onRelationshipChange?.("friends");
        } else {
          setRelationship("request_sent");
          setRequestId(data.request?.id);
          showToast("Friend request sent");
          onRelationshipChange?.("request_sent");
        }
      } else {
        showToast(data.error || "Failed to send request", "error");
      }
    } catch {
      showToast("Failed to send request", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptRequest = async () => {
    if (!requestId) {
      showToast("Request not found", "error");
      return;
    }

    setActionLoading(true);

    try {
      const res = await fetch(`/api/friend-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept" }),
      });

      if (res.ok) {
        setRelationship("friends");
        showToast("Friend request accepted!");
        onRelationshipChange?.("friends");
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to accept", "error");
      }
    } catch {
      showToast("Failed to accept request", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeclineRequest = async () => {
    if (!requestId) {
      showToast("Request not found", "error");
      return;
    }

    setActionLoading(true);

    try {
      const res = await fetch(`/api/friend-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "decline" }),
      });

      if (res.ok) {
        setRelationship("none");
        setRequestId(null);
        showToast("Request declined");
        onRelationshipChange?.("none");
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to decline", "error");
      }
    } catch {
      showToast("Failed to decline request", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!requestId) {
      showToast("Request not found", "error");
      return;
    }

    setActionLoading(true);

    try {
      const res = await fetch(`/api/friend-requests/${requestId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setRelationship("none");
        setRequestId(null);
        showToast("Request cancelled");
        onRelationshipChange?.("none");
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to cancel", "error");
      }
    } catch {
      showToast("Failed to cancel request", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnfriend = async () => {
    if (!user) return;

    setActionLoading(true);

    try {
      // Delete the friendship via the unfriend API
      const res = await fetch("/api/friends/unfriend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId }),
      });

      if (!res.ok) {
        const data = await res.json();
        showToast(data.error || "Failed to unfriend", "error");
        return;
      }

      // After unfriending, check current follow status to determine new relationship
      // We might still be following them (following) or they might still be following us (followed_by)
      const followRes = await fetch(`/api/users/${targetUsername}`);
      if (followRes.ok) {
        const data = await followRes.json();
        const newRelationship = data.relationship || "none";
        setRelationship(newRelationship);
        onRelationshipChange?.(newRelationship);
      } else {
        // Fallback to "none" if we can't fetch the status
        setRelationship("none");
        onRelationshipChange?.("none");
      }

      showToast("Removed from friends");
    } catch {
      showToast("Failed to unfriend", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const sizeClasses = {
    sm: "px-3 py-1 text-xs",
    md: "px-4 py-1.5 text-sm",
  };

  if (loading || authLoading) {
    return (
      <div
        className={`${sizeClasses[size]} rounded-full bg-[var(--twilight)] animate-pulse ${className}`}
        style={{ width: size === "sm" ? 90 : 110 }}
      />
    );
  }

  // Not logged in - show Add Friend that redirects to login
  if (!user) {
    return (
      <button
        onClick={handleSendRequest}
        className={`font-mono font-medium rounded-full bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)] hover:bg-[var(--neon-cyan)]/30 transition-all ${sizeClasses[size]} ${className}`}
      >
        Add Friend
      </button>
    );
  }

  // Already friends
  if (relationship === "friends") {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <button
          onClick={handleUnfriend}
          disabled={actionLoading}
          className={`font-mono font-medium rounded-full bg-[var(--neon-green)]/20 text-[var(--neon-green)] hover:bg-[var(--coral)]/20 hover:text-[var(--coral)] transition-all disabled:opacity-50 ${sizeClasses[size]} flex items-center gap-1.5 group`}
          title="Click to unfriend"
        >
          {actionLoading ? (
            <span className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <svg className="w-3.5 h-3.5 group-hover:hidden" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              <svg className="w-3.5 h-3.5 hidden group-hover:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </>
          )}
          <span className="group-hover:hidden">Friends</span>
          <span className="hidden group-hover:inline">Unfriend</span>
        </button>
      </div>
    );
  }

  // Request sent by us
  if (relationship === "request_sent") {
    return (
      <button
        onClick={handleCancelRequest}
        disabled={actionLoading}
        className={`font-mono font-medium rounded-full bg-[var(--twilight)] text-[var(--muted)] hover:bg-[var(--coral)]/20 hover:text-[var(--coral)] transition-all disabled:opacity-50 ${sizeClasses[size]} ${className}`}
      >
        {actionLoading ? (
          <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          "Request Sent"
        )}
      </button>
    );
  }

  // Request received from them
  if (relationship === "request_received") {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <button
          onClick={handleAcceptRequest}
          disabled={actionLoading}
          className={`font-mono font-medium rounded-full bg-[var(--coral)] text-[var(--void)] hover:bg-[var(--rose)] transition-all disabled:opacity-50 ${sizeClasses[size]}`}
        >
          {actionLoading ? "..." : "Accept"}
        </button>
        <button
          onClick={handleDeclineRequest}
          disabled={actionLoading}
          className={`font-mono font-medium rounded-full bg-transparent border border-[var(--muted)] text-[var(--muted)] hover:bg-[var(--muted)]/10 transition-all disabled:opacity-50 ${sizeClasses[size]}`}
        >
          Decline
        </button>
      </div>
    );
  }

  // No relationship or just following - show Add Friend
  return (
    <button
      onClick={handleSendRequest}
      disabled={actionLoading}
      className={`font-mono font-medium rounded-full bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)] hover:bg-[var(--neon-cyan)]/30 transition-all disabled:opacity-50 ${sizeClasses[size]} ${className}`}
    >
      {actionLoading ? (
        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        "Add Friend"
      )}
    </button>
  );
}
