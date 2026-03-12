"use client";

import {
  Brain,
  CalendarBlank,
  ForkKnife,
  Microphone,
  Moon,
  MusicNote,
  Palette,
  SoccerBall,
  Users,
  type Icon,
} from "@phosphor-icons/react";
import type { RegularHang } from "@/lib/concierge/concierge-types";

interface DiscoverSceneSectionProps {
  regulars: RegularHang[];
}

const ACTIVITY_ICONS: Record<string, Icon> = {
  music: MusicNote,
  comedy: Microphone,
  trivia: Brain,
  art: Palette,
  food_drink: ForkKnife,
  sports: SoccerBall,
  nightlife: Moon,
  community: Users,
};

function getActivityIcon(activityType: string | null | undefined): Icon {
  if (!activityType) return CalendarBlank;
  return ACTIVITY_ICONS[activityType] ?? CalendarBlank;
}

function formatTime(time: string | null | undefined): string {
  if (!time) return "TBA";
  const [h, m] = time.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return "TBA";
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${m.toString().padStart(2, "0")} ${period}`;
}

function estimateWalkMinutes(distanceKm: number): number {
  return Math.round(((distanceKm * 1.3) / 5) * 60);
}

function formatDistance(distanceKm: number): string {
  if (distanceKm < 2) {
    return `${estimateWalkMinutes(distanceKm)} min walk`;
  }
  return `${distanceKm.toFixed(1)} km`;
}

export function DiscoverSceneSection({ regulars }: DiscoverSceneSectionProps) {
  if (regulars.length === 0) return null;

  return (
    <section id="scene" className="rounded-2xl bg-[var(--hotel-cream)]/60 p-5 md:p-6 space-y-3">
      {/* Section header */}
      <div>
        <h2 className="font-display text-2xl text-[var(--hotel-charcoal)]">Neighborhood Regulars</h2>
        <p className="text-sm font-body text-[var(--hotel-stone)] mt-0.5">
          The weekly lineup steps from your door
        </p>
      </div>

      <div className="space-y-1">
        {regulars.map((hang) => {
          const ActivityIcon = getActivityIcon(hang.activity_type);
          const timeDisplay = formatTime(hang.start_time);

          return (
            <div
              key={hang.id}
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/60 transition-colors"
            >
              {/* Activity icon */}
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm">
                <ActivityIcon size={20} weight="duotone" className="text-[var(--hotel-champagne)]" />
              </div>

              {/* Title + venue/time */}
              <div className="flex-1 min-w-0">
                <p className="font-body font-medium text-base text-[var(--hotel-charcoal)] truncate">
                  {hang.title}
                </p>
                <p className="font-body text-sm text-[var(--hotel-stone)] truncate">
                  {hang.venue_name}
                  {hang.venue_name && " · "}
                  {timeDisplay}
                </p>
              </div>

              {/* Distance badge */}
              <span className="shrink-0 text-xs font-body text-[var(--hotel-stone)] bg-white px-2.5 py-1 rounded-full shadow-sm">
                {formatDistance(hang.distance_km)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
