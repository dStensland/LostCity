"use client";

import { useLayoutEffect } from "react";
import { parseISO, format } from "date-fns";
import SmartImage from "@/components/SmartImage";
import type { SeedPayload } from "@/lib/detail/entity-preview-store";
import { markOverlayPhase } from "@/lib/detail/overlay-perf";

/**
 * Seeded detail-view skeleton — renders hero image + title + one breadcrumb
 * line using the card-published seed payload so the overlay paints real
 * content instantly instead of gray shimmer. The section shimmer blocks
 * below match DetailLoadingSkeleton so the swap to full data is subtle.
 *
 * Used by detail views when `seedData` is present and the real fetch
 * hasn't landed yet.
 */
export function SeededDetailSkeleton({ seed }: { seed: SeedPayload }) {
  const { title, breadcrumb, imageUrl } = deriveDisplay(seed);

  // Stamp first-paint time — the whole point of seeding is getting real
  // pixels on screen before the fetch lands. useLayoutEffect fires after
  // DOM mutations but before the browser paints, which is as close to
  // actual first-paint as we can cheaply observe.
  useLayoutEffect(() => {
    const key = seedRefKey(seed);
    if (key) markOverlayPhase("seeded-paint", key);
  }, [seed]);

  return (
    <div className="relative min-h-[100dvh] bg-[var(--void)]" aria-busy="true" aria-label="Loading">
      {/* Hero — real image from the card */}
      <div className="relative w-full h-[300px] lg:h-[55vh] lg:min-h-[400px] lg:max-h-[700px] overflow-hidden">
        {imageUrl ? (
          <SmartImage
            src={imageUrl}
            alt=""
            fill
            className="object-cover"
            sizes="(min-width: 1024px) 100vw, 100vw"
          />
        ) : (
          <div className="absolute inset-0 bg-[var(--twilight)]/40 animate-pulse" />
        )}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[var(--void)] to-transparent" />
      </div>

      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        {/* Identity — real title + breadcrumb */}
        <div className="pt-6 pb-4 space-y-3">
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--cream)] tracking-[-0.01em] leading-tight">
            {title}
          </h1>
          {breadcrumb && (
            <p className="font-mono text-xs text-[var(--muted)] uppercase tracking-[0.14em]">
              {breadcrumb}
            </p>
          )}
        </div>

        {/* Section placeholders — content loads here */}
        {[0, 1, 2].map((i) => (
          <div key={i} className="py-6 space-y-3 border-t border-[var(--twilight)]/30">
            <div className="h-3 w-24 bg-[var(--twilight)]/40 rounded animate-pulse" />
            <div className="space-y-2">
              <div className="h-4 w-full bg-[var(--twilight)]/25 rounded animate-pulse" />
              <div className="h-4 w-5/6 bg-[var(--twilight)]/25 rounded animate-pulse" />
              <div className="h-4 w-2/3 bg-[var(--twilight)]/25 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function seedRefKey(seed: SeedPayload): string | null {
  switch (seed.kind) {
    case "event":
      return `event:${seed.id}`;
    case "spot":
    case "series":
    case "festival":
    case "org":
    case "neighborhood":
      return `${seed.kind}:${seed.slug}`;
  }
}

function deriveDisplay(seed: SeedPayload): {
  title: string;
  breadcrumb: string | null;
  imageUrl: string | null;
} {
  switch (seed.kind) {
    case "event":
      return {
        title: seed.title,
        breadcrumb: formatEventBreadcrumb(seed),
        imageUrl: seed.image_url ?? null,
      };
    case "spot":
      return {
        title: seed.name,
        breadcrumb: seed.neighborhood ?? null,
        imageUrl: seed.image_url ?? null,
      };
    case "series":
      return {
        title: seed.title,
        breadcrumb: seed.category ?? null,
        imageUrl: seed.image_url ?? null,
      };
    case "festival":
      return {
        title: seed.name,
        breadcrumb: formatFestivalBreadcrumb(seed),
        imageUrl: seed.image_url ?? null,
      };
    case "org":
      return {
        title: seed.name,
        breadcrumb: seed.tagline ?? null,
        imageUrl: seed.logo_url ?? null,
      };
    case "neighborhood":
      return {
        title: seed.name,
        breadcrumb: formatNeighborhoodBreadcrumb(seed),
        imageUrl: seed.hero_image ?? null,
      };
  }
}

function formatEventBreadcrumb(seed: {
  start_date?: string | null;
  venue?: { name: string } | null;
}): string | null {
  const parts: string[] = [];
  if (seed.start_date) {
    try {
      parts.push(format(parseISO(seed.start_date), "MMM d").toUpperCase());
    } catch {
      // ignore — date might be malformed
    }
  }
  if (seed.venue?.name) parts.push(seed.venue.name.toUpperCase());
  return parts.length > 0 ? parts.join(" · ") : null;
}

function formatFestivalBreadcrumb(seed: {
  announced_start?: string | null;
  announced_end?: string | null;
  neighborhood?: string | null;
}): string | null {
  const parts: string[] = [];
  if (seed.announced_start) {
    try {
      const start = format(parseISO(seed.announced_start), "MMM d");
      const end = seed.announced_end
        ? format(parseISO(seed.announced_end), "MMM d")
        : null;
      parts.push(end && end !== start ? `${start} – ${end}` : start);
    } catch {
      // ignore
    }
  }
  if (seed.neighborhood) parts.push(seed.neighborhood);
  return parts.length > 0 ? parts.join(" · ").toUpperCase() : null;
}

function formatNeighborhoodBreadcrumb(seed: {
  events_today_count?: number | null;
  venue_count?: number | null;
}): string | null {
  const parts: string[] = [];
  if (seed.events_today_count && seed.events_today_count > 0) {
    parts.push(`${seed.events_today_count} TONIGHT`);
  }
  if (seed.venue_count) {
    parts.push(`${seed.venue_count} ${seed.venue_count === 1 ? "PLACE" : "PLACES"}`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}
