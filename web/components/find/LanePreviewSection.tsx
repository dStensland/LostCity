"use client";

import { memo } from "react";
import Link from "next/link";
import { Ticket } from "@phosphor-icons/react";
import type { VerticalLane } from "@/lib/types/discovery";
import { LANE_CONFIG, LANE_ICONS } from "@/lib/types/discovery";
import { useLaneSpots } from "@/lib/hooks/useLaneSpots";
import { DiscoveryCard } from "@/components/cards/DiscoveryCard";

// -------------------------------------------------------------------------
// Lane → "See all" URL mapping
// Routes to existing tool views with from=find breadcrumb
// -------------------------------------------------------------------------

export const LANE_SEE_ALL_URLS: Record<string, string> = {
  arts: "?view=places&tab=things-to-do&venue_type=museum,gallery,arts_center,theater&from=find",
  dining: "?view=places&tab=eat-drink&from=find",
  nightlife: "?view=places&tab=nightlife&from=find",
  outdoors: "?view=places&tab=things-to-do&venue_type=park,trail,recreation,viewpoint,landmark&from=find",
  music: "?view=happening&content=showtimes&vertical=music&from=find",
  entertainment: "?view=places&tab=things-to-do&venue_type=arcade,attraction,entertainment,escape_room,bowling,zoo,aquarium,cinema&from=find",
};

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
  const { items, openCount, totalCount, loading } = useLaneSpots(portalSlug, lane, 3);

  const config = LANE_CONFIG[lane];
  const LaneIcon = LANE_ICONS[config.icon] ?? Ticket;
  const seeAllHref = `/${portalSlug}${LANE_SEE_ALL_URLS[lane] ?? `?view=find&lane=${lane}`}`;

  if (!loading && items.length === 0) {
    return (
      <section className="px-4 pb-2 pt-4">
        <div className="flex items-center">
          <div className="flex items-center gap-2">
            <LaneIcon size={16} style={{ color: config.color }} weight="duotone" />
            <h2 className="font-mono text-xs font-bold uppercase tracking-wider" style={{ color: config.color }}>{config.label}</h2>
          </div>
          <div className="flex-1" />
          <Link href={seeAllHref} className="text-xs flex items-center gap-1 hover:opacity-80" style={{ color: config.color }}>See all →</Link>
        </div>
        <p className="mt-3 text-sm text-[var(--muted)]">Nothing nearby right now</p>
      </section>
    );
  }

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
          {/* Count badge — visible once loaded; prefer openCount, fall back to totalCount */}
          {!loading && (openCount > 0 || totalCount > 0) && (
            <span
              className="font-mono text-2xs font-bold uppercase tracking-wider rounded px-1.5 py-0.5"
              style={{
                backgroundColor: `${config.color}1A`,
                color: config.color,
              }}
            >
              {openCount > 0 ? `${openCount} OPEN` : `${totalCount} PLACES`}
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
