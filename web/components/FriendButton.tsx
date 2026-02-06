"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";
import { useFriendship, type RelationshipStatus } from "@/lib/hooks/useFriendship";
import { useEffect } from "react";

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
  size = "md",
  className = "",
  onRelationshipChange,
}: FriendButtonProps) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();

  const {
    relationship,
    isLoading,
    isActionLoading,
    sendRequest,
    acceptRequest,
    declineRequest,
    cancelRequest,
    unfriend,
  } = useFriendship(targetUserId, targetUsername);

  // Notify parent component of relationship changes
  useEffect(() => {
    if (relationship !== "none") {
      onRelationshipChange?.(relationship);
    }
  }, [relationship, onRelationshipChange]);

  // Don't show for own profile
  if (user?.id === targetUserId) {
    return null;
  }

  const handleSendRequest = () => {
    if (!user) {
      router.push(`/auth/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    try {
      sendRequest();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to send request", "error");
    }
  };

  const handleAcceptRequest = () => {
    try {
      acceptRequest();
      showToast("Friend request accepted!");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to accept", "error");
    }
  };

  const handleDeclineRequest = () => {
    try {
      declineRequest();
      showToast("Request declined");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to decline", "error");
    }
  };

  const handleCancelRequest = () => {
    try {
      cancelRequest();
      showToast("Request cancelled");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to cancel", "error");
    }
  };

  const handleUnfriend = () => {
    if (!user) return;

    try {
      unfriend();
      showToast("Removed from friends");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to unfriend", "error");
    }
  };

  const sizeClasses = {
    sm: "px-3 py-1 text-xs",
    md: "px-4 py-1.5 text-sm",
  };
  const skeletonWidthClasses = {
    sm: "w-[90px]",
    md: "w-[110px]",
  };

  if (isLoading || authLoading) {
    return (
      <div
        className={`${sizeClasses[size]} ${skeletonWidthClasses[size]} rounded-full bg-[var(--twilight)] animate-pulse ${className}`}
      />
    );
  }

  // Not logged in - show Add Friend that redirects to login
  if (!user) {
    return (
      <button
        onClick={handleSendRequest}
        className={`btn-accent btn-pill active:scale-[0.98] ${sizeClasses[size]} ${className}`}
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
          disabled={isActionLoading}
          className={`btn-success btn-pill active:scale-[0.98] hover:bg-[var(--coral)]/20 hover:text-[var(--coral)] hover:border-[var(--coral)]/30 ${sizeClasses[size]} flex items-center gap-1.5 group`}
          title="Click to unfriend"
        >
          {isActionLoading ? (
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
        disabled={isActionLoading}
        className={`btn-secondary btn-pill active:scale-[0.98] hover:bg-[var(--coral)]/20 hover:text-[var(--coral)] hover:border-[var(--coral)]/30 ${sizeClasses[size]} ${className}`}
      >
        {isActionLoading ? (
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
          disabled={isActionLoading}
          className={`btn-primary btn-pill active:scale-[0.98] ${sizeClasses[size]}`}
        >
          {isActionLoading ? "..." : "Accept"}
        </button>
        <button
          onClick={handleDeclineRequest}
          disabled={isActionLoading}
          className={`btn-secondary btn-pill active:scale-[0.98] ${sizeClasses[size]}`}
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
      disabled={isActionLoading}
      className={`btn-accent btn-pill active:scale-[0.98] ${sizeClasses[size]} ${className}`}
    >
      {isActionLoading ? (
        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        "Add Friend"
      )}
    </button>
  );
}
