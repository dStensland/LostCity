"use client";

import { memo, Fragment } from "react";
import Link from "next/link";
import SmartImage from "@/components/SmartImage";
import CategoryIcon, { getCategoryColor } from "@/components/CategoryIcon";
import Dot from "@/components/ui/Dot";
import type { FeedEventData } from "@/components/EventCard";
import type { EditorialMention, FriendGoingInfo } from "@/lib/city-pulse/types";
import { formatTime, formatSmartDate } from "@/lib/formats";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HeroCardProps {
  event: FeedEventData & {
    card_tier?: "hero";
    editorial_mentions?: EditorialMention[];
  };
  portalSlug?: string;
  friendsGoing?: FriendGoingInfo[];
  index?: number;
  /** Hide image (show gradient fallback only) */
  hideImages?: boolean;
  /** Editorial blurb shown beneath metadata */
  editorialBlurb?: string | null;
  /** Portal vertical for civic routing */
  vertical?: string | null;
}

// ---------------------------------------------------------------------------
// Contextual label derivation
// ---------------------------------------------------------------------------

function getContextualLabel(
  event: FeedEventData & { card_tier?: "hero" }
): string | null {
  // Only show labels that are genuinely informative to users.
  // Never expose internal tier names (FLAGSHIP, TENTPOLE) — those are backend signals.
  if (event.festival_id) return "FESTIVAL";
  if (event.is_free) return "FREE";
  // Fall back to the event's category as a contextual label
  if (event.category) {
    const label = event.category.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
    return label;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Metadata row: venue name · date/time · price
// ---------------------------------------------------------------------------

function buildMetadataRow(event: FeedEventData): string[] {
  const parts: string[] = [];

  if (event.venue?.name) {
    parts.push(event.venue.name);
  }

  const { label: dateLabel } = formatSmartDate(event.start_date);
  if (event.is_all_day) {
    parts.push(`${dateLabel} · All Day`);
  } else if (event.start_time) {
    parts.push(`${dateLabel} · ${formatTime(event.start_time)}`);
  } else {
    parts.push(dateLabel);
  }

  if (event.is_free) {
    parts.push("Free");
  } else if (event.price_min !== null && event.price_min !== undefined) {
    parts.push(`From $${event.price_min}`);
  }

  if (event.venue?.google_rating != null) {
    parts.push(`${event.venue.google_rating.toFixed(1)} ★`);
  }

  return parts;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const HeroCard = memo(function HeroCard({
  event,
  portalSlug = "atlanta",
  friendsGoing,
  index,
  hideImages = false,
  editorialBlurb,
}: HeroCardProps) {
  const label = getContextualLabel(event);
  const metadata = buildMetadataRow(event);
  const catColor = getCategoryColor(event.category);

  const heroImageUrl = hideImages
    ? null
    : event.image_url || event.series?.image_url || event.venue?.image_url;

  // Stagger animation — only first 10 items
  const staggerClass =
    index !== undefined && index < 10 ? `stagger-${index + 1}` : "";

  return (
    <Link
      href={`/${portalSlug}/events/${event.id}`}
      prefetch={false}
      className={[
        "block relative w-full rounded-card overflow-hidden hover-lift gradient-border-subtle animate-page-enter",
        staggerClass,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={event.title}
    >
      {/* ── Image / Fallback ─────────────────────────────────────────── */}
      <div className="relative w-full h-[200px] sm:h-[240px]">
        {heroImageUrl ? (
          <>
            {/* Image fills the card */}
            <SmartImage
              src={heroImageUrl}
              alt=""
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, 800px"
              blurhash={event.blurhash}
              fallback={
                <div
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(135deg, var(--dusk) 0%, color-mix(in srgb, ${catColor} 25%, var(--twilight)) 40%, color-mix(in srgb, ${catColor} 15%, var(--void)) 100%)`,
                  }}
                />
              }
            />
            {/* Gradient overlay — bottom half */}
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--night)] via-[var(--night)]/60 to-transparent" />
          </>
        ) : (
          /* No-image fallback */
          <>
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--dusk)] to-[var(--night)]" />
            <div className="absolute inset-0 flex items-center justify-center opacity-20">
              <CategoryIcon
                type={event.category || "other"}
                size={64}
                glow="subtle"
                weight="light"
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--night)]/90 via-[var(--night)]/40 to-transparent" />
          </>
        )}

        {/* ── Content overlay — bottom-left ─────────────────────────── */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 pt-2">
          {/* Contextual label */}
          {label && (
            <p className="font-mono text-2xs font-bold uppercase tracking-[1.2px] text-[var(--gold)] mb-1">
              {label}
            </p>
          )}

          {/* Title */}
          <h2 className="text-2xl font-semibold text-[var(--cream)] line-clamp-2 leading-tight mb-2">
            {event.title}
          </h2>

          {/* Metadata row */}
          {metadata.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-sm text-[var(--soft)]">
              {metadata.map((value, idx) => (
                <Fragment key={`${event.id}-hero-meta-${idx}`}>
                  {idx > 0 && <Dot />}
                  <span>{value}</span>
                </Fragment>
              ))}
            </div>
          )}

          {/* Editorial blurb */}
          {editorialBlurb && (
            <p className="mt-1.5 text-sm text-white/80 italic leading-relaxed max-w-xl line-clamp-2">
              {editorialBlurb}
            </p>
          )}

          {/* Friends going — social proof */}
          {friendsGoing && friendsGoing.length > 0 && (
            <p className="mt-1.5 text-xs text-[var(--soft)]">
              {friendsGoing
                .slice(0, 2)
                .map((f) => f.display_name || f.username)
                .join(", ")}
              {friendsGoing.length > 2 && ` + ${friendsGoing.length - 2} more`}{" "}
              going
            </p>
          )}

          {/* Aggregate social proof pills */}
          {((event.going_count ?? 0) > 0 || (event.interested_count ?? 0) > 0) && (
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {(event.going_count ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--coral)]/10 border border-[var(--coral)]/20 font-mono text-xs text-[var(--coral)]">
                  {event.going_count} going
                </span>
              )}
              {(event.interested_count ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--gold)]/10 border border-[var(--gold)]/20 font-mono text-xs text-[var(--gold)]">
                  {event.interested_count} interested
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
});

export type { HeroCardProps };
