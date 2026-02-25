"use client";

/**
 * Browse section — category grid for full-access exploration.
 *
 * Layout: 3-col grid of colored category buttons with icon + mono label.
 * Category-colored background tint at 10%. Interaction: hover scale + active press.
 */

import Link from "next/link";
import type { CityPulseSection } from "@/lib/city-pulse/types";
import CategoryIcon, {
  getCategoryLabel,
  getCategoryColor,
} from "@/components/CategoryIcon";

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

export default function BrowseSection({ section, portalSlug }: Props) {
  return (
    <section>
      {/* Section header */}
      <div className="flex items-center gap-2 mb-4">
        <span className="w-2 h-2 rounded-full bg-[var(--coral)]" />
        <h2 className="font-mono text-[0.6875rem] font-bold tracking-[0.12em] uppercase text-[var(--cream)]">
          {section.title || "Browse by Category"}
        </h2>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
        {BROWSE_CATEGORIES.map((cat) => {
          const catColor = getCategoryColor(cat);
          return (
            <Link
              key={cat}
              href={`/${portalSlug}?view=find&type=events&categories=${cat}`}
              className="flex flex-col items-center justify-center gap-2 py-4 rounded-2xl border transition-all hover:scale-105 active:scale-95"
              style={{
                borderColor: `color-mix(in srgb, ${catColor} 20%, transparent)`,
                backgroundColor: `color-mix(in srgb, ${catColor} 10%, transparent)`,
              }}
            >
              <CategoryIcon type={cat} size={28} />
              <span
                className="font-mono text-[0.6875rem] font-medium tracking-wide text-center leading-tight"
                style={{ color: catColor }}
              >
                {getCategoryLabel(cat)}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
