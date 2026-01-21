import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import GlassHeader from "@/components/GlassHeader";
import MainNav from "@/components/MainNav";
import PageFooter from "@/components/PageFooter";
import {
  getSeriesBySlug,
  getSeriesEvents,
  getSeriesTypeLabel,
  getSeriesTypeColor,
  formatGenre,
} from "@/lib/series";

export const revalidate = 300; // 5 minutes

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const series = await getSeriesBySlug(slug);

  if (!series) {
    return { title: "Series Not Found" };
  }

  return {
    title: `${series.title} | Lost City`,
    description: series.description || `See all showtimes and venues for ${series.title}`,
  };
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(timeStr: string | null): string {
  if (!timeStr) return "";
  const [hours, minutes] = timeStr.split(":");
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
}

// Group events by date
function groupEventsByDate(
  events: Awaited<ReturnType<typeof getSeriesEvents>>
): Map<string, typeof events> {
  const groups = new Map<string, typeof events>();
  for (const event of events) {
    const date = event.start_date;
    if (!groups.has(date)) {
      groups.set(date, []);
    }
    groups.get(date)!.push(event);
  }
  return groups;
}

export default async function SeriesPage({ params }: Props) {
  const { slug } = await params;
  const series = await getSeriesBySlug(slug);

  if (!series) {
    notFound();
  }

  const events = await getSeriesEvents(series.id);
  const eventsByDate = groupEventsByDate(events);
  const typeColor = getSeriesTypeColor(series.series_type);

  return (
    <div className="min-h-screen">
      <GlassHeader />

      <Suspense fallback={<div className="h-10 bg-[var(--night)]" />}>
        <MainNav />
      </Suspense>

      {/* Hero Section */}
      <section className="relative">
        {/* Background gradient */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            background: `linear-gradient(to bottom, ${typeColor}40, transparent)`,
          }}
        />

        <div className="relative max-w-3xl mx-auto px-4 py-8">
          <div className="flex items-start gap-6">
            {/* Poster/Image */}
            <div className="flex-shrink-0">
              {series.image_url ? (
                <Image
                  src={series.image_url}
                  alt={series.title}
                  width={160}
                  height={240}
                  className="rounded-xl object-cover shadow-lg"
                  style={{ width: 160, height: 240 }}
                />
              ) : (
                <div
                  className="w-40 h-60 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${typeColor}20` }}
                >
                  <svg
                    className="w-16 h-16"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    style={{ color: typeColor }}
                  >
                    {series.series_type === "film" ? (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
                      />
                    ) : (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    )}
                  </svg>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              {/* Type badge */}
              <span
                className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-mono font-medium uppercase tracking-wider mb-3"
                style={{
                  backgroundColor: `${typeColor}20`,
                  color: typeColor,
                }}
              >
                {getSeriesTypeLabel(series.series_type)}
              </span>

              <h1 className="text-3xl font-bold text-[var(--cream)] mb-2">
                {series.title}
              </h1>

              {/* Film metadata */}
              {series.series_type === "film" && (
                <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--muted)] mb-4">
                  {series.year && <span>{series.year}</span>}
                  {series.rating && (
                    <span className="px-1.5 py-0.5 border border-[var(--muted)] rounded text-xs">
                      {series.rating}
                    </span>
                  )}
                  {series.runtime_minutes && (
                    <span>
                      {Math.floor(series.runtime_minutes / 60)}h{" "}
                      {series.runtime_minutes % 60}m
                    </span>
                  )}
                  {series.director && (
                    <span>
                      Directed by{" "}
                      <span className="text-[var(--soft)]">{series.director}</span>
                    </span>
                  )}
                </div>
              )}

              {/* Recurring show metadata */}
              {series.series_type === "recurring_show" && series.frequency && (
                <div className="flex items-center gap-2 text-sm text-[var(--muted)] mb-4">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  <span className="capitalize">{series.frequency}</span>
                  {series.day_of_week && (
                    <span className="capitalize">on {series.day_of_week}s</span>
                  )}
                </div>
              )}

              {series.description && (
                <p className="text-[var(--soft)] leading-relaxed mb-4">
                  {series.description}
                </p>
              )}

              {/* Genres */}
              {series.genres && series.genres.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {series.genres.map((genre) => (
                    <span
                      key={genre}
                      className="px-2.5 py-1 rounded-full text-xs font-medium border border-[var(--twilight)]"
                      style={{ backgroundColor: "var(--void)" }}
                    >
                      {formatGenre(genre)}
                    </span>
                  ))}
                </div>
              )}

              {/* Trailer link */}
              {series.trailer_url && (
                <a
                  href={series.trailer_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--twilight)] text-[var(--cream)] hover:bg-[var(--twilight)]/80 transition-colors"
                >
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Watch Trailer
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Showtimes Section */}
      <main className="max-w-3xl mx-auto px-4 py-8">
        <h2 className="text-xl font-bold text-[var(--cream)] mb-6">
          {events.length > 0 ? (
            <>
              <span className="text-[var(--coral)]">{events.length}</span> Upcoming{" "}
              {series.series_type === "film" ? "Showtime" : "Event"}
              {events.length !== 1 ? "s" : ""}
            </>
          ) : (
            "No Upcoming Events"
          )}
        </h2>

        {events.length > 0 ? (
          <div className="space-y-6">
            {Array.from(eventsByDate.entries()).map(([date, dateEvents]) => (
              <div key={date}>
                {/* Date header */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="text-[var(--cream)] font-medium">
                    {formatDate(date)}
                  </div>
                  <div className="flex-1 h-px bg-[var(--twilight)]" />
                </div>

                {/* Events for this date */}
                <div className="space-y-2">
                  {dateEvents.map((event) => (
                    <Link
                      key={event.id}
                      href={`/events/${event.id}`}
                      className="flex items-center gap-4 p-4 rounded-lg border border-[var(--twilight)] transition-all hover:border-[var(--coral)]/50 group"
                      style={{ backgroundColor: "var(--card-bg)" }}
                    >
                      {/* Time */}
                      <div className="flex-shrink-0 w-20 text-center">
                        {event.start_time ? (
                          <span className="text-lg font-mono text-[var(--cream)] group-hover:text-[var(--coral)] transition-colors">
                            {formatTime(event.start_time)}
                          </span>
                        ) : (
                          <span className="text-sm font-mono text-[var(--muted)]">
                            TBA
                          </span>
                        )}
                      </div>

                      {/* Venue */}
                      <div className="flex-1 min-w-0">
                        {event.venue ? (
                          <>
                            <div className="font-medium text-[var(--cream)] truncate group-hover:text-[var(--coral)] transition-colors">
                              {event.venue.name}
                            </div>
                            {event.venue.neighborhood && (
                              <div className="text-xs text-[var(--muted)] font-mono">
                                {event.venue.neighborhood}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="text-[var(--muted)]">Venue TBA</div>
                        )}
                      </div>

                      {/* Ticket button */}
                      {event.ticket_url && (
                        <a
                          href={event.ticket_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-[var(--coral)] text-[var(--void)] text-sm font-medium hover:bg-[var(--rose)] transition-colors"
                        >
                          Tickets
                        </a>
                      )}

                      {/* Arrow */}
                      <svg
                        className="w-5 h-5 text-[var(--muted)] group-hover:text-[var(--coral)] transition-colors flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--twilight)]/30 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-[var(--muted)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <p className="text-[var(--muted)]">
              No upcoming showtimes scheduled
            </p>
            <p className="text-sm text-[var(--muted)] mt-2">
              Check back later for new dates
            </p>
          </div>
        )}
      </main>

      <PageFooter />
    </div>
  );
}
