"use client";

import { memo } from "react";
import Link from "next/link";
import { Palette, FrameCorners, Star } from "@phosphor-icons/react";
import type { DiscoveryPlaceEntity } from "@/lib/types/discovery";

const ARTS_ACCENT = "#C9874F";
const ICON_BG = `${ARTS_ACCENT}1A`; // 10% opacity

interface CompactArtsCardProps {
  entity: DiscoveryPlaceEntity;
  portalSlug: string;
}

function formatRating(rating: number | null): string | null {
  if (rating === null) return null;
  return rating.toFixed(1);
}

function formatCloseTime(closesAt: string | null): string | null {
  if (!closesAt) return null;
  const [h, m] = closesAt.split(":").map(Number);
  const period = h >= 12 ? "pm" : "am";
  const hr = h === 0 ? 12 : h > 12 ? h - 12 : h;
  if (!m) return `${hr}${period}`;
  return `${hr}:${m.toString().padStart(2, "0")}${period}`;
}

export const CompactArtsCard = memo(function CompactArtsCard({
  entity,
  portalSlug,
}: CompactArtsCardProps) {
  const href = `/${portalSlug}?spot=${entity.slug}`;
  const rating = formatRating(entity.google_rating);
  const closeTime = formatCloseTime(entity.closes_at);
  const hasExhibition =
    entity.current_exhibition_title !== null &&
    entity.current_exhibition_title !== "";

  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-card border border-[var(--twilight)] bg-[var(--night)] p-3 hover:bg-[var(--dusk)] transition-colors"
    >
      {/* Icon box */}
      <div
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: ICON_BG }}
      >
        <Palette size={18} color={ARTS_ACCENT} weight="duotone" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Row 1: name + rating */}
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-[var(--cream)]">
            {entity.name}
          </span>
          {rating && (
            <span className="flex items-center gap-0.5 flex-shrink-0">
              <Star size={10} color="#FFD93D" weight="fill" />
              <span className="font-mono text-2xs text-[var(--muted)]">
                {rating}
              </span>
            </span>
          )}
        </div>

        {/* Row 2: exhibition badge (if present) */}
        {hasExhibition && (
          <div className="mt-0.5 flex items-center gap-1 overflow-hidden">
            <span
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-2xs font-mono"
              style={{
                backgroundColor: `${ARTS_ACCENT}20`,
                color: ARTS_ACCENT,
              }}
            >
              <FrameCorners size={10} color={ARTS_ACCENT} weight="duotone" />
              <span className="truncate max-w-[160px]">
                {entity.current_exhibition_title}
              </span>
            </span>
          </div>
        )}

        {/* Row 3: open badge + neighborhood + free info */}
        <div className="flex items-center gap-1.5 text-2xs mt-0.5">
          {entity.is_open ? (
            <span className="flex items-center gap-1 text-[#00D9A0]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#00D9A0]" />
              <span>
                {closeTime ? `Open · Closes ${closeTime}` : "Open"}
              </span>
            </span>
          ) : (
            <span className="text-[var(--muted)]">Closed</span>
          )}
          {entity.neighborhood && (
            <>
              <span className="text-[var(--muted)] opacity-40">·</span>
              <span className="text-[var(--muted)] truncate">
                {entity.neighborhood}
              </span>
            </>
          )}
          {entity.price_level === 0 && (
            <>
              <span className="text-[var(--muted)] opacity-40">·</span>
              <span className="text-[#00D9A0] font-mono">Free</span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
});

export type { CompactArtsCardProps };
