"use client";

/**
 * RegularHangsSection — standalone section for recurring hangs.
 *
 * Weekly trivia, run clubs, karaoke, open mic — the fabric of city life.
 * Self-fetching via /api/regulars; the feed manifest seeds React Query's
 * cache via `initialData` so no waterfall fires on first render.
 * RecurringStrip handles activity chips, day-of-week filter, and compact row
 * rendering.
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { CityPulseEventItem } from "@/lib/city-pulse/types";
import type { FeedEventData } from "@/components/EventCard";
import { matchActivityType } from "@/lib/scene-event-routing";
import { ENABLE_LINEUP_RECURRING } from "@/lib/launch-flags";
import { RecurringStrip } from "@/components/feed/lineup/RecurringStrip";
import type { RegularsFeedData } from "@/lib/city-pulse/loaders/load-regulars";

interface RegularHangsSectionProps {
  portalSlug: string;
  /** Server-preloaded payload from the feed manifest; skips the client fetch when present. */
  initialData?: RegularsFeedData | null;
}

export default function RegularHangsSection({ portalSlug, initialData }: RegularHangsSectionProps) {
  // Shares cache key with the server loader's seed — instant from warm cache
  const { data: regularsData } = useQuery<{ events: FeedEventData[] }>({
    queryKey: ["regulars", portalSlug],
    queryFn: async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);
      try {
        const res = await fetch(`/api/regulars?portal=${portalSlug}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Regulars fetch failed: ${res.status}`);
        return res.json();
      } finally {
        clearTimeout(timeoutId);
      }
    },
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: ENABLE_LINEUP_RECURRING,
    initialData: initialData ?? undefined,
  });

  // Transform to CityPulseEventItem[] — dedup by title+venue
  const recurringEvents = useMemo<CityPulseEventItem[]>(() => {
    if (!ENABLE_LINEUP_RECURRING || !regularsData?.events) return [];
    const seen = new Set<string>();
    return regularsData.events
      .filter((event: FeedEventData) => {
        if (!matchActivityType(event as unknown as Parameters<typeof matchActivityType>[0])) return false;
        const venueId = event.venue?.id ?? 0;
        const key = `${event.title}|${venueId}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((event: FeedEventData) => ({
        item_type: "event" as const,
        event: {
          ...event,
          is_recurring: true,
          recurrence_label: (event as Record<string, unknown>).recurrence_label as string | undefined,
        },
      }));
  }, [regularsData]);

  if (!ENABLE_LINEUP_RECURRING || recurringEvents.length === 0) return null;

  return (
    <div className="mt-4 scroll-mt-28">
      <RecurringStrip events={recurringEvents} portalSlug={portalSlug} />
    </div>
  );
}
