"use client";

import Link from "next/link";
import { Palette, BookmarkSimple } from "@phosphor-icons/react";
import SmartImage from "@/components/SmartImage";
import type { RankedCandidate } from "@/lib/search/ranking/types";

interface ExhibitionResultCardProps {
  candidate: RankedCandidate;
  variant?: "top-matches" | "grouped";
  isSaved?: boolean;
  href?: string;
}

function formatDateRange(
  startDate: string | undefined,
  endDate: string | undefined
): string {
  if (!startDate) return "";
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return "";

  const end = endDate ? new Date(endDate) : null;
  const endValid = end && !Number.isNaN(end.getTime());

  const fmtMonthDay = (d: Date): string =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const fmtDay = (d: Date): string => String(d.getDate());

  // Single-day exhibition or no end date
  if (!endValid || start.toDateString() === end.toDateString()) {
    return fmtMonthDay(start);
  }

  // Same month: "Apr 18–30"
  if (
    start.getMonth() === end.getMonth() &&
    start.getFullYear() === end.getFullYear()
  ) {
    return `${fmtMonthDay(start)}–${fmtDay(end)}`;
  }

  // Different months or years: "Apr 28 – May 3"
  return `${fmtMonthDay(start)} – ${fmtMonthDay(end)}`;
}

export function ExhibitionResultCard({
  candidate,
  variant = "top-matches",
  isSaved = false,
  href,
}: ExhibitionResultCardProps) {
  const title =
    (candidate.payload.title as string | undefined) ?? "Untitled Exhibition";
  const subtitle = (candidate.payload.subtitle as string | undefined) ?? "";
  const imageUrl = (candidate.payload.image_url as string | undefined) ?? "";
  const startDate = (candidate.payload.start_date as string | undefined) ?? "";
  const endDate = (candidate.payload.end_date as string | undefined) ?? "";
  const hrefSlug =
    (candidate.payload.href_slug as string | undefined) ?? candidate.id;
  const finalHref = href ?? `/exhibitions/${hrefSlug}`;
  const dateRange = formatDateRange(startDate, endDate);

  const containerBase =
    "flex gap-3 p-3 rounded-card bg-[var(--night)] border border-[var(--twilight)]/50 hover:bg-[var(--dusk)] hover:border-[var(--twilight)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vibe)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--void)] transition-colors";
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
          <SmartImage
            src={imageUrl}
            alt=""
            width={64}
            height={64}
            className="w-full h-full object-cover"
          />
        ) : (
          <Palette weight="duotone" className="w-5 h-5 text-[var(--vibe)]" />
        )}
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-mono text-2xs font-bold uppercase tracking-[0.12em] text-[var(--vibe)]">
            Exhibition
          </span>
          {dateRange && (
            <span className="text-2xs text-[var(--muted)]">· {dateRange}</span>
          )}
        </div>
        <h3 className="text-sm font-semibold text-[var(--cream)] line-clamp-2">
          {title}
        </h3>
        {subtitle && (
          <p className="text-xs text-[var(--muted)] truncate">{subtitle}</p>
        )}
      </div>
      {isSaved && (
        <div className="flex-shrink-0 self-start">
          <BookmarkSimple
            weight="fill"
            className="w-4 h-4 text-[var(--vibe)]"
          />
        </div>
      )}
    </Link>
  );
}
