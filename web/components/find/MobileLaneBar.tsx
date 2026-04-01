"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { House } from "@phosphor-icons/react";

const MOBILE_LANES = [
  { id: "events", label: "Events", accent: "#FF6B7A", href: "?view=find&lane=events" },
  { id: "now-showing", label: "Film", accent: "#FF6B7A", href: "?view=find&lane=now-showing&vertical=film" },
  { id: "live-music", label: "Music", accent: "#A78BFA", href: "?view=find&lane=live-music&vertical=music" },
  { id: "stage", label: "Stage", accent: "#E855A0", href: "?view=find&lane=stage&vertical=stage" },
  { id: "regulars", label: "Regulars", accent: "#FFD93D", href: "?view=find&lane=regulars" },
  { id: "places", label: "Places", accent: "#00D9A0", href: "?view=find&lane=places" },
  { id: "classes", label: "Classes", accent: "#C9874F", href: "?view=find&lane=classes" },
  { id: "calendar", label: "Calendar", accent: "#00D9A0", href: "?view=find&lane=calendar" },
  { id: "map", label: "Map", accent: "#00D4E8", href: "?view=find&lane=map" },
];

interface MobileLaneBarProps {
  portalSlug: string;
  activeLane: string | null;
}

export function MobileLaneBar({ portalSlug, activeLane }: MobileLaneBarProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingLane, setPendingLane] = useState<string | null>(null);

  const visualActiveLane = isPending && pendingLane !== undefined ? pendingLane : activeLane;

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

  if (!activeLane && !isPending) return null;

  return (
    <div className="lg:hidden sticky top-[73px] z-40 bg-[var(--void)]/95 backdrop-blur-sm border-b border-[var(--twilight)]/30">
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide px-3 py-2">
        <a
          href={`/${portalSlug}?view=find`}
          onClick={(e) => handleClick(`/${portalSlug}?view=find`, null, e)}
          className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold text-[var(--soft)] hover:bg-[var(--dusk)] transition-colors"
        >
          <House size={14} weight="duotone" />
          Explore
        </a>
        {MOBILE_LANES.map((lane) => {
          const isActive = visualActiveLane === lane.id;
          return (
            <a
              key={lane.id}
              href={`/${portalSlug}${lane.href}`}
              onClick={(e) => handleClick(`/${portalSlug}${lane.href}`, lane.id, e)}
              className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors whitespace-nowrap"
              style={
                isActive
                  ? { backgroundColor: `${lane.accent}20`, color: lane.accent }
                  : { color: "var(--soft)" }
              }
            >
              {lane.label}
            </a>
          );
        })}
      </div>
    </div>
  );
}

export type { MobileLaneBarProps };
