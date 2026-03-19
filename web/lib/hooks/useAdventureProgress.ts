"use client";

import { useState, useCallback, useEffect, startTransition } from "react";

const STORAGE_KEY = "losttrack_progress";

interface ProgressState {
  visitedSlugs: string[];
}

function readStorage(): ProgressState {
  if (typeof window === "undefined") return { visitedSlugs: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { visitedSlugs: [] };
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "visitedSlugs" in parsed &&
      Array.isArray((parsed as { visitedSlugs: unknown }).visitedSlugs)
    ) {
      return { visitedSlugs: (parsed as ProgressState).visitedSlugs };
    }
    return { visitedSlugs: [] };
  } catch {
    return { visitedSlugs: [] };
  }
}

function writeStorage(state: ProgressState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage unavailable — non-fatal
  }
}

/**
 * localStorage-backed progress tracking for the Lost Track adventure portal.
 * Tracks visited destination slugs. Quest progress is derived from the
 * quest→node mapping in yonder-launch-destination-nodes.ts.
 */
export function useAdventureProgress() {
  const [visitedSlugs, setVisitedSlugs] = useState<string[]>([]);

  // Hydrate from localStorage on mount (avoids SSR mismatch).
  // startTransition defers the render to avoid blocking the initial paint.
  useEffect(() => {
    const stored = readStorage().visitedSlugs;
    startTransition(() => {
      setVisitedSlugs(stored);
    });
  }, []);

  const markVisited = useCallback((slug: string) => {
    setVisitedSlugs((prev) => {
      if (prev.includes(slug)) return prev;
      const next = [...prev, slug];
      writeStorage({ visitedSlugs: next });
      return next;
    });
  }, []);

  const unmarkVisited = useCallback((slug: string) => {
    setVisitedSlugs((prev) => {
      const next = prev.filter((s) => s !== slug);
      writeStorage({ visitedSlugs: next });
      return next;
    });
  }, []);

  const isVisited = useCallback(
    (slug: string) => visitedSlugs.includes(slug),
    [visitedSlugs],
  );

  /**
   * Count visited nodes that belong to a specific quest.
   * Requires the caller to pass the list of spot slugs for that quest.
   */
  const getVisitedCount = useCallback(
    (questNodeSlugs: string[]): number => {
      return questNodeSlugs.filter((slug) => visitedSlugs.includes(slug)).length;
    },
    [visitedSlugs],
  );

  return {
    markVisited,
    unmarkVisited,
    isVisited,
    visitedSlugs,
    getVisitedCount,
  };
}
