"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "@/components/SmartImage";
import ScopedStyles from "@/components/ScopedStyles";
import RSVPButton from "@/components/RSVPButton";
import AddToCalendar from "@/components/AddToCalendar";
import { createCssVarClass } from "@/lib/css-utils";
import GettingThereSection from "@/components/GettingThereSection";
import { format, parseISO } from "date-fns";
import { decodeHtmlEntities, formatTimeSplit } from "@/lib/formats";
import { usePortalOptional } from "@/lib/portal-context";

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

const FESTIVAL_ACCENT = "#FBBF24";

const NeonFloatingBackButton = ({ onClose }: { onClose: () => void }) => (
  <button
    onClick={onClose}
    className="group absolute top-3 left-3 flex items-center gap-2 px-3.5 py-2 rounded-full font-mono text-xs font-semibold tracking-wide uppercase transition-all duration-300 z-10 hover:scale-105 neon-back-btn"
  >
    <svg
      className="w-4 h-4 transition-transform duration-300 group-hover:-translate-x-0.5 neon-back-icon"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
    </svg>
    <span className="transition-all duration-300 group-hover:text-[var(--coral)] neon-back-text">
      Back
    </span>
  </button>
);

function groupSessionsByDate(sessions: SessionData[]): Map<string, SessionData[]> {
  const map = new Map<string, SessionData[]>();
  sessions.forEach((session) => {
    if (!map.has(session.start_date)) {
      map.set(session.start_date, []);
    }
    map.get(session.start_date)!.push(session);
  });
  return map;
}

function formatSessionTime(time: string | null): string {
  if (!time) return "TBA";
  const { time: t, period } = formatTimeSplit(time, false);
  return period ? `${t} ${period}` : t;
}

export default function FestivalDetailView({
  slug,
  portalSlug,
  onClose,
  showOpenPageLink = true,
}: FestivalDetailViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const portalContext = usePortalOptional();
  const portalId = portalContext?.portal?.id || null;
  const [festival, setFestival] = useState<FestivalData | null>(null);
  const [programs, setPrograms] = useState<ProgramData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    async function fetchFestival() {
      setLoading(true);
      setError(null);

      try {
        const qs = portalId ? `?${new URLSearchParams({ portal_id: portalId }).toString()}` : "";
        const res = await fetch(`/api/festivals/${slug}${qs}`);
        if (!res.ok) {
          throw new Error("Festival not found");
        }
        const data = (await res.json()) as FestivalResponse;
        setFestival(data.festival);
        setPrograms(data.programs || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load festival");
      } finally {
        setLoading(false);
      }
    }

    fetchFestival();
  }, [slug, portalId]);

  const allSessions = useMemo(() => programs.flatMap((p) => p.sessions || []), [programs]);
  const summary = useMemo(() => {
    if (allSessions.length === 0) return null;
    const dates = allSessions.map((s) => s.start_date).sort();
    const startDate = dates[0];
    const endDate = dates[dates.length - 1];
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
  }, [allSessions, programs.length]);

  const accentClass = createCssVarClass("--accent-color", FESTIVAL_ACCENT, "accent");

  const navigateToDetail = (param: string, value: string | number) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.delete("event");
    params.delete("spot");
    params.delete("series");
    params.delete("festival");
    params.delete("org");
    params.set(param, String(value));
    router.push(`/${portalSlug}?${params.toString()}`, { scroll: false });
  };

  const handleSessionClick = (id: number) => navigateToDetail("event", id);
  const handleProgramClick = (slug: string) => navigateToDetail("series", slug);

  if (loading) {
    return (
      <div className="pt-6">
        <div className="relative rounded-xl overflow-hidden mb-6 bg-[var(--dusk)]">
          <NeonFloatingBackButton onClose={onClose} />
          <div className="p-6 flex items-start gap-4">
            <div className="w-28 aspect-[4/5] skeleton-shimmer rounded-lg" />
            <div className="flex-1 space-y-3 pt-2">
              <div className="h-5 skeleton-shimmer rounded w-20" />
              <div className="h-7 skeleton-shimmer rounded w-3/4" />
              <div className="h-4 skeleton-shimmer rounded w-1/2" />
            </div>
          </div>
        </div>
        <div className="h-32 skeleton-shimmer rounded-xl" />
      </div>
    );
  }

  if (error || !festival) {
    return (
      <div className="pt-6">
        <div className="relative rounded-xl overflow-hidden mb-6 bg-[var(--dusk)] border border-[var(--twilight)]">
          <NeonFloatingBackButton onClose={onClose} />
          <div className="text-center py-16">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--twilight)]/50 flex items-center justify-center">
              <svg className="w-6 h-6 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-[var(--muted)]">{error || "Festival not found"}</p>
          </div>
        </div>
      </div>
    );
  }

  const showImage = festival.image_url && !imageError;
  const dateRange = summary?.startDate
    ? summary.startDate === summary.endDate
      ? format(parseISO(summary.startDate), "EEE, MMM d")
      : `${format(parseISO(summary.startDate), "MMM d")}–${format(parseISO(summary.endDate), "MMM d")}`
    : "Schedule TBD";

  return (
    <div className={`pt-6 pb-8 ${accentClass?.className ?? ""}`}>
      <ScopedStyles css={accentClass?.css} />
      <div className="relative rounded-xl overflow-hidden mb-6 border border-[var(--twilight)] series-hero-bg">
        <NeonFloatingBackButton onClose={onClose} />
        <div className="p-6 flex items-start gap-4">
          <div className="flex-shrink-0">
            {showImage ? (
              <div className="relative w-28 aspect-[4/5] rounded-lg overflow-hidden border border-[var(--twilight)]">
                {!imageLoaded && (
                  <div className="absolute inset-0 skeleton-shimmer" />
                )}
                <Image
                  src={festival.image_url!}
                  alt={festival.name}
                  fill
                  sizes="112px"
                  className="object-cover"
                  onLoad={() => setImageLoaded(true)}
                  onError={() => setImageError(true)}
                />
              </div>
            ) : (
              <div className="w-28 aspect-[4/5] rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] flex items-center justify-center">
                <svg className="w-10 h-10 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 4v16m0-12h9l-1.5 3L14 14H5" />
                </svg>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[0.6rem] font-mono font-semibold uppercase tracking-wider bg-accent-20 text-accent">
                Festival
              </div>
              {showOpenPageLink && (
                <Link
                  href={`/${portalSlug}/festivals/${festival.slug}`}
                  className="text-[0.6rem] font-mono uppercase tracking-wider px-2 py-1 rounded-full border border-[var(--twilight)] text-[var(--soft)] hover:text-[var(--cream)] hover:border-[var(--coral)]/40 transition-colors"
                >
                  Open page
                </Link>
              )}
            </div>
            <h1 className="text-[var(--cream)] text-2xl font-bold mb-2 leading-tight">
              {festival.name}
            </h1>
            <div className="text-sm text-[var(--soft)] space-y-1">
              <div>{dateRange}</div>
              {festival.location && (
                <div className="text-[var(--muted)]">{festival.location}</div>
              )}
            </div>
            {summary && (
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="inline-flex items-center px-2 py-1 rounded font-mono text-[0.6rem] bg-[var(--twilight)]/40 text-[var(--soft)]">
                  {summary.programCount} program{summary.programCount !== 1 ? "s" : ""}
                </span>
                <span className="inline-flex items-center px-2 py-1 rounded font-mono text-[0.6rem] bg-[var(--twilight)]/40 text-[var(--soft)]">
                  {summary.sessionCount} session{summary.sessionCount !== 1 ? "s" : ""}
                </span>
                {summary.venueCount > 0 && (
                  <span className="inline-flex items-center px-2 py-1 rounded font-mono text-[0.6rem] bg-[var(--twilight)]/40 text-[var(--soft)]">
                    {summary.venueCount} venue{summary.venueCount !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {festival.description && (
        <div className="mb-6 p-4 rounded-lg border border-[var(--twilight)] bg-[var(--void)] text-sm text-[var(--soft)]">
          {festival.description}
        </div>
      )}

      {/* Transit info for single-venue festivals */}
      {(() => {
        const venueIds = new Set(allSessions.filter((s) => s.venue).map((s) => s.venue!.id));
        const singleVenue = venueIds.size === 1 ? allSessions.find((s) => s.venue)?.venue ?? null : null;
        return singleVenue ? (
          <div className="mb-6">
            <GettingThereSection transit={singleVenue} variant="compact" />
          </div>
        ) : null;
      })()}

      <div className="space-y-4">
        {programs.length === 0 && (
          <div className="text-center py-12 text-[var(--muted)]">
            Program details coming soon.
          </div>
        )}

        {programs.map((program) => {
          const sessionsByDate = groupSessionsByDate(program.sessions || []);
          const sortedDates = Array.from(sessionsByDate.keys()).sort();

          return (
            <div key={program.id} className="rounded-xl border border-[var(--twilight)] bg-[var(--card-bg)] p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="text-[var(--cream)] text-lg font-semibold truncate">
                    {program.title}
                  </h3>
                  <p className="text-[var(--muted)] text-xs mt-1">
                    {program.sessions.length} session{program.sessions.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <button
                  onClick={() => handleProgramClick(program.slug)}
                  className="shrink-0 text-xs font-mono px-3 py-1.5 rounded-full border border-[var(--twilight)] text-[var(--soft)] hover:text-[var(--cream)] hover:border-[var(--coral)]/40 transition-colors"
                >
                  View program
                </button>
              </div>

              {program.description && (
                <p className="text-sm text-[var(--soft)] mt-2 line-clamp-2">
                  {program.description}
                </p>
              )}

              {program.sessions.length === 0 && (
                <div className="text-xs text-[var(--muted)] mt-3">
                  Schedule coming soon.
                </div>
              )}

              {program.sessions.length > 0 && (
                <div className="mt-3 space-y-3">
                  {sortedDates.map((date) => (
                    <div key={date} className="space-y-2">
                      <div className="text-[0.65rem] font-mono uppercase tracking-wider text-[var(--muted)]">
                        {format(parseISO(date), "EEE, MMM d")}
                      </div>
                      <div className="space-y-1">
                        {sessionsByDate.get(date)!.map((session) => {
                          const sessionTitle = decodeHtmlEntities(session.title);

                          return (
                            <div
                              key={session.id}
                              className="flex items-start gap-2 px-2.5 py-2 rounded-lg border border-transparent hover:border-[var(--twilight)] hover:bg-[var(--twilight)]/30 transition-colors"
                            >
                              <button
                                onClick={() => handleSessionClick(session.id)}
                                className="flex-1 min-w-0 text-left"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <span className="font-mono text-[0.65rem] text-[var(--muted)] shrink-0">
                                    {formatSessionTime(session.start_time)}
                                  </span>
                                  <span className="text-sm text-[var(--cream)] truncate">
                                    {sessionTitle}
                                  </span>
                                </div>
                                {session.venue && (
                                  <span className="block text-[0.65rem] text-[var(--muted)] mt-0.5 truncate">
                                    {session.venue.name}
                                  </span>
                                )}
                              </button>

                              <div className="flex shrink-0 items-center gap-1 pt-0.5">
                                <AddToCalendar
                                  eventId={session.id}
                                  title={sessionTitle}
                                  date={session.start_date}
                                  time={session.start_time}
                                  venue={session.venue?.name}
                                  variant="icon"
                                />
                                <RSVPButton
                                  eventId={session.id}
                                  eventTitle={sessionTitle}
                                  venueId={session.venue?.id}
                                  venueName={session.venue?.name}
                                  variant="compact"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
