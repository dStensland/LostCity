"use client";

/**
 * InlineSpecialRow — special/deal row matching the Neon Underground CompactEventRow language.
 *
 * Layout: gold gradient edge | 80px thumbnail | title / venue·neighborhood / time·price
 * Active specials get a green "Now" indicator with pulse.
 */

import Link from "next/link";
import Image from "@/components/SmartImage";
import type { CityPulseSpecialItem } from "@/lib/city-pulse/types";

interface InlineSpecialRowProps {
  special: CityPulseSpecialItem["special"];
  portalSlug: string;
  isLast?: boolean;
}

function formatSpecialTime(special: CityPulseSpecialItem["special"]): string {
  if (special.state === "active_now") return "Now";
  if (special.starts_in_minutes != null && special.starts_in_minutes > 0) {
    const mins = special.starts_in_minutes;
    if (mins < 60) return `in ${mins}m`;
    return `in ${Math.floor(mins / 60)}h`;
  }
  return "Today";
}

export default function InlineSpecialRow({ special, portalSlug, isLast }: InlineSpecialRowProps) {
  const isActive = special.state === "active_now";
  const timeLabel = formatSpecialTime(special);

  return (
    <Link
      href={`/${portalSlug}?spot=${special.venue.slug}`}
      scroll={false}
      className={[
        "flex items-stretch gap-3 pr-3 transition-all group relative",
        !isLast && "border-b border-[var(--twilight)]/20",
        isActive && "bg-[var(--gold)]/[0.03]",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Gold gradient accent edge */}
      <div
        className="shrink-0 self-stretch rounded-r-full"
        style={{
          width: isActive ? "3px" : "2px",
          background: `linear-gradient(to bottom, var(--gold), color-mix(in srgb, var(--gold) ${isActive ? "40%" : "20%"}, transparent))`,
        }}
      />

      {/* 80px thumbnail — venue image or gold gradient fallback */}
      <div
        className="shrink-0 w-20 h-20 self-center relative overflow-hidden rounded-xl my-2.5"
        style={{
          boxShadow: "0 0 0 1px color-mix(in srgb, var(--gold) 15%, transparent)",
        }}
      >
        {special.venue.image_url ? (
          <Image
            src={special.venue.image_url}
            alt=""
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="80px"
          />
        ) : (
          <div
            className="w-full h-full"
            style={{
              background: "linear-gradient(135deg, color-mix(in srgb, var(--gold) 20%, var(--void)), color-mix(in srgb, var(--gold) 8%, var(--void)))",
            }}
          />
        )}
      </div>

      {/* Special info — three lines */}
      <div className="min-w-0 flex-1 py-3 flex flex-col justify-center gap-0.5">
        {/* Line 1: Title */}
        <p className="text-[0.875rem] font-semibold text-[var(--cream)] truncate group-hover:text-[var(--gold)] transition-colors leading-snug">
          {special.title}
        </p>

        {/* Line 2: Venue · Neighborhood */}
        <p className="text-[0.75rem] text-[var(--muted)] truncate">
          {special.venue.name}
          {special.venue.neighborhood && (
            <span className="opacity-50">
              {" "}&middot; {special.venue.neighborhood}
            </span>
          )}
        </p>

        {/* Line 3: Time + price */}
        <div className="flex items-center gap-2 mt-0.5">
          <span className="inline-flex items-center gap-1 font-mono text-[0.6875rem] font-medium leading-none">
            {isActive && (
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--neon-green)] opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[var(--neon-green)]" />
              </span>
            )}
            <span className={isActive ? "text-[var(--neon-green)]" : "text-[var(--soft)]"}>
              {timeLabel}
            </span>
          </span>

          {special.price_note && (
            <span className="inline-flex items-center font-mono text-[0.5625rem] font-bold uppercase tracking-wider text-[var(--gold)]">
              {special.price_note}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
