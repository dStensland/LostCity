"use client";

import Link from "next/link";
import type { RankedCandidate } from "@/lib/search/ranking/types";

interface NeighborhoodResultCardProps {
  candidate: RankedCandidate;
  variant?: "top-matches" | "grouped";
  href?: string;
}

export function NeighborhoodResultCard({
  candidate,
  variant = "top-matches",
  href,
}: NeighborhoodResultCardProps) {
  const title = (candidate.payload.title as string | undefined) ?? "Untitled Neighborhood";
  const eventCount = candidate.payload.event_count as number | undefined;
  const venueCount = candidate.payload.venue_count as number | undefined;
  const hrefSlug = (candidate.payload.href_slug as string | undefined) ?? candidate.id;
  const finalHref = href ?? `/neighborhoods/${hrefSlug}`;

  const metaParts: string[] = [];
  if (typeof eventCount === "number" && eventCount > 0) {
    metaParts.push(`${eventCount} events this week`);
  }
  if (typeof venueCount === "number" && venueCount > 0) {
    metaParts.push(`${venueCount} venues`);
  }
  const meta = metaParts.join(" · ");

  const containerBase =
    "flex items-center gap-3 p-3 rounded-card bg-[var(--night)] border border-[var(--twilight)]/50 border-l-2 border-l-[var(--twilight)] hover:bg-[var(--dusk)] hover:border-[var(--twilight)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--void)] transition-colors";
  const heightClass = variant === "top-matches" ? "h-[84px]" : "min-h-[72px]";

  return (
    <Link
      href={finalHref}
      className={`${containerBase} ${heightClass}`}
      role="option"
      aria-selected={false}
    >
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-mono text-2xs font-bold uppercase tracking-[0.12em] text-[var(--soft)]">Neighborhood</span>
        </div>
        <h3 className="text-sm font-semibold text-[var(--cream)] line-clamp-2">{title}</h3>
        {meta && <p className="text-xs text-[var(--muted)] truncate">{meta}</p>}
      </div>
      <div className="flex-shrink-0 self-center">
        <span className="text-xs text-[var(--coral)]">Browse →</span>
      </div>
    </Link>
  );
}
