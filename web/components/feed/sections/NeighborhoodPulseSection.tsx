"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MapPin, CaretRight } from "@phosphor-icons/react";
import FeedSectionHeader from "@/components/feed/FeedSectionHeader";

// ── Types ──────────────────────────────────────────────────────────────────────

interface NeighborhoodPulseItem {
  name: string;
  slug: string;
  tier: number;
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

const MAX_NEIGHBORHOODS = 6;

// ── Neighborhood row ──────────────────────────────────────────────────────────

interface NeighborhoodRowProps {
  item: NeighborhoodPulseItem;
  portalSlug: string;
  countLabel: string;
}

function NeighborhoodRow({ item, portalSlug, countLabel }: NeighborhoodRowProps) {
  const { name, slug, accentColor, eventsTodayCount, topCategories } = item;
  const displayCategories = topCategories.slice(0, 3).join(" \u00b7 ");

  return (
    <Link
      href={`/${portalSlug}?view=find&neighborhoods=${slug}`}
      className="flex items-center gap-3 px-4 py-3 border-b border-[var(--twilight)]/40 hover:bg-[var(--dusk)] transition-colors group"
    >
      {/* Left accent bar */}
      <div
        className="w-0.5 self-stretch rounded-full shrink-0"
        style={{ backgroundColor: accentColor }}
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-base font-semibold text-[var(--cream)] leading-tight truncate">
          {name}
        </p>
        {displayCategories && (
          <p className="text-xs text-[var(--muted)] mt-0.5 truncate">
            {displayCategories}
          </p>
        )}
      </div>

      {/* Count + arrow */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-sm text-[var(--soft)]">
          {eventsTodayCount} {countLabel}
        </span>
        <CaretRight
          weight="bold"
          className="w-3 h-3 text-[var(--muted)] group-hover:text-[var(--soft)] transition-colors"
        />
      </div>
    </Link>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-4 py-3 border-b border-[var(--twilight)]/40"
        >
          <div className="w-0.5 h-10 rounded-full bg-[var(--twilight)]/40 shrink-0 animate-pulse" />
          <div className="flex-1 space-y-1.5">
            <div className="h-4 w-32 rounded bg-[var(--cream)]/[0.04] animate-pulse" />
            <div className="h-3 w-24 rounded bg-[var(--cream)]/[0.03] animate-pulse" />
          </div>
          <div className="h-4 w-24 rounded bg-[var(--cream)]/[0.03] animate-pulse shrink-0" />
        </div>
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
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

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

    return () => { clearTimeout(timeoutId); controller.abort(); };
  }, [portalSlug]);

  // Empty state: fewer than 3 neighborhoods
  if (!loading && neighborhoods.length < 3) return null;

  const evening = isEvening();
  const countLabel = evening ? "tonight" : "today";
  const cityName = portalSlug.charAt(0).toUpperCase() + portalSlug.slice(1);
  const subtitle = evening ? `Where ${cityName} is alive tonight` : `Where ${cityName} is alive today`;

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

      {/* Vertical list */}
      <div>
        {loading ? (
          <SkeletonRows />
        ) : (
          neighborhoods.slice(0, MAX_NEIGHBORHOODS).map((item) => (
            <NeighborhoodRow
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
