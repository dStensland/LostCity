"use client";

import { memo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Palette,
  ForkKnife,
  MoonStars,
  Tree,
  MusicNotes,
  Ticket,
} from "@phosphor-icons/react";
import type { VerticalLane } from "@/lib/types/discovery";
import { LANE_CONFIG } from "@/lib/types/discovery";

// -------------------------------------------------------------------------
// Lane icon map
// -------------------------------------------------------------------------

const LANE_ICONS: Record<
  string,
  React.ComponentType<{
    size?: number;
    className?: string;
    color?: string;
    weight?: "duotone" | "regular" | "bold" | "fill" | "thin" | "light";
  }>
> = {
  palette: Palette,
  "fork-knife": ForkKnife,
  "moon-stars": MoonStars,
  tree: Tree,
  "music-notes": MusicNotes,
  ticket: Ticket,
};

// -------------------------------------------------------------------------
// Lane sub-category chips
// -------------------------------------------------------------------------

const LANE_CHIPS: Record<VerticalLane, string[]> = {
  arts: ["Museums", "Galleries", "Theater", "Comedy"],
  dining: ["Coffee", "Brunch", "Happy Hour", "Late Night"],
  nightlife: ["Live Music", "Cocktails", "Date Night"],
  outdoors: ["Parks", "Trails", "Viewpoints"],
  music: ["Tonight", "This Week", "All Shows"],
  entertainment: ["Museums", "Arcades", "Attractions"],
};

// -------------------------------------------------------------------------
// LaneFilterBar
// -------------------------------------------------------------------------

interface LaneFilterBarProps {
  lane: VerticalLane;
  portalSlug: string;
  totalCount: number;
  openCount: number;
}

export const LaneFilterBar = memo(function LaneFilterBar({
  lane,
  portalSlug,
  totalCount,
  openCount,
}: LaneFilterBarProps) {
  const [activeChip, setActiveChip] = useState<string>("All");
  const config = LANE_CONFIG[lane];
  const LaneIcon = LANE_ICONS[config.icon] ?? Ticket;
  const chips = ["All", ...LANE_CHIPS[lane]];

  return (
    <div className="space-y-3">
      {/* Top row: back arrow + lane label + summary */}
      <div className="flex items-center gap-3">
        <Link
          href={`/${portalSlug}?view=find`}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-[var(--twilight)] bg-[var(--night)] text-[var(--soft)] hover:text-[var(--cream)] transition-colors"
          aria-label="Back to Find"
        >
          <ArrowLeft size={16} weight="regular" />
        </Link>

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <LaneIcon size={16} color={config.color} weight="duotone" />
          <span className="font-mono text-sm font-bold text-[var(--cream)] truncate">
            {config.label}
          </span>
        </div>

        {/* Summary */}
        <span className="font-mono text-xs text-[var(--muted)] flex-shrink-0">
          {totalCount > 0 && `${totalCount} places`}
          {openCount > 0 && (
            <>
              {totalCount > 0 ? " · " : ""}
              <span style={{ color: "#00D9A0" }}>{openCount} open</span>
            </>
          )}
        </span>
      </div>

      {/* Filter chip row — display only (future: wire to URL filter params) */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4">
        {chips.map((chip) => {
          const isActive = chip === activeChip;
          return (
            <button
              key={chip}
              type="button"
              onClick={() => setActiveChip(chip)}
              className={[
                "flex-shrink-0 py-2 px-3.5 rounded-full font-mono text-xs font-medium border transition-colors",
                isActive
                  ? "border-transparent"
                  : "border-[var(--twilight)] text-[var(--soft)] bg-transparent hover:border-[var(--soft)] hover:text-[var(--cream)]",
              ].join(" ")}
              style={
                isActive
                  ? {
                      backgroundColor: config.color,
                      borderColor: config.color,
                      color: "#09090B",
                    }
                  : undefined
              }
            >
              {chip}
            </button>
          );
        })}
      </div>
    </div>
  );
});

export type { LaneFilterBarProps };
