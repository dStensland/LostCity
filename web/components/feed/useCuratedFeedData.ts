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

      // Feed drives above-fold layout; moments are optional and should not block first render.
      void (async () => {
        try {
          const momentsRes = await fetch(`/api/moments?portal=${portalSlug}`, { signal });
          if (!signal.aborted && momentsRes.ok) {
            setMoments(await momentsRes.json());
          }
        } catch (momentsErr) {
          if (momentsErr instanceof Error && momentsErr.name === "AbortError") return;
          console.error("Failed to load moments data:", momentsErr);
        }
      })();

      const feedRes = await fetch(`/api/portals/${portalSlug}/feed`, { signal });

      if (!signal.aborted) {
        if (feedRes.ok) {
          const feedData = await feedRes.json();
          setSections(feedData.sections || []);
        } else {
          setError("Failed to load feed");
        }

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
    const timeoutId = setTimeout(() => {
      void load(controller.signal);
    }, 0);
    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [load]);

  const reload = useCallback(() => {
    const controller = new AbortController();
    load(controller.signal);
  }, [load]);

  return { sections, moments, loading, error, reload };
}
