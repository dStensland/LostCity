"use client";

import Link from "next/link";
import React, { useState, type CSSProperties } from "react";
import type { Spot } from "@/lib/spots-constants";
import { formatPriceLevel } from "@/lib/spots-constants";
import { formatCloseTime } from "@/lib/hours";
import { kmToMiles, haversineMiles, formatDistanceMiles } from "@/lib/distance";
import CategoryIcon, { getCategoryColor, getCategoryLabel } from "./CategoryIcon";
import LazyImage from "./LazyImage";
import { OpenStatusBadge } from "./HoursSection";
import { EventsBadge } from "./Badge";
import Dot from "@/components/ui/Dot";
import { PressQuote } from "@/components/feed/PressQuote";
import type { EditorialMention } from "@/lib/city-pulse/types";

function formatEventDate(dateStr: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const eventDate = new Date(dateStr + "T00:00:00");
  const diffDays = Math.round((eventDate.getTime() - today.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays < 7) return eventDate.toLocaleDateString("en-US", { weekday: "short" });
  return eventDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatEventTime(time: string | null): string | null {
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "pm" : "am";
  const hr = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${hr}${period}` : `${hr}:${m.toString().padStart(2, "0")}${period}`;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SpotTagData = {
  tag_id: string;
  tag_label: string;
  tag_group: string;
  score: number;
};

interface VenueCardProps {
  venue: Spot;
  portalSlug: string;
  /** "discovery" = image-rail list card, "compact" = tighter single-line for feed/search */
  variant?: "discovery" | "compact";
  /** Contextual label from City Pulse (e.g. "Great patio weather") */
  contextualLabel?: string;
  /** Whether venue is currently open */
  isOpenNow?: boolean;
  /** Top active special */
  topSpecial?: { id: number; title: string; type: string; state: "active_now" | "starting_soon" } | null;
  /** Pre-loaded tags */
  tags?: SpotTagData[];
  /** Show distance from a point */
  showDistance?: { lat: number; lng: number };
  /** Stagger index for animation */
  index?: number;
  /** Editorial press mentions to show on the discovery card */
  editorialMentions?: EditorialMention[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FEATURED_EVENT_THRESHOLD = 5;

const LOCATION_DESIGNATOR_LABELS: Record<string, string> = {
  private_after_signup: "Location after RSVP",
  virtual: "Virtual",
  recovery_meeting: "Recovery meeting location",
};

/** Compute distance in miles — prefer API-provided distance_km, fall back to client-side haversine */
function getDistanceMiles(venue: Spot, from?: { lat: number; lng: number }): number | null {
  if (venue.distance_km != null) return kmToMiles(venue.distance_km);
  if (from && venue.lat != null && venue.lng != null) {
    return haversineMiles(from.lat, from.lng, venue.lat, venue.lng);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Discovery variant — image rail layout
// ---------------------------------------------------------------------------

function DiscoveryCard({
  venue,
  portalSlug,
  showDistance,
  editorialMentions,
}: {
  venue: Spot;
  portalSlug: string;
  showDistance?: { lat: number; lng: number };
  editorialMentions?: EditorialMention[];
}) {
  const [imageError, setImageError] = useState(false);
  const hasImage = venue.image_url && !imageError;
  const isFeatured = (venue.event_count ?? 0) >= FEATURED_EVENT_THRESHOLD;
  const categoryKey = venue.venue_type || "other";
  const accentColor = getCategoryColor(categoryKey);
  const locationDesignator = venue.location_designator || "standard";
  const locationLabel = LOCATION_DESIGNATOR_LABELS[locationDesignator];
  const distance = getDistanceMiles(venue, showDistance);

  return (
    <Link
      href={`/${portalSlug}?spot=${venue.slug}`}
      scroll={false}
      data-category={categoryKey}
      className="find-row-card find-row-card-bg block rounded-xl border border-[var(--twilight)]/75 border-l-[2px] border-l-[var(--accent-color)] overflow-hidden group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-color)]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--void)]"
      style={
        {
          "--accent-color": accentColor,
        } as CSSProperties
      }
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 sm:gap-3">
        <div className="min-w-0 p-3 sm:p-3.5">
          <div className="flex gap-2.5 sm:gap-3">
            <div
              className={`hidden sm:flex flex-shrink-0 self-stretch relative w-[100px] -ml-3 sm:-ml-3.5 -my-3 sm:-my-3.5 overflow-hidden list-rail-media border-r border-[var(--twilight)]/60 ${
                hasImage ? "" : "bg-[color-mix(in_srgb,var(--night)_84%,transparent)]"
              }`}
            >
              {hasImage ? (
                <>
                  <LazyImage
                    src={venue.image_url!}
                    alt={venue.name}
                    fill
                    sizes="100px"
                    className="w-full h-full object-cover scale-[1.03]"
                    placeholderColor="color-mix(in srgb, var(--accent-color) 15%, transparent)"
                    onError={() => setImageError(true)}
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/56 to-black/20 pointer-events-none" />
                </>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <CategoryIcon type={venue.venue_type || "venue"} size={28} glow="subtle" weight="light" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="sm:hidden flex items-center gap-2 mb-2">
                {hasImage ? (
                  <span className="relative w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 border border-[var(--twilight)]/50">
                    <LazyImage
                      src={venue.image_url!}
                      alt={venue.name}
                      fill
                      sizes="40px"
                      className="object-cover"
                      placeholderColor="color-mix(in srgb, var(--accent-color) 15%, transparent)"
                      onError={() => setImageError(true)}
                    />
                  </span>
                ) : (
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-accent-20 border border-[var(--twilight)]/50">
                    <CategoryIcon type={venue.venue_type || "venue"} size={14} glow="subtle" />
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2.5 mb-1">
                <span className="hidden sm:inline-flex flex-shrink-0 items-center justify-center w-8 h-8 rounded-lg bg-accent-20 border border-[var(--twilight)]/55">
                  <CategoryIcon type={venue.venue_type || "venue"} size={16} glow="subtle" />
                </span>
                <span className="text-[var(--cream)] font-semibold text-base sm:text-lg transition-colors line-clamp-1 group-hover:text-[var(--accent-color)] leading-tight">
                  {venue.name}
                </span>
                {venue.is_open !== undefined && (
                  <span className="hidden sm:inline-flex">
                    <OpenStatusBadge hours={venue.hours || null} is24Hours={venue.is_24_hours || false} />
                  </span>
                )}
                {isFeatured && (
                  <span className="inline-flex flex-shrink-0 px-1.5 py-0.5 rounded font-mono text-2xs font-medium uppercase bg-accent-25 text-accent border border-accent-40">
                    Hot
                  </span>
                )}
                {locationLabel && (
                  <span className="inline-flex flex-shrink-0 px-1.5 py-0.5 rounded font-mono text-2xs font-medium uppercase bg-[var(--twilight)]/65 text-[var(--soft)] border border-[var(--twilight)]">
                    {locationLabel}
                  </span>
                )}
              </div>

              {venue.short_description && <p className="text-sm text-[var(--soft)] mt-0.5 line-clamp-1">{venue.short_description}</p>}

              {/* Editorial press quote */}
              {editorialMentions && editorialMentions.length > 0 && (
                <div className="mt-1">
                  <PressQuote
                    snippet={editorialMentions[0].snippet}
                    source={editorialMentions[0].source_key
                      .replace(/_/g, " ")
                      .replace(/\b\w/g, (c) => c.toUpperCase())}
                    articleUrl={editorialMentions[0].article_url}
                  />
                </div>
              )}

              <div className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)] mt-1.5 leading-relaxed flex-wrap">
                {distance !== null && (
                  <span className="text-[var(--neon-green)] font-mono text-xs">{formatDistanceMiles(distance)}</span>
                )}
                {venue.neighborhood && (
                  <>
                    {distance !== null && <Dot />}
                    <span className="truncate max-w-[65%] sm:max-w-[45%] font-medium text-sm">{venue.neighborhood}</span>
                  </>
                )}
                {venue.price_level && (
                  <>
                    <Dot />
                    <span className="text-[var(--gold)] font-mono text-xs">{formatPriceLevel(venue.price_level)}</span>
                  </>
                )}
                {venue.is_open && venue.closes_at && (
                  <>
                    <Dot />
                    <span className="text-[var(--neon-green)] font-mono text-xs">til {formatCloseTime(venue.closes_at)}</span>
                  </>
                )}
                {(venue.event_count ?? 0) > 0 && (
                  <>
                    <Dot />
                    <span className="text-[var(--coral)] font-mono text-xs">
                      {venue.event_count} event{venue.event_count !== 1 ? "s" : ""}
                    </span>
                  </>
                )}
              </div>

              {/* Upcoming events (enriched for Things to Do tab) */}
              {venue.upcoming_events && venue.upcoming_events.length > 0 && (
                <div className="mt-2 pt-2 border-t border-[var(--twilight)]/40 space-y-1.5">
                  {venue.upcoming_events.map((evt) => (
                    <div key={evt.id} className="flex items-center gap-2 min-w-0">
                      <span className="flex-shrink-0 text-[var(--neon-green)] font-mono text-2xs font-medium w-12">
                        {formatEventDate(evt.start_date)}
                      </span>
                      <span className="text-xs text-[var(--cream)] line-clamp-1 flex-1 min-w-0">
                        {evt.title}
                      </span>
                      {evt.start_time && (
                        <span className="flex-shrink-0 text-[var(--muted)] font-mono text-2xs">
                          {formatEventTime(evt.start_time)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 pt-2.5 pr-2.5 pb-2.5 sm:pt-3 sm:pr-3.5 sm:pb-3 flex-shrink-0">
          {venue.is_open !== undefined && (
            <span className="sm:hidden inline-flex">
              <OpenStatusBadge hours={venue.hours || null} is24Hours={venue.is_24_hours || false} />
            </span>
          )}
          <span className="inline-flex w-9 h-9 items-center justify-center rounded-lg border border-[var(--twilight)]/75 bg-[var(--dusk)]/72 text-[var(--muted)] group-hover:text-[var(--cream)] group-hover:border-[var(--accent-color)]/55 transition-all">
            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 3h7v7m0-7L10 14" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10v8a1 1 0 001 1h8" />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Compact variant — tighter single-line for feed/search/neighborhood
// ---------------------------------------------------------------------------

function CompactCard({
  venue,
  portalSlug,
  contextualLabel,
  isOpenNow,
  topSpecial,
  showDistance,
  index = 0,
}: {
  venue: Spot;
  portalSlug: string;
  contextualLabel?: string;
  isOpenNow?: boolean;
  topSpecial?: VenueCardProps["topSpecial"];
  showDistance?: { lat: number; lng: number };
  index?: number;
}) {
  const staggerClass = index < 10 ? `stagger-${index + 1}` : "";
  const priceDisplay = formatPriceLevel(venue.price_level);
  const venueType = venue.venue_type || "music_venue";

  const distance = getDistanceMiles(venue, showDistance);

  return (
    <Link
      href={`/${portalSlug}?spot=${venue.slug}`}
      scroll={false}
      data-category={venueType}
      data-accent="category"
      className={`event-item animate-fade-in ${staggerClass} group card-atmospheric glow-accent reflection-accent card-hover-lift surface-raised rounded-xl border border-subtle shadow-card-sm hover:shadow-card-md`}
    >
      {/* Icon column */}
      <div className="w-10 flex-shrink-0 flex items-center justify-center">
        <CategoryIcon type={venueType} size={24} />
      </div>

      {/* Content column */}
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold text-[var(--text-primary)] leading-tight line-clamp-2 sm:line-clamp-1 group-hover:text-[var(--coral)] transition-colors text-sm">
          {venue.name}
        </h3>
        {/* Contextual badges */}
        {(contextualLabel || isOpenNow || topSpecial) && (
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {isOpenNow && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-2xs font-mono font-medium text-[var(--neon-green)] bg-[var(--neon-green)]/10 border border-[var(--neon-green)]/25">
                Open now
              </span>
            )}
            {contextualLabel && <span className="text-xs font-mono text-[var(--neon-cyan)]">{contextualLabel}</span>}
            {topSpecial && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-2xs font-mono font-medium text-[var(--neon-amber)] bg-[var(--neon-amber)]/10 border border-[var(--neon-amber)]/25">
                {topSpecial.title}
              </span>
            )}
          </div>
        )}
        <div className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)] mt-1">
          <span className="font-medium text-base">{getCategoryLabel(venueType)}</span>
          {venue.neighborhood && (
            <>
              <Dot />
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--surface-elevated)]/60 text-[var(--text-secondary)] text-xs font-medium">
                {venue.neighborhood}
              </span>
            </>
          )}
        </div>

        {/* Description */}
        {venue.short_description && (
          <p className="text-sm text-[var(--text-secondary)] mt-1.5 line-clamp-2 leading-relaxed">{venue.short_description}</p>
        )}

        {/* Meta row - mobile */}
        <div className="flex items-center gap-3 mt-2 sm:hidden">
          {distance !== null && (
            <span className="font-mono text-xs font-medium text-[var(--coral)]">{formatDistanceMiles(distance)}</span>
          )}
          {priceDisplay && <span className="font-mono text-xs font-medium text-[var(--muted)]">{priceDisplay}</span>}
          {venue.event_count !== undefined && venue.event_count > 0 && <EventsBadge count={venue.event_count} />}
        </div>
      </div>

      {/* Right column - desktop only */}
      <div className="hidden sm:flex items-center gap-3">
        {distance !== null && (
          <span className="font-mono text-xs font-medium text-[var(--coral)] whitespace-nowrap">{formatDistanceMiles(distance)}</span>
        )}
        {priceDisplay && <span className="font-mono text-sm font-medium text-[var(--muted)]">{priceDisplay}</span>}
        {venue.event_count !== undefined && venue.event_count > 0 && <EventsBadge count={venue.event_count} />}
        <div className="w-5 h-5 items-center justify-center text-[var(--muted)] group-hover:text-[var(--coral)] transition-colors hidden md:flex desktop-hover-only">
          <svg
            className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

function VenueCard({
  venue,
  portalSlug,
  variant = "discovery",
  contextualLabel,
  isOpenNow,
  topSpecial,
  tags: _tags,
  showDistance,
  index,
  editorialMentions,
}: VenueCardProps) {
  if (variant === "compact") {
    return (
      <CompactCard
        venue={venue}
        portalSlug={portalSlug}
        contextualLabel={contextualLabel}
        isOpenNow={isOpenNow}
        topSpecial={topSpecial}
        showDistance={showDistance}
        index={index}
      />
    );
  }

  return (
    <DiscoveryCard
      venue={venue}
      portalSlug={portalSlug}
      showDistance={showDistance}
      editorialMentions={editorialMentions}
    />
  );
}

export default React.memo(VenueCard);
