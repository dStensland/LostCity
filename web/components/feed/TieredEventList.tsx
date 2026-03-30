"use client";

/**
 * TieredEventList — flat list of CityPulse events as StandardRow cards.
 *
 * Shows events in a consistent compact row format. Capped at maxVisible
 * with a "Show more" expander. No hero/featured tier split — all events
 * get the same treatment for clarity and honest data presentation.
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import type { FeedEventData } from "@/components/EventCard";
import type { CardTier, EditorialMention, FriendGoingInfo } from "@/lib/city-pulse/types";
import { StandardRow } from "@/components/feed/StandardRow";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TieredFeedEvent = FeedEventData & {
  card_tier?: CardTier;
  editorial_mentions?: EditorialMention[];
  friends_going?: FriendGoingInfo[];
  is_tentpole?: boolean;
  importance?: "flagship" | "major" | "standard" | null;
};

interface TieredEventListProps {
  events: TieredFeedEvent[];
  portalSlug?: string;
  /** Section type (kept for API compat, unused in flat list) */
  sectionType?: string;
  /** Category event counts (kept for API compat, unused in flat list) */
  categoryCounts?: Record<string, number>;
  /** Active holidays (kept for API compat, unused in flat list) */
  holidays?: Array<{ name: string; date: string }>;
  /** @deprecated No longer used — all events render as rows */
  maxHero?: number;
  /** @deprecated No longer used — all events render as rows */
  maxFeatured?: number;
  /** "See all" link href shown after rows */
  seeAllHref?: string;
  /** "See all" link label */
  seeAllLabel?: string;
  /** Max visible items before "Show more" collapse (default: 8) */
  maxVisible?: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TieredEventList({
  events,
  portalSlug = "atlanta",
  seeAllHref,
  seeAllLabel = "See all",
  maxVisible = 8,
}: TieredEventListProps) {
  const [expanded, setExpanded] = useState(false);

  // Collapse when the event list changes (tab/chip switch)
  const eventFingerprint = events.length > 0 ? `${events[0].id}-${events.length}` : "empty";
  useEffect(() => { setExpanded(false); }, [eventFingerprint]);

  if (events.length === 0) return null;

  const visibleEvents = expanded ? events : events.slice(0, maxVisible);
  const hiddenCount = events.length - maxVisible;

  return (
    <div className="space-y-1.5">
      {/* Event rows */}
      <div className="space-y-1.5 card-stagger">
        {visibleEvents.map((event, idx) => (
          <StandardRow
            key={`event-${event.id}`}
            event={event as FeedEventData & { card_tier?: "standard" }}
            portalSlug={portalSlug}
            index={idx}
          />
        ))}
      </div>

      {/* Show more */}
      {!expanded && hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="w-full py-2.5 text-center font-mono text-xs font-medium text-[var(--soft)] hover:text-[var(--cream)] transition-colors border border-[var(--twilight)]/40 rounded-lg hover:border-[var(--twilight)]/70 hover:bg-white/[0.02] active:scale-[0.99]"
        >
          Show {hiddenCount} more event{hiddenCount !== 1 ? "s" : ""}
        </button>
      )}

      {/* See all */}
      {seeAllHref && (
        <Link
          href={seeAllHref}
          className="block w-full text-center font-mono text-xs text-[var(--neon-green)] hover:opacity-80 transition-opacity py-1"
        >
          {seeAllLabel}
        </Link>
      )}
    </div>
  );
}

export type { TieredEventListProps };
