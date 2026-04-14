"use client";

import Link from "next/link";
import { Confetti } from "@phosphor-icons/react";
import SmartImage from "@/components/SmartImage";
import type { RankedCandidate } from "@/lib/search/ranking/types";

interface FestivalResultCardProps {
  candidate: RankedCandidate;
  variant?: "top-matches" | "grouped";
  href?: string;
}

function parseDate(input: string | undefined): Date | null {
  if (!input) return null;
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function formatDateRange(startInput: string | undefined, endInput: string | undefined): { label: string; multiDay: boolean } {
  const start = parseDate(startInput);
  const end = parseDate(endInput);
  if (!start) return { label: "", multiDay: false };

  const startMonth = start.toLocaleDateString("en-US", { month: "short" });
  const startDay = start.getDate();

  if (!end) {
    return { label: `${startMonth} ${startDay}`, multiDay: false };
  }

  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();
  if (sameDay) {
    return { label: `${startMonth} ${startDay}`, multiDay: false };
  }

  const sameMonth = start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth();
  const endDay = end.getDate();
  if (sameMonth) {
    return { label: `${startMonth} ${startDay}\u2013${endDay}`, multiDay: true };
  }

  const endMonth = end.toLocaleDateString("en-US", { month: "short" });
  return { label: `${startMonth} ${startDay} \u2013 ${endMonth} ${endDay}`, multiDay: true };
}

export function FestivalResultCard({
  candidate,
  variant = "top-matches",
  href,
}: FestivalResultCardProps) {
  const title = (candidate.payload.title as string | undefined) ?? "Untitled Festival";
  const imageUrl = (candidate.payload.image_url as string | undefined) ?? "";
  const startDate = candidate.payload.start_date as string | undefined;
  const endDate = candidate.payload.end_date as string | undefined;
  const hrefSlug = (candidate.payload.href_slug as string | undefined) ?? candidate.id;
  const finalHref = href ?? `/festivals/${hrefSlug}`;

  const { label: dateLabel, multiDay } = formatDateRange(startDate, endDate);

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
          <Confetti weight="duotone" className="w-5 h-5 text-[var(--gold)]" />
        )}
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-mono text-2xs font-bold uppercase tracking-[0.12em] text-[var(--gold)]">Festival</span>
          {dateLabel && <span className="text-2xs text-[var(--muted)]">· {dateLabel}</span>}
        </div>
        <h3 className="text-sm font-semibold text-[var(--cream)] line-clamp-2">{title}</h3>
      </div>
      {multiDay && (
        <div className="flex-shrink-0 self-start">
          <span className="text-2xs rounded-full px-2 py-0.5 bg-[var(--gold)]/15 text-[var(--gold)]">Multi-day</span>
        </div>
      )}
    </Link>
  );
}
