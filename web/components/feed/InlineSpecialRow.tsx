"use client";

/**
 * InlineSpecialRow — compact special row matching CompactEventRow layout.
 *
 * Layout: gold accent border | time column | square thumbnail | title + venue | price badge.
 * No Sparkle icon, no gold background — same visual language as events.
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
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h`;
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
        "flex items-stretch gap-3 pr-3 transition-colors hover:bg-white/[0.02] group",
        !isLast && "border-b border-[var(--twilight)]/30",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Gold accent — 2px left border */}
      <div
        className="shrink-0 w-0.5 self-stretch rounded-full"
        style={{ backgroundColor: "var(--gold)" }}
      />

      {/* Time column */}
      <div className="shrink-0 w-14 min-h-[4.5rem] flex items-center justify-end py-3 pr-1">
        <span className="font-mono text-[0.6875rem] font-medium text-right leading-tight whitespace-nowrap flex items-center gap-1">
          {isActive && (
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--neon-green)] shrink-0" />
          )}
          <span className={isActive ? "text-[var(--neon-green)]" : "text-[var(--cream)]"}>
            {timeLabel}
          </span>
        </span>
      </div>

      {/* Square thumbnail — venue image or gold gradient fallback */}
      <div className="shrink-0 w-16 h-16 self-center relative overflow-hidden rounded-lg">
        {special.venue.image_url ? (
          <Image
            src={special.venue.image_url}
            alt=""
            fill
            className="object-cover"
            sizes="64px"
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

      {/* Special info — two lines */}
      <div className="min-w-0 flex-1 py-3 flex flex-col justify-center">
        <p className="text-[0.875rem] font-semibold text-[var(--cream)] truncate group-hover:text-[var(--gold)] transition-colors leading-snug">
          {special.title}
        </p>
        <p className="text-[0.75rem] text-[var(--muted)] truncate mt-0.5">
          {special.venue.name}
          {special.venue.neighborhood && (
            <span className="opacity-50">
              {" "}&middot; {special.venue.neighborhood}
            </span>
          )}
        </p>
      </div>

      {/* Price note badge */}
      {special.price_note && (
        <div className="shrink-0 self-center pl-1">
          <span className="inline-flex items-center font-mono text-[0.625rem] font-medium text-[var(--gold)] bg-[var(--gold)]/10 px-2 py-0.5 rounded-full">
            {special.price_note}
          </span>
        </div>
      )}
    </Link>
  );
}
