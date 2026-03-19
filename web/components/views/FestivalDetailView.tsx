"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Skeleton from "@/components/Skeleton";
import ScopedStyles from "@/components/ScopedStyles";
import RSVPButton from "@/components/RSVPButton";
import AddToCalendar from "@/components/AddToCalendar";
import { createCssVarClass } from "@/lib/css-utils";
import { format, parseISO } from "date-fns";
import { decodeHtmlEntities, formatTimeSplit } from "@/lib/formats";
import { usePortal } from "@/lib/portal-context";
import LinkifyText from "../LinkifyText";
import SmartImage from "@/components/SmartImage";
import {
  ArrowSquareOut,
  MapPin,
  CalendarBlank,
  Ticket,
  Globe,
  CaretRight,
  ArrowCounterClockwise,
  ArrowLeft,
  Train,
  Car,
  Path,
  MusicNotes,
  BeerStein,
  SunHorizon,
  ForkKnife,
  UsersThree,
} from "@phosphor-icons/react";
import DetailShell from "@/components/detail/DetailShell";
import { DetailStickyBar } from "@/components/detail/DetailStickyBar";
import { useDetailFetch } from "@/lib/hooks/useDetailFetch";
import { useDetailNavigation } from "@/lib/hooks/useDetailNavigation";

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
  audience?: string | null;
  size_tier?: string | null;
  indoor_outdoor?: string | null;
  price_tier?: string | null;
  festival_type?: string | null;
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

const FESTIVAL_ACCENT = "#FFD93D";

const FESTIVAL_TYPE_LABELS: Record<string, string> = {
  music_festival: "Music Festival",
  food_festival: "Food Festival",
  arts_festival: "Arts Festival",
  film_festival: "Film Festival",
  cultural_festival: "Cultural Festival",
  comedy_festival: "Comedy Festival",
  tech_festival: "Tech Festival",
  community_festival: "Community Festival",
  beer_festival: "Beer Festival",
  wine_festival: "Wine Festival",
};

const STAGE_ACCENT_COLORS = [
  "#FFD93D",
  "#00D9A0",
  "#A78BFA",
  "#00D4E8",
  "#E855A0",
];

// Maps experience_tags slugs → display label + Phosphor icon element
const EXPERIENCE_TAG_META: Record<string, { label: string; icon: React.ReactNode }> = {
  live_music:      { label: "Live Music",     icon: <MusicNotes size={11} weight="fill" /> },
  craft_beer:      { label: "Craft Beer",     icon: <BeerStein size={11} weight="fill" /> },
  outdoor:         { label: "Outdoor",        icon: <SunHorizon size={11} weight="fill" /> },
  food_vendors:    { label: "Food Vendors",   icon: <ForkKnife size={11} weight="fill" /> },
  all_ages:        { label: "All Ages",       icon: <UsersThree size={11} weight="fill" /> },
  family_friendly: { label: "Family",         icon: <UsersThree size={11} weight="fill" /> },
};

function getTagMeta(tag: string): { label: string; icon: React.ReactNode } {
  const key = tag.toLowerCase().replace(/[\s-]/g, "_");
  if (EXPERIENCE_TAG_META[key]) return EXPERIENCE_TAG_META[key];
  const label = tag.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return { label, icon: null };
}

// ── Helpers ──────────────────────────────────────────────────────────────

function formatSessionTime(time: string | null): string {
  if (!time) return "TBA";
  // Treat midnight placeholder as unknown time
  if (time === "00:00:00" || time === "00:00") return "TBA";
  const { time: t, period } = formatTimeSplit(time, false);
  return period ? `${t} ${period}` : t;
}

function formatDayDuration(startDate: string, endDate: string | null): string {
  if (!endDate || startDate === endDate) return "1 day";
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  return `${days} day${days !== 1 ? "s" : ""}`;
}

// ── Component ────────────────────────────────────────────────────────────

export default function FestivalDetailView({
  slug,
  portalSlug,
  onClose,
  showOpenPageLink = true,
}: FestivalDetailViewProps) {
  const { portal } = usePortal();
  const { toEvent, toSeries: handleProgramClick } = useDetailNavigation(portalSlug);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const fetchUrl = useMemo(() => {
    if (!portal?.id) return null;
    return `/api/festivals/${slug}?portal_id=${portal.id}`;
  }, [slug, portal?.id]);

  const { data, status, error, retry } = useDetailFetch<FestivalResponse>(fetchUrl, {
    entityLabel: "festival",
  });

  const festival = data?.festival ?? null;
  const programs = useMemo(() => data?.programs ?? [], [data]);

  const allSessions = useMemo(() => programs.flatMap((p) => p.sessions || []), [programs]);

  const summary = useMemo(() => {
    if (allSessions.length === 0 && !festival) return null;
    const dates = allSessions.map((s) => s.start_date).sort();
    const startDate = festival?.announced_start || dates[0] || null;
    const endDate = festival?.announced_end || dates[dates.length - 1] || null;
    const venues = new Map<number, SessionData["venue"]>();
    allSessions.forEach((s) => {
      if (s.venue) venues.set(s.venue.id, s.venue);
    });
    return {
      startDate,
      endDate,
      programCount: programs.length,
      sessionCount: allSessions.length,
      venueCount: venues.size,
    };
  }, [allSessions, programs.length, festival]);

  const singleVenue = useMemo(() => {
    const venueIds = new Set(allSessions.filter((s) => s.venue).map((s) => s.venue!.id));
    return venueIds.size === 1 ? allSessions.find((s) => s.venue)?.venue ?? null : null;
  }, [allSessions]);

  // Unique sorted dates for day tabs
  const uniqueDates = useMemo(() => {
    const dates = [...new Set(allSessions.map((s) => s.start_date))].sort();
    return dates;
  }, [allSessions]);

  // Effective selected day (defaults to today if in range, else first date)
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const defaultDay = uniqueDates.includes(todayStr) ? todayStr : uniqueDates[0] ?? null;
  const activeDay = selectedDay && uniqueDates.includes(selectedDay) ? selectedDay : defaultDay;

  // Programs filtered to active day
  const dayPrograms = useMemo(() => {
    if (!activeDay) return programs;
    return programs
      .map((p) => ({
        ...p,
        sessions: p.sessions.filter((s) => s.start_date === activeDay),
      }))
      .filter((p) => p.sessions.length > 0);
  }, [programs, activeDay]);

  const accentClass = createCssVarClass("--accent-color", FESTIVAL_ACCENT, "accent");

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
          <Skeleton className="h-6 w-20 rounded" delay="0.2s" />
          <Skeleton className="h-6 w-20 rounded" delay="0.22s" />
        </div>
        <div className="mx-5 border-t border-[var(--twilight)]/40" />
        <div className="px-5 py-3 flex gap-2">
          <Skeleton className="h-6 w-16 rounded" delay="0.26s" />
          <Skeleton className="h-6 w-16 rounded" delay="0.28s" />
          <Skeleton className="h-6 w-14 rounded" delay="0.3s" />
        </div>
      </div>
    );
    const skeletonContent = (
      <div className="p-6 lg:p-8 space-y-6">
        <Skeleton className="h-4 w-full rounded" delay="0.28s" />
        <Skeleton className="h-4 w-[75%] rounded" delay="0.3s" />
        <div className="flex gap-2 pt-2">
          <Skeleton className="h-9 w-20 rounded-lg" delay="0.4s" />
          <Skeleton className="h-9 w-20 rounded-lg" delay="0.42s" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-20 w-full rounded-xl" delay="0.46s" />
          <Skeleton className="h-20 w-full rounded-xl" delay="0.5s" />
        </div>
      </div>
    );
    return <DetailShell onClose={onClose} sidebar={skeletonSidebar} content={skeletonContent} />;
  }

  // ── ERROR ────────────────────────────────────────────────────────────

  if (error || !festival) {
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

  const dateRange = summary?.startDate
    ? summary.startDate === summary.endDate
      ? format(parseISO(summary.startDate), "EEE, MMM d")
      : `${format(parseISO(summary.startDate), "MMM d")}–${format(parseISO(summary.endDate!), "MMM d, yyyy")}`
    : "Schedule TBD";

  const durationLabel = summary?.startDate
    ? formatDayDuration(summary.startDate, summary.endDate ?? null)
    : null;

  // Stats pills: programs as "stages", duration
  const statPills: string[] = [];
  if (summary?.programCount) statPills.push(`${summary.programCount} Stage${summary.programCount !== 1 ? "s" : ""}`);
  if (durationLabel) statPills.push(durationLabel);

  // Hero image fallback chain: festival image → first program image → null (renders gradient)
  const heroImageUrl = festival.image_url
    ?? programs.find((p) => p.image_url)?.image_url
    ?? null;

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

      {/* Festival identity */}
      <div className="px-5 pt-3 pb-3 space-y-2">
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
          <span className="text-sm text-[var(--cream)]">
            {dateRange}
            {durationLabel && <span className="text-[var(--soft)]"> · {durationLabel}</span>}
          </span>
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

      {/* Experience tags */}
      {festival.experience_tags && festival.experience_tags.length > 0 && (
        <>
          <div className="mx-5 border-t border-[var(--twilight)]/40" />
          <div className="px-5 py-2.5 space-y-2">
            <p className="font-mono text-2xs font-bold text-[var(--muted)] uppercase tracking-[0.12em]">
              Experience
            </p>
            <div className="flex flex-wrap gap-1.5">
              {festival.experience_tags.map((tag, i) => {
                const { label, icon } = getTagMeta(tag);
                const isPrimary = i === 0;
                return (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs"
                    style={
                      isPrimary
                        ? {
                            color: "var(--accent-color)",
                            background: "color-mix(in srgb, var(--accent-color) 15%, transparent)",
                          }
                        : {
                            color: "var(--soft)",
                            background: "var(--dusk)",
                            border: "1px solid var(--twilight)",
                          }
                    }
                  >
                    {icon && (
                      <span style={isPrimary ? { color: "var(--accent-color)" } : { color: "var(--muted)" }}>
                        {icon}
                      </span>
                    )}
                    {label}
                  </span>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Stats row */}
      {statPills.length > 0 && (
        <>
          <div className="mx-5 border-t border-[var(--twilight)]/40" />
          <div className="px-5 py-2.5 flex flex-wrap gap-1.5">
            {statPills.map((pill) => (
              <span
                key={pill}
                className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium text-[var(--cream)] bg-[var(--dusk)] border border-[var(--twilight)]"
              >
                {pill}
              </span>
            ))}
          </div>
        </>
      )}

      {/* CTAs */}
      {(festival.ticket_url || festival.website) && (
        <>
          <div className="mx-5 border-t border-[var(--twilight)]/40" />
          <div className="px-5 py-3 space-y-2">
            {festival.ticket_url && (
              <a
                href={festival.ticket_url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 min-h-[44px] rounded-lg text-sm font-medium transition-all focus-ring hover:brightness-110"
                style={{
                  background: "var(--accent-color)",
                  color: "#09090B",
                }}
              >
                <Ticket size={16} weight="bold" aria-hidden="true" />
                Get Festival Passes
              </a>
            )}
            {festival.website && (
              <a
                href={festival.website}
                target="_blank"
                rel="noopener noreferrer"
                className={`w-full flex items-center justify-center gap-2 transition-colors focus-ring ${
                  festival.ticket_url
                    ? "min-h-[44px] text-sm text-[var(--soft)] hover:text-[var(--cream)]"
                    : "min-h-[44px] rounded-lg border border-[var(--twilight)] text-sm font-medium text-[var(--soft)] hover:text-[var(--cream)] hover:border-[var(--soft)]"
                }`}
              >
                <Globe size={15} weight={festival.ticket_url ? "light" : "bold"} aria-hidden="true" />
                Visit Website
              </a>
            )}
          </div>
        </>
      )}

      {/* Getting There (single venue, inline icon rows) */}
      {singleVenue && (singleVenue.nearest_marta_station || singleVenue.beltline_adjacent || (singleVenue.parking_type && singleVenue.parking_type.length > 0)) && (
        <>
          <div className="mx-5 border-t border-[var(--twilight)]/40" />
          <div className="px-5 py-3 space-y-2">
            <p className="font-mono text-2xs font-bold text-[var(--muted)] uppercase tracking-[0.12em] mb-2">
              Getting There
            </p>
            {singleVenue.nearest_marta_station && singleVenue.marta_walk_minutes != null && singleVenue.marta_walk_minutes <= 15 && (
              <div className="flex items-center gap-2">
                <Train size={13} weight="fill" style={{ color: "#A78BFA" }} aria-hidden="true" className="flex-shrink-0" />
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
                <Path size={13} weight="bold" style={{ color: "#00D9A0" }} aria-hidden="true" className="flex-shrink-0" />
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
      <div>
        <div className="flex items-center gap-3 mb-4">
          <p className="font-mono text-xs font-bold text-[var(--muted)] uppercase tracking-[0.12em]">
            Schedule
          </p>
          {allSessions.length > 0 && (
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full font-mono text-2xs text-[var(--cream)] border border-[var(--twilight)]"
              style={{ background: "rgba(37,37,48,0.5)" }}
            >
              {allSessions.length}
            </span>
          )}
        </div>

        {/* Day tabs */}
        {uniqueDates.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-4 -mx-1 px-1">
            {uniqueDates.map((date) => {
              const isActive = date === activeDay;
              return (
                <button
                  key={date}
                  onClick={() => setSelectedDay(date)}
                  className="flex-shrink-0 flex flex-col items-center px-4 py-2 rounded-lg transition-colors focus-ring"
                  style={
                    isActive
                      ? { background: "var(--accent-color)" }
                      : {
                          background: "var(--dusk)",
                          border: "1px solid var(--twilight)",
                        }
                  }
                >
                  <span
                    className="font-mono text-2xs font-bold tracking-[0.06em] uppercase"
                    style={{ color: isActive ? "var(--void)" : "var(--muted)" }}
                  >
                    {format(parseISO(date), "EEE")}
                  </span>
                  <span
                    className="text-sm font-bold"
                    style={{ color: isActive ? "var(--void)" : "var(--soft)" }}
                  >
                    {format(parseISO(date), "MMM d")}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Stage cards */}
        {dayPrograms.length > 0 ? (
          <div className="space-y-4">
            {dayPrograms.map((program, programIndex) => {
              const stageColor = STAGE_ACCENT_COLORS[programIndex % STAGE_ACCENT_COLORS.length];

              // Detect headliner: last session with a known start_time
              const sorted = [...program.sessions].sort((a, b) =>
                (a.start_time ?? "").localeCompare(b.start_time ?? "")
              );
              const timedSessions = sorted.filter(
                (s) => s.start_time && s.start_time !== "00:00:00" && s.start_time !== "00:00"
              );
              const headlinerId = timedSessions.length > 1 ? timedSessions[timedSessions.length - 1].id : null;

              return (
                <div
                  key={program.id}
                  className="rounded-xl border border-[var(--twilight)] overflow-hidden"
                  style={{ background: "var(--night)" }}
                >
                  {/* Stage header */}
                  <div
                    className="flex items-center px-4 py-3 border-b"
                    style={{
                      background: `color-mix(in srgb, ${stageColor} 8%, transparent)`,
                      borderColor: "rgba(37,37,48,0.5)",
                    }}
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0 mr-3"
                      style={{ background: stageColor }}
                    />
                    <h3 className="text-sm font-bold text-[var(--cream)] flex-1 min-w-0 truncate">
                      {program.title}
                    </h3>
                    {program.sessions.length > 0 && (
                      <span
                        className="font-mono text-xs ml-3 flex-shrink-0"
                        style={{ color: "var(--muted)" }}
                      >
                        {program.sessions.length} set{program.sessions.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>

                  {/* Session rows */}
                  <div>
                    {sorted.map((session, rowIndex) => {
                      const sessionTitle = decodeHtmlEntities(session.title);
                      const isHeadliner = session.id === headlinerId && sorted.length > 1;

                      return (
                        <div
                          key={session.id}
                          className="flex items-center gap-3 px-4 group"
                          style={
                            isHeadliner
                              ? {
                                  background: `color-mix(in srgb, ${stageColor} 8%, transparent)`,
                                  borderBottom: rowIndex < sorted.length - 1 ? "1px solid rgba(37,37,48,0.3)" : undefined,
                                }
                              : {
                                  borderBottom: rowIndex < sorted.length - 1 ? "1px solid rgba(37,37,48,0.3)" : undefined,
                                }
                          }
                        >
                          <button
                            onClick={() => toEvent(session.id)}
                            className="flex-1 min-w-0 flex items-center gap-3 py-2.5 text-left focus-ring"
                            style={{ minHeight: "44px" }}
                          >
                            <span
                              className="font-mono text-xs shrink-0 w-16 tabular-nums"
                              style={{ color: isHeadliner ? stageColor : "var(--muted)" }}
                            >
                              {formatSessionTime(session.start_time)}
                            </span>
                            <span className="min-w-0 flex-1 flex items-center gap-2">
                              <span
                                className="truncate block"
                                style={{
                                  fontSize: isHeadliner ? "14px" : "13px",
                                  fontWeight: isHeadliner ? 600 : 500,
                                  color: "var(--cream)",
                                }}
                              >
                                {sessionTitle}
                              </span>
                              {isHeadliner && (
                                <span
                                  className="flex-shrink-0 font-mono text-2xs font-bold px-1.5 py-0.5 rounded"
                                  style={{
                                    color: stageColor,
                                    background: `color-mix(in srgb, ${stageColor} 20%, transparent)`,
                                  }}
                                >
                                  HEADLINER
                                </span>
                              )}
                            </span>
                          </button>

                          <div className="flex shrink-0 items-center gap-1">
                            {!isHeadliner && (
                              <AddToCalendar
                                eventId={session.id}
                                title={sessionTitle}
                                date={session.start_date}
                                time={session.start_time}
                                venue={session.venue?.name}
                                variant="icon"
                              />
                            )}
                            <RSVPButton
                              eventId={session.id}
                              eventTitle={sessionTitle}
                              venueId={session.venue?.id}
                              venueName={session.venue?.name}
                              variant="compact"
                            />
                          </div>

                          <CaretRight
                            size={14}
                            weight="bold"
                            className="flex-shrink-0"
                            style={{
                              color: isHeadliner
                                ? `color-mix(in srgb, ${stageColor} 60%, transparent)`
                                : "rgba(139,139,148,0.4)",
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>

                  {/* View program link */}
                  <div className="px-4 border-t border-[var(--twilight)]/20">
                    <button
                      onClick={() => handleProgramClick(program.slug)}
                      className="min-h-[44px] text-xs font-mono text-[var(--muted)] hover:text-[var(--soft)] transition-colors flex items-center gap-1 focus-ring"
                    >
                      View full program
                      <CaretRight size={11} weight="bold" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center border border-[var(--twilight)] rounded-xl bg-[var(--night)]">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--twilight)]/30 flex items-center justify-center">
              <CalendarBlank size={24} weight="light" className="text-[var(--muted)]" aria-hidden="true" />
            </div>
            <p className="text-[var(--muted)] text-sm">
              {programs.length > 0 ? "No sessions on this day" : "Program details coming soon"}
            </p>
          </div>
        )}
      </div>
    </div>
  );

  // ── MOBILE STICKY BAR ───────────────────────────────────────────────

  const mobileBottomBar = festival.ticket_url ? (
    <DetailStickyBar
      primaryAction={{
        label: "Get Passes",
        href: festival.ticket_url,
        icon: <Ticket size={16} weight="light" />,
      }}
      primaryColor={FESTIVAL_ACCENT}
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
