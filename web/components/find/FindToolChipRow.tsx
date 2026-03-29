"use client";

/**
 * FindToolChipRow — scrollable row of jewel-tone tool chips that shift order
 * based on time of day (America/New_York timezone).
 *
 * Access-layer navigation to pre-filtered Find views.
 */

import { useMemo } from "react";
import Link from "next/link";
import {
  MusicNotes,
  FilmSlate,
  MaskHappy,
  Ticket,
  ArrowsClockwise,
  CalendarBlank,
  MapTrifold,
} from "@phosphor-icons/react";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";

// ---------------------------------------------------------------------------
// Chip definitions
// ---------------------------------------------------------------------------

interface ToolChip {
  id: string;
  label: string;
  icon: PhosphorIcon;
  accent: string;
  href: string;
}

const CHIPS: ToolChip[] = [
  {
    id: "music",
    label: "Tonight's Music",
    icon: MusicNotes,
    accent: "#A78BFA",
    href: "?view=happening&content=showtimes&vertical=music&from=find",
  },
  {
    id: "film",
    label: "Now Showing",
    icon: FilmSlate,
    accent: "#FF6B7A",
    href: "?view=happening&content=showtimes&vertical=film&from=find",
  },
  {
    id: "stage",
    label: "Stage & Comedy",
    icon: MaskHappy,
    accent: "#E855A0",
    href: "?view=happening&content=showtimes&vertical=stage&from=find",
  },
  {
    id: "events",
    label: "All Events",
    icon: Ticket,
    accent: "#FF6B7A",
    href: "?view=happening&from=find",
  },
  {
    id: "regulars",
    label: "Regulars",
    icon: ArrowsClockwise,
    accent: "#FFD93D",
    href: "?view=happening&content=regulars&from=find",
  },
  {
    id: "calendar",
    label: "Calendar",
    icon: CalendarBlank,
    accent: "#00D9A0",
    href: "?view=happening&display=calendar&from=find",
  },
  {
    id: "map",
    label: "Map",
    icon: MapTrifold,
    accent: "#00D4E8",
    href: "?view=happening&display=map&from=find",
  },
];

// ---------------------------------------------------------------------------
// Time-of-day reordering
// ---------------------------------------------------------------------------

/**
 * Returns chip IDs in priority order for the current moment.
 * Operates in America/New_York timezone.
 */
function getChipOrder(): string[] {
  const now = new Date();
  const nyTime = new Date(
    now.toLocaleString("en-US", { timeZone: "America/New_York" }),
  );
  const hour = nyTime.getHours();
  const day = nyTime.getDay(); // 0=Sun, 6=Sat
  const isWeekend = day === 0 || day === 6;

  const ids = CHIPS.map((c) => c.id);

  // Late night: 10pm–9am — film, regulars first
  if (hour >= 22 || hour < 9) {
    return prioritize(ids, ["film", "regulars"]);
  }

  // Evening: 5pm–10pm — music, film first
  if (hour >= 17) {
    return prioritize(ids, ["music", "film"]);
  }

  // Weekend morning: Sat/Sun before 2pm — events, film first
  if (isWeekend && hour < 14) {
    return prioritize(ids, ["events", "film"]);
  }

  // Daytime weekday — film, events first
  return prioritize(ids, ["film", "events"]);
}

/**
 * Moves the listed ids to the front of the array (in order), preserving the
 * relative order of everything else.
 */
function prioritize(ids: string[], first: string[]): string[] {
  const rest = ids.filter((id) => !first.includes(id));
  return [...first, ...rest];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface FindToolChipRowProps {
  portalSlug: string;
}

export function FindToolChipRow({ portalSlug }: FindToolChipRowProps) {
  const orderedChips = useMemo(() => {
    const order = getChipOrder();
    const chipMap = new Map(CHIPS.map((c) => [c.id, c]));
    return order.map((id) => chipMap.get(id)).filter(Boolean) as ToolChip[];
  }, []);

  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4 py-2">
      {orderedChips.map((chip) => {
        const IconComponent = chip.icon;
        const href = `/${portalSlug}/find${chip.href}`;

        return (
          <Link
            key={chip.id}
            href={href}
            className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-full text-sm font-semibold border transition-colors hover:brightness-125 active:brightness-90"
            style={{
              color: chip.accent,
              borderColor: `color-mix(in srgb, ${chip.accent} 35%, transparent)`,
              backgroundColor: `color-mix(in srgb, ${chip.accent} 14%, transparent)`,
            }}
          >
            <IconComponent weight="duotone" className="w-5 h-5" />
            {chip.label}
          </Link>
        );
      })}
    </div>
  );
}

export type { FindToolChipRowProps };
