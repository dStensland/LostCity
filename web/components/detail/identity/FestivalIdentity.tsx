"use client";

import { memo, useMemo } from "react";
import { parseISO, format, differenceInCalendarDays } from "date-fns";
import { CalendarBlank, MapPin } from "@phosphor-icons/react";
import { ExperienceTagStrip } from "@/components/detail/ExperienceTagStrip";
import { formatDateRange } from "@/lib/detail/format";
import type { FestivalData } from "@/lib/detail/types";

// ── Config ────────────────────────────────────────────────────────────────────

const FESTIVAL_TYPE_LABELS: Record<string, string> = {
  music_festival: "Music Festival",
  food_festival: "Food Festival",
  arts_festival: "Arts Festival",
  film_festival: "Film Festival",
  cultural_festival: "Cultural Festival",
  comedy_festival: "Comedy Festival",
  tech_festival: "Tech Festival",
  community_festival: "Community Festival",
  community: "Community Festival",
  beer_festival: "Beer Festival",
  wine_festival: "Wine Festival",
  conference: "Conference",
  tech_conference: "Conference",
  market: "Market",
  holiday_spectacle: "Holiday Event",
  performing_arts_festival: "Performing Arts",
  fair: "Fair",
  fashion_event: "Fashion Event",
  athletic_event: "Athletic Event",
  hobby_expo: "Expo",
  pop_culture_con: "Convention",
};

const PRICE_LABELS: Record<string, string> = {
  free: "Free",
  budget: "$",
  mid: "$$",
  moderate: "$$",
  premium: "$$$",
};

const INDOOR_OUTDOOR_LABELS: Record<string, string> = {
  indoor: "Indoor",
  outdoor: "Outdoor",
  both: "Indoor + Outdoor",
  mixed: "Indoor + Outdoor",
};

// ── Temporal state ────────────────────────────────────────────────────────────

type TemporalState =
  | "no-dates"
  | "upcoming"
  | "happening-first"
  | "happening-mid"
  | "happening-last"
  | "ended";

interface TemporalInfo {
  state: TemporalState;
  bannerText: string | null;
  bannerColor: string; // CSS variable name e.g. "--gold"
}

function getTodayString(): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function getTemporalInfo(
  announcedStart: string | null | undefined,
  announcedEnd: string | null | undefined,
  today: string
): TemporalInfo {
  if (!announcedStart) {
    return { state: "no-dates", bannerText: null, bannerColor: "--muted" };
  }

  const start = announcedStart.substring(0, 10);
  const end = announcedEnd?.substring(0, 10) ?? null;

  if (today < start) {
    const daysUntil = differenceInCalendarDays(parseISO(start), parseISO(today));
    return {
      state: "upcoming",
      bannerText:
        daysUntil === 1 ? "Starts tomorrow" : `Starts in ${daysUntil} days`,
      bannerColor: "--gold",
    };
  }

  if (end && today > end) {
    return {
      state: "ended",
      bannerText: `Ended ${format(parseISO(end), "MMM d")}`,
      bannerColor: "--muted",
    };
  }

  if (today === start) {
    return {
      state: "happening-first",
      bannerText: "Opening day",
      bannerColor: "--neon-green",
    };
  }

  if (end && today === end) {
    return {
      state: "happening-last",
      bannerText: "Last day",
      bannerColor: "--coral",
    };
  }

  // mid-festival
  if (end) {
    const dayNum =
      differenceInCalendarDays(parseISO(today), parseISO(start)) + 1;
    const totalDays =
      differenceInCalendarDays(parseISO(end), parseISO(start)) + 1;
    return {
      state: "happening-mid",
      bannerText: `Day ${dayNum} of ${totalDays}`,
      bannerColor: "--neon-green",
    };
  }

  return {
    state: "happening-mid",
    bannerText: "Happening now",
    bannerColor: "--neon-green",
  };
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface FestivalIdentityProps {
  festival: FestivalData;
  portalSlug: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const FestivalIdentity = memo(function FestivalIdentity({
  festival,
}: FestivalIdentityProps) {
  const today = useMemo(() => getTodayString(), []);
  const temporal = useMemo(
    () => getTemporalInfo(festival.announced_start, festival.announced_end, today),
    [festival.announced_start, festival.announced_end, today]
  );

  const festivalTypeLabel = festival.primary_type
    ? FESTIVAL_TYPE_LABELS[festival.primary_type] ?? "Festival"
    : "Festival";

  const dateRange = formatDateRange(
    festival.announced_start,
    festival.announced_end
  );

  // Stat pills
  const statPills: string[] = [];
  if (festival.price_tier && PRICE_LABELS[festival.price_tier]) {
    statPills.push(PRICE_LABELS[festival.price_tier]);
  }
  if (festival.indoor_outdoor && INDOOR_OUTDOOR_LABELS[festival.indoor_outdoor]) {
    statPills.push(INDOOR_OUTDOOR_LABELS[festival.indoor_outdoor]);
  }

  const isEnded = temporal.state === "ended";

  return (
    <div className="space-y-2">
      {/* Temporal banner */}
      {temporal.bannerText && (
        <div
          className="rounded-md px-3 py-1.5 flex items-center gap-2"
          style={{
            background: isEnded
              ? "var(--twilight)"
              : `color-mix(in srgb, var(${temporal.bannerColor}) 12%, transparent)`,
            border: isEnded
              ? "1px solid var(--twilight)"
              : `1px solid color-mix(in srgb, var(${temporal.bannerColor}) 25%, transparent)`,
          }}
        >
          {!isEnded && (
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: `var(${temporal.bannerColor})` }}
            />
          )}
          <span
            className="text-xs font-semibold"
            style={{
              color: isEnded ? "var(--muted)" : `var(${temporal.bannerColor})`,
            }}
          >
            {temporal.bannerText}
          </span>
        </div>
      )}

      {/* Name */}
      <h1 className="text-xl font-bold text-[var(--cream)] leading-tight">
        {festival.name}
      </h1>

      {/* Type badge */}
      <span
        className="inline-flex items-center px-2 py-0.5 rounded font-mono text-2xs font-bold tracking-[0.12em] uppercase text-[var(--soft)] bg-[var(--twilight)] border border-[var(--twilight)]"
      >
        {festivalTypeLabel.toUpperCase()}
      </span>

      {/* Date row */}
      {dateRange && (
        <div className="flex items-center gap-1.5">
          <CalendarBlank
            size={14}
            weight="duotone"
            className="text-[var(--gold)] flex-shrink-0"
            aria-hidden="true"
          />
          <span className="text-sm text-[var(--cream)]">{dateRange}</span>
        </div>
      )}

      {/* Location row */}
      {(festival.location || festival.neighborhood) && (
        <div className="flex items-center gap-1.5">
          <MapPin
            size={14}
            weight="duotone"
            className="flex-shrink-0 text-[var(--muted)]"
            aria-hidden="true"
          />
          <span className="text-sm text-[var(--soft)]">
            {festival.location}
            {festival.location && festival.neighborhood && " · "}
            {festival.neighborhood}
          </span>
        </div>
      )}

      {/* Stat pills */}
      {statPills.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {statPills.map((pill) => (
            <span
              key={pill}
              className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium text-[var(--cream)] bg-[var(--dusk)] border border-[var(--twilight)]"
            >
              {pill}
            </span>
          ))}
        </div>
      )}

      {/* Experience tags */}
      {festival.experience_tags && festival.experience_tags.length > 0 && (
        <ExperienceTagStrip tags={festival.experience_tags} />
      )}
    </div>
  );
});

export type { FestivalIdentityProps };
