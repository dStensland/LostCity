"use client";

import { memo } from "react";
import Link from "next/link";
import type { RightNowItem } from "@/lib/find-data";

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

function getRightNowLabel(): string {
  const now = new Date();
  const hour = now.getHours();
  const dayName = now.toLocaleDateString("en-US", { weekday: "long" });

  // Night mode: after 10pm or before 5am
  if (hour >= 22 || hour < 5) {
    return "Open Now";
  }

  // Format hour as "11am" / "2pm"
  const period = hour >= 12 ? "pm" : "am";
  const h = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const timeStr = `${h}${period}`;

  return `Right Now · ${dayName} ${timeStr}`;
}

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "pm" : "am";
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${hour}${period}` : `${hour}:${String(m).padStart(2, "0")}${period}`;
}

// -------------------------------------------------------------------------
// RightNowSection
// -------------------------------------------------------------------------

interface RightNowSectionProps {
  items: RightNowItem[];
  portalSlug: string;
}

export const RightNowSection = memo(function RightNowSection({
  items,
  portalSlug,
}: RightNowSectionProps) {
  if (items.length === 0) return null;

  const seeAllHref = `/${portalSlug}?view=find&display=list`;
  const label = getRightNowLabel();
  const displayItems = items.slice(0, 4);

  return (
    <section>
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-xs font-bold tracking-[0.12em] uppercase text-[var(--coral)]">
          {label}
        </span>
        <Link
          href={seeAllHref}
          className="text-xs flex items-center gap-1 text-[var(--coral)] hover:opacity-80 transition-opacity"
        >
          See all →
        </Link>
      </div>

      {/* Compact rows */}
      <div className="space-y-0.5">
        {displayItems.map((item) => (
          <Link
            key={`${item.entity_type}-${item.id}`}
            href={`/${portalSlug}?${item.entity_type === "place" ? "spot" : "event"}=${item.entity_type === "place" ? item.slug : item.id}`}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--dusk)] transition-colors group"
          >
            {/* Time or status */}
            <span className="font-mono text-xs font-bold tabular-nums text-[var(--gold)] w-12 shrink-0 text-right">
              {item.entity_type === "event" && item.start_time
                ? formatTime(item.start_time)
                : item.is_open
                  ? "Open"
                  : ""}
            </span>
            {/* Name + venue */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[var(--cream)] truncate group-hover:text-[var(--coral)] transition-colors">
                {item.name}
              </p>
              <p className="text-xs text-[var(--muted)] truncate">
                {item.venue_name ?? item.place_type}
                {item.neighborhood ? ` · ${item.neighborhood}` : ""}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
});

export type { RightNowSectionProps };
