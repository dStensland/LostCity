"use client";

/**
 * TieredEventList — renders a list of CityPulse events using card_tier signals.
 *
 * Tier hierarchy:
 *   hero     → HeroCard (full-width, max 1, shown first)
 *   featured → mini horizontal carousel of featured cards (max 4)
 *   standard → StandardRow compact rows (all remaining)
 *
 * Optional editorial callout is shown above the hero when the section has
 * a tentpole/festival or high-density category signal.
 */

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import type { FeedEventData } from "@/components/EventCard";
import type { CardTier, EditorialMention, FriendGoingInfo } from "@/lib/city-pulse/types";
import { HeroCard } from "@/components/feed/HeroCard";
import { StandardRow } from "@/components/feed/StandardRow";
import { EditorialCallout } from "@/components/feed/EditorialCallout";
import { PressQuote } from "@/components/feed/PressQuote";
import { generateEditorialCallout } from "@/lib/editorial-templates";
import CategoryPlaceholder from "@/components/CategoryPlaceholder";
import SmartImage from "@/components/SmartImage";
import { formatTime } from "@/lib/formats";
import { format, parseISO } from "date-fns";

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

// ---------------------------------------------------------------------------
// Editorial relevance guard
// ---------------------------------------------------------------------------

/**
 * Categories where venue-level editorial mentions (restaurant reviews, bar
 * features, etc.) are relevant context.  Editorial sources in the
 * `editorial_mentions` table are food/drink/tourism publications.  Showing a
 * restaurant review on a fitness class or education workshop at the same venue
 * creates confusing mismatches.
 */
const EDITORIAL_RELEVANT_CATEGORIES = new Set([
  "food_drink",
  "nightlife",
  "arts",
  "music",
  "community",
]);

function isEditorialRelevant(event: TieredFeedEvent): boolean {
  const cat = event.category ?? "";
  return EDITORIAL_RELEVANT_CATEGORIES.has(cat);
}

interface TieredEventListProps {
  events: TieredFeedEvent[];
  portalSlug?: string;
  /** Section type for editorial callout context ("tonight", "this_weekend", etc.) */
  sectionType?: string;
  /** Category event counts for editorial density callout */
  categoryCounts?: Record<string, number>;
  /** Active holidays for editorial callout */
  holidays?: Array<{ name: string; date: string }>;
  /** Max hero cards to show (default: 1) */
  maxHero?: number;
  /** Max featured cards to show in carousel (default: 4) */
  maxFeatured?: number;
  /** "See all" link href shown after standard rows */
  seeAllHref?: string;
  /** "See all" link label */
  seeAllLabel?: string;
  /** Max total visible items before "Show more" collapse (default: 8).
   *  Hero + featured count toward the cap; standard rows fill the remainder. */
  maxVisible?: number;
}

// ---------------------------------------------------------------------------
// Featured mini-card (inline, no FeaturedCarousel overhead)
// ---------------------------------------------------------------------------

function FeaturedMiniCard({
  event,
  portalSlug,
}: {
  event: TieredFeedEvent;
  portalSlug: string;
}) {
  const imageUrl = event.image_url || event.series?.image_url;
  const firstMention = event.editorial_mentions?.[0];

  return (
    <Link
      href={`/${portalSlug}/events/${event.id}`}
      prefetch={false}
      className="group flex-shrink-0 w-72 snap-start flex flex-col rounded-xl overflow-hidden border border-[var(--twilight)]/40 bg-gradient-to-br from-[var(--night)] to-[var(--void)] hover:border-[var(--twilight)]/70 transition-all"
      aria-label={event.title}
    >
      {/* Image / Placeholder */}
      {imageUrl ? (
        <div className="relative h-32 overflow-hidden bg-[var(--twilight)]">
          <SmartImage
            src={imageUrl}
            alt=""
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="288px"
            blurhash={event.blurhash}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          {/* Featured badge */}
          <div className="absolute bottom-2 left-2.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm border border-[var(--gold)]/40 bg-[var(--gold)]/10 text-[var(--gold)] font-mono text-2xs font-bold uppercase tracking-wider">
              Featured
            </span>
          </div>
        </div>
      ) : (
        <div className="relative h-32 overflow-hidden">
          <CategoryPlaceholder category={event.category} />
          <div className="absolute bottom-2 left-2.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm border border-[var(--gold)]/40 bg-[var(--gold)]/10 text-[var(--gold)] font-mono text-2xs font-bold uppercase tracking-wider">
              Featured
            </span>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex flex-col gap-1.5 p-3">
        <h3 className="text-base font-semibold text-[var(--cream)] group-hover:text-[var(--gold)] transition-colors line-clamp-2 leading-snug">
          {event.title}
        </h3>

        <p className="text-sm text-[var(--soft)]">
          {format(parseISO(event.start_date), "EEE, MMM d")}
          {event.start_time && ` · ${formatTime(event.start_time)}`}
        </p>

        {event.venue?.name && (
          <p className="text-xs text-[var(--muted)] truncate">{event.venue.name}</p>
        )}

        {/* Press quote if available */}
        {firstMention && (
          <div className="mt-0.5">
            <PressQuote
              snippet={firstMention.snippet}
              source={firstMention.source_key
                .replace(/_/g, " ")
                .replace(/\b\w/g, (c) => c.toUpperCase())}
              articleUrl={firstMention.article_url}
            />
          </div>
        )}

        {/* Price + social proof badges */}
        <div className="flex items-center gap-1.5 mt-auto pt-1 flex-wrap">
          {event.is_free ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[var(--neon-green)]/10 border border-[var(--neon-green)]/20 text-[var(--neon-green)] font-mono text-2xs font-bold uppercase tracking-wider">
              Free
            </span>
          ) : event.price_min !== null && event.price_min !== undefined ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-[var(--twilight)] font-mono text-2xs font-medium text-[var(--muted)]">
              From ${event.price_min}
            </span>
          ) : null}
          {(event.going_count ?? 0) > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[var(--coral)]/10 border border-[var(--coral)]/20 font-mono text-2xs font-medium text-[var(--coral)]">
              {event.going_count} going
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TieredEventList({
  events,
  portalSlug = "atlanta",
  sectionType = "this_week",
  categoryCounts = {},
  holidays = [],
  maxHero = 1,
  maxFeatured = 4,
  seeAllHref,
  seeAllLabel = "See all",
  maxVisible = 8,
}: TieredEventListProps) {
  const [expanded, setExpanded] = useState(false);

  // Collapse when the event list changes (tab/chip switch)
  const eventFingerprint = events.length > 0 ? `${events[0].id}-${events.length}` : "empty";
  useEffect(() => { setExpanded(false); }, [eventFingerprint]);

  // Split events into tiers
  const { heroEvents, featuredEvents, standardEvents } = useMemo(() => {
    const hero: TieredFeedEvent[] = [];
    const featured: TieredFeedEvent[] = [];
    const standard: TieredFeedEvent[] = [];

    for (const event of events) {
      const tier = event.card_tier ?? "standard";
      if (tier === "hero" && hero.length < maxHero) {
        hero.push(event);
      } else if ((tier === "featured" || tier === "hero") && featured.length < maxFeatured) {
        // Overflow hero events fall into featured
        featured.push(event);
      } else {
        standard.push(event);
      }
    }

    return { heroEvents: hero, featuredEvents: featured, standardEvents: standard };
  }, [events, maxHero, maxFeatured]);

  // Try to generate an editorial callout from section context
  const editorialCallout = useMemo(() => {
    return generateEditorialCallout({
      events: events.map((e) => ({
        category_id: e.category ?? undefined,
        is_tentpole: e.is_tentpole,
        festival_id: e.festival_id,
        title: e.title,
        importance: e.importance ?? undefined,
      })),
      sectionType,
      categoryCounts,
      holidays,
    });
  }, [events, sectionType, categoryCounts, holidays]);

  if (events.length === 0) return null;

  return (
    <div className="space-y-2.5">
      {/* Editorial callout — only when there's a meaningful signal */}
      {editorialCallout && (
        <EditorialCallout
          highlightText={editorialCallout.highlightText}
          remainderText={editorialCallout.remainderText}
        />
      )}

      {/* Hero card — flagship / festival / tentpole event */}
      {heroEvents.map((event, idx) => (
        <HeroCard
          key={`hero-${event.id}`}
          event={event as FeedEventData & { card_tier?: "hero"; editorial_mentions?: EditorialMention[] }}
          portalSlug={portalSlug}
          friendsGoing={event.friends_going}
          editorialBlurb={
            isEditorialRelevant(event)
              ? (event.editorial_mentions?.[0]?.snippet ?? null)
              : null
          }
          index={idx}
        />
      ))}

      {/* Featured carousel — shown only when there are featured-tier events */}
      {featuredEvents.length > 0 && (
        <div className="-mx-4">
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory px-4 scroll-smooth">
            {featuredEvents.map((event) => (
              <FeaturedMiniCard
                key={`featured-${event.id}`}
                event={event}
                portalSlug={portalSlug}
              />
            ))}
          </div>
        </div>
      )}

      {/* Standard rows — capped at maxVisible total, expandable */}
      {standardEvents.length > 0 && (() => {
        const usedSlots = heroEvents.length + featuredEvents.length;
        const standardCap = Math.max(maxVisible - usedSlots, 2);
        const visibleStandard = expanded
          ? standardEvents
          : standardEvents.slice(0, standardCap);
        const hiddenCount = standardEvents.length - standardCap;

        return (
          <>
            <div className="space-y-1.5 card-stagger">
              {visibleStandard.map((event, idx) => (
                <StandardRow
                  key={`standard-${event.id}`}
                  event={event as FeedEventData & { card_tier?: "standard" }}
                  portalSlug={portalSlug}
                  index={usedSlots + idx}
                />
              ))}
            </div>
            {!expanded && hiddenCount > 0 && (
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="w-full py-2.5 text-center font-mono text-xs font-medium text-[var(--soft)] hover:text-[var(--cream)] transition-colors border border-[var(--twilight)]/40 rounded-lg hover:border-[var(--twilight)]/70 hover:bg-white/[0.02] active:scale-[0.99]"
              >
                Show {hiddenCount} more event{hiddenCount !== 1 ? "s" : ""}
              </button>
            )}
          </>
        );
      })()}

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
