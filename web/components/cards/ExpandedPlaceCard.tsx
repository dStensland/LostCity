"use client";

import { memo } from "react";
import Link from "next/link";
import {
  Star,
  FrameCorners,
  MapPin,
  Palette,
  ForkKnife,
  MoonStars,
  Tree,
  MusicNotes,
  Ticket,
} from "@phosphor-icons/react";
import type { DiscoveryPlaceEntity, VerticalLane } from "@/lib/types/discovery";
import { LANE_CONFIG } from "@/lib/types/discovery";
import SmartImage from "@/components/SmartImage";

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

function formatRating(rating: number | null): string | null {
  if (rating === null) return null;
  return rating.toFixed(1);
}

function formatDistance(km: number | null): string | null {
  if (km === null) return null;
  const miles = km * 0.621371;
  if (miles < 0.1) return "nearby";
  return `${miles.toFixed(1)}mi`;
}

function formatCloseTime(closesAt: string | null): string | null {
  if (!closesAt) return null;
  const [h, m] = closesAt.split(":").map(Number);
  const period = h >= 12 ? "pm" : "am";
  const hr = h === 0 ? 12 : h > 12 ? h - 12 : h;
  if (m === 0) return `${hr}${period}`;
  return `${hr}:${m.toString().padStart(2, "0")}${period}`;
}

function formatPriceLevel(level: number | null): string | null {
  if (level === null || level === 0) return null;
  return "$".repeat(Math.min(level, 4));
}

function getTypeBadgeLabel(placeType: string): string {
  const labels: Record<string, string> = {
    museum: "MUSEUM",
    gallery: "GALLERY",
    theater: "THEATER",
    cinema: "CINEMA",
    arts_center: "ARTS CENTER",
    studio: "STUDIO",
    restaurant: "RESTAURANT",
    bar: "BAR",
    brewery: "BREWERY",
    cocktail_bar: "COCKTAIL BAR",
    coffee_shop: "CAFÉ",
    food_hall: "FOOD HALL",
    wine_bar: "WINE BAR",
    rooftop: "ROOFTOP",
    lounge: "LOUNGE",
    nightclub: "NIGHTCLUB",
    comedy_club: "COMEDY CLUB",
    karaoke: "KARAOKE",
    lgbtq: "LGBTQ+",
    music_venue: "LIVE MUSIC",
    amphitheater: "AMPHITHEATER",
    arena: "ARENA",
    stadium: "STADIUM",
    park: "PARK",
    trail: "TRAIL",
    recreation: "RECREATION",
    viewpoint: "VIEWPOINT",
    landmark: "LANDMARK",
    arcade: "ARCADE",
    attraction: "ATTRACTION",
    escape_room: "ESCAPE ROOM",
    bowling: "BOWLING",
    zoo: "ZOO",
    aquarium: "AQUARIUM",
  };
  return labels[placeType] ?? placeType.replace(/_/g, " ").toUpperCase();
}

// -------------------------------------------------------------------------
// Vertical-specific inline blocks
// -------------------------------------------------------------------------

interface ArtsInlineProps {
  entity: DiscoveryPlaceEntity;
  accentColor: string;
}

function ArtsInlineBlock({ entity, accentColor }: ArtsInlineProps) {
  if (!entity.current_exhibition_title) return null;

  return (
    <div
      className="rounded px-2 py-1.5 border"
      style={{
        backgroundColor: `${accentColor}15`,
        borderColor: `${accentColor}40`,
      }}
    >
      <div className="flex items-center gap-1 mb-0.5">
        <FrameCorners size={10} color={accentColor} weight="duotone" />
        <span
          className="font-mono text-2xs uppercase tracking-wider"
          style={{ color: accentColor }}
        >
          Current Exhibition
        </span>
      </div>
      <span className="text-xs font-medium text-[var(--cream)] line-clamp-1">
        {entity.current_exhibition_title}
      </span>
      {entity.current_exhibition_status && (
        <span className="font-mono text-2xs text-[var(--muted)] mt-0.5 block">
          {entity.current_exhibition_status}
        </span>
      )}
    </div>
  );
}

interface DiningInlineProps {
  entity: DiscoveryPlaceEntity;
  accentColor: string;
}

function DiningInlineBlock({ entity, accentColor }: DiningInlineProps) {
  const cuisines = entity.cuisine?.slice(0, 3) ?? [];
  const price = formatPriceLevel(entity.price_level);

  if (cuisines.length === 0 && !price) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {cuisines.map((c) => (
        <span
          key={c}
          className="inline-flex items-center rounded px-2 py-0.5 font-mono text-2xs capitalize"
          style={{
            backgroundColor: `${accentColor}15`,
            color: accentColor,
          }}
        >
          {c}
        </span>
      ))}
      {price && (
        <span className="font-mono text-xs text-[var(--muted)]">{price}</span>
      )}
    </div>
  );
}

interface OutdoorsInlineProps {
  entity: DiscoveryPlaceEntity;
  accentColor: string;
}

const COMMITMENT_LABELS: Record<string, string> = {
  hour: "~1 hr",
  halfday: "Half day",
  fullday: "Full day",
  weekend: "Weekend",
};

function OutdoorsInlineBlock({ entity, accentColor }: OutdoorsInlineProps) {
  const commitment = entity.commitment_tier
    ? COMMITMENT_LABELS[entity.commitment_tier] ?? entity.commitment_tier
    : null;
  const season =
    entity.best_seasons && entity.best_seasons.length > 0
      ? entity.best_seasons[0]
      : null;

  if (!commitment && !season) return null;

  return (
    <div className="flex items-center gap-1.5">
      {commitment && (
        <span
          className="inline-flex items-center rounded px-2 py-0.5 font-mono text-2xs"
          style={{
            backgroundColor: `${accentColor}20`,
            color: accentColor,
          }}
        >
          {commitment}
        </span>
      )}
      {season && (
        <span
          className="inline-flex items-center rounded px-2 py-0.5 font-mono text-2xs capitalize"
          style={{
            backgroundColor: "rgba(255, 217, 61, 0.15)",
            color: "#FFD93D",
          }}
        >
          {season.replace(/_/g, " ")}
        </span>
      )}
    </div>
  );
}

interface DefaultDescriptionProps {
  description: string | null;
}

function DefaultDescription({ description }: DefaultDescriptionProps) {
  if (!description) return null;
  return (
    <p className="text-xs text-[var(--soft)] line-clamp-2 leading-relaxed">
      {description}
    </p>
  );
}

// -------------------------------------------------------------------------
// Fallback icon map — used when hero image fails to load
// -------------------------------------------------------------------------

const FALLBACK_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>> = {
  arts: Palette,
  dining: ForkKnife,
  nightlife: MoonStars,
  outdoors: Tree,
  music: MusicNotes,
  entertainment: Ticket,
};

// -------------------------------------------------------------------------
// ExpandedPlaceCard
// -------------------------------------------------------------------------

interface ExpandedPlaceCardProps {
  entity: DiscoveryPlaceEntity;
  portalSlug: string;
  lane: VerticalLane;
}

export const ExpandedPlaceCard = memo(function ExpandedPlaceCard({
  entity,
  portalSlug,
  lane,
}: ExpandedPlaceCardProps) {
  const href = `/${portalSlug}?spot=${entity.slug}`;
  const config = LANE_CONFIG[lane];
  const accentColor = config.color;

  const rating = formatRating(entity.google_rating);
  const distance = formatDistance(entity.distance_km);
  const closeTime = formatCloseTime(entity.closes_at);
  const typeBadge = getTypeBadgeLabel(entity.place_type);
  const FallbackIcon = FALLBACK_ICONS[lane] ?? Ticket;

  return (
    <Link
      href={href}
      className="block rounded-[var(--card-radius,12px)] border border-[var(--twilight)] bg-[var(--night)] overflow-hidden hover:bg-[var(--dusk)] transition-colors"
    >
      {/* Hero image frame — 140px height */}
      <div className="relative h-[140px] w-full overflow-hidden bg-[var(--dusk)]">
        <SmartImage
          src={entity.image_url ?? ""}
          alt={entity.name}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 600px"
          fallback={
            <div
              className="flex h-full w-full items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${accentColor}20 0%, var(--dusk) 100%)` }}
            >
              <FallbackIcon size={48} className="text-[var(--muted)]" style={{ opacity: 0.3 }} />
            </div>
          }
        />

        {/* Bottom gradient overlay */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

        {/* Type badge — bottom-left, absolute */}
        <div
          className="absolute bottom-2 left-2 rounded px-1.5 py-0.5 font-mono text-2xs font-bold text-white uppercase tracking-wider"
          style={{ backgroundColor: `${accentColor}DE` }}
        >
          {typeBadge}
        </div>
      </div>

      {/* Card body */}
      <div className="p-3.5 space-y-2">
        {/* Row 1: name + rating */}
        <div className="flex items-start justify-between gap-2">
          <span className="text-base font-bold text-[var(--cream)] leading-tight">
            {entity.name}
          </span>
          {rating && (
            <span className="flex items-center gap-0.5 flex-shrink-0 mt-0.5">
              <Star size={12} color="#FFD93D" weight="fill" />
              <span className="font-mono text-xs text-[var(--muted)]">
                {rating}
              </span>
            </span>
          )}
        </div>

        {/* Vertical-specific inline block */}
        {lane === "arts" ? (
          <ArtsInlineBlock entity={entity} accentColor={accentColor} />
        ) : lane === "dining" ? (
          <DiningInlineBlock entity={entity} accentColor={accentColor} />
        ) : lane === "outdoors" ? (
          <OutdoorsInlineBlock entity={entity} accentColor={accentColor} />
        ) : (
          <DefaultDescription description={entity.short_description} />
        )}

        {/* Metadata row */}
        <div className="flex items-center gap-1.5 text-xs flex-wrap">
          {/* Open/closed badge */}
          {entity.is_open ? (
            <span className="flex items-center gap-1 text-[#00D9A0]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#00D9A0] flex-shrink-0" />
              <span className="font-mono">
                {closeTime ? `Open · Closes ${closeTime}` : "Open"}
              </span>
            </span>
          ) : (
            <span className="font-mono text-[var(--muted)]">Closed</span>
          )}

          {/* Neighborhood */}
          {entity.neighborhood && (
            <>
              <span className="text-[var(--muted)] opacity-40">·</span>
              <span className="flex items-center gap-0.5 text-[var(--muted)]">
                <MapPin size={11} weight="duotone" />
                <span className="truncate max-w-[120px]">
                  {entity.neighborhood}
                </span>
              </span>
            </>
          )}

          {/* Distance */}
          {distance && (
            <>
              <span className="text-[var(--muted)] opacity-40">·</span>
              <span className="font-mono text-[var(--muted)]">{distance}</span>
            </>
          )}

          {/* Free indicator */}
          {entity.price_level === 0 && (
            <>
              <span className="text-[var(--muted)] opacity-40">·</span>
              <span className="font-mono text-[#00D9A0]">Free</span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
});

export type { ExpandedPlaceCardProps };
