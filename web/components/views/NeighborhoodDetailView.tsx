"use client";

import { useEffect, useMemo, useRef } from "react";
import { markOverlayPhase } from "@/lib/detail/overlay-perf";
import Link from "next/link";
import { X } from "@phosphor-icons/react";
import SmartImage from "@/components/SmartImage";
import PlaceCard from "@/components/PlaceCard";
import ScheduleRow, {
  type ScheduleRowEvent,
} from "@/components/shared/ScheduleRow";
import { getNeighborhoodHeroStyle } from "@/components/neighborhoods/NeighborhoodHeroStyle";
import { getNeighborhoodColor } from "@/lib/neighborhood-colors";
import { useDetailFetch } from "@/lib/hooks/useDetailFetch";
import { decodeHtmlEntities } from "@/lib/formats";
import { buildNeighborhoodUrl } from "@/lib/entity-urls";
import type { NeighborhoodSeed } from "@/lib/detail/entity-preview-store";
import type { Spot } from "@/lib/spots-constants";
import type { Event } from "@/lib/supabase";

interface NeighborhoodDetailPayload {
  neighborhood: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    color: string;
    lat: number;
    lng: number;
    tier: 1 | 2 | 3;
    heroImage?: string;
  };
  spots: (Spot & { event_count: number })[];
  events: Event[];
  counts: {
    todayCount: number;
    upcomingCount: number;
    spotCount: number;
  };
}

interface NeighborhoodDetailViewProps {
  slug: string;
  portalSlug: string;
  onClose: () => void;
  /** Server-fetched data — skips client fetch when provided */
  initialData?: NeighborhoodDetailPayload;
  /** Partial card-published seed for fast first paint. */
  seedData?: NeighborhoodSeed;
}

/**
 * Seeded skeleton that matches the neighborhood overlay's layout: max-w-3xl,
 * 240-280px hero with dominant color, name + stats line. Replaces the generic
 * "Loading…" flash when the card published a seed on render.
 */
function SeededNeighborhoodSkeleton({ seed }: { seed: NeighborhoodSeed }) {
  const color = seed.color || getNeighborhoodColor(seed.name);
  const heroStyle = getNeighborhoodHeroStyle(color, seed.hero_image ?? undefined);
  const statsParts: string[] = [];
  if (seed.events_today_count && seed.events_today_count > 0) {
    statsParts.push(
      `${seed.events_today_count} ${
        seed.events_today_count === 1 ? "event" : "events"
      } tonight`,
    );
  }
  if (seed.venue_count) {
    statsParts.push(
      `${seed.venue_count} ${seed.venue_count === 1 ? "spot" : "spots"}`,
    );
  }
  return (
    <div
      className="max-w-3xl mx-auto px-4 py-4 sm:py-6 pb-24 space-y-6"
      aria-busy="true"
      aria-label="Loading"
    >
      <section
        className="relative overflow-hidden rounded-card-xl border border-[var(--twilight)] h-[240px] sm:h-[280px]"
        style={heroStyle.gradient}
      >
        {heroStyle.imageSrc && (
          <SmartImage
            src={heroStyle.imageSrc}
            alt=""
            fill
            className="opacity-80 object-cover"
          />
        )}
        <div
          className="absolute inset-x-0 bottom-0 h-3/5 pointer-events-none"
          style={{
            background:
              "linear-gradient(180deg, transparent 0%, rgba(9,9,11,0.75) 60%, rgba(9,9,11,0.95) 100%)",
          }}
          aria-hidden="true"
        />
        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8 space-y-2">
          <h1 className="text-3xl sm:text-4xl font-bold text-[var(--cream)] tracking-[-0.01em] leading-tight">
            {seed.name}
          </h1>
          {statsParts.length > 0 && (
            <p className="font-mono text-xs text-[var(--cream)]/80 tracking-[0.14em] uppercase">
              {statsParts.join(" · ")}
            </p>
          )}
        </div>
      </section>
      {[0, 1].map((i) => (
        <div key={i} className="space-y-3">
          <div className="h-3 w-32 bg-[var(--twilight)]/40 rounded animate-pulse" />
          <div className="space-y-2">
            <div className="h-4 w-full bg-[var(--twilight)]/25 rounded animate-pulse" />
            <div className="h-4 w-5/6 bg-[var(--twilight)]/25 rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

function toScheduleRowEvent(ev: Event): ScheduleRowEvent {
  const venue = (ev as Event & { venue?: { name: string; slug?: string } | null })
    .venue;
  return {
    id: ev.id,
    title: ev.title,
    start_date: ev.start_date,
    start_time: ev.start_time,
    is_all_day: ev.is_all_day ?? null,
    place: venue ? { name: venue.name, slug: venue.slug } : null,
    category_id:
      (ev as Event & { category_id?: string | null }).category_id ?? null,
    image_url: ev.image_url ?? null,
  };
}

/**
 * NeighborhoodDetailView — overlay-shaped detail render for `?neighborhood=slug`.
 *
 * Lighter than the standalone /[portal]/neighborhoods/[slug] page (no map,
 * no nearby chip rail, no "see all" overflow rows) — overlay is for
 * in-context glance, not deep planning. Users wanting the full experience
 * tap the canonical link in the overlay header.
 */
export default function NeighborhoodDetailView({
  slug,
  portalSlug,
  onClose,
  initialData,
  seedData,
}: NeighborhoodDetailViewProps) {
  const fetchUrl = useMemo(() => {
    if (initialData) return null;
    return `/api/neighborhoods/${slug}?portal=${portalSlug}`;
  }, [initialData, slug, portalSlug]);

  const { data: fetchedData, status } =
    useDetailFetch<NeighborhoodDetailPayload>(fetchUrl, {
      entityLabel: "neighborhood",
    });

  const resolvedStatus = initialData ? ("ready" as const) : status;
  const stampedRef = useRef<string | null>(null);
  useEffect(() => {
    if (resolvedStatus !== "ready") return;
    const ref = `neighborhood:${slug}`;
    if (stampedRef.current === ref) return;
    stampedRef.current = ref;
    markOverlayPhase("content-ready", ref);
  }, [resolvedStatus, slug]);

  const data = (initialData ?? fetchedData) as NeighborhoodDetailPayload | null;

  if (!data) {
    if (status === "error") {
      return (
        <div className="max-w-3xl mx-auto px-4 py-12 text-center">
          <p className="text-sm text-[var(--muted)]">
            Couldn&apos;t load this neighborhood.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 font-mono text-xs text-[var(--coral)] hover:opacity-80"
          >
            Close
          </button>
        </div>
      );
    }
    if (seedData) return <SeededNeighborhoodSkeleton seed={seedData} />;
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <p className="font-mono text-xs text-[var(--muted)]">Loading…</p>
      </div>
    );
  }

  const { neighborhood, spots, events, counts } = data;
  const color = neighborhood.color || getNeighborhoodColor(neighborhood.name);
  const heroStyle = getNeighborhoodHeroStyle(color, neighborhood.heroImage);

  // Canonical-page URL (always canonical since it's an "open as full page" affordance)
  const canonicalUrl = buildNeighborhoodUrl(
    neighborhood.slug,
    portalSlug,
    "canonical",
  );

  const statsParts: string[] = [];
  if (counts.todayCount > 0) {
    statsParts.push(
      `${counts.todayCount} ${counts.todayCount === 1 ? "event" : "events"} tonight`,
    );
  }
  if (counts.upcomingCount > counts.todayCount) {
    statsParts.push(`${counts.upcomingCount} this week`);
  }
  statsParts.push(
    `${counts.spotCount} ${counts.spotCount === 1 ? "spot" : "spots"}`,
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-4 sm:py-6 pb-24 space-y-6">
      {/* Hero */}
      <section
        className="relative overflow-hidden rounded-card-xl border border-[var(--twilight)] h-[240px] sm:h-[280px]"
        style={heroStyle.gradient}
      >
        {heroStyle.imageSrc && (
          <SmartImage
            src={heroStyle.imageSrc}
            alt=""
            fill
            className="opacity-80 object-cover"
          />
        )}
        {/* Bottom vignette so text reads */}
        <div
          className="absolute inset-x-0 bottom-0 h-3/5 pointer-events-none"
          style={{
            background:
              "linear-gradient(180deg, transparent 0%, rgba(9,9,11,0.75) 60%, rgba(9,9,11,0.95) 100%)",
          }}
          aria-hidden="true"
        />

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center bg-[var(--void)]/70 hover:bg-[var(--twilight)] transition-colors"
        >
          <X weight="bold" className="w-4 h-4 text-[var(--cream)]" />
        </button>

        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span
              className="w-[7px] h-[7px] rounded-full flex-shrink-0"
              style={{ backgroundColor: color }}
              aria-hidden="true"
            />
            <span
              className="font-mono text-2xs font-bold uppercase tracking-[0.14em]"
              style={{
                color: counts.todayCount > 0 ? color : "var(--muted)",
              }}
            >
              {neighborhood.name.toUpperCase()}
              {counts.todayCount > 0 ? " · ALIVE TONIGHT" : ""}
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-[var(--cream)] leading-none">
            {neighborhood.name}
          </h2>
          <p className="text-sm text-[var(--soft)]">{statsParts.join(" · ")}</p>
        </div>
      </section>

      {neighborhood.description && (
        <p className="text-sm text-[var(--soft)] leading-relaxed">
          {neighborhood.description}
        </p>
      )}

      {/* Tonight / upcoming events */}
      {events.length > 0 && (
        <section>
          <div className="flex items-center justify-between pt-3 border-t border-[var(--twilight)] mb-3">
            <span
              className="font-mono text-xs font-bold uppercase tracking-[0.14em]"
              style={{ color: counts.todayCount > 0 ? color : "var(--muted)" }}
            >
              Upcoming
            </span>
            <span className="font-mono text-2xs tabular-nums text-[var(--muted)]">
              {events.length}
            </span>
          </div>
          <div className="space-y-2">
            {events.map((ev) => (
              <ScheduleRow
                key={ev.id}
                event={{
                  ...toScheduleRowEvent(ev),
                  title: decodeHtmlEntities(ev.title),
                }}
                accentColor={color}
                portalSlug={portalSlug}
              />
            ))}
          </div>
        </section>
      )}

      {/* Popular spots */}
      {spots.length > 0 && (
        <section>
          <div className="flex items-center justify-between pt-3 border-t border-[var(--twilight)] mb-3">
            <span className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
              Popular Spots
            </span>
            <span className="font-mono text-2xs tabular-nums text-[var(--muted)]">
              {spots.length}
            </span>
          </div>
          <div className="space-y-1">
            {spots.map((spot, i) => (
              <PlaceCard
                key={spot.id}
                venue={spot}
                index={i}
                portalSlug={portalSlug}
                variant="compact"
                hideNeighborhood
              />
            ))}
          </div>
        </section>
      )}

      {/* Open-as-page link — escape hatch to the standalone detail page */}
      <div className="pt-3 border-t border-[var(--twilight)]">
        <Link
          href={canonicalUrl}
          className="inline-flex items-center font-mono text-xs text-[var(--coral)] hover:opacity-80 transition-opacity"
        >
          Open {neighborhood.name} page →
        </Link>
        <span className="ml-2 font-mono text-2xs text-[var(--muted)]">
          (full directory)
        </span>
      </div>
    </div>
  );
}
