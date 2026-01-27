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
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();
  const { showToast } = useToast();

  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Safety timeout - ensure loading never stays true forever
  useEffect(() => {
    const safetyTimeout = setTimeout(() => {
      setLoading(false);
    }, 5000);
    return () => clearTimeout(safetyTimeout);
  }, []);

  // Check if already following
  useEffect(() => {
    let cancelled = false;

    async function checkFollowStatus() {
      // Quick exit if auth still loading - we'll re-run when it's done
      if (authLoading) {
        return;
      }

      if (!user) {
        setLoading(false);
        return;
      }

      // Ensure we have a valid target
      if (!targetUserId && !targetVenueId && !targetOrgId && !targetProducerId) {
        setLoading(false);
        return;
      }

      try {
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

        // Race the query against a timeout
        const result = await Promise.race([
          query.maybeSingle(),
          new Promise<{ data: null; error: { message: string } }>((resolve) =>
            setTimeout(() => resolve({ data: null, error: { message: "Query timeout" } }), 3000)
          ),
        ]);

        if (cancelled) return;

        if (result.error) {
          console.error("Error checking follow status:", result.error);
        }

        setIsFollowing(!!result.data);
      } catch (err) {
        console.error("Exception checking follow status:", err);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- supabase client is stable
  }, [user, authLoading, targetUserId, targetVenueId, targetOrgId, targetProducerId]);

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

    try {
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
          console.error("Unfollow error:", error);
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

        const { error } = await supabase.from("follows").insert(followData as never);

        if (!error) {
          setIsFollowing(true);
          showToast("Following");
        } else {
          console.error("Follow error:", error);
          showToast("Failed to follow", "error");
        }
      }
    } catch (err) {
      console.error("Follow action error:", err);
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
