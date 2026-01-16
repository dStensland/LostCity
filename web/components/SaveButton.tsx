"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";

type SaveButtonProps = {
  eventId?: number;
  venueId?: number;
  size?: "sm" | "md";
  className?: string;
  showLabel?: boolean;
};

export default function SaveButton({
  eventId,
  venueId,
  size = "md",
  className = "",
  showLabel = false,
}: SaveButtonProps) {
  const router = useRouter();
  const { user } = useAuth();
  const supabase = createClient();

  const [isSaved, setIsSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Load existing saved state
  useEffect(() => {
    async function loadSavedState() {
      if (!user) {
        setLoading(false);
        return;
      }

      let query = supabase
        .from("saved_items")
        .select("id")
        .eq("user_id", user.id);

      if (eventId) {
        query = query.eq("event_id", eventId);
      } else if (venueId) {
        query = query.eq("venue_id", venueId);
      }

      const { data } = await query.maybeSingle();
      setIsSaved(!!data);
      setLoading(false);
    }

    loadSavedState();
  }, [user, eventId, venueId, supabase]);

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      router.push(`/auth/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    setActionLoading(true);

    if (isSaved) {
      // Remove saved item
      let query = supabase
        .from("saved_items")
        .delete()
        .eq("user_id", user.id);

      if (eventId) {
        query = query.eq("event_id", eventId);
      } else if (venueId) {
        query = query.eq("venue_id", venueId);
      }

      await query;
      setIsSaved(false);
    } else {
      // Add saved item
      const insertData: { user_id: string; event_id?: number; venue_id?: number } = {
        user_id: user.id,
      };

      if (eventId) {
        insertData.event_id = eventId;
      } else if (venueId) {
        insertData.venue_id = venueId;
      }

      await supabase.from("saved_items").insert(insertData as never);
      setIsSaved(true);
    }

    setActionLoading(false);
  };

  const sizeClasses = {
    sm: "p-1.5",
    md: "p-2",
  };

  const iconSizes = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
  };

  if (loading) {
    return (
      <div
        className={`${sizeClasses[size]} rounded-lg bg-[var(--twilight)] animate-pulse ${className}`}
        style={{ width: size === "sm" ? 28 : 36, height: size === "sm" ? 28 : 36 }}
      />
    );
  }

  return (
    <button
      onClick={handleToggle}
      disabled={actionLoading}
      className={`${sizeClasses[size]} rounded-lg transition-all ${
        isSaved
          ? "text-[var(--gold)] hover:text-[var(--coral)]"
          : "text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]"
      } ${className} ${showLabel ? "flex items-center gap-1.5" : ""}`}
      title={isSaved ? "Remove from saved" : "Save for later"}
      aria-label={isSaved ? "Remove from saved" : "Save for later"}
    >
      {actionLoading ? (
        <span className={`inline-block ${iconSizes[size]} border-2 border-current border-t-transparent rounded-full animate-spin`} />
      ) : (
        <svg
          className={iconSizes[size]}
          fill={isSaved ? "currentColor" : "none"}
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
          />
        </svg>
      )}
      {showLabel && (
        <span className="font-mono text-xs font-medium">
          {isSaved ? "Saved" : "Save"}
        </span>
      )}
    </button>
  );
}
