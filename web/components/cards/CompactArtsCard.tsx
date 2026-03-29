"use client";

import { memo } from "react";
import Link from "next/link";
import { Palette, Star } from "@phosphor-icons/react";
import Dot from "@/components/ui/Dot";
import type { DiscoveryPlaceEntity } from "@/lib/types/discovery";
import { formatRating, formatCloseTime } from "@/lib/utils/place-formatters";

const ARTS_ACCENT = "#C9874F";
const ICON_BG = `${ARTS_ACCENT}1A`; // 10% opacity

interface CompactArtsCardProps {
  entity: DiscoveryPlaceEntity;
  portalSlug: string;
}

export const CompactArtsCard = memo(function CompactArtsCard({
  entity,
  portalSlug,
}: CompactArtsCardProps) {
  const href = `/${portalSlug}?spot=${entity.slug}`;
  const rating = entity.google_rating != null ? formatRating(entity.google_rating) : null;
  const closeTime = entity.closes_at ? formatCloseTime(entity.closes_at) : null;
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

        {/* Row 2: exhibition label (if present) */}
        {hasExhibition && (
          <div className="mt-0.5 truncate text-2xs font-mono"
            style={{ color: ARTS_ACCENT }}
          >
            {entity.current_exhibition_title}
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
              <Dot />
              <span className="text-[var(--muted)] truncate">
                {entity.neighborhood}
              </span>
            </>
          )}
          {entity.price_level === 0 && (
            <>
              <Dot />
              <span className="text-[#00D9A0] font-mono">Free</span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
});

export type { CompactArtsCardProps };
