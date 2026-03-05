"use client";

/**
 * Browse section — category grid for full-access exploration.
 *
 * Layout: 3-col grid of colored category buttons with icon + label + count.
 * Categories with high event counts get a "hot" glow treatment.
 */

import { useMemo } from "react";
import Link from "next/link";
import type { CityPulseSection } from "@/lib/city-pulse/types";
import CategoryIcon, {
  getCategoryLabel,
  getCategoryColor,
} from "@/components/CategoryIcon";
import FeedSectionHeader from "@/components/feed/FeedSectionHeader";
import { Compass } from "@phosphor-icons/react";

interface Props {
  section: CityPulseSection;
  portalSlug: string;
}

const BROWSE_CATEGORIES = [
  "music",
  "nightlife",
  "food_drink",
  "art",
  "comedy",
  "sports",
  "community",
  "fitness",
  "learning",
  "family",
  "film",
  "theater",
] as const;

/** Threshold for "hot" category treatment */
const HOT_THRESHOLD = 5;

export default function BrowseSection({ section, portalSlug }: Props) {
  // Compute per-category event counts from section items or meta
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    // Try section.meta first (server may provide pre-computed counts)
    const metaCounts = section.meta?.category_counts as Record<string, number> | undefined;
    if (metaCounts) return metaCounts;

    // Fall back to counting items in the section
    for (const item of section.items) {
      if (item.item_type === "event") {
        const cat = item.event.category;
        if (cat) counts[cat] = (counts[cat] || 0) + 1;
      }
    }
    return counts;
  }, [section]);

  const hasCounts = Object.values(categoryCounts).some((c) => c > 0);

  return (
    <section className="pb-2">
      {/* Section header */}
      <FeedSectionHeader
        title={section.title || "Browse"}
        priority="secondary"
        accentColor="var(--neon-cyan)"
        icon={<Compass weight="duotone" className="w-5 h-5" />}
      />

      {/* Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
        {BROWSE_CATEGORIES.map((cat) => {
          const catColor = getCategoryColor(cat);
          const count = categoryCounts[cat] || 0;
          const isHot = count >= HOT_THRESHOLD;

          return (
            <Link
              key={cat}
              href={`/${portalSlug}?view=find&type=events&categories=${cat}`}
              className={[
                "relative flex flex-col items-center justify-center gap-1.5 py-4 rounded-2xl border transition-all hover:scale-105 active:scale-95",
                isHot ? "ring-1" : "",
              ].join(" ")}
              style={{
                borderColor: `color-mix(in srgb, ${catColor} ${isHot ? "40" : "28"}%, transparent)`,
                backgroundColor: `color-mix(in srgb, ${catColor} ${isHot ? "16" : "10"}%, transparent)`,
                ...(isHot ? {
                  ringColor: `color-mix(in srgb, ${catColor} 25%, transparent)`,
                  boxShadow: `0 0 16px -4px color-mix(in srgb, ${catColor} 30%, transparent)`,
                } : {}),
              }}
            >
              <CategoryIcon type={cat} size={28} />
              <span
                className="font-mono text-xs font-medium tracking-wide text-center leading-tight"
                style={{ color: catColor }}
              >
                {getCategoryLabel(cat)}
              </span>
              {hasCounts && count > 0 && (
                <span
                  className="font-mono text-2xs tabular-nums"
                  style={{ color: `color-mix(in srgb, ${catColor} 70%, var(--muted))` }}
                >
                  {count} {count === 1 ? "event" : "events"}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
