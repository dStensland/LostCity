"use client";

import { useState, useEffect, useCallback } from "react";
import type { FeedSectionData } from "./FeedSection";
import type { MomentsResponse } from "@/lib/moments-utils";

export interface CuratedFeedData {
  sections: FeedSectionData[];
  moments: MomentsResponse | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Fetches /api/portals/{slug}/feed and /api/moments in parallel,
 * providing a single source of truth for CuratedContent's children.
 * Eliminates 3 redundant API calls (2x feed, 1x moments).
 */
export function useCuratedFeedData(portalSlug: string): CuratedFeedData {
  const [sections, setSections] = useState<FeedSectionData[]>([]);
  const [moments, setMoments] = useState<MomentsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal: AbortSignal) => {
    try {
      setError(null);
      setLoading(true);

      const [feedRes, momentsRes] = await Promise.all([
        fetch(`/api/portals/${portalSlug}/feed`, { signal }),
        fetch(`/api/moments?portal=${portalSlug}`, { signal }),
      ]);

      if (!signal.aborted) {
        if (feedRes.ok) {
          const feedData = await feedRes.json();
          setSections(feedData.sections || []);
        } else {
          setError("Failed to load feed");
        }

        if (momentsRes.ok) {
          setMoments(await momentsRes.json());
        }
        // moments failure is non-critical, don't set error

        setLoading(false);
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      console.error("Failed to load curated feed data:", err);
      if (!signal.aborted) {
        setError("Unable to load feed. Please try again.");
        setLoading(false);
      }
    }
  }, [portalSlug]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const reload = useCallback(() => {
    const controller = new AbortController();
    load(controller.signal);
  }, [load]);

  return { sections, moments, loading, error, reload };
}
