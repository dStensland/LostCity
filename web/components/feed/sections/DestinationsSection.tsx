"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import Link from "next/link";
import { MapPin } from "@phosphor-icons/react";
import FeedSectionHeader from "@/components/feed/FeedSectionHeader";
import { PressQuote } from "@/components/feed/PressQuote";
import SmartImage from "@/components/SmartImage";

// ── Types ──────────────────────────────────────────────────────────────────────

interface DestinationVenue {
  id: number;
  name: string;
  slug: string | null;
  neighborhood: string | null;
  venue_type: string | null;
  image_url: string | null;
}

interface DestinationItem {
  venue: DestinationVenue;
  occasion: string;
  contextual_label: string;
  editorial_quote: { snippet: string; source: string } | null;
}

interface DestinationsResponse {
  destinations: DestinationItem[];
}

export interface DestinationsSectionProps {
  portalSlug: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const CARD_WIDTH = 220;
const GAP = 12;

// ── Skeleton ───────────────────────────────────────────────────────────────────

function DestinationCardSkeleton() {
  return (
    <div
      className="flex-shrink-0 rounded-card overflow-hidden bg-[var(--night)] border border-[var(--twilight)]/40 animate-pulse"
      style={{ width: CARD_WIDTH }}
    >
      <div className="h-28 bg-[var(--twilight)]/40" />
      <div className="p-3 space-y-2">
        <div className="h-2 w-20 rounded bg-[var(--twilight)]/60" />
        <div className="h-3.5 w-36 rounded bg-[var(--twilight)]/50" />
        <div className="h-2.5 w-24 rounded bg-[var(--twilight)]/40" />
      </div>
    </div>
  );
}

// ── Destination card ───────────────────────────────────────────────────────────

interface DestinationCardProps {
  item: DestinationItem;
  portalSlug: string;
}

function DestinationCard({ item, portalSlug }: DestinationCardProps) {
  const { venue, contextual_label, editorial_quote } = item;
  const href = venue.slug ? `/${portalSlug}/places/${venue.slug}` : null;

  const inner = (
    <div
      className="flex-shrink-0 rounded-card overflow-hidden bg-[var(--night)] border border-[var(--twilight)]/40 hover-lift shadow-card-sm"
      style={{ width: CARD_WIDTH }}
    >
      {/* Image with gradient overlay */}
      <div className="relative h-28 overflow-hidden bg-[var(--twilight)]/30">
        {venue.image_url ? (
          <SmartImage
            src={venue.image_url}
            alt={venue.name}
            fill
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <MapPin weight="duotone" className="w-8 h-8 text-[var(--twilight)]" />
          </div>
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[var(--night)] via-[var(--night)]/60 to-transparent" />
      </div>

      {/* Card body */}
      <div className="p-3 space-y-1.5">
        {/* Contextual label */}
        <p
          className="font-mono text-2xs font-bold tracking-[0.1em] uppercase"
          style={{ color: "var(--neon-green)" }}
        >
          {contextual_label}
        </p>

        {/* Venue name */}
        <p className="text-base font-semibold text-[var(--cream)] leading-snug line-clamp-2">
          {venue.name}
        </p>

        {/* Neighborhood + venue type */}
        {(venue.neighborhood || venue.venue_type) && (
          <p className="text-xs text-[var(--muted)] leading-tight">
            {[venue.neighborhood, venue.venue_type]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}

        {/* Editorial quote */}
        {editorial_quote && (
          <div className="pt-1">
            <PressQuote
              snippet={editorial_quote.snippet}
              source={editorial_quote.source}
            />
          </div>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="snap-start block">
        {inner}
      </Link>
    );
  }

  return <div className="snap-start">{inner}</div>;
}

// ── Main section ───────────────────────────────────────────────────────────────

export function DestinationsSection({ portalSlug }: DestinationsSectionProps) {
  const [destinations, setDestinations] = useState<DestinationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Fetch destinations
  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/portals/${portalSlug}/destinations`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<DestinationsResponse>;
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        setDestinations(data.destinations ?? []);
        setLoading(false);
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return;
        setLoading(false);
      });

    return () => controller.abort();
  }, [portalSlug]);

  // Carousel scroll tracking
  const updateScrollState = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollLeft } = scrollRef.current;
    const index = Math.round(scrollLeft / (CARD_WIDTH + GAP));
    setActiveIndex(Math.min(index, Math.max(destinations.length - 1, 0)));
  }, [destinations.length]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      ro.disconnect();
    };
  }, [updateScrollState]);

  // Graceful degradation: don't render section if no data after load
  if (!loading && destinations.length < 2) return null;

  const showDots = destinations.length > 1;

  return (
    <section className="pb-2">
      <FeedSectionHeader
        title="Worth Checking Out"
        priority="secondary"
        accentColor="var(--neon-green)"
        icon={<MapPin weight="duotone" className="w-4 h-4" />}
        seeAllHref={`/${portalSlug}?view=places`}
        seeAllLabel="Explore"
      />

      {/* Carousel */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-3 -mx-4 px-4 scrollbar-none"
        style={{ scrollSnapType: "x mandatory" }}
      >
        {loading ? (
          <>
            <DestinationCardSkeleton />
            <DestinationCardSkeleton />
            <DestinationCardSkeleton />
          </>
        ) : (
          destinations.map((item) => (
            <DestinationCard
              key={item.venue.id}
              item={item}
              portalSlug={portalSlug}
            />
          ))
        )}
      </div>

      {/* Mobile dot indicators */}
      {!loading && showDots && (
        <div className="flex justify-center gap-1.5 mt-2">
          {destinations.map((_, i) => (
            <div
              key={i}
              className="rounded-full transition-all duration-200"
              style={{
                width: i === activeIndex ? 16 : 6,
                height: 6,
                backgroundColor:
                  i === activeIndex
                    ? "var(--neon-green)"
                    : "var(--twilight)",
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export type { DestinationsSectionProps as DestinationSectionProps };
