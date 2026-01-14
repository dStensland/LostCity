"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";

type FollowButtonProps = {
  targetUserId?: string;
  targetVenueId?: number;
  targetOrgId?: number;
  size?: "sm" | "md";
  className?: string;
};

export default function FollowButton({
  targetUserId,
  targetVenueId,
  targetOrgId,
  size = "md",
  className = "",
}: FollowButtonProps) {
  const router = useRouter();
  const { user } = useAuth();
  const supabase = createClient();

  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

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
      }

      const { data } = await query.single();
      setIsFollowing(!!data);
      setLoading(false);
    }

    checkFollowStatus();
  }, [user, targetUserId, targetVenueId, targetOrgId, supabase]);

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
      }

      const { error } = await query;

      if (!error) {
        setIsFollowing(false);
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
      }

      const { error } = await supabase
        .from("follows")
        .insert(followData as never);

      if (!error) {
        setIsFollowing(true);
      }
    }

    setActionLoading(false);
  };

  const sizeClasses = {
    sm: "px-3 py-1 text-xs",
    md: "px-4 py-1.5 text-sm",
  };

  if (loading) {
    return (
      <div
        className={`${sizeClasses[size]} rounded-full bg-[var(--twilight)] animate-pulse ${className}`}
        style={{ width: size === "sm" ? 70 : 85 }}
      />
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={actionLoading}
      className={`font-mono font-medium rounded-full transition-colors disabled:opacity-50 ${sizeClasses[size]} ${
        isFollowing
          ? "bg-[var(--twilight)] text-[var(--cream)] hover:bg-[var(--coral)] hover:text-[var(--void)]"
          : "bg-[var(--coral)] text-[var(--void)] hover:bg-[var(--rose)]"
      } ${className}`}
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
