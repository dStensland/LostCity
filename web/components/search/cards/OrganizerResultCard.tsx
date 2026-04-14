"use client";

import Link from "next/link";
import SmartImage from "@/components/SmartImage";
import type { RankedCandidate } from "@/lib/search/ranking/types";

interface OrganizerResultCardProps {
  candidate: RankedCandidate;
  variant?: "top-matches" | "grouped";
  href?: string;
}

function initialsFromTitle(title: string): string {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0]?.[0] ?? "";
  const second = words[1]?.[0] ?? "";
  return (first + second).toUpperCase() || "?";
}

export function OrganizerResultCard({
  candidate,
  variant = "top-matches",
  href,
}: OrganizerResultCardProps) {
  const title = (candidate.payload.title as string | undefined) ?? "Untitled Organizer";
  const imageUrl = (candidate.payload.image_url as string | undefined) ?? "";
  const categoryLabel = (candidate.payload.category_label as string | undefined) ?? "";
  const upcomingCount = candidate.payload.upcoming_count as number | undefined;
  const hrefSlug = (candidate.payload.href_slug as string | undefined) ?? candidate.id;
  const finalHref = href ?? `/organizers/${hrefSlug}`;

  const metaParts: string[] = [];
  if (categoryLabel) metaParts.push(categoryLabel);
  if (typeof upcomingCount === "number" && upcomingCount > 0) {
    metaParts.push(`${upcomingCount} upcoming event${upcomingCount === 1 ? "" : "s"}`);
  }
  const meta = metaParts.join(" · ");

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
      <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-[var(--twilight)] flex items-center justify-center">
        {imageUrl ? (
          <SmartImage src={imageUrl} alt="" width={40} height={40} className="w-full h-full object-cover" />
        ) : (
          <span className="font-mono text-xs font-bold text-[var(--cream)]">{initialsFromTitle(title)}</span>
        )}
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-mono text-2xs font-bold uppercase tracking-[0.12em] text-[var(--coral)]">Organizer</span>
        </div>
        <h3 className="text-sm font-semibold text-[var(--cream)] line-clamp-2">{title}</h3>
        {meta && <p className="text-xs text-[var(--muted)] truncate">{meta}</p>}
      </div>
    </Link>
  );
}
