"use client";

import { Sparkle } from "@phosphor-icons/react";
import { buildExploreUrl } from "@/lib/find-url";

interface GapRowProps {
  date: Date;
  portalSlug: string;
}

export function GapRow({ date, portalSlug }: GapRowProps) {
  const dayLabel = date.toLocaleDateString("en-US", { weekday: "long" });
  const dateParam = date.toISOString().split("T")[0];
  const isToday = new Date().toDateString() === date.toDateString();
  const label = isToday ? "Tonight is open" : `${dayLabel} is open`;
  const cta = isToday
    ? "Explore what's happening →"
    : `Find something for ${dayLabel} →`;

  const exploreUrl = buildExploreUrl({ portalSlug, lane: "events", date: dateParam });

  return (
    <a
      href={exploreUrl}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-dashed border-[var(--twilight)] bg-[var(--night)]/50 transition-colors duration-300 hover:border-[var(--coral)]/30 group"
      role="listitem"
      aria-label={`${dayLabel} ${dateParam} is open. Explore events.`}
    >
      <div className="w-7 h-7 rounded-lg bg-[var(--coral)]/8 flex items-center justify-center flex-shrink-0">
        <Sparkle size={14} weight="duotone" className="text-[var(--coral)]/60" />
      </div>
      <div>
        <div className="text-xs text-[var(--muted)]">{label}</div>
        <div className="text-xs text-[var(--coral)]/80 group-hover:text-[var(--coral)]">
          {cta}
        </div>
      </div>
    </a>
  );
}
