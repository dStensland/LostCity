"use client";

/**
 * Browse section — split into "Things to Do" (events) and "Places to Go" (destinations).
 *
 * Only shows categories with real results (non-zero counts).
 * Destination counts come from venue_type_counts in section meta.
 * Event counts come from category_counts in section meta.
 * category_representatives (new field) provides a snippet for each tile.
 */

import { useMemo } from "react";
import type { CityPulseSection } from "@/lib/city-pulse/types";
import { THINGS_TO_DO_TILES } from "@/lib/spots-constants";
import {
  getCategoryLabel,
  getCategoryColor,
} from "@/components/CategoryIcon";
import FeedSectionHeader from "@/components/feed/FeedSectionHeader";
import { MapPin, Compass } from "@phosphor-icons/react";
import { BrowseGridTile } from "./BrowseGridTile";


interface Props {
  section: CityPulseSection;
  portalSlug: string;
}

const EVENT_CATEGORIES = [
  "music",
  "film",
  "comedy",
  "theater",
  "art",
  "dance",
  "sports",
  "fitness",
  "outdoors",
  "games",
  "food_drink",
  "conventions",
  "workshops",
  "education",
  "words",
  "volunteer",
  "civic",
  "religious",
] as const;

export default function BrowseSection({ section, portalSlug }: Props) {
  const venueTypeCounts = section.meta?.venue_type_counts as Record<string, number> | undefined;
  const eventCategoryCounts = section.meta?.category_counts as Record<string, number> | undefined;

  // category_representatives is new — may be absent in cached responses
  const representatives = (
    section.meta?.category_representatives ?? {}
  ) as Record<string, { title: string; venue_name: string }>;

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
            seeAllHref={`/${portalSlug}?view=happening`}
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {eventTiles.map(({ key: cat, count }) => (
              <BrowseGridTile
                key={cat}
                category={cat}
                label={getCategoryLabel(cat)}
                count={count}
                accentColor={getCategoryColor(cat)}
                snippet={representatives[cat] ?? null}
                badge={null}
                href={`/${portalSlug}?view=happening&categories=${cat}`}
              />
            ))}
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
            seeAllHref={`/${portalSlug}?view=places`}
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {destinationTiles.map((tile) => (
              <BrowseGridTile
                key={tile.key}
                category={tile.key}
                label={tile.label}
                count={tile.count}
                accentColor={tile.color}
                snippet={null}
                badge={null}
                href={`/${portalSlug}?view=places&venue_type=${tile.venueTypes?.[0] ?? ""}`}
              />
            ))}
          </div>
        </div>
      )}

    </section>
  );
}
