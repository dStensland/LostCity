"use client";

import { useMemo } from "react";
import Link from "next/link";
import Skeleton from "@/components/Skeleton";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass } from "@/lib/css-utils";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { usePortal } from "@/lib/portal-context";
import LinkifyText from "../LinkifyText";
import SmartImage from "@/components/SmartImage";
import {
  ArrowSquareOut,
  MapPin,
  CalendarBlank,
  Ticket,
  Globe,
  ArrowCounterClockwise,
  ArrowLeft,
  CaretRight,
  Train,
  Car,
  Path,
} from "@phosphor-icons/react";
import DetailShell from "@/components/detail/DetailShell";
import { DetailStickyBar } from "@/components/detail/DetailStickyBar";
import { ExperienceTagStrip } from "@/components/detail/ExperienceTagStrip";
import { useDetailFetch } from "@/lib/hooks/useDetailFetch";
import { useDetailNavigation } from "@/lib/hooks/useDetailNavigation";
import { decodeHtmlEntities, formatTimeSplit } from "@/lib/formats";
import { useState } from "react";

// ── Types ────────────────────────────────────────────────────────────────

interface FestivalData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  website: string | null;
  ticket_url: string | null;
  location: string | null;
  neighborhood: string | null;
  primary_type?: string | null;
  experience_tags?: string[] | null;
  announced_start?: string | null;
  announced_end?: string | null;
  indoor_outdoor?: string | null;
  price_tier?: string | null;
}

interface SessionData {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  end_time: string | null;
  venue: {
    id: number;
    name: string;
    slug: string;
    neighborhood: string | null;
    nearest_marta_station?: string | null;
    marta_walk_minutes?: number | null;
    marta_lines?: string[] | null;
    beltline_adjacent?: boolean | null;
    beltline_segment?: string | null;
    parking_type?: string[] | null;
    parking_free?: boolean | null;
    transit_score?: number | null;
  } | null;
}

interface ProgramData {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  sessions: SessionData[];
}

interface FestivalResponse {
  festival: FestivalData;
  programs: ProgramData[];
}

interface FestivalDetailViewProps {
  slug: string;
  portalSlug: string;
  onClose: () => void;
  showOpenPageLink?: boolean;
}

// ── Config ───────────────────────────────────────────────────────────────

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

/** Max events to show before "See all" overflow link */
const EVENT_LIST_CAP = 20;

/** Min events spanning 2+ days to show day tabs */
const DAY_TAB_THRESHOLD = 6;

// ── Temporal State ───────────────────────────────────────────────────────

type TemporalState =
  | "no-dates"
  | "upcoming"
  | "happening-first"
  | "happening-mid"
  | "happening-last"
  | "happening-no-end"
  | "ended";

interface TemporalInfo {
  state: TemporalState;
  bannerText: string | null;
  bannerColor: string; // CSS variable name
  ctaColor: string;    // hex for accent
  showTicketCta: boolean;
}

function getTemporalState(
  announcedStart: string | null | undefined,
  announcedEnd: string | null | undefined,
  today: string
): TemporalInfo {
  if (!announcedStart) {
    return {
      state: "no-dates",
      bannerText: null,
      bannerColor: "",
      ctaColor: "#FF6B7A", // --coral
      showTicketCta: true,
    };
  }

  // Normalize to YYYY-MM-DD in case DB stores timestamps
  const start = announcedStart.substring(0, 10);
  const end = announcedEnd?.substring(0, 10) ?? null;

  if (today < start) {
    const daysUntil = differenceInCalendarDays(parseISO(start), parseISO(today));
    return {
      state: "upcoming",
      bannerText: daysUntil === 1 ? "Starts tomorrow" : `Starts in ${daysUntil} days`,
      bannerColor: "--gold",
      ctaColor: "#FF6B7A", // --coral
      showTicketCta: true,
    };
  }

  if (!end) {
    // Has start, no end, and today >= start
    // Staleness check: if 30+ days past start with no end date, treat as ended
    const daysSinceStart = differenceInCalendarDays(parseISO(today), parseISO(start));
    if (daysSinceStart > 30) {
      return {
        state: "ended",
        bannerText: null,
        bannerColor: "",
        ctaColor: "",
        showTicketCta: false,
      };
    }
    return {
      state: "happening-no-end",
      bannerText: "Happening now",
      bannerColor: "--neon-green",
      ctaColor: "#FFD93D", // --gold
      showTicketCta: true,
    };
  }

  if (today > end) {
    return {
      state: "ended",
      bannerText: `Ended ${format(parseISO(end), "MMM d")}`,
      bannerColor: "--twilight",
      ctaColor: "",
      showTicketCta: false,
    };
  }

  if (today === start) {
    return {
      state: "happening-first",
      bannerText: "Starts today",
      bannerColor: "--neon-green",
      ctaColor: "#FFD93D",
      showTicketCta: true,
    };
  }

  if (today === end) {
    return {
      state: "happening-last",
      bannerText: "Last day — ends tonight",
      bannerColor: "--neon-green",
      ctaColor: "#FFD93D",
      showTicketCta: true,
    };
  }

  // Mid-festival
  const dayNum = differenceInCalendarDays(parseISO(today), parseISO(start)) + 1;
  const totalDays = differenceInCalendarDays(parseISO(end), parseISO(start)) + 1;
  return {
    state: "happening-mid",
    bannerText: `Day ${dayNum} of ${totalDays} — happening now`,
    bannerColor: "--neon-green",
    ctaColor: "#FFD93D",
    showTicketCta: true,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────

function formatDuration(startDate: string, endDate: string | null): string {
  if (!endDate || startDate === endDate) return "1 day";
  const days = differenceInCalendarDays(parseISO(endDate), parseISO(startDate)) + 1;
  return `${days} day${days !== 1 ? "s" : ""}`;
}

function formatSessionTime(time: string | null): string {
  if (!time || time === "00:00:00" || time === "00:00") return "";
  const { time: t, period } = formatTimeSplit(time, false);
  return period ? `${t} ${period}` : t;
}

function getTodayString(): string {
  // Client-side date in US Eastern (matches server getLocalDateString)
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

// ── Component ────────────────────────────────────────────────────────────

export default function FestivalDetailView({
  slug,
  portalSlug,
  onClose,
  showOpenPageLink = true,
}: FestivalDetailViewProps) {
  const { portal } = usePortal();
  const { toEvent } = useDetailNavigation(portalSlug);

  const fetchUrl = useMemo(() => {
    if (!portal?.id) return null;
    return `/api/festivals/${slug}?portal_id=${portal.id}`;
  }, [slug, portal?.id]);

  const { data, status, error, retry } = useDetailFetch<FestivalResponse>(fetchUrl, {
    entityLabel: "festival",
  });

  const festival = data?.festival ?? null;
  const programs = useMemo(() => data?.programs ?? [], [data]);

  // Flatten programs[].sessions[] into a single sorted event list
  const allEvents = useMemo(() => {
    const events = programs.flatMap((p) => p.sessions || []);
    return events.sort((a, b) => {
      const dateComp = a.start_date.localeCompare(b.start_date);
      if (dateComp !== 0) return dateComp;
      return (a.start_time ?? "").localeCompare(b.start_time ?? "");
    });
  }, [programs]);

  const today = useMemo(() => getTodayString(), []);

  // Temporal state
  const temporal = useMemo(() => {
    if (!festival) return null;
    return getTemporalState(festival.announced_start, festival.announced_end, today);
  }, [festival, today]);

  // Single venue detection (for Getting There)
  const singleVenue = useMemo(() => {
    const venueIds = new Set(allEvents.filter((s) => s.venue).map((s) => s.venue!.id));
    return venueIds.size === 1 ? allEvents.find((s) => s.venue)?.venue ?? null : null;
  }, [allEvents]);

  // Hero image: festival → first program → null
  const heroImageUrl = useMemo(() => {
    return festival?.image_url
      ?? programs.find((p) => p.image_url)?.image_url
      ?? null;
  }, [festival, programs]);

  const accentClass = useMemo(
    () => createCssVarClass("--accent-color", temporal?.ctaColor || "#FFD93D", "accent"),
    [temporal?.ctaColor]
  );

  // Day tabs state
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const uniqueDates = useMemo(() => {
    return [...new Set(allEvents.map((e) => e.start_date))].sort();
  }, [allEvents]);

  const showDayTabs = uniqueDates.length >= 2 && allEvents.length >= DAY_TAB_THRESHOLD;

  const defaultDay = useMemo(() => {
    if (!showDayTabs) return null;
    return uniqueDates.includes(today) ? today : uniqueDates[0] ?? null;
  }, [showDayTabs, uniqueDates, today]);

  const activeDay = showDayTabs
    ? (selectedDay && uniqueDates.includes(selectedDay) ? selectedDay : defaultDay)
    : null;

  // Filter and cap events for display
  const displayEvents = useMemo(() => {
    const events = activeDay
      ? allEvents.filter((e) => e.start_date === activeDay)
      : allEvents;
    return events.slice(0, EVENT_LIST_CAP);
  }, [allEvents, activeDay]);

  const totalEventCount = activeDay
    ? allEvents.filter((e) => e.start_date === activeDay).length
    : allEvents.length;

  const hasOverflow = totalEventCount > EVENT_LIST_CAP;
  const allPast = displayEvents.length > 0 && displayEvents.every((e) => e.start_date < today);

  // ── LOADING ──────────────────────────────────────────────────────────

  if (status === "loading") {
    const skeletonSidebar = (
      <div role="status" aria-label="Loading festival details">
        <Skeleton className="h-[240px] w-full" />
        <div className="px-5 pt-4 pb-3 space-y-2">
          <Skeleton className="h-5 w-28 rounded" delay="0.06s" />
          <Skeleton className="h-7 w-[75%] rounded" delay="0.1s" />
          <Skeleton className="h-4 w-[50%] rounded" delay="0.14s" />
          <Skeleton className="h-4 w-[40%] rounded" delay="0.16s" />
        </div>
        <div className="mx-5 border-t border-[var(--twilight)]/40" />
        <div className="px-5 py-3 flex gap-2">
          <Skeleton className="h-6 w-16 rounded" delay="0.2s" />
          <Skeleton className="h-6 w-16 rounded" delay="0.22s" />
          <Skeleton className="h-6 w-14 rounded" delay="0.26s" />
        </div>
      </div>
    );
    const skeletonContent = (
      <div className="p-6 lg:p-8 space-y-6">
        <Skeleton className="h-4 w-full rounded" delay="0.28s" />
        <Skeleton className="h-4 w-[75%] rounded" delay="0.3s" />
        <div className="space-y-3 pt-4">
          <Skeleton className="h-14 w-full rounded-xl" delay="0.4s" />
          <Skeleton className="h-14 w-full rounded-xl" delay="0.44s" />
        </div>
      </div>
    );
    return <DetailShell onClose={onClose} sidebar={skeletonSidebar} content={skeletonContent} />;
  }

  // ── ERROR ────────────────────────────────────────────────────────────

  if (error || !festival || !temporal) {
    return (
      <DetailShell
        onClose={onClose}
        singleColumn
        content={
          <div className="flex flex-col items-center justify-center py-20 px-4" role="alert">
            <p className="text-[var(--soft)] mb-6">{error || "Festival not found"}</p>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[var(--twilight)] text-[var(--soft)] hover:text-[var(--cream)] hover:bg-[var(--dusk)] transition-colors font-mono text-sm focus-ring"
              >
                <ArrowLeft size={16} weight="bold" />
                Go Back
              </button>
              <button
                onClick={retry}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--coral)] text-[var(--void)] font-mono text-sm font-medium hover:brightness-110 transition-all focus-ring"
              >
                <ArrowCounterClockwise size={16} weight="bold" />
                Try Again
              </button>
            </div>
          </div>
        }
      />
    );
  }

  // ── DERIVED VALUES ──────────────────────────────────────────────────

  const festivalTypeLabel = festival.primary_type
    ? FESTIVAL_TYPE_LABELS[festival.primary_type] || "Festival"
    : "Festival";

  const dateRange = festival.announced_start
    ? festival.announced_start === (festival.announced_end ?? festival.announced_start)
      ? format(parseISO(festival.announced_start), "EEE, MMM d, yyyy")
      : `${format(parseISO(festival.announced_start), "MMM d")}–${format(parseISO(festival.announced_end!), "MMM d, yyyy")}`
    : "Dates TBD";

  const durationLabel = festival.announced_start
    ? formatDuration(festival.announced_start, festival.announced_end ?? null)
    : null;

  // Stat pills: duration, price, indoor/outdoor
  const statPills: string[] = [];
  if (durationLabel) statPills.push(durationLabel);
  if (festival.price_tier) {
    const label = PRICE_LABELS[festival.price_tier];
    if (label) statPills.push(label);
  }
  if (festival.indoor_outdoor) {
    const label = INDOOR_OUTDOOR_LABELS[festival.indoor_outdoor];
    if (label) statPills.push(label);
  }

  // ── SIDEBAR ─────────────────────────────────────────────────────────

  const sidebarContent = (
    <div className={`flex flex-col h-full ${accentClass?.className ?? ""}`}>
      {/* Hero image */}
      <div className="relative h-[240px] w-full flex-shrink-0 bg-[var(--night)]">
        {heroImageUrl ? (
          <SmartImage
            src={heroImageUrl}
            alt={festival.name}
            fill
            priority
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--dusk)] to-[var(--night)] flex items-center justify-center">
            <CalendarBlank size={48} weight="light" style={{ color: "var(--accent-color)", opacity: 0.25 }} aria-hidden="true" />
          </div>
        )}
        {/* Bottom gradient overlay */}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[var(--night)] via-[var(--night)]/60 to-transparent" />
        {/* Festival type badge */}
        <div className="absolute bottom-3 left-3">
          <span
            className="inline-flex items-center px-2 py-0.5 rounded font-mono text-2xs font-bold tracking-[0.12em] uppercase"
            style={{
              color: "var(--accent-color)",
              background: "color-mix(in srgb, var(--accent-color) 25%, transparent)",
            }}
          >
            {festivalTypeLabel.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Identity zone */}
      <div className="px-5 pt-3 pb-3 space-y-2">
        {/* Temporal banner */}
        {temporal.bannerText && (
          <div
            className="rounded-md px-3 py-1.5 flex items-center gap-2 mb-1"
            style={{
              background: temporal.state === "ended"
                ? "var(--twilight)"
                : `color-mix(in srgb, var(${temporal.bannerColor}) 12%, transparent)`,
              border: temporal.state === "ended"
                ? "1px solid var(--twilight)"
                : `1px solid color-mix(in srgb, var(${temporal.bannerColor}) 25%, transparent)`,
            }}
          >
            {temporal.state !== "ended" && (
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: `var(${temporal.bannerColor})` }}
              />
            )}
            <span
              className="text-xs font-semibold"
              style={{
                color: temporal.state === "ended"
                  ? "var(--muted)"
                  : `var(${temporal.bannerColor})`,
              }}
            >
              {temporal.bannerText}
            </span>
          </div>
        )}

        <div className="flex items-start justify-between gap-2">
          <h1 className="text-xl font-bold text-[var(--cream)] leading-tight">
            {festival.name}
          </h1>
          {showOpenPageLink && (
            <Link
              href={`/${portalSlug}/festivals/${festival.slug}`}
              className="flex-shrink-0 inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded border border-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)] hover:border-[var(--twilight)] transition-colors focus-ring mt-0.5"
              aria-label="Open festival page"
            >
              <ArrowSquareOut size={14} weight="light" aria-hidden="true" />
            </Link>
          )}
        </div>

        {/* Date row */}
        <div className="flex items-center gap-1.5">
          <CalendarBlank
            size={14}
            weight="fill"
            style={{ color: "var(--accent-color)" }}
            aria-hidden="true"
          />
          <span className="text-sm text-[var(--cream)]">{dateRange}</span>
        </div>

        {/* Location row */}
        {(festival.location || festival.neighborhood) && (
          <div className="flex items-center gap-1.5">
            <MapPin size={14} weight="light" className="flex-shrink-0 text-[var(--muted)]" aria-hidden="true" />
            <span className="text-sm text-[var(--soft)]">
              {festival.location}
              {festival.location && festival.neighborhood && " · "}
              {festival.neighborhood}
            </span>
          </div>
        )}
      </div>

      {/* Stat pills + experience tags (merged) */}
      {(statPills.length > 0 || (festival.experience_tags && festival.experience_tags.length > 0)) && (
        <>
          <div className="mx-5 border-t border-[var(--twilight)]/40" />
          <div className="px-5 py-2.5 space-y-2">
            {statPills.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
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
            {festival.experience_tags && festival.experience_tags.length > 0 && (
              <ExperienceTagStrip tags={festival.experience_tags} />
            )}
          </div>
        </>
      )}

      {/* CTAs */}
      {(temporal.showTicketCta && festival.ticket_url) || festival.website ? (
        <>
          <div className="mx-5 border-t border-[var(--twilight)]/40" />
          <div className="px-5 py-3 space-y-2">
            {temporal.showTicketCta && festival.ticket_url && (
              <a
                href={festival.ticket_url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 min-h-[44px] rounded-lg text-sm font-medium transition-all focus-ring hover:brightness-110"
                style={{
                  background: "var(--accent-color)",
                  color: "var(--void)",
                }}
              >
                <Ticket size={16} weight="bold" aria-hidden="true" />
                Get Passes
              </a>
            )}
            {festival.website && (
              <a
                href={festival.website}
                target="_blank"
                rel="noopener noreferrer"
                className={`w-full flex items-center justify-center gap-2 transition-colors focus-ring ${
                  temporal.showTicketCta && festival.ticket_url
                    ? "min-h-[44px] text-sm text-[var(--soft)] hover:text-[var(--cream)]"
                    : "min-h-[44px] rounded-lg border border-[var(--twilight)] text-sm font-medium text-[var(--soft)] hover:text-[var(--cream)] hover:border-[var(--soft)]"
                }`}
              >
                <Globe size={15} weight={temporal.showTicketCta && festival.ticket_url ? "light" : "bold"} aria-hidden="true" />
                Visit Website
              </a>
            )}
          </div>
        </>
      ) : null}

      {/* Getting There (single venue only) */}
      {singleVenue && (singleVenue.nearest_marta_station || singleVenue.beltline_adjacent || (singleVenue.parking_type && singleVenue.parking_type.length > 0)) && (
        <>
          <div className="mx-5 border-t border-[var(--twilight)]/40" />
          <div className="px-5 py-3 space-y-2">
            <p className="font-mono text-2xs font-bold text-[var(--muted)] uppercase tracking-[0.12em] mb-2">
              Getting There
            </p>
            {singleVenue.nearest_marta_station && singleVenue.marta_walk_minutes != null && singleVenue.marta_walk_minutes <= 15 && (
              <div className="flex items-center gap-2">
                <Train size={13} weight="fill" style={{ color: "var(--vibe)" }} aria-hidden="true" className="flex-shrink-0" />
                <span className="text-xs text-[var(--soft)]">
                  {singleVenue.nearest_marta_station}
                  {singleVenue.marta_walk_minutes != null && ` · ${singleVenue.marta_walk_minutes} min walk`}
                </span>
              </div>
            )}
            {singleVenue.parking_type && singleVenue.parking_type.length > 0 && (
              <div className="flex items-center gap-2">
                <Car size={13} weight="light" className="flex-shrink-0 text-[var(--muted)]" aria-hidden="true" />
                <span className="text-xs text-[var(--soft)]">
                  {singleVenue.parking_free ? "Free parking" : "Paid parking"}
                </span>
              </div>
            )}
            {singleVenue.beltline_adjacent && (
              <div className="flex items-center gap-2">
                <Path size={13} weight="bold" style={{ color: "var(--neon-green)" }} aria-hidden="true" className="flex-shrink-0" />
                <span className="text-xs text-[var(--soft)]">
                  Near BeltLine
                  {singleVenue.beltline_segment && ` · ${singleVenue.beltline_segment}`}
                </span>
              </div>
            )}
          </div>
        </>
      )}

      <div className="hidden lg:flex flex-1" />
    </div>
  );

  // ── CONTENT ─────────────────────────────────────────────────────────

  const contentBody = (
    <div className={`px-6 lg:px-8 py-6 space-y-6 max-w-3xl ${accentClass?.className ?? ""}`}>
      {/* About */}
      {festival.description && (
        <div>
          <p className="font-mono text-xs font-bold text-[var(--muted)] uppercase tracking-[0.12em] mb-2">
            About
          </p>
          <div className="text-sm text-[var(--soft)] leading-relaxed whitespace-pre-wrap">
            <LinkifyText text={festival.description} />
          </div>
        </div>
      )}

      {/* Schedule */}
      {allEvents.length > 0 ? (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <p className="font-mono text-xs font-bold text-[var(--muted)] uppercase tracking-[0.12em]">
              {allPast ? "Past Schedule" : "Schedule"}
            </p>
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full font-mono text-2xs text-[var(--cream)] border border-[var(--twilight)]"
              style={{ background: "rgba(37,37,48,0.5)" }}
            >
              {allEvents.length}
            </span>
          </div>

          {/* Day tabs */}
          {showDayTabs && (
            <div
              className="inline-flex items-center gap-0.5 p-[3px] rounded-lg mb-4 overflow-x-auto scrollbar-hide max-w-full"
              style={{ background: "var(--dusk)" }}
              aria-label="Filter by festival day"
            >
              {uniqueDates.map((date) => {
                const isActive = date === activeDay;
                return (
                  <button
                    key={date}
                    aria-pressed={isActive}
                    onClick={() => setSelectedDay(date)}
                    className="flex flex-col items-center px-3.5 py-1.5 rounded-md transition-colors focus-ring flex-shrink-0"
                    style={
                      isActive
                        ? { background: "var(--accent-color)", color: "var(--void)" }
                        : { color: "var(--soft)" }
                    }
                  >
                    <span
                      className="font-mono text-2xs font-bold tracking-[0.06em] uppercase"
                      style={{ color: isActive ? "var(--void)" : "var(--muted)" }}
                    >
                      {format(parseISO(date), "EEE")}
                    </span>
                    <span
                      className={`text-sm ${isActive ? "font-semibold" : ""}`}
                      style={{ color: isActive ? "var(--void)" : "var(--soft)" }}
                    >
                      {format(parseISO(date), "MMM d")}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Event list */}
          <div className="bg-[var(--night)] border border-[var(--twilight)] rounded-xl overflow-hidden">
            {displayEvents.map((event, idx) => {
              const isPast = event.start_date < today;
              const title = decodeHtmlEntities(event.title);
              const time = formatSessionTime(event.start_time);
              const rawVenue = event.venue?.name;
              const venueName = rawVenue && rawVenue !== "Unknown Venue" ? rawVenue : null;
              const metaParts = [
                !activeDay ? format(parseISO(event.start_date), "EEE, MMM d") : null,
                time,
                venueName,
              ].filter(Boolean);

              return (
                <button
                  key={event.id}
                  onClick={() => toEvent(event.id)}
                  className="w-full flex items-center gap-3 px-4 text-left focus-ring transition-colors hover:bg-[var(--dusk)]/50"
                  style={{
                    minHeight: "48px",
                    opacity: isPast ? 0.7 : 1,
                    borderBottom: idx < displayEvents.length - 1
                      ? "1px solid color-mix(in srgb, var(--twilight) 40%, transparent)"
                      : undefined,
                  }}
                >
                  <div className="flex-1 min-w-0 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[var(--cream)] truncate">
                        {title}
                      </span>
                      {isPast && (
                        <span className="flex-shrink-0 font-mono text-2xs font-bold px-1.5 py-0.5 rounded bg-[var(--twilight)] text-[var(--muted)]">
                          PAST
                        </span>
                      )}
                    </div>
                    {metaParts.length > 0 && (
                      <p className="text-xs text-[var(--muted)] mt-0.5 truncate">
                        {metaParts.join(" · ")}
                      </p>
                    )}
                  </div>
                  <CaretRight size={14} weight="bold" className="flex-shrink-0 text-[var(--twilight)]" />
                </button>
              );
            })}
          </div>

          {/* Overflow link — navigates to Find view.
              NOTE: Find view doesn't support a festival= filter param yet.
              This just opens Find, which is better than rendering 100+ rows.
              A festival-scoped Find filter is a follow-up. */}
          {hasOverflow && (
            <Link
              href={`/${portalSlug}?view=find`}
              className="mt-3 inline-flex items-center gap-1 text-xs font-mono hover:opacity-80 transition-opacity"
              style={{ color: "var(--accent-color)" }}
            >
              See all {totalEventCount} events
              <CaretRight size={11} weight="bold" />
            </Link>
          )}
        </div>
      ) : (
        /* Empty schedule — actionable hint */
        !festival.description ? null : (
          <div className="border-t border-[var(--twilight)] pt-6">
            <div className="text-center py-8">
              <CalendarBlank size={28} weight="light" className="mx-auto mb-3 text-[var(--twilight)]" aria-hidden="true" />
              {temporal.showTicketCta && festival.ticket_url ? (
                <p className="text-sm text-[var(--muted)]">
                  Schedule announced closer to the dates —{" "}
                  <a
                    href={festival.ticket_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-[var(--soft)]"
                  >
                    passes available now
                  </a>
                </p>
              ) : festival.website ? (
                <a
                  href={festival.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[var(--muted)] underline hover:text-[var(--soft)]"
                >
                  Check the festival website for schedule updates
                </a>
              ) : (
                <p className="text-sm text-[var(--muted)] italic">
                  Schedule details will appear when announced
                </p>
              )}
            </div>
          </div>
        )
      )}

      {/* Empty content fallback (no description AND no events) */}
      {!festival.description && allEvents.length === 0 && (
        <div className="text-center py-12">
          <CalendarBlank size={32} weight="light" className="mx-auto mb-4 text-[var(--twilight)]" aria-hidden="true" />
          {temporal.showTicketCta && festival.ticket_url ? (
            <p className="text-sm text-[var(--muted)]">
              Schedule announced closer to the dates —{" "}
              <a
                href={festival.ticket_url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-[var(--soft)]"
              >
                passes available now
              </a>
            </p>
          ) : festival.website ? (
            <>
              <p className="text-sm text-[var(--muted)] mb-2">Details coming soon</p>
              <a
                href={festival.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[var(--soft)] underline hover:text-[var(--cream)]"
              >
                Check the festival website for updates
              </a>
            </>
          ) : (
            <p className="text-sm text-[var(--muted)]">Details coming soon</p>
          )}
        </div>
      )}
    </div>
  );

  // ── MOBILE STICKY BAR ───────────────────────────────────────────────

  const mobileBottomBar = temporal.showTicketCta && festival.ticket_url ? (
    <DetailStickyBar
      primaryAction={{
        label: "Get Passes",
        href: festival.ticket_url,
        icon: <Ticket size={16} weight="light" />,
      }}
      primaryColor={temporal.ctaColor}
      containerClassName="max-w-3xl"
      scrollThreshold={0}
      className="lg:hidden"
    />
  ) : undefined;

  // ── RENDER ──────────────────────────────────────────────────────────

  return (
    <>
      <ScopedStyles css={accentClass?.css} />
      <DetailShell
        onClose={onClose}
        sidebar={sidebarContent}
        content={contentBody}
        bottomBar={mobileBottomBar}
      />
    </>
  );
}
