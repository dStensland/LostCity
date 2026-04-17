"use client";

/**
 * useFeedPreferences — manages feed layout + interest preferences.
 *
 * Lifecycle:
 *  1. On mount (when authenticated), fetches saved prefs from /api/preferences
 *  2. feedLayout is updated immediately on local changes (optimistic)
 *  3. savedInterests only updates on explicit save or initial load
 *     (this controls when the API refetches per-category data)
 *  4. hasLocalChanges guard prevents prefs-load from overwriting draft edits
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { FeedLayout } from "@/lib/city-pulse/types";
import { DEFAULT_FEED_ORDER, LEGACY_BLOCK_IDS } from "@/lib/city-pulse/types";

function makeDefaultLayout(): FeedLayout {
  return {
    visible_blocks: [...DEFAULT_FEED_ORDER].filter((b) => b !== "browse"),
    hidden_blocks: [],
    version: 2 as const,
  };
}

/** Detect legacy v1 block IDs and reset to v2 defaults, preserving interests. */
function migrateIfLegacy(layout: FeedLayout): { layout: FeedLayout; migrated: boolean } {
  const allBlocks = [...layout.visible_blocks, ...layout.hidden_blocks];
  const hasLegacy = allBlocks.some((b) => LEGACY_BLOCK_IDS.has(b));
  if (!hasLegacy && layout.version === 2) return { layout, migrated: false };
  return {
    layout: {
      ...makeDefaultLayout(),
      ...(layout.interests !== undefined && { interests: layout.interests }),
    },
    migrated: true,
  };
}

interface UseFeedPreferencesOptions {
  isAuthenticated: boolean;
}

export function useFeedPreferences({ isAuthenticated }: UseFeedPreferencesOptions) {
  const [feedLayout, setFeedLayout] = useState<FeedLayout | null>(null);
  const [savedInterests, setSavedInterests] = useState<string[] | undefined>();

  // Ref always holds the latest feedLayout — safe to read from callbacks
  const feedLayoutRef = useRef<FeedLayout | null>(feedLayout);
  useEffect(() => { feedLayoutRef.current = feedLayout; }, [feedLayout]);

  // Gate: once user makes local changes, don't let prefs-load overwrite them
  const hasLocalChanges = useRef(false);

  // Fetch user preferences on mount when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/preferences");
        if (!res.ok) return;
        const prefs = await res.json();
        if (cancelled || hasLocalChanges.current) return;
        if (!prefs.feed_layout) return;

        const { layout, migrated } = migrateIfLegacy(prefs.feed_layout);
        setFeedLayout(layout);
        setSavedInterests(layout.interests ?? undefined);

        // Silently persist migrated layout back to DB
        if (migrated) {
          fetch("/api/preferences", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ feed_layout: layout }),
          }).catch(() => {});
        }
      } catch {
        // Preferences are optional — don't block the feed
      }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  // Local-only: update feedLayout interests without persisting or refetching
  const handleInterestsChange = useCallback((interests: string[]) => {
    hasLocalChanges.current = true;
    setFeedLayout((prev) => {
      const base = prev || makeDefaultLayout();
      return { ...base, interests };
    });
  }, []);

  // Explicit save: persist interests + update savedInterests (triggers API refetch)
  const handleSaveInterests = useCallback(async (interests: string[]) => {
    setSavedInterests(interests);
    if (!isAuthenticated) return;
    try {
      const layout = feedLayoutRef.current || makeDefaultLayout();
      await fetch("/api/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feed_layout: { ...layout, interests } }),
      });
    } catch {
      // Silently fail — layout is already applied locally
    }
  }, [isAuthenticated]);

  return {
    feedLayout,
    savedInterests,
    handleInterestsChange,
    handleSaveInterests,
  };
}
