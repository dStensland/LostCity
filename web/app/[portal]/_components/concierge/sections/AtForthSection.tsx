"use client";
/* eslint-disable @next/next/no-img-element */

import type { PropertyMoment } from "@/lib/concierge/concierge-types";
import { getProxiedImageSrc } from "@/lib/image-proxy";

interface AtForthSectionProps {
  moments: PropertyMoment[];
  portalName: string;
  onMomentClick?: (moment: PropertyMoment) => void;
}

const STATUS_CONFIG: Record<
  PropertyMoment["status"],
  { label: string; dotClass: string; textClass: string; badgeClass: string }
> = {
  active_now: {
    label: "Open Now",
    dotClass: "bg-green-500",
    textClass: "text-green-700",
    badgeClass: "bg-green-50 border border-green-200",
  },
  starting_soon: {
    label: "Starting Soon",
    dotClass: "bg-amber-500",
    textClass: "text-amber-700",
    badgeClass: "bg-amber-50 border border-amber-200",
  },
  later: {
    label: "Later Today",
    dotClass: "bg-[var(--hotel-stone)]/40",
    textClass: "text-[var(--hotel-stone)]",
    badgeClass: "bg-[var(--hotel-cream)] border border-[var(--hotel-sand)]",
  },
  closed: {
    label: "Closed",
    dotClass: "bg-[var(--hotel-stone)]/30",
    textClass: "text-[var(--hotel-stone)]/70",
    badgeClass: "bg-[var(--hotel-cream)] border border-[var(--hotel-sand)]",
  },
};

export function AtForthSection({ moments, portalName, onMomentClick }: AtForthSectionProps) {
  if (moments.length === 0) return null;

  return (
    <section id="at-property" className="rounded-2xl bg-[var(--hotel-champagne)]/[0.06] p-5 md:p-6 space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <h2 className="font-body text-xs font-semibold uppercase tracking-[0.15em] text-[var(--hotel-champagne)]">
          At {portalName.toUpperCase()}
        </h2>
        <a
          href="#at-property"
          className="text-xs font-body text-[var(--hotel-stone)] hover:text-[var(--hotel-charcoal)] transition-colors"
        >
          See all →
        </a>
      </div>

      {/* Cards: horizontal scroll on mobile, 3-col grid on desktop */}
      <div className="md:hidden flex gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-2">
        {moments.map((moment) => (
          <MomentCard key={`m-${moment.venue.id}`} moment={moment} onClick={onMomentClick} />
        ))}
      </div>
      <div className="hidden md:grid grid-cols-3 gap-4">
        {moments.map((moment) => (
          <MomentCard key={`d-${moment.venue.id}`} moment={moment} onClick={onMomentClick} />
        ))}
      </div>
    </section>
  );
}

function MomentCard({ moment, onClick }: { moment: PropertyMoment; onClick?: (moment: PropertyMoment) => void }) {
  const imgSrc = getProxiedImageSrc(moment.venue.photoUrl);
  const resolvedSrc = typeof imgSrc === "string" ? imgSrc : moment.venue.photoUrl;
  const status = STATUS_CONFIG[moment.status];

  return (
    <button
      onClick={() => onClick?.(moment)}
      className="flex-shrink-0 w-72 md:w-auto snap-start rounded-xl overflow-hidden border border-[var(--hotel-sand)] bg-white shadow-sm text-left hover:shadow-md transition-shadow"
    >
      {/* Image with status badge overlay */}
      <div className="h-36 relative overflow-hidden bg-[var(--hotel-cream)]">
        <img
          src={resolvedSrc}
          alt={moment.venue.name}
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
        {/* Status badge: top-left overlay */}
        <div className={`absolute top-2 left-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-body ${status.textClass} ${status.badgeClass}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${status.dotClass} shrink-0`} />
          {status.label}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-1">
        <h3 className="font-display text-lg text-[var(--hotel-charcoal)] leading-snug">
          {moment.venue.name}
        </h3>
        <p className="font-body text-xs uppercase tracking-wider text-[var(--hotel-stone)]">
          {moment.venue.typeLabel}
        </p>
        <p className="font-body text-sm text-[var(--hotel-stone)] italic">
          {moment.contextLine}
        </p>
        {moment.specialTitle && (
          <p className="text-sm font-body font-medium text-[var(--hotel-champagne)]">
            {moment.specialTitle}
          </p>
        )}
      </div>
    </button>
  );
}

export type { AtForthSectionProps };
