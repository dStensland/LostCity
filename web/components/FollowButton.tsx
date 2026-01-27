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

  // Check if already following
  useEffect(() => {
    let cancelled = false;
    let timeoutId: NodeJS.Timeout;

    async function checkFollowStatus() {
      // Wait for auth to finish loading, but with a timeout
      if (authLoading) {
        // Set a timeout - if auth takes longer than 5s, stop loading anyway
        timeoutId = setTimeout(() => {
          if (!cancelled) {
            setLoading(false);
          }
        }, 5000);
        return;
      }

      // Clear any pending timeout since auth is done
      if (timeoutId) {
        clearTimeout(timeoutId);
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

        const { data, error } = await query.maybeSingle();

        if (cancelled) return;

        if (error) {
          console.error("Error checking follow status:", error);
        }

        setIsFollowing(!!data);
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
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
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

    // Timeout wrapper to prevent indefinite hangs
    const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> => {
      return Promise.race([
        promise,
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error("Request timeout")), ms)
        ),
      ]);
    };

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

        const { error } = await withTimeout(query, 8000);

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

        const { error } = await withTimeout(
          supabase.from("follows").insert(followData as never),
          8000
        );

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
      if (err instanceof Error && err.message === "Request timeout") {
        showToast("Request timed out - please try again", "error");
      } else {
        showToast("Something went wrong", "error");
      }
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
