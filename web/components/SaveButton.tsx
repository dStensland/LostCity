"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";

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
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();

  const [isSaved, setIsSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Load existing saved state via API
  useEffect(() => {
    async function loadSavedState() {
      if (authLoading) return;

      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const params = new URLSearchParams();
        if (eventId) params.set("event_id", eventId.toString());
        if (venueId) params.set("venue_id", venueId.toString());

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(`/api/saved?${params}`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          const { saved } = await response.json();
          setIsSaved(saved);
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("Failed to load saved state:", err);
        }
      } finally {
        setLoading(false);
      }
    }

    loadSavedState();
  }, [user, authLoading, eventId, venueId]);

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      router.push(`/auth/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    setActionLoading(true);
    const previousState = isSaved;

    // Trigger pop animation
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 200);

    // Optimistic update
    setIsSaved(!isSaved);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      let response: Response;

      if (previousState) {
        // Remove saved item
        const params = new URLSearchParams();
        if (eventId) params.set("event_id", eventId.toString());
        if (venueId) params.set("venue_id", venueId.toString());

        response = await fetch(`/api/saved?${params}`, {
          method: "DELETE",
          signal: controller.signal,
        });
      } else {
        // Add saved item
        response = await fetch("/api/saved", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event_id: eventId,
            venue_id: venueId,
          }),
          signal: controller.signal,
        });
      }

      clearTimeout(timeoutId);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save");
      }

      // Show success toast
      showToast(previousState ? "Removed from saved" : "Saved for later");
    } catch (error) {
      // Rollback on error
      setIsSaved(previousState);

      let message = "Failed to save. Please try again.";
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          message = "Request timed out. Please try again.";
        } else if (error.message) {
          message = error.message;
        }
      }

      showToast(message, "error");
      console.error("Failed to update saved state:", error);
    } finally {
      setActionLoading(false);
    }
  };

  // Ensure minimum 44px touch target for accessibility
  const sizeClasses = {
    sm: "p-2.5", // 10px padding + 20px icon = 40px, close to 44px minimum
    md: "p-3",   // 12px padding + 20px icon = 44px
  };

  const iconSizes = {
    sm: "w-5 h-5",
    md: "w-5 h-5",
  };

  if (loading) {
    return (
      <div
        className={`${sizeClasses[size]} rounded-lg bg-[var(--twilight)] animate-pulse ${className}`}
        style={{ width: size === "sm" ? 40 : 44, height: size === "sm" ? 40 : 44 }}
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
          className={`${iconSizes[size]} transition-transform duration-200 ${isAnimating ? "scale-125" : "scale-100"}`}
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
