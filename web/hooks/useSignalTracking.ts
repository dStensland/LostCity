"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth-context";

type ActionType = "view" | "save" | "share" | "rsvp_going" | "rsvp_interested" | "went";

/**
 * Track a signal manually
 */
export async function trackSignal(eventId: number, action: ActionType): Promise<boolean> {
  try {
    const res = await fetch("/api/signals/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_id: eventId, action }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Hook to track event views with a minimum dwell time
 * Only tracks once per page load, only for authenticated users
 */
export function useViewTracking(eventId: number, minDwellMs: number = 2000) {
  const { user } = useAuth();
  const trackedRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    // Don't track if not logged in or already tracked
    if (!user || trackedRef.current) {
      return;
    }

    // Set timer to track after minimum dwell time
    timerRef.current = setTimeout(() => {
      if (!trackedRef.current) {
        trackedRef.current = true;
        trackSignal(eventId, "view").catch(() => {
          // Silent failure - tracking is non-critical
        });
      }
    }, minDwellMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [eventId, user, minDwellMs]);
}

/**
 * Hook to track shares with navigator.share or clipboard copy
 */
export function useShareTracking(eventId: number) {
  const { user } = useAuth();

  const trackShare = async () => {
    if (!user) return;
    await trackSignal(eventId, "share");
  };

  return { trackShare };
}
