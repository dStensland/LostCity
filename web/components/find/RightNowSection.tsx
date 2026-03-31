"use client";

import { memo } from "react";
import Link from "next/link";
import {
  FilmSlate,
  MusicNotes,
  MaskHappy,
  Ticket,
  ArrowsClockwise,
} from "@phosphor-icons/react";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import type { CategoryPulse } from "@/lib/find-data";

// -------------------------------------------------------------------------
// Contextual lane teaser definitions
// -------------------------------------------------------------------------

interface LaneTeaser {
  id: string;
  label: string;
  icon: PhosphorIcon;
  accent: string;
  href: string;
  /** Returns a contextual subtitle given the current hour (Eastern) */
  getSubtitle: (hourEt: number) => string;
}

const LANE_TEASERS: LaneTeaser[] = [
  {
    id: "now-showing",
    label: "Now Showing",
    icon: FilmSlate,
    accent: "#FF6B7A",
    href: "?view=find&lane=now-showing&vertical=film",
    getSubtitle: () => "Movies playing in theaters",
  },
  {
    id: "live-music",
    label: "Live Music",
    icon: MusicNotes,
    accent: "#A78BFA",
    href: "?view=find&lane=live-music&vertical=music",
    getSubtitle: (h) => (h >= 17 ? "Shows tonight" : "Upcoming shows"),
  },
  {
    id: "stage",
    label: "Stage & Comedy",
    icon: MaskHappy,
    accent: "#E855A0",
    href: "?view=find&lane=stage&vertical=stage",
    getSubtitle: (h) => (h >= 17 ? "Live tonight" : "Performances this week"),
  },
  {
    id: "events",
    label: "All Events",
    icon: Ticket,
    accent: "#FF6B7A",
    href: "?view=find&lane=events",
    getSubtitle: (h) => (h >= 17 ? "Happening tonight" : "Happening today"),
  },
  {
    id: "regulars",
    label: "Regulars",
    icon: ArrowsClockwise,
    accent: "#FFD93D",
    href: "?view=find&lane=regulars",
    getSubtitle: () => "Weekly recurring hangs",
  },
];

// -------------------------------------------------------------------------
// Badge count helper
// -------------------------------------------------------------------------

const TEASER_PULSE_MAPPING: Record<string, string> = {
  "live-music": "music",
  "now-showing": "entertainment",
};

function getBadgeCount(teaserId: string, pulse?: CategoryPulse[]): number {
  if (!pulse) return 0;
  const category = TEASER_PULSE_MAPPING[teaserId];
  if (!category) return 0;
  return pulse.find((p) => p.category === category)?.count ?? 0;
}

// -------------------------------------------------------------------------
// Header label — contextual based on time of day
// -------------------------------------------------------------------------

function getRightNowLabel(): string {
  const now = new Date();
  const hour = now.getHours();
  const dayName = now.toLocaleDateString("en-US", { weekday: "long" });

  if (hour >= 22 || hour < 5) return "Open Now";

  const period = hour >= 12 ? "pm" : "am";
  const h = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `Right Now · ${dayName} ${h}${period}`;
}

// -------------------------------------------------------------------------
// RightNowSection — contextual lane teasers
// -------------------------------------------------------------------------

interface RightNowSectionProps {
  portalSlug: string;
  pulse?: CategoryPulse[];
}

export const RightNowSection = memo(function RightNowSection({
  portalSlug,
  pulse,
}: RightNowSectionProps) {
  const label = getRightNowLabel();

  const nowEt = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/New_York" })
  );
  const hourEt = nowEt.getHours();

  return (
    <section>
      {/* Section header */}
      <div className="mb-3">
        <span className="font-mono text-xs font-bold tracking-[0.12em] uppercase text-[var(--coral)]">
          {label}
        </span>
      </div>

      {/* Lane teaser grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {LANE_TEASERS.map((teaser) => {
          const TeaserIcon = teaser.icon;
          const count = getBadgeCount(teaser.id, pulse);
          const subtitle = teaser.getSubtitle(hourEt);

          return (
            <Link
              key={teaser.id}
              href={`/${portalSlug}${teaser.href}`}
              className="group flex flex-col gap-2 p-3.5 rounded-xl border border-[var(--twilight)]/60 bg-[var(--night)] hover:bg-[var(--dusk)] transition-colors"
            >
              <div className="flex items-center gap-2">
                <TeaserIcon
                  size={18}
                  color={teaser.accent}
                  weight="duotone"
                  className="flex-shrink-0"
                />
                <span
                  className="text-sm font-semibold group-hover:brightness-125 transition-all"
                  style={{ color: teaser.accent }}
                >
                  {teaser.label}
                </span>
              </div>
              <p className="text-xs text-[var(--muted)] leading-snug">
                {count > 0 ? `${count} venues · ${subtitle.toLowerCase()}` : subtitle}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
});

export type { RightNowSectionProps };
