"use client";

import { memo, useState, useTransition, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FilmSlate,
  MusicNotes,
  MaskHappy,
  Ticket,
  ArrowsClockwise,
  CalendarBlank,
  MapTrifold,
  MapPin,
  ArrowLeft,
  GraduationCap,
} from "@phosphor-icons/react";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import { useWeather } from "@/lib/hooks/useWeather";
import type { CategoryPulse } from "@/lib/find-data";
import { LANE_META } from "@/lib/explore-lane-meta";

// -------------------------------------------------------------------------
// Lane definitions
// -------------------------------------------------------------------------

interface Lane {
  id: string;
  label: string;
  icon: PhosphorIcon;
  accent: string;
  href: string;
}

const BROWSE_LANES: Lane[] = [
  {
    id: "events",
    label: "Events",
    icon: Ticket,
    accent: LANE_META["events"].accent,
    href: LANE_META["events"].href,
  },
  {
    id: "now-showing",
    label: "Now Showing",
    icon: FilmSlate,
    accent: LANE_META["now-showing"].accent,
    href: LANE_META["now-showing"].href,
  },
  {
    id: "live-music",
    label: "Live Music",
    icon: MusicNotes,
    accent: LANE_META["live-music"].accent,
    href: LANE_META["live-music"].href,
  },
  {
    id: "stage",
    label: "Stage & Comedy",
    icon: MaskHappy,
    accent: LANE_META["stage"].accent,
    href: LANE_META["stage"].href,
  },
  {
    id: "regulars",
    label: "Regulars",
    icon: ArrowsClockwise,
    accent: LANE_META["regulars"].accent,
    href: LANE_META["regulars"].href,
  },
  {
    id: "places",
    label: "Places",
    icon: MapPin,
    accent: LANE_META["places"].accent,
    href: LANE_META["places"].href,
  },
  {
    id: "classes",
    label: "Classes",
    icon: GraduationCap,
    accent: LANE_META["classes"].accent,
    href: LANE_META["classes"].href,
  },
];

const VIEW_LANES: Lane[] = [
  {
    id: "calendar",
    label: "Calendar",
    icon: CalendarBlank,
    accent: LANE_META["calendar"].accent,
    href: LANE_META["calendar"].href,
  },
  {
    id: "map",
    label: "Map",
    icon: MapTrifold,
    accent: LANE_META["map"].accent,
    href: LANE_META["map"].href,
  },
];

// -------------------------------------------------------------------------
// Badge count helper
// -------------------------------------------------------------------------

const LANE_PULSE_MAPPING: Record<string, string> = {
  "live-music": "music",
  "now-showing": "entertainment",
};

function getBadgeCount(laneId: string, pulse?: CategoryPulse[]): number {
  if (!pulse) return 0;
  const category = LANE_PULSE_MAPPING[laneId];
  if (!category) return 0;
  return pulse.find((p) => p.category === category)?.count ?? 0;
}

// -------------------------------------------------------------------------
// Context block — date + weather
// -------------------------------------------------------------------------

function ContextBlock() {
  const weather = useWeather();
  const now = new Date();
  const dateLabel = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="border-t border-[var(--twilight)] pt-4 space-y-1">
      <p className="font-mono text-xs font-bold text-[var(--cream)]">{dateLabel}</p>
      {!weather.loading && weather.temp > 0 && (
        <p className="text-xs text-[var(--muted)]">
          {Math.round(weather.temp)}°F · {weather.condition} · Atlanta
        </p>
      )}
    </div>
  );
}

// -------------------------------------------------------------------------
// FindSidebar
// -------------------------------------------------------------------------

interface FindSidebarProps {
  portalSlug: string;
  activeLane?: string | null;
  pulse?: CategoryPulse[];
}

export const FindSidebar = memo(function FindSidebar({
  portalSlug,
  activeLane,
  pulse,
}: FindSidebarProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingLane, setPendingLane] = useState<string | null>(null);

  // The visually active lane: show the pending lane immediately on click,
  // fall back to the server-confirmed activeLane
  const visualActiveLane = isPending && pendingLane ? pendingLane : activeLane;

  const handleLaneClick = useCallback(
    (lane: Lane, e: React.MouseEvent) => {
      e.preventDefault();
      setPendingLane(lane.id);
      startTransition(() => {
        router.push(`/${portalSlug}${lane.href}`);
      });
    },
    [portalSlug, router, startTransition]
  );

  const handleExploreClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setPendingLane(null);
      startTransition(() => {
        router.push(`/${portalSlug}?view=find`);
      });
    },
    [portalSlug, router, startTransition]
  );

  function renderLane(lane: Lane) {
    const LaneIcon = lane.icon;
    const badge = getBadgeCount(lane.id, pulse);
    const isActive = visualActiveLane === lane.id;

    return (
      <li key={lane.id}>
        <a
          href={`/${portalSlug}${lane.href}`}
          onClick={(e) => handleLaneClick(lane, e)}
          className={[
            "flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors cursor-pointer",
            isActive
              ? "font-semibold"
              : "text-[var(--soft)] hover:bg-[var(--dusk)]",
          ].join(" ")}
          style={
            isActive
              ? { backgroundColor: `color-mix(in srgb, ${lane.accent} 8%, transparent)`, color: lane.accent }
              : undefined
          }
        >
          <LaneIcon
            size={16}
            color={isActive ? lane.accent : "var(--soft)"}
            weight="duotone"
            className="flex-shrink-0"
          />
          <span className="flex-1 text-sm">{lane.label}</span>
          {badge > 0 && (
            <span
              className="text-2xs font-mono font-bold tabular-nums px-1.5 py-0.5 rounded-full"
              style={{
                backgroundColor: `color-mix(in srgb, ${lane.accent} 20%, transparent)`,
                color: lane.accent,
              }}
            >
              {badge}
            </span>
          )}
        </a>
      </li>
    );
  }

  return (
    <aside
      className="w-[240px] h-full bg-[var(--night)] border-r border-[var(--twilight)] p-6 flex flex-col gap-6"
      aria-label="Explore navigation"
    >
      {/* Title — links back to launchpad; shows back arrow when a lane is active */}
      <a
        href={`/${portalSlug}?view=find`}
        onClick={handleExploreClick}
        className="flex items-center gap-1.5 text-2xl font-bold text-[var(--cream)] leading-none hover:text-[var(--coral)] transition-colors cursor-pointer"
      >
        {visualActiveLane && (
          <ArrowLeft size={18} weight="duotone" className="flex-shrink-0" />
        )}
        Explore
      </a>

      {/* Browse group */}
      <nav className="flex-1">
        <p className="font-mono text-2xs font-bold tracking-[0.14em] uppercase text-[var(--muted)] mb-2">
          Browse
        </p>
        <ul className="space-y-0.5">
          {BROWSE_LANES.map(renderLane)}
        </ul>

        {/* Views group */}
        <p className="font-mono text-2xs font-bold tracking-[0.14em] uppercase text-[var(--muted)] mt-5 mb-2">
          Views
        </p>
        <ul className="space-y-0.5">
          {VIEW_LANES.map(renderLane)}
        </ul>
      </nav>

      {/* Context block */}
      <ContextBlock />
    </aside>
  );
});

export type { FindSidebarProps };
