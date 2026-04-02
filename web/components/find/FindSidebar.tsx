"use client";

import { memo, useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import { useWeather } from "@/lib/hooks/useWeather";
import { LANE_META, BROWSE_LANES as BROWSE_LANE_SLUGS, VIEW_LANES as VIEW_LANE_SLUGS, LANE_ICONS } from "@/lib/explore-lane-meta";

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

const BROWSE_LANES: Lane[] = BROWSE_LANE_SLUGS.map((id) => ({
  id,
  label: LANE_META[id].mobileLabel,
  icon: LANE_ICONS[id],
  accent: LANE_META[id].accent,
  href: LANE_META[id].href,
}));

const VIEW_LANES: Lane[] = VIEW_LANE_SLUGS.map((id) => ({
  id,
  label: LANE_META[id].mobileLabel,
  icon: LANE_ICONS[id],
  accent: LANE_META[id].accent,
  href: LANE_META[id].href,
}));

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
  laneStates?: Record<string, { state: string; count: number; count_today: number | null }>;
}

export const FindSidebar = memo(function FindSidebar({
  portalSlug,
  activeLane,
  laneStates,
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
          {!activeLane && laneStates?.[lane.id] && (
            <span
              className="w-1.5 h-1.5 rounded-full ml-auto shrink-0"
              style={{
                backgroundColor:
                  laneStates[lane.id].state === "alive"
                    ? lane.accent
                    : laneStates[lane.id].state === "quiet"
                    ? "var(--twilight)"
                    : "transparent",
              }}
            />
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
      {/* Title — always visible home link; coral when on home, cream when in a lane */}
      <a
        href={`/${portalSlug}?view=find`}
        onClick={handleExploreClick}
        className={`text-2xl font-bold leading-none transition-colors cursor-pointer ${
          !visualActiveLane
            ? "text-[var(--coral)]"
            : "text-[var(--cream)] hover:text-[var(--coral)]"
        }`}
      >
        Explore
      </a>

      {/* Search button */}
      <button
        onClick={() => router.push(`/${portalSlug}?view=find`)}
        className="flex items-center gap-2 w-full px-3 py-2 rounded-lg
          bg-[var(--void)]/50 border border-[var(--twilight)]/40
          text-[var(--muted)] text-sm hover:border-[var(--twilight)]
          hover:text-[var(--cream)] transition-colors"
      >
        <MagnifyingGlass size={14} weight="duotone" />
        <span>Search...</span>
      </button>

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
