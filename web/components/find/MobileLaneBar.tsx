"use client";

import { useState, useTransition, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { House } from "@phosphor-icons/react";
import { LANE_META, BROWSE_LANES, VIEW_LANES, LANE_ICONS } from "@/lib/explore-lane-meta";

const MOBILE_LANES = [...BROWSE_LANES, ...VIEW_LANES].map((slug) => ({
  id: slug,
  label: LANE_META[slug].mobileLabel,
  accent: LANE_META[slug].accent,
  href: LANE_META[slug].href,
}));

interface MobileLaneBarProps {
  portalSlug: string;
  activeLane: string | null;
}

export function MobileLaneBar({ portalSlug, activeLane }: MobileLaneBarProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingLane, setPendingLane] = useState<string | null>(null);

  // Clear pendingLane once parent's activeLane catches up
  useEffect(() => {
    if (pendingLane !== null && activeLane === pendingLane) {
      setPendingLane(null);
    }
  }, [activeLane, pendingLane]);

  // Show pendingLane until activeLane matches — don't rely on isPending timing
  const visualActiveLane = pendingLane !== null && pendingLane !== activeLane
    ? pendingLane
    : activeLane;

  const handleClick = useCallback(
    (href: string, laneId: string | null, e: React.MouseEvent) => {
      e.preventDefault();
      setPendingLane(laneId);
      startTransition(() => {
        router.push(href);
      });
    },
    [router, startTransition]
  );

  return (
    <div className="lg:hidden sticky top-[73px] z-40 bg-[var(--void)]/95 backdrop-blur-sm border-b border-[var(--twilight)]/30">
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide px-3 py-2">
        <a
          href={`/${portalSlug}?view=find`}
          onClick={(e) => handleClick(`/${portalSlug}?view=find`, null, e)}
          className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
            !visualActiveLane
              ? "bg-[var(--coral)]/15 text-[var(--coral)]"
              : "text-[var(--soft)] hover:bg-[var(--dusk)]"
          }`}
        >
          <House size={14} weight="duotone" />
          Explore
        </a>
        {MOBILE_LANES.map((lane) => {
          const isActive = visualActiveLane === lane.id;
          const Icon = LANE_ICONS[lane.id];
          return (
            <a
              key={lane.id}
              href={`/${portalSlug}${lane.href}`}
              onClick={(e) => handleClick(`/${portalSlug}${lane.href}`, lane.id, e)}
              className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors whitespace-nowrap"
              style={
                isActive
                  ? { backgroundColor: `color-mix(in srgb, ${lane.accent} 12%, transparent)`, color: lane.accent }
                  : { color: "var(--soft)" }
              }
            >
              <Icon size={12} weight="duotone" />
              {lane.label}
            </a>
          );
        })}
      </div>
    </div>
  );
}

export type { MobileLaneBarProps };
