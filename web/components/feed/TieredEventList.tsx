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
  // eslint-disable-next-line react-hooks/set-state-in-effect -- derived-state reset when fingerprint changes (tab/chip switch). Cascade bounded — expanded is not in the dep array.
  useEffect(() => { setExpanded(false); }, [eventFingerprint]);

  if (events.length === 0) return null;

  const visibleEvents = expanded ? events : events.slice(0, maxVisible);
  const hiddenCount = events.length - maxVisible;

  return (
    <div className="space-y-2">
      {/* Event rows — 2-col grid on desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5 card-stagger">
        {visibleEvents.map((event, idx) => (
          <StandardRow
            key={`event-${event.id}`}
            event={event as FeedEventData & { card_tier?: "standard" }}
            portalSlug={portalSlug}
            index={idx}
          />
        ))}
      </div>

      {/* Show more — promoted treatment: coral outline, small sparkle glyph,
          feels like an intent-ful continuation rather than a buried footer. */}
      {!expanded && hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="w-full py-3 text-center font-mono text-xs font-semibold text-[var(--coral)] border border-[var(--coral)]/45 rounded-lg bg-[var(--coral)]/[0.05] hover:bg-[var(--coral)]/[0.12] hover:border-[var(--coral)]/70 active:scale-[0.99] transition-all inline-flex items-center justify-center gap-2 uppercase tracking-[0.08em]"
        >
          <span>Show {hiddenCount} more event{hiddenCount !== 1 ? "s" : ""}</span>
          <span aria-hidden className="text-sm leading-none">↓</span>
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
