"use client";

import Link from "next/link";
import { MapPin } from "@phosphor-icons/react";
import SmartImage from "@/components/SmartImage";
import type { RankedCandidate } from "@/lib/search/ranking/types";

interface VenueResultCardProps {
  candidate: RankedCandidate;
  variant?: "top-matches" | "grouped";
  href?: string;
}

export function VenueResultCard({
  candidate,
  variant = "top-matches",
  href,
}: VenueResultCardProps) {
  const title = (candidate.payload.title as string | undefined) ?? "Untitled Place";
  const subtitle = (candidate.payload.subtitle as string | undefined) ?? "";
  const imageUrl = (candidate.payload.image_url as string | undefined) ?? "";
  const neighborhood = (candidate.payload.neighborhood as string | undefined) ?? "";
  const categoryLabel = (candidate.payload.category_label as string | undefined) ?? "";
  const isOpenNow = candidate.payload.is_open_now === true;
  const hrefSlug = (candidate.payload.href_slug as string | undefined) ?? candidate.id;
  const finalHref = href ?? `/places/${hrefSlug}`;

  const metaParts = [neighborhood, categoryLabel].filter(Boolean);
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
      <div className="w-16 h-16 rounded-md overflow-hidden flex-shrink-0 bg-[var(--twilight)]/40 flex items-center justify-center">
        {imageUrl ? (
          <SmartImage src={imageUrl} alt="" width={64} height={64} className="w-full h-full object-cover" />
        ) : (
          <MapPin weight="duotone" className="w-5 h-5 text-[var(--coral)]" />
        )}
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-mono text-2xs font-bold uppercase tracking-[0.12em] text-[var(--coral)]">Place</span>
        </div>
        <h3 className="text-sm font-semibold text-[var(--cream)] line-clamp-2">{title}</h3>
        {meta && <p className="text-xs text-[var(--muted)] truncate">{meta}</p>}
        {!meta && subtitle && <p className="text-xs text-[var(--muted)] truncate">{subtitle}</p>}
      </div>
      {isOpenNow && (
        <div className="flex-shrink-0 self-start">
          <span className="text-2xs rounded-full px-2 py-0.5 bg-[var(--coral)]/15 text-[var(--coral)]">Open Now</span>
        </div>
      )}
    </Link>
  );
}
