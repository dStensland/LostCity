"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";

type FollowButtonProps = {
  targetUserId?: string;
  targetVenueId?: number;
  targetOrgId?: string;
  targetProducerId?: string;
  initialIsFollowing?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
};

export default function FollowButton({
  targetUserId,
  targetVenueId,
  targetOrgId,
  targetProducerId,
  initialIsFollowing,
  size = "md",
  className = "",
}: FollowButtonProps) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();

  const [isFollowing, setIsFollowing] = useState(initialIsFollowing ?? false);
  const [loading, setLoading] = useState(initialIsFollowing === undefined);
  const [actionLoading, setActionLoading] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Check if already following via API (skip if initialIsFollowing provided)
  useEffect(() => {
    // Skip API call if initial value was provided
    if (initialIsFollowing !== undefined) {
      return;
    }

    let cancelled = false;

    async function checkFollowStatus() {
      // Wait for auth to finish
      if (authLoading) {
        return;
      }

      // Not logged in - show button as not following
      if (!user) {
        setLoading(false);
        return;
      }

      // No valid target
      if (!targetUserId && !targetVenueId && !targetOrgId && !targetProducerId) {
        setLoading(false);
        return;
      }

      try {
        const params = new URLSearchParams();
        if (targetUserId) params.set("userId", targetUserId);
        else if (targetVenueId) params.set("venueId", targetVenueId.toString());
        else if (targetProducerId) params.set("producerId", targetProducerId);
        // Note: targetOrgId uses same column as producerId in some cases

        const res = await fetch(`/api/follow?${params.toString()}`);
        const data = await res.json();

        if (!cancelled) {
          setIsFollowing(data.isFollowing || false);
        }
      } catch (err) {
        console.error("Error checking follow status:", err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    checkFollowStatus();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading, targetUserId, targetVenueId, targetOrgId, targetProducerId, initialIsFollowing]);

  // Don't show follow button for own profile
  if (targetUserId && user?.id === targetUserId) {
    return null;
  }

  const handleClick = async () => {
    if (!user) {
      const currentPath = window.location.pathname;
      router.push(`/auth/login?redirect=${encodeURIComponent(currentPath)}`);
      return;
    }

    setActionLoading(true);
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 150);

    try {
      const res = await fetch("/api/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId,
          targetVenueId,
          targetProducerId,
          action: isFollowing ? "unfollow" : "follow",
        }),
      });

      const data = await res.json();

      if (data.success) {
        setIsFollowing(data.isFollowing);
        showToast(data.isFollowing ? "Following" : "Unfollowed");
      } else {
        console.error("Follow action error:", data.error);
        showToast("Something went wrong", "error");
      }
    } catch (err) {
      console.error("Follow action exception:", err);
      showToast("Something went wrong", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const sizeClasses = {
    sm: "px-3 py-1 text-xs",
    md: "px-4 py-1.5 text-sm",
    lg: "px-6 py-3 text-base",
  };

  const isDisabled = loading || actionLoading;

  return (
    <button
      onClick={handleClick}
      disabled={isDisabled}
      className={`font-mono font-medium rounded-full transition-all duration-150 ${sizeClasses[size]} ${
        isFollowing
          ? "bg-[var(--twilight)] text-[var(--cream)] hover:bg-[var(--coral)] hover:text-[var(--void)]"
          : "bg-[var(--coral)] text-[var(--void)] hover:bg-[var(--rose)]"
      } ${isDisabled ? "opacity-50 cursor-not-allowed" : ""} ${isAnimating ? "scale-95" : "scale-100"} ${className}`}
    >
      {actionLoading ? (
        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : isFollowing ? (
        "Following"
      ) : (
        "Follow"
      )}
    </button>
  );
}
