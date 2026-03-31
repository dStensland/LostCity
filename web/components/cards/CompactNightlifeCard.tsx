"use client";

import { memo } from "react";
import Link from "next/link";
import { MoonStars } from "@phosphor-icons/react";
import Dot from "@/components/ui/Dot";
import type { DiscoveryPlaceEntity } from "@/lib/types/discovery";
import { formatCloseTime } from "@/lib/utils/place-formatters";

const NIGHTLIFE_ACCENT = "#FF6B7A";
const ICON_BG = `${NIGHTLIFE_ACCENT}1A`; // 10% opacity

interface CompactNightlifeCardProps {
  entity: DiscoveryPlaceEntity;
  portalSlug: string;
}

export const CompactNightlifeCard = memo(function CompactNightlifeCard({
  entity,
  portalSlug,
}: CompactNightlifeCardProps) {
  const href = `/${portalSlug}?spot=${entity.slug}`;
  const closeTime = entity.closes_at ? formatCloseTime(entity.closes_at) : null;
  const topVibe =
    entity.vibes && entity.vibes.length > 0
      ? entity.vibes.slice(0, 2).join(" · ")
      : null;

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
        <MoonStars size={18} color={NIGHTLIFE_ACCENT} weight="duotone" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Row 1: name + vibes */}
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-[var(--cream)]">
            {entity.name}
          </span>
        </div>

        {/* Row 2: vibes */}
        {topVibe && (
          <div className="text-2xs text-[var(--muted)] capitalize mt-0.5">
            {topVibe}
          </div>
        )}

        {/* Row 3: open badge + events tonight */}
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
          {entity.event_count > 0 && (
            <>
              <Dot />
              <span className="font-mono text-[var(--muted)]">
                {entity.event_count === 1
                  ? "1 event tonight"
                  : `${entity.event_count} events tonight`}
              </span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
});

export type { CompactNightlifeCardProps };
