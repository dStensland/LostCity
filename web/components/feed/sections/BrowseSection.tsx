"use client";

/**
 * Browse section — split into "Things to Do" (events) and "Places to Go" (destinations).
 *
 * Only shows categories with real results (non-zero counts).
 * Destination counts come from venue_type_counts in section meta.
 * Event counts come from category_counts in section meta.
 */

import { useMemo } from "react";
import Link from "next/link";
import type { CityPulseSection } from "@/lib/city-pulse/types";
import { THINGS_TO_DO_TILES } from "@/lib/spots-constants";
import CategoryIcon, {
  getCategoryLabel,
  getCategoryColor,
} from "@/components/CategoryIcon";
import FeedSectionHeader from "@/components/feed/FeedSectionHeader";
import { MapPin, Compass } from "@phosphor-icons/react";

interface Props {
  section: CityPulseSection;
  portalSlug: string;
}

const EVENT_CATEGORIES = [
  "music",
  "nightlife",
  "food_drink",
  "art",
  "comedy",
  "sports",
  "community",
  "exercise",
  "recreation",
  "learning",
  "family",
  "film",
  "theater",
] as const;

export default function BrowseSection({ section, portalSlug }: Props) {
  const venueTypeCounts = section.meta?.venue_type_counts as Record<string, number> | undefined;
  const eventCategoryCounts = section.meta?.category_counts as Record<string, number> | undefined;

  // Destination tiles with aggregated counts from venue types
  const destinationTiles = useMemo(() => {
    if (!venueTypeCounts) return [];
    return THINGS_TO_DO_TILES.map((tile) => {
      const count = tile.venueTypes.reduce(
        (sum, vt) => sum + (venueTypeCounts[vt] || 0),
        0,
      );
      return { ...tile, count };
    }).filter((tile) => tile.count > 0);
  }, [venueTypeCounts]);

  // Event categories with counts
  const eventTiles = useMemo(() => {
    if (!eventCategoryCounts) return [];
    return EVENT_CATEGORIES.map((cat) => ({
      key: cat,
      count: eventCategoryCounts[cat] || 0,
    })).filter((t) => t.count > 0);
  }, [eventCategoryCounts]);

  if (destinationTiles.length === 0 && eventTiles.length === 0) return null;

  return (
    <section className="pb-2 space-y-8">
      {/* Things to Do */}
      {eventTiles.length > 0 && (
        <div>
          <FeedSectionHeader
            title="Things to Do"
            priority="secondary"
            accentColor="var(--neon-cyan)"
            icon={<Compass weight="duotone" className="w-5 h-5" />}
            seeAllHref={`/${portalSlug}?view=find&type=events`}
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {eventTiles.map(({ key: cat, count }) => {
              const catColor = getCategoryColor(cat);
              return (
                <Link
                  key={cat}
                  href={`/${portalSlug}?view=find&type=events&categories=${cat}`}
                  className="relative flex flex-col items-center justify-center gap-1.5 py-4 rounded-2xl border transition-all hover:scale-105 active:scale-95"
                  style={{
                    borderColor: `color-mix(in srgb, ${catColor} 28%, transparent)`,
                    backgroundColor: `color-mix(in srgb, ${catColor} 10%, transparent)`,
                  }}
                >
                  <CategoryIcon type={cat} size={28} />
                  <span
                    className="font-mono text-xs font-medium tracking-wide text-center leading-tight"
                    style={{ color: catColor }}
                  >
                    {getCategoryLabel(cat)}
                  </span>
                  <span
                    className="font-mono text-2xs tabular-nums"
                    style={{ color: `color-mix(in srgb, ${catColor} 70%, var(--muted))` }}
                  >
                    {count} {count === 1 ? "event" : "events"}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Places to Go */}
      {destinationTiles.length > 0 && (
        <div>
          <FeedSectionHeader
            title="Places to Go"
            priority="secondary"
            accentColor="var(--neon-green)"
            icon={<MapPin weight="duotone" className="w-5 h-5" />}
            seeAllHref={`/${portalSlug}?view=find&type=spots`}
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {destinationTiles.map((tile) => (
              <Link
                key={tile.key}
                href={`/${portalSlug}?view=find&type=spots`}
                className="relative flex flex-col items-center justify-center gap-1.5 py-4 rounded-2xl border transition-all hover:scale-105 active:scale-95"
                style={{
                  borderColor: `color-mix(in srgb, ${tile.color} 28%, transparent)`,
                  backgroundColor: `color-mix(in srgb, ${tile.color} 10%, transparent)`,
                }}
              >
                <CategoryIcon type={tile.iconType} size={28} />
                <span
                  className="font-mono text-xs font-medium tracking-wide text-center leading-tight"
                  style={{ color: tile.color }}
                >
                  {tile.label}
                </span>
                <span
                  className="font-mono text-2xs tabular-nums"
                  style={{ color: `color-mix(in srgb, ${tile.color} 70%, var(--muted))` }}
                >
                  {tile.count} {tile.count === 1 ? "place" : "places"}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
