"use client";

import Link from "next/link";
import { MusicNotes, BookmarkSimple } from "@phosphor-icons/react";
import SmartImage from "@/components/SmartImage";
import type { RankedCandidate } from "@/lib/search/ranking/types";

interface EventResultCardProps {
  candidate: RankedCandidate;
  variant?: "top-matches" | "grouped";
  isSaved?: boolean;
  href?: string;
}

function formatWhen(startsAt: string | undefined): string {
  if (!startsAt) return "";
  const d = new Date(startsAt);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function EventResultCard({
  candidate,
  variant = "top-matches",
  isSaved = false,
  href,
}: EventResultCardProps) {
  const title = (candidate.payload.title as string | undefined) ?? "Untitled Event";
  const subtitle = (candidate.payload.subtitle as string | undefined) ?? "";
  const imageUrl = (candidate.payload.image_url as string | undefined) ?? "";
  const startsAt = (candidate.payload.starts_at as string | undefined) ?? "";
  const hrefSlug = (candidate.payload.href_slug as string | undefined) ?? candidate.id;
  const finalHref = href ?? `/events/${hrefSlug}`;
  const when = formatWhen(startsAt);

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
          <MusicNotes weight="duotone" className="w-5 h-5 text-[var(--coral)]" />
        )}
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-mono text-2xs font-bold uppercase tracking-[0.12em] text-[var(--coral)]">Event</span>
          {when && <span className="text-2xs text-[var(--muted)]">· {when}</span>}
        </div>
        <h3 className="text-sm font-semibold text-[var(--cream)] line-clamp-2">{title}</h3>
        {subtitle && <p className="text-xs text-[var(--muted)] truncate">{subtitle}</p>}
      </div>
      {isSaved && (
        <div className="flex-shrink-0 self-start">
          <BookmarkSimple weight="fill" className="w-4 h-4 text-[var(--coral)]" />
        </div>
      )}
    </Link>
  );
}
