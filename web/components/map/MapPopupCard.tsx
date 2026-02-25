"use client";

import Link from "next/link";
import { formatTime } from "@/lib/formats";
import { getCategoryColor, getCategoryLabel } from "@/lib/category-config";

interface EventPopupProps {
  type: "event";
  id: number;
  title: string;
  category: string | null;
  venueName: string | null;
  neighborhood: string | null;
  startTime: string | null;
  isAllDay?: boolean;
  isLive?: boolean;
  isFree?: boolean;
  priceMin: number | null;
  priceMax: number | null;
  portalSlug: string;
}

interface SpotPopupProps {
  type: "spot";
  slug: string;
  name: string;
  venueType: string | null;
  locationDesignator?: "standard" | "private_after_signup" | "virtual" | "recovery_meeting" | null;
  address: string | null;
  neighborhood: string | null;
  portalSlug: string;
}

type MapPopupCardProps = EventPopupProps | SpotPopupProps;

export default function MapPopupCard(props: MapPopupCardProps) {
  if (props.type === "spot") {
    return <SpotPopupContent {...props} />;
  }
  return <EventPopupContent {...props} />;
}

function EventPopupContent({
  id,
  title,
  category,
  venueName,
  neighborhood,
  startTime,
  isAllDay,
  isLive,
  isFree,
  priceMin,
  priceMax,
  portalSlug,
}: EventPopupProps) {
  const categoryKey = category || "other";

  return (
    <div
      data-category={categoryKey}
      className="min-w-[260px] max-w-[320px] p-4 pr-8 rounded-2xl bg-gradient-to-b from-[var(--dusk)]/96 to-[var(--night)]/95 backdrop-blur-md border border-[var(--twilight)] shadow-[0_10px_34px_rgba(0,0,0,0.52)]"
    >
      <div className="flex items-center justify-between mb-2">
        {category && (
          <span
            className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[0.6rem] font-mono font-medium uppercase tracking-wide rounded"
            style={{
              background: `${getCategoryColor(categoryKey)}20`,
              color: getCategoryColor(categoryKey),
            }}
          >
            {getCategoryLabel(categoryKey)}
          </span>
        )}
        {isLive && (
          <span className="flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 text-[0.6rem] font-mono font-medium bg-[var(--neon-red)]/20 text-[var(--neon-red)] rounded">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--neon-red)] animate-pulse" />
            LIVE
          </span>
        )}
      </div>

      <Link
        href={`/${portalSlug}?event=${id}`}
        scroll={false}
        className="block text-base font-medium text-[var(--cream)] hover:text-[var(--coral)] transition-colors line-clamp-2 mb-2"
      >
        {title}
      </Link>

      <div className="flex items-center gap-1.5 text-[0.7rem] text-[var(--soft)] mb-1">
        <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        </svg>
        <span className="truncate">{venueName}</span>
      </div>

      <div className="flex items-center gap-1.5 font-mono text-[0.65rem] text-[var(--muted)]">
        <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-[var(--cream)]">
          {formatTime(startTime, isAllDay)}
        </span>
        {neighborhood && (
          <>
            <span className="opacity-40">&middot;</span>
            <span className="truncate">{neighborhood}</span>
          </>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        {isFree ? (
          <span className="inline-block px-2 py-0.5 text-[0.65rem] font-mono font-medium bg-[var(--neon-green)]/20 text-[var(--neon-green)] rounded">
            FREE
          </span>
        ) : priceMin !== null && (
          <span className="inline-block px-2 py-0.5 text-[0.65rem] font-mono font-medium bg-[var(--gold)]/20 text-[var(--gold)] rounded">
            ${priceMin}{priceMax && priceMax !== priceMin ? `\u2013$${priceMax}` : "+"}
          </span>
        )}
        <Link
          href={`/${portalSlug}?event=${id}`}
          scroll={false}
          className="ml-auto inline-flex items-center px-2 py-1 rounded-full bg-[var(--coral)]/15 border border-[var(--coral)]/35 text-[0.65rem] font-mono text-[var(--coral)] hover:bg-[var(--coral)]/20"
        >
          View details &rarr;
        </Link>
      </div>
    </div>
  );
}

function SpotPopupContent({
  slug,
  name,
  venueType,
  locationDesignator,
  address,
  neighborhood,
  portalSlug,
}: SpotPopupProps) {
  const categoryKey = venueType || "other";
  const locationLabel =
    locationDesignator === "private_after_signup"
      ? "Location after RSVP"
      : locationDesignator === "virtual"
      ? "Virtual"
      : locationDesignator === "recovery_meeting"
      ? "Recovery meeting location"
      : null;

  return (
    <div
      data-category={categoryKey}
      className="min-w-[240px] max-w-[300px] p-4 pr-8 rounded-2xl bg-gradient-to-b from-[var(--dusk)]/96 to-[var(--night)]/95 backdrop-blur-md border border-[var(--twilight)] shadow-[0_10px_34px_rgba(0,0,0,0.52)]"
    >
      <div className="flex items-center justify-between mb-2">
        {venueType && (
          <span
            className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[0.6rem] font-mono font-medium uppercase tracking-wide rounded"
            style={{
              background: `${getCategoryColor(categoryKey)}20`,
              color: getCategoryColor(categoryKey),
            }}
          >
            {getCategoryLabel(categoryKey)}
          </span>
        )}
        <span className="flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 text-[0.6rem] font-mono font-medium bg-[var(--twilight)]/80 text-[var(--soft)] rounded">
          DESTINATION
        </span>
      </div>

      <Link
        href={`/${portalSlug}/spots/${slug}`}
        className="block text-base font-medium text-[var(--cream)] hover:text-[var(--coral)] transition-colors line-clamp-2 mb-2"
      >
        {name}
      </Link>

      {address && (
        <div className="flex items-center gap-1.5 text-[0.7rem] text-[var(--soft)] mb-1">
          <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          </svg>
          <span className="truncate">{address}</span>
        </div>
      )}

      {neighborhood && (
        <div className="flex items-center gap-1.5 font-mono text-[0.65rem] text-[var(--muted)]">
          <span className="truncate">{neighborhood}</span>
        </div>
      )}

      {locationLabel && (
        <div className="mt-1.5">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[0.6rem] font-mono uppercase tracking-wide bg-[var(--twilight)]/70 text-[var(--soft)] border border-[var(--twilight)]">
            {locationLabel}
          </span>
        </div>
      )}

      <div className="mt-3">
        <Link
          href={`/${portalSlug}/spots/${slug}`}
          className="inline-flex items-center px-2 py-1 rounded-full bg-[var(--coral)]/15 border border-[var(--coral)]/35 text-[0.65rem] font-mono text-[var(--coral)] hover:bg-[var(--coral)]/20"
        >
          View details &rarr;
        </Link>
      </div>
    </div>
  );
}
