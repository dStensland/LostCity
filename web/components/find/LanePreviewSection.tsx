"use client";

import { memo } from "react";
import Link from "next/link";
import { Ticket } from "@phosphor-icons/react";
import type { VerticalLane } from "@/lib/types/discovery";
import { LANE_CONFIG, LANE_ICONS } from "@/lib/types/discovery";
import { useLaneSpots } from "@/lib/hooks/useLaneSpots";
import { DiscoveryCard } from "@/components/cards/DiscoveryCard";

// -------------------------------------------------------------------------
// Skeleton
// -------------------------------------------------------------------------

function LaneSkeleton() {
  return (
    <div className="space-y-2" aria-hidden>
      {[0, 1].map((i) => (
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
// LanePreviewSection
// -------------------------------------------------------------------------

interface LanePreviewSectionProps {
  lane: VerticalLane;
  portalSlug: string;
}

export const LanePreviewSection = memo(function LanePreviewSection({
  lane,
  portalSlug,
}: LanePreviewSectionProps) {
  const { items, openCount, loading } = useLaneSpots(portalSlug, lane, 3);

  if (!loading && items.length === 0) return null;

  const config = LANE_CONFIG[lane];
  const LaneIcon = LANE_ICONS[config.icon] ?? Ticket;
  const seeAllHref = `/${portalSlug}?view=find&lane=${lane}`;

  return (
    <section>
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <LaneIcon
            size={14}
            color={config.color}
            weight="duotone"
          />
          <span className="font-mono text-xs font-bold tracking-[0.12em] uppercase text-[var(--cream)]">
            {config.label}
          </span>
          {/* Count badge — visible once loaded */}
          {!loading && openCount > 0 && (
            <span
              className="font-mono text-2xs font-bold uppercase tracking-wider rounded px-1.5 py-0.5"
              style={{
                backgroundColor: `${config.color}1A`,
                color: config.color,
              }}
            >
              {openCount} OPEN
            </span>
          )}
        </div>
        <Link
          href={seeAllHref}
          className="text-xs flex items-center gap-1 hover:opacity-80 transition-opacity"
          style={{ color: config.color }}
        >
          See all →
        </Link>
      </div>

      {/* Content */}
      {loading ? (
        <LaneSkeleton />
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <DiscoveryCard
              key={`place-${item.id}`}
              entity={item}
              portalSlug={portalSlug}
              lane={lane}
            />
          ))}
        </div>
      )}
    </section>
  );
});

export type { LanePreviewSectionProps };
