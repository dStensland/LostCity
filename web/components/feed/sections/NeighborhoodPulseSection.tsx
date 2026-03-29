"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MapPin } from "@phosphor-icons/react";
import FeedSectionHeader from "@/components/feed/FeedSectionHeader";

// ── Types ──────────────────────────────────────────────────────────────────────

interface NeighborhoodPulseItem {
  name: string;
  slug: string;
  tier: string;
  eventsTodayCount: number;
  eventsWeekCount: number;
  topCategories: string[];
  accentColor: string;
}

interface NeighborhoodPulseResponse {
  neighborhoods: NeighborhoodPulseItem[];
}

export interface NeighborhoodPulseSectionProps {
  portalSlug: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function isEvening(): boolean {
  return new Date().getHours() >= 14;
}

// ── Sparkline ─────────────────────────────────────────────────────────────────

const SPARKLINE_OPACITIES = [1.0, 0.7, 0.9, 0.5, 0.8];
const SPARKLINE_HEIGHTS = [20, 12, 16, 8, 14]; // px

function Sparkline({ accentColor }: { accentColor: string }) {
  return (
    <div className="flex gap-0.5 mt-2 items-end">
      {SPARKLINE_HEIGHTS.map((height, i) => (
        <div
          key={i}
          className="w-1 rounded-sm"
          style={{
            height: `${height}px`,
            backgroundColor: accentColor,
            opacity: SPARKLINE_OPACITIES[i],
          }}
        />
      ))}
    </div>
  );
}

// ── Neighborhood card ──────────────────────────────────────────────────────────

interface NeighborhoodCardProps {
  item: NeighborhoodPulseItem;
  portalSlug: string;
  countLabel: string;
}

function NeighborhoodCard({ item, portalSlug, countLabel }: NeighborhoodCardProps) {
  const { name, slug, accentColor, eventsTodayCount, topCategories } = item;
  const displayCategories = topCategories.slice(0, 3).join(" · ");

  return (
    <Link
      href={`/${portalSlug}?view=find&neighborhoods=${slug}`}
      className="block min-w-[140px] flex-shrink-0 snap-start rounded-lg p-3.5 border transition-all hover:scale-[1.02]"
      style={{
        background: `color-mix(in srgb, ${accentColor} 10%, transparent)`,
        borderColor: `color-mix(in srgb, ${accentColor} 15%, transparent)`,
      }}
    >
      {/* Neighborhood name */}
      <p className="text-sm font-semibold text-[var(--cream)] leading-tight truncate">
        {name}
      </p>

      {/* Count */}
      <p
        className="text-2xl font-bold leading-tight mt-1 tabular-nums"
        style={{ color: accentColor }}
      >
        {eventsTodayCount}
      </p>

      {/* Label */}
      <p className="text-2xs text-[var(--muted)]">{countLabel}</p>

      {/* Sparkline */}
      <Sparkline accentColor={accentColor} />

      {/* Top categories */}
      {displayCategories && (
        <p className="text-2xs text-[var(--muted)] mt-1.5 truncate">
          {displayCategories}
        </p>
      )}
    </Link>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function SkeletonCards() {
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="min-w-[140px] h-[140px] flex-shrink-0 rounded-lg bg-white/[0.03] animate-pulse"
        />
      ))}
    </>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function NeighborhoodPulseSection({ portalSlug }: NeighborhoodPulseSectionProps) {
  const [neighborhoods, setNeighborhoods] = useState<NeighborhoodPulseItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/portals/${portalSlug}/neighborhoods/pulse`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<NeighborhoodPulseResponse>;
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        setNeighborhoods(data.neighborhoods ?? []);
        setLoading(false);
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return;
        setLoading(false);
      });

    return () => controller.abort();
  }, [portalSlug]);

  // Empty state: fewer than 3 neighborhoods
  if (!loading && neighborhoods.length < 3) return null;

  const evening = isEvening();
  const countLabel = evening ? "events tonight" : "events today";
  const subtitle = evening ? "Where Atlanta is alive tonight" : "Where Atlanta is alive today";

  return (
    <section>
      {/* Header */}
      <div className="px-4">
        <FeedSectionHeader
          title="Neighborhood Pulse"
          priority="secondary"
          accentColor="var(--coral)"
          seeAllHref={`/${portalSlug}?view=find`}
          icon={<MapPin weight="duotone" />}
        />
        <p className="text-xs text-[var(--muted)] -mt-2 mb-3">{subtitle}</p>
      </div>

      {/* Horizontal scroll */}
      <div className="flex gap-2.5 overflow-x-auto scrollbar-hide snap-x snap-mandatory px-4">
        {loading ? (
          <SkeletonCards />
        ) : (
          neighborhoods.map((item) => (
            <NeighborhoodCard
              key={item.slug}
              item={item}
              portalSlug={portalSlug}
              countLabel={countLabel}
            />
          ))
        )}
      </div>
    </section>
  );
}


