"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";

type FollowButtonProps = {
  targetUserId?: string;
  targetVenueId?: number;
  targetOrgId?: string;
  targetProducerId?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

export default function FollowButton({
  targetUserId,
  targetVenueId,
  targetOrgId,
  targetProducerId,
  size = "md",
  className = "",
}: FollowButtonProps) {
  const router = useRouter();
  const { user } = useAuth();
  const supabase = createClient();
  const { showToast } = useToast();

  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Check if already following
  useEffect(() => {
    async function checkFollowStatus() {
      if (!user) {
        setLoading(false);
        return;
      }

      let query = supabase
        .from("follows")
        .select("id")
        .eq("follower_id", user.id);

      if (targetUserId) {
        query = query.eq("followed_user_id", targetUserId);
      } else if (targetVenueId) {
        query = query.eq("followed_venue_id", targetVenueId);
      } else if (targetOrgId) {
        query = query.eq("followed_org_id", targetOrgId);
      } else if (targetProducerId) {
        query = query.eq("followed_producer_id", targetProducerId);
      }

      const { data } = await query.single();
      setIsFollowing(!!data);
      setLoading(false);
    }

    checkFollowStatus();
  }, [user, targetUserId, targetVenueId, targetOrgId, targetProducerId, supabase]);

  // Don't show follow button for own profile
  if (targetUserId && user?.id === targetUserId) {
    return null;
  }

  const handleClick = async () => {
    if (!user) {
      // Redirect to login
      const currentPath = window.location.pathname;
      router.push(`/auth/login?redirect=${encodeURIComponent(currentPath)}`);
      return;
    }

    setActionLoading(true);

    // Trigger pop animation
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 150);

    if (isFollowing) {
      // Unfollow
      let query = supabase
        .from("follows")
        .delete()
        .eq("follower_id", user.id);

      if (targetUserId) {
        query = query.eq("followed_user_id", targetUserId);
      } else if (targetVenueId) {
        query = query.eq("followed_venue_id", targetVenueId);
      } else if (targetOrgId) {
        query = query.eq("followed_org_id", targetOrgId);
      } else if (targetProducerId) {
        query = query.eq("followed_producer_id", targetProducerId);
      }

      const { error } = await query;

      if (!error) {
        setIsFollowing(false);
        showToast("Unfollowed");
      } else {
        showToast("Failed to unfollow", "error");
      }
    } else {
      // Follow
      const followData: Record<string, unknown> = {
        follower_id: user.id,
      };

      if (targetUserId) {
        followData.followed_user_id = targetUserId;
      } else if (targetVenueId) {
        followData.followed_venue_id = targetVenueId;
      } else if (targetOrgId) {
        followData.followed_org_id = targetOrgId;
      } else if (targetProducerId) {
        followData.followed_producer_id = targetProducerId;
      }

      const { error } = await supabase
        .from("follows")
        .insert(followData as never);

      if (!error) {
        setIsFollowing(true);
        showToast("Following");
      } else {
        showToast("Failed to follow", "error");
      }
    }

    setActionLoading(false);
  };

  const sizeClasses = {
    sm: "px-3 py-1 text-xs",
    md: "px-4 py-1.5 text-sm",
    lg: "px-6 py-3 text-base",
  };

  if (loading) {
    return (
      <div
        className={`${sizeClasses[size]} rounded-full bg-[var(--twilight)] animate-pulse ${className}`}
        style={{ width: size === "sm" ? 70 : size === "lg" ? "100%" : 85 }}
      />
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={actionLoading}
      className={`font-mono font-medium rounded-full transition-all duration-150 disabled:opacity-50 ${sizeClasses[size]} ${
        isFollowing
          ? "bg-[var(--twilight)] text-[var(--cream)] hover:bg-[var(--coral)] hover:text-[var(--void)]"
          : "bg-[var(--coral)] text-[var(--void)] hover:bg-[var(--rose)]"
      } ${isAnimating ? "scale-95" : "scale-100"} ${className}`}
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
