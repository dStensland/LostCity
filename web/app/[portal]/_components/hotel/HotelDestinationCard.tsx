"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";
import { getProxiedImageSrc } from "@/lib/image-proxy";

const DEFAULT_DESTINATION_IMAGE = "https://forthatlanta.com/hubfs/Forth/Website/Images/Club/hero-banner-club-faq-desktop.jpg";

type DestinationSpecial = {
  title: string;
  type: string;
  price_note: string | null;
  confidence?: "high" | "medium" | "low" | null;
  last_verified_at?: string | null;
  starts_in_minutes: number | null;
  remaining_minutes: number | null;
};

type Destination = {
  venue: {
    slug: string | null;
    name: string;
    neighborhood: string | null;
    venue_type: string | null;
    image_url: string | null;
    short_description?: string | null;
  };
  proximity_label: string;
  proximity_tier: "walkable" | "close" | "destination";
  special_state: "active_now" | "starting_soon" | "none";
  top_special: DestinationSpecial | null;
  next_event: {
    title: string;
    start_date: string;
    start_time: string | null;
  } | null;
};

type DaypartContext = "all" | "morning" | "day" | "evening" | "late_night";

interface HotelDestinationCardProps {
  destination: Destination;
  portalSlug: string;
  variant?: "standard" | "live";
  daypartContext?: DaypartContext;
}

function formatSpecialType(type: string): string {
  return type.replace(/_/g, " ");
}

function getStateLabel(destination: Destination): string {
  if (destination.special_state === "active_now") {
    if (destination.top_special?.remaining_minutes && destination.top_special.remaining_minutes > 0) {
      return `Live now · ${destination.top_special.remaining_minutes} min left`;
    }
    return "Live now";
  }
  if (destination.special_state === "starting_soon") {
    if (destination.top_special?.starts_in_minutes !== null && destination.top_special?.starts_in_minutes !== undefined) {
      return `Starts in ${destination.top_special.starts_in_minutes} min`;
    }
    return "Starting soon";
  }
  return "No live offer right now";
}

function confidenceLabel(confidence: "high" | "medium" | "low" | null | undefined): string | null {
  if (!confidence) return null;
  if (confidence === "high") return "High confidence";
  if (confidence === "medium") return "Medium confidence";
  return "Low confidence";
}

function hoursSince(timestamp: string | null | undefined): number | null {
  if (!timestamp) return null;
  const parsed = Date.parse(timestamp);
  if (Number.isNaN(parsed)) return null;
  return Math.max(0, Math.round((Date.now() - parsed) / (1000 * 60 * 60)));
}

function contextBadgeLabel(destination: Destination, daypartContext: DaypartContext): string | null {
  if (destination.special_state === "active_now") return "Open now";
  if (daypartContext === "late_night") return "Open late";
  if (daypartContext === "morning") return "Morning pick";
  if (daypartContext === "day") return "Daytime pick";
  if (daypartContext === "evening") return "Evening pick";
  return null;
}

function resolveDestinationHref(portalSlug: string, destination: Destination): string {
  const slug = typeof destination.venue.slug === "string" ? destination.venue.slug.trim() : "";
  if (slug) return `/${portalSlug}?spot=${slug}`;
  return `/${portalSlug}?view=find&type=destinations&search=${encodeURIComponent(destination.venue.name)}`;
}

export default function HotelDestinationCard({
  destination,
  portalSlug,
  variant = "standard",
  daypartContext = "all",
}: HotelDestinationCardProps) {
  const href = resolveDestinationHref(portalSlug, destination);
  const isLive = variant === "live";
  const imageCandidates = useMemo(() => {
    const rawSources = [destination.venue.image_url, DEFAULT_DESTINATION_IMAGE];
    const unique: string[] = [];
    const seen = new Set<string>();
    for (const source of rawSources) {
      if (!source) continue;
      const proxied = getProxiedImageSrc(source);
      if (typeof proxied !== "string") continue;
      if (seen.has(proxied)) continue;
      seen.add(proxied);
      unique.push(proxied);
    }
    return unique;
  }, [destination.venue.image_url]);
  const [imageIndex, setImageIndex] = useState(0);
  const imageSrc = imageCandidates[Math.min(imageIndex, imageCandidates.length - 1)] || null;
  const confidence = confidenceLabel(destination.top_special?.confidence);
  const freshnessHours = hoursSince(destination.top_special?.last_verified_at);
  const contextBadge = contextBadgeLabel(destination, daypartContext);

  return (
    <Link
      href={href}
      className={`group isolate block rounded-xl overflow-hidden bg-[var(--hotel-cream)] border transition-all duration-500 [clip-path:inset(0_round_0.75rem)] ${
        isLive
          ? "border-[var(--hotel-champagne)]/45 shadow-[var(--hotel-shadow-medium)] hover:shadow-[var(--hotel-shadow-strong)]"
          : "border-[var(--hotel-sand)] shadow-[var(--hotel-shadow-soft)] hover:shadow-[var(--hotel-shadow-medium)]"
      }`}
    >
      <div className="relative aspect-[4/3] bg-[var(--hotel-sand)] overflow-hidden rounded-t-[inherit] [clip-path:inset(0_round_0.75rem_0.75rem_0_0)]">
        {imageSrc ? (
          <Image
            src={imageSrc}
            alt={destination.venue.name}
            fill
            sizes="(max-width: 768px) 90vw, 320px"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105 transform-gpu will-change-transform [backface-visibility:hidden]"
            onError={() => {
              setImageIndex((current) => (current < imageCandidates.length - 1 ? current + 1 : current));
            }}
          />
        ) : (
          <div className="absolute inset-0 bg-[var(--hotel-sand)]" />
        )}
        {destination.special_state !== "none" && (
          <div className="absolute top-3 left-3 rounded-full bg-[var(--hotel-ink)]/75 text-[10px] tracking-[0.14em] uppercase text-[var(--hotel-champagne)] px-3 py-1">
            {destination.special_state === "active_now" ? "Live" : "Soon"}
          </div>
        )}
        {contextBadge && (
          <div className="absolute top-3 right-3 rounded-full bg-black/55 text-[10px] tracking-[0.13em] uppercase text-white/88 px-3 py-1">
            {contextBadge}
          </div>
        )}
      </div>

      <div className="p-5 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-xl text-[var(--hotel-charcoal)] leading-tight">
            {destination.venue.name}
          </h3>
          <span className="shrink-0 text-[11px] uppercase tracking-[0.14em] text-[var(--hotel-stone)]">
            {destination.proximity_label}
          </span>
        </div>

        <p className="text-sm text-[var(--hotel-stone)]">
          {destination.venue.neighborhood || "Nearby"}{destination.venue.venue_type ? ` · ${destination.venue.venue_type.replace(/_/g, " ")}` : ""}
        </p>

        {destination.top_special ? (
          <div className="rounded-lg bg-[var(--hotel-ivory)] border border-[var(--hotel-sand)] px-3 py-2">
            <p className="text-sm text-[var(--hotel-charcoal)] font-medium">{destination.top_special.title}</p>
            <p className="text-xs uppercase tracking-[0.12em] text-[var(--hotel-champagne)] mt-1">
              {formatSpecialType(destination.top_special.type)}
              {destination.top_special.price_note ? ` · ${destination.top_special.price_note}` : ""}
            </p>
          </div>
        ) : destination.venue.short_description ? (
          <p className="text-sm text-[var(--hotel-stone)] line-clamp-2">{destination.venue.short_description}</p>
        ) : null}

        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--hotel-stone)]">{getStateLabel(destination)}</p>
          {destination.next_event && (
            <p className="text-xs text-[var(--hotel-champagne)] line-clamp-1">
              Next: {destination.next_event.title}
            </p>
          )}
        </div>
        {(confidence || freshnessHours !== null) && (
          <div className="pt-1 flex flex-wrap gap-2">
            {confidence && (
              <span className="rounded-full border border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-[var(--hotel-charcoal)]">
                {confidence}
              </span>
            )}
            {freshnessHours !== null && (
              <span className="rounded-full border border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-[var(--hotel-stone)]">
                Verified {freshnessHours}h ago
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
