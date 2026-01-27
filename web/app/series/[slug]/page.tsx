import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import UnifiedHeader from "@/components/UnifiedHeader";
import PageFooter from "@/components/PageFooter";
import {
  getSeriesBySlug,
  getSeriesEvents,
  getSeriesTypeLabel,
  getSeriesTypeColor,
  formatGenre,
  groupSeriesEventsByVenue,
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

// Group events by date within a venue (for display)
function groupEventsByDate(
  events: { id: number; date: string; time: string | null; ticketUrl: string | null }[]
): Map<string, typeof events> {
  const groups = new Map<string, typeof events>();
  for (const event of events) {
    if (!groups.has(event.date)) {
      groups.set(event.date, []);
    }
    groups.get(event.date)!.push(event);
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
  const venueShowtimes = groupSeriesEventsByVenue(events);
  const typeColor = getSeriesTypeColor(series.series_type);

  return (
    <div className="min-h-screen">
      <UnifiedHeader />

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
                    ) : series.series_type === "festival_program" ? (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
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

      {/* Showtimes Section - Venue First Layout */}
      <main className="max-w-3xl mx-auto px-4 py-8">
        <h2 className="text-xl font-bold text-[var(--cream)] mb-6">
          {events.length > 0 ? (
            <>
              <span className="text-[var(--coral)]">{events.length}</span> Upcoming{" "}
              {series.series_type === "film" ? "Showtime" : "Event"}
              {events.length !== 1 ? "s" : ""}{" "}
              {venueShowtimes.length > 0 && (
                <>
                  at{" "}
                  <span className="text-[var(--coral)]">{venueShowtimes.length}</span>{" "}
                  {venueShowtimes.length === 1 ? "Venue" : "Venues"}
                </>
              )}
            </>
          ) : (
            series.series_type === "festival_program"
              ? "No Scheduled Events"
              : "No Upcoming Events"
          )}
        </h2>

        {venueShowtimes.length > 0 ? (
          <div className="space-y-6">
            {venueShowtimes.map((vs) => {
              const eventsByDate = groupEventsByDate(vs.events);

              return (
                <div
                  key={vs.venue.id}
                  className="rounded-lg border border-[var(--twilight)] overflow-hidden"
                  style={{ backgroundColor: "var(--card-bg)" }}
                >
                  {/* Venue header */}
                  <div className="p-4 border-b border-[var(--twilight)]/50">
                    <Link
                      href={`/spots/${vs.venue.slug}`}
                      className="group flex items-center gap-2"
                    >
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
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      <span className="font-semibold text-[var(--cream)] group-hover:text-[var(--coral)] transition-colors">
                        {vs.venue.name}
                      </span>
                      {vs.venue.neighborhood && (
                        <span className="text-sm text-[var(--muted)] font-mono">
                          ({vs.venue.neighborhood})
                        </span>
                      )}
                      <svg
                        className="w-4 h-4 text-[var(--muted)] group-hover:text-[var(--coral)] transition-colors ml-auto"
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
                  </div>

                  {/* Dates and times for this venue */}
                  <div className="divide-y divide-[var(--twilight)]/30">
                    {Array.from(eventsByDate.entries()).map(([date, dateEvents]) => (
                      <div key={date} className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {/* Date */}
                          <div className="flex-shrink-0 w-28">
                            <span className="text-sm font-medium text-[var(--soft)]">
                              {formatDate(date)}
                            </span>
                          </div>

                          {/* Times */}
                          <div className="flex flex-wrap items-center gap-2">
                            {dateEvents.map((event) => (
                              <div key={event.id} className="flex items-center gap-1">
                                {event.ticketUrl ? (
                                  <a
                                    href={event.ticketUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-mono text-sm px-2 py-1 rounded bg-[var(--twilight)]/50 text-[var(--cream)] hover:bg-[var(--coral)] hover:text-[var(--void)] transition-colors"
                                  >
                                    {formatTime(event.time)}
                                  </a>
                                ) : (
                                  <span className="font-mono text-sm px-2 py-1 rounded bg-[var(--twilight)]/30 text-[var(--muted)]">
                                    {formatTime(event.time)}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
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
