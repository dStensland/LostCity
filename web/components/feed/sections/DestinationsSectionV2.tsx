"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MapPin, Sun, Clock, Sparkle, CheckCircle, Star } from "@phosphor-icons/react";
import FeedSectionHeader from "@/components/feed/FeedSectionHeader";
import SmartImage from "@/components/SmartImage";
import Badge from "@/components/ui/Badge";
import Dot from "@/components/ui/Dot";
import FilterChip from "@/components/filters/FilterChip";
import { formatRelativeTime } from "@/lib/formats";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClosingExhibition {
  title: string;
  days_remaining: number;
}

interface DestinationV2Item {
  id: number;
  name: string;
  slug: string | null;
  neighborhood: string | null;
  place_type: string | null;
  image_url: string | null;
  google_rating: number | null;
  google_rating_count: number | null;
  is_open: boolean | null;
  created_at: string;
  indoor_outdoor: string | null;
  wheelchair: boolean | null;
  family_suitability: string | null;
  short_description: string | null;
  closing_exhibition?: ClosingExhibition | null;
}

interface DestinationsV2Response {
  destinations: DestinationV2Item[];
  lensAvailability: Record<string, boolean>;
}

export interface DestinationsSectionV2Props {
  portalSlug: string;
}

// ---------------------------------------------------------------------------
// Lens definitions
// ---------------------------------------------------------------------------

type LensKey = "weather" | "closing_soon" | "new" | "open_now" | "top_rated";

interface LensConfig {
  key: LensKey;
  label: string;
  icon: React.ReactNode;
  accentToken: string;
  chipVariant: "free" | "date" | "default";
}

const LENSES: LensConfig[] = [
  {
    key: "weather",
    label: "Weather",
    icon: <Sun weight="duotone" className="w-3.5 h-3.5" />,
    accentToken: "var(--neon-green)",
    chipVariant: "free",
  },
  {
    key: "closing_soon",
    label: "Closing Soon",
    icon: <Clock weight="duotone" className="w-3.5 h-3.5" />,
    accentToken: "var(--neon-red)",
    chipVariant: "default",
  },
  {
    key: "new",
    label: "New",
    icon: <Sparkle weight="duotone" className="w-3.5 h-3.5" />,
    accentToken: "var(--gold)",
    chipVariant: "date",
  },
  {
    key: "open_now",
    label: "Open Now",
    icon: <CheckCircle weight="duotone" className="w-3.5 h-3.5" />,
    accentToken: "var(--neon-green)",
    chipVariant: "free",
  },
  {
    key: "top_rated",
    label: "Top Rated",
    icon: <Star weight="duotone" className="w-3.5 h-3.5" />,
    accentToken: "var(--gold)",
    chipVariant: "date",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function applyLens(
  items: DestinationV2Item[],
  lens: LensKey | null,
): DestinationV2Item[] {
  if (!lens) return items;

  switch (lens) {
    case "closing_soon":
      return items.filter((d) => d.closing_exhibition != null);

    case "new": {
      const cutoff = Date.now() - THIRTY_DAYS_MS;
      return items.filter(
        (d) => d.created_at && new Date(d.created_at).getTime() >= cutoff,
      );
    }

    case "open_now":
      return items.filter((d) => d.is_open === true);

    case "top_rated":
      return [...items]
        .filter((d) => d.google_rating != null)
        .sort((a, b) => (b.google_rating ?? 0) - (a.google_rating ?? 0));

    case "weather":
      // Sort indoor first if ambiguous; no hard filter so section stays populated
      return [...items].sort((a, b) => {
        const rankA = a.indoor_outdoor === "indoor" ? 0 : a.indoor_outdoor === "outdoor" ? 1 : 2;
        const rankB = b.indoor_outdoor === "indoor" ? 0 : b.indoor_outdoor === "outdoor" ? 1 : 2;
        return rankA - rankB;
      });

    default:
      return items;
  }
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function DestinationSkeletons() {
  return (
    <section className="pb-2">
      {/* Header skeleton */}
      <div className="h-4 w-36 rounded skeleton-shimmer mb-4" style={{ opacity: 0.2 }} />
      {/* Lens chip row skeleton */}
      <div className="flex gap-2 mb-4 overflow-hidden">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex-shrink-0 h-9 w-24 rounded-full skeleton-shimmer"
            style={{ opacity: 0.12, animationDelay: `${i * 0.08}s` }}
          />
        ))}
      </div>
      {/* Card skeletons */}
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex gap-3 mb-3 items-center"
          style={{ animationDelay: `${i * 0.1}s` }}
        >
          <div
            className="flex-shrink-0 w-[52px] h-[52px] rounded-lg skeleton-shimmer"
            style={{ opacity: 0.15 }}
          />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-40 rounded skeleton-shimmer" style={{ opacity: 0.2 }} />
            <div className="h-3 w-28 rounded skeleton-shimmer" style={{ opacity: 0.12 }} />
          </div>
        </div>
      ))}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Destination card (horizontal row, ~72px height)
// ---------------------------------------------------------------------------

interface DestinationCardProps {
  item: DestinationV2Item;
  activeLens: LensKey | null;
  portalSlug: string;
}

function DestinationCard({ item, activeLens, portalSlug }: DestinationCardProps) {
  const href = item.slug ? `/${portalSlug}/spots/${item.slug}` : null;

  // Contextual secondary line based on active lens
  const contextualLine = (() => {
    if (activeLens === "closing_soon" && item.closing_exhibition) {
      return (
        <p className="text-xs leading-tight" style={{ color: "var(--neon-red)" }}>
          &ldquo;{item.closing_exhibition.title}&rdquo; closes in{" "}
          {item.closing_exhibition.days_remaining} day
          {item.closing_exhibition.days_remaining !== 1 ? "s" : ""}
        </p>
      );
    }

    if (activeLens === "new") {
      return (
        <p className="text-xs leading-tight" style={{ color: "var(--gold)" }}>
          Opened {formatRelativeTime(item.created_at)}
        </p>
      );
    }

    if (activeLens === "open_now" && item.is_open === true) {
      return (
        <Badge variant="success" size="sm">
          Open
        </Badge>
      );
    }

    if (activeLens === "weather" && item.indoor_outdoor) {
      const label =
        item.indoor_outdoor === "indoor"
          ? "Indoor"
          : item.indoor_outdoor === "outdoor"
          ? "Outdoor"
          : null;
      if (label) {
        return (
          <Badge variant="info" size="sm">
            {label}
          </Badge>
        );
      }
    }

    // No active lens — show short description or open status
    if (item.short_description) {
      return (
        <p className="text-xs text-[var(--muted)] leading-tight line-clamp-1">
          {item.short_description}
        </p>
      );
    }

    if (item.is_open === true) {
      return <Badge variant="success" size="sm">Open</Badge>;
    }
    if (item.is_open === false) {
      return <Badge variant="neutral" size="sm">Closed</Badge>;
    }

    return null;
  })();

  const cardInner = (
    <div className="flex items-center gap-3 py-2.5 group">
      {/* Thumbnail */}
      <div className="relative flex-shrink-0 w-[52px] h-[52px] rounded-lg overflow-hidden bg-[var(--twilight)]/40">
        {item.image_url ? (
          <SmartImage
            src={item.image_url}
            alt={item.name}
            fill
            className="object-cover"
            fallback={
              <div className="absolute inset-0 flex items-center justify-center bg-[var(--dusk)]">
                <MapPin weight="duotone" className="w-5 h-5 text-[var(--twilight)]" />
              </div>
            }
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--dusk)]">
            <MapPin weight="duotone" className="w-5 h-5 text-[var(--twilight)]" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-0.5">
        {/* Name */}
        <p className="text-base font-semibold text-[var(--cream)] leading-tight truncate group-hover:text-[var(--neon-green)] transition-colors">
          {item.name}
        </p>

        {/* Metadata row */}
        {(item.neighborhood || item.place_type || item.google_rating != null) && (
          <div className="flex items-center gap-1 text-xs text-[var(--muted)] leading-tight flex-wrap">
            {item.neighborhood && <span>{item.neighborhood}</span>}
            {item.neighborhood && item.place_type && <Dot />}
            {item.place_type && <span>{item.place_type}</span>}
            {item.google_rating != null && (
              <>
                {(item.neighborhood || item.place_type) && <Dot />}
                <span style={{ color: "var(--gold)" }}>
                  {item.google_rating.toFixed(1)} &#9733;
                </span>
              </>
            )}
          </div>
        )}

        {/* Contextual line */}
        {contextualLine && <div className="pt-0.5">{contextualLine}</div>}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} prefetch={false} className="block border-b border-[var(--twilight)]/30 last:border-0">
        {cardInner}
      </Link>
    );
  }

  return (
    <div className="border-b border-[var(--twilight)]/30 last:border-0">
      {cardInner}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main section
// ---------------------------------------------------------------------------

export function DestinationsSectionV2({ portalSlug }: DestinationsSectionV2Props) {
  const [destinations, setDestinations] = useState<DestinationV2Item[]>([]);
  const [lensAvailability, setLensAvailability] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [activeLens, setActiveLens] = useState<LensKey | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    fetch(`/api/portals/${portalSlug}/destinations`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<DestinationsV2Response>;
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        setDestinations(data.destinations ?? []);
        setLensAvailability(data.lensAvailability ?? {});
        setLoading(false);
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return;
        setLoading(false);
      });

    return () => { clearTimeout(timeoutId); controller.abort(); };
  }, [portalSlug]);

  if (loading) return <DestinationSkeletons />;

  const filtered = applyLens(destinations, activeLens);
  if (filtered.length < 2) return null;

  const visibleLenses = LENSES.filter((l) => lensAvailability[l.key] === true);

  return (
    <section className="pb-2 feed-section-enter">
      <FeedSectionHeader
        title="Destinations"
        priority="secondary"
        accentColor="var(--neon-green)"
        icon={<MapPin weight="duotone" className="w-4 h-4" />}
        seeAllHref={`/${portalSlug}?view=find`}
        seeAllLabel="Explore"
      />

      {/* Lens chip row */}
      {visibleLenses.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-3 -mx-4 px-4">
          {visibleLenses.map((lens) => (
            <div key={lens.key} className="flex-shrink-0 flex items-center gap-1.5">
              <FilterChip
                label={lens.label}
                variant={lens.chipVariant}
                active={activeLens === lens.key}
                size="sm"
                onClick={() =>
                  setActiveLens((prev) => (prev === lens.key ? null : lens.key))
                }
              />
            </div>
          ))}
        </div>
      )}

      {/* Card list */}
      <div className="rounded-xl overflow-hidden border border-[var(--twilight)]/40 bg-[var(--night)] px-3">
        {filtered.slice(0, 8).map((item) => (
          <DestinationCard
            key={item.id}
            item={item}
            activeLens={activeLens}
            portalSlug={portalSlug}
          />
        ))}
      </div>
    </section>
  );
}

// DestinationsSectionV2Props is exported inline above
