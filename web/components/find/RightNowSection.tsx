"use client";

import { memo } from "react";
import Link from "next/link";
import { useRightNow } from "@/lib/hooks/useRightNow";
import { DiscoveryCard } from "@/components/cards/DiscoveryCard";

// -------------------------------------------------------------------------
// Header label — contextual based on time of day
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

// -------------------------------------------------------------------------
// Skeleton — shown while loading
// -------------------------------------------------------------------------

function RightNowSkeleton() {
  return (
    <div className="space-y-2" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-[72px] rounded-card bg-[var(--dusk)] animate-pulse"
          style={{ animationDelay: `${i * 80}ms` }}
        />
      ))}
    </div>
  );
}

// -------------------------------------------------------------------------
// RightNowSection
// -------------------------------------------------------------------------

interface RightNowSectionProps {
  portalSlug: string;
}

export const RightNowSection = memo(function RightNowSection({
  portalSlug,
}: RightNowSectionProps) {
  const { items, loading } = useRightNow(portalSlug, 6);

  const seeAllHref = `/${portalSlug}?view=find&display=list`;
  const label = getRightNowLabel();

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

      {/* Content */}
      {loading ? (
        <RightNowSkeleton />
      ) : items.length === 0 ? null : (
        <div className="space-y-2">
          {items.map((item) => (
            <DiscoveryCard
              key={`${item.entity_type}-${item.id}`}
              entity={item}
              portalSlug={portalSlug}
            />
          ))}
        </div>
      )}
    </section>
  );
});

export type { RightNowSectionProps };
