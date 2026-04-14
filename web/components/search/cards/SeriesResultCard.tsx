"use client";

import Link from "next/link";
import { ArrowsClockwise, BookmarkSimple } from "@phosphor-icons/react";
import SmartImage from "@/components/SmartImage";
import type { RankedCandidate } from "@/lib/search/ranking/types";

interface SeriesResultCardProps {
  candidate: RankedCandidate;
  variant?: "top-matches" | "grouped";
  isSaved?: boolean;
  href?: string;
}

export function SeriesResultCard({
  candidate,
  variant = "top-matches",
  isSaved = false,
  href,
}: SeriesResultCardProps) {
  const title = (candidate.payload.title as string | undefined) ?? "Untitled Series";
  const imageUrl = (candidate.payload.image_url as string | undefined) ?? "";
  const recurrenceLabel = (candidate.payload.recurrence_label as string | undefined) ?? "";
  const hrefSlug = (candidate.payload.href_slug as string | undefined) ?? candidate.id;
  const finalHref = href ?? `/series/${hrefSlug}`;

  const containerBase =
    "flex gap-3 p-3 rounded-card bg-[var(--night)] border border-[var(--twilight)]/50 hover:bg-[var(--dusk)] hover:border-[var(--twilight)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--void)] transition-colors";
  const heightClass = variant === "top-matches" ? "h-[84px]" : "min-h-[72px]";

  return (
    <Link
      href={finalHref}
      className={`${containerBase} ${heightClass}`}
      role="option"
      aria-selected={false}
    >
      <div className="w-16 h-16 rounded-md overflow-hidden flex-shrink-0 bg-[var(--twilight)]/40 flex items-center justify-center">
        {imageUrl ? (
          <SmartImage src={imageUrl} alt="" width={64} height={64} className="w-full h-full object-cover" />
        ) : (
          <ArrowsClockwise weight="duotone" className="w-5 h-5 text-[var(--gold)]" />
        )}
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-mono text-2xs font-bold uppercase tracking-[0.12em] text-[var(--gold)]">Series</span>
        </div>
        <h3 className="text-sm font-semibold text-[var(--cream)] line-clamp-2">{title}</h3>
        {recurrenceLabel && <p className="text-xs text-[var(--muted)] truncate">{recurrenceLabel}</p>}
      </div>
      {isSaved && (
        <div className="flex-shrink-0 self-start">
          <BookmarkSimple weight="fill" className="w-4 h-4 text-[var(--coral)]" />
        </div>
      )}
    </Link>
  );
}
