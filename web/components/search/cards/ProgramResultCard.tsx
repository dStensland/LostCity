"use client";

import Link from "next/link";
import { GraduationCap } from "@phosphor-icons/react";
import SmartImage from "@/components/SmartImage";
import type { RankedCandidate } from "@/lib/search/ranking/types";

interface ProgramResultCardProps {
  candidate: RankedCandidate;
  variant?: "top-matches" | "grouped";
  href?: string;
}

export function ProgramResultCard({
  candidate,
  variant = "top-matches",
  href,
}: ProgramResultCardProps) {
  const title = (candidate.payload.title as string | undefined) ?? "Untitled Program";
  const imageUrl = (candidate.payload.image_url as string | undefined) ?? "";
  const provider = (candidate.payload.provider as string | undefined) ?? "";
  const ageRange = (candidate.payload.age_range as string | undefined) ?? "";
  const enrollingNow = candidate.payload.enrolling_now !== false;
  const hrefSlug = (candidate.payload.href_slug as string | undefined) ?? candidate.id;
  const finalHref = href ?? `/programs/${hrefSlug}`;

  const metaParts: string[] = [];
  if (provider) metaParts.push(provider);
  if (ageRange) metaParts.push(ageRange);
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
      <div className="w-16 h-16 rounded-md overflow-hidden flex-shrink-0 bg-[var(--neon-green)]/15 border border-[var(--neon-green)]/20 flex items-center justify-center">
        {imageUrl ? (
          <SmartImage src={imageUrl} alt="" width={64} height={64} className="w-full h-full object-cover" />
        ) : (
          <GraduationCap weight="duotone" className="w-5 h-5 text-[var(--neon-green)]" />
        )}
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-mono text-2xs font-bold uppercase tracking-[0.12em] text-[var(--neon-green)]">Program</span>
        </div>
        <h3 className="text-sm font-semibold text-[var(--cream)] line-clamp-2">{title}</h3>
        {meta && <p className="text-xs text-[var(--muted)] truncate">{meta}</p>}
      </div>
      {enrollingNow && (
        <div className="flex-shrink-0 self-start">
          <span className="text-2xs rounded-full px-2 py-0.5 bg-[var(--neon-green)]/15 text-[var(--neon-green)]">Enrolling Now</span>
        </div>
      )}
    </Link>
  );
}
