import { notFound, permanentRedirect } from "next/navigation";
import Link from "next/link";
import type { ReactElement } from "react";
import { cache } from "react";
import ScrollToTop from "@/components/ScrollToTop";
import {
  getSeriesBySlug,
  getSeriesEvents,
  getSeriesTypeColor,
  formatGenre,
  groupSeriesEventsByVenue,
} from "@/lib/series";
import { buildFilmCapsule } from "@/lib/film-capsule";
import { getRelatedSeries } from "@/lib/series-related";
import {
  LegacyDetailHero,
  InfoCard,
  MetadataGrid,
  SectionHeader,
  RelatedSection,
  RelatedCard,
  DetailStickyBar,
} from "@/components/detail";
import { safeJsonLd } from "@/lib/formats";
import { buildBreadcrumbSchema } from "@/lib/breadcrumb-schema";
import type { Metadata } from "next";
import ScopedStylesServer from "@/components/ScopedStylesServer";
import { createCssVarClass } from "@/lib/css-utils";
import { buildExploreUrl } from "@/lib/find-url";
import { buildSeriesUrl } from "@/lib/entity-urls";
import { resolveDetailPageRequest } from "../../_surfaces/detail/resolve-detail-page-request";

export const revalidate = 120;

type Props = {
  params: Promise<{ portal: string; slug: string }>;
};

// Deduplicate series fetches across generateMetadata and page
const getCachedSeriesBySlug = cache(getSeriesBySlug);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, portal: portalSlug } = await params;
  const series = await getCachedSeriesBySlug(slug);
  const request = await resolveDetailPageRequest({
    portalSlug,
    pathname: `/${portalSlug}/showtimes/${slug}`,
  });

  if (!series) {
    return {
      title: "Film Not Found",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const activePortalSlug = request?.portal.slug || portalSlug;
  const portalName = request?.portal.name || "Lost City";
  const fallbackDescription = `See all showtimes and venues for ${series.title}`;
  const description = series.description || fallbackDescription;

  return {
    title: `${series.title} | ${portalName}`,
    description,
    alternates: {
      canonical: `/${activePortalSlug}/showtimes/${slug}`,
    },
    openGraph: {
      title: series.title,
      description,
      type: "website",
      images: [
        {
          url: `/${activePortalSlug}/series/${slug}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: series.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: series.title,
      description,
      images: [
        {
          url: `/${activePortalSlug}/series/${slug}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: series.title,
        },
      ],
    },
  };
}

// Generate Schema.org Movie structured data
function generateFilmSchema(
  series: NonNullable<Awaited<ReturnType<typeof getSeriesBySlug>>>,
  events: Awaited<ReturnType<typeof getSeriesEvents>>
) {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Movie",
    name: series.title,
  };

  if (series.description) {
    schema.description = series.description;
  }

  if (series.image_url) {
    schema.image = [series.image_url];
  }

  if (series.director) {
    schema.director = {
      "@type": "Person",
      name: series.director,
    };
  }

  if (series.year) {
    schema.datePublished = series.year.toString();
  }

  if (series.trailer_url) {
    schema.trailer = {
      "@type": "VideoObject",
      url: series.trailer_url,
    };
  }

  if (series.genres && series.genres.length > 0) {
    schema.genre = series.genres.map((g) => formatGenre(g));
  }

  if (series.rating) {
    schema.contentRating = series.rating;
  }

  if (series.runtime_minutes) {
    schema.duration = `PT${series.runtime_minutes}M`;
  }

  // Screening events as subEvents
  if (events.length > 0) {
    schema.subjectOf = events.slice(0, 10).map((event) => ({
      "@type": "ScreeningEvent",
      name: event.title,
      startDate: event.start_time
        ? `${event.start_date}T${event.start_time}:00`
        : event.start_date,
      location: event.venue
        ? {
            "@type": "Place",
            name: event.venue.name,
          }
        : undefined,
    }));
  }

  return schema;
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

function formatRuntime(minutes: number | null): string {
  if (!minutes) return "Runtime Unknown";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) {
    return `${hours}h ${mins}m`;
  } else if (hours > 0) {
    return `${hours}h`;
  } else {
    return `${mins}m`;
  }
}

// Group events by date within a venue
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

function getFilmTypeIcon(): ReactElement {
  return (
    <svg
      className="w-6 h-6"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
      />
    </svg>
  );
}

export default async function PortalFilmPage({ params }: Props) {
  const { slug, portal: portalSlug } = await params;
  const series = await getCachedSeriesBySlug(slug);
  const request = await resolveDetailPageRequest({
    portalSlug,
    pathname: `/${portalSlug}/showtimes/${slug}`,
  });

  if (!series) {
    notFound();
  }

  // This route is film-only. Non-film series belong at /series/[slug].
  if (series.series_type !== "film") {
    permanentRedirect(`/${portalSlug}/series/${slug}`);
  }

  const activePortalSlug = request?.portal.slug || portalSlug;
  const activePortalName =
    request?.portal.name ||
    portalSlug.charAt(0).toUpperCase() + portalSlug.slice(1);

  const [events, relatedSeries] = await Promise.all([
    getSeriesEvents(series.id),
    getRelatedSeries(series.id, series.series_type, series.genres),
  ]);
  const venueShowtimes = groupSeriesEventsByVenue(events);
  const typeColor = getSeriesTypeColor("film");
  const seriesAccentClass = createCssVarClass("--accent-color", typeColor, "accent");
  const filmSchema = generateFilmSchema(series, events);
  const previewEvents = events.slice(0, 8);
  const remainingPreviewCount = Math.max(0, events.length - previewEvents.length);

  const heroSubtitle = [series.year, series.rating].filter(Boolean).join(" • ");

  return (
    <>
      <ScrollToTop />
      {/* Schema.org JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(filmSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLd(
            buildBreadcrumbSchema([
              { name: activePortalName, href: `/${activePortalSlug}` },
              {
                name: "Films",
                href: buildExploreUrl({ portalSlug: activePortalSlug, lane: "events" }),
              },
              { name: series.title },
            ])
          ),
        }}
      />

      <ScopedStylesServer css={seriesAccentClass?.css} />

      <div className={`min-h-screen ${seriesAccentClass?.className ?? ""}`}>
        <main
          data-clean-detail="true"
          className="max-w-5xl mx-auto px-4 py-4 sm:py-6 pb-32 md:pb-16 space-y-6 sm:space-y-9"
        >
          {/* Hero Section - Poster Mode */}
          <LegacyDetailHero
            mode="poster"
            entityId={series.id}
            viewTransitionPrefix="series-hero"
            imageUrl={series.image_url}
            title={series.title}
            subtitle={heroSubtitle}
            categoryColor={typeColor}
            backFallbackHref={`/${activePortalSlug}`}
            categoryIcon={getFilmTypeIcon()}
            badge={
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded text-xs font-mono uppercase tracking-wider bg-accent-20 text-accent border border-accent-40">
                Now Showing
              </span>
            }
          >
            {/* Film metadata in hero */}
            <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--muted)] mt-3">
              {series.director && (
                <span>
                  Directed by{" "}
                  <span className="text-[var(--soft)]">{series.director}</span>
                </span>
              )}
              {series.runtime_minutes && (
                <span>{formatRuntime(series.runtime_minutes)}</span>
              )}
            </div>
            {buildFilmCapsule(series) && (
              <p className="text-xs italic text-[var(--muted)] mt-2">
                {buildFilmCapsule(series)}
              </p>
            )}
          </LegacyDetailHero>

          {/* Festival context — a film can be part of a festival program */}
          {series.festival && (
            <Link
              href={`/${activePortalSlug}/festivals/${series.festival.slug}`}
              className="flex items-center justify-between gap-4 p-4 rounded-xl border border-[var(--twilight)] bg-[var(--card-bg)] hover:bg-[var(--card-bg-hover)] transition-all group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg border border-[var(--twilight)] bg-accent-20 flex items-center justify-center flex-shrink-0">
                  <svg
                    className="w-5 h-5 text-[var(--accent-color)]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M5 4v16m0-12h9l-1.5 3L14 14H5"
                    />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-mono uppercase tracking-wider text-[var(--muted)]">
                    Festival
                  </div>
                  <div className="text-sm text-[var(--soft)] group-hover:text-[var(--accent-color)] transition-colors">
                    Part of{" "}
                    <span className="text-[var(--cream)] font-medium">
                      {series.festival.name}
                    </span>
                  </div>
                  {(series.festival.location || series.festival.neighborhood) && (
                    <div className="text-xs text-[var(--muted)] truncate">
                      {series.festival.location || series.festival.neighborhood}
                    </div>
                  )}
                </div>
              </div>
              <svg
                className="w-5 h-5 text-[var(--muted)] group-hover:text-[var(--accent-color)] transition-colors flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Link>
          )}

          {/* Main Content Card */}
          <InfoCard
            accentColor={typeColor}
            className="!bg-[var(--night)] !border-[var(--twilight)]/90"
          >
            <SectionHeader title="At a Glance" className="border-t-0 pt-0 pb-2" />
            <MetadataGrid
              items={[
                { label: "Year", value: series.year?.toString() || "Unknown" },
                { label: "Runtime", value: formatRuntime(series.runtime_minutes) },
                { label: "Rating", value: series.rating || "NR" },
                { label: "Showtimes", value: `${events.length}` },
                { label: "Venues", value: `${venueShowtimes.length}` },
              ]}
              className="mb-6"
            />

            {/* Description */}
            {series.description && (
              <>
                <SectionHeader title="About" />
                <p className="text-[var(--soft)] whitespace-pre-wrap leading-relaxed mb-6">
                  {series.description}
                </p>
              </>
            )}

            {/* Genres */}
            {series.genres && series.genres.length > 0 && (
              <>
                <SectionHeader title="Genres" count={series.genres.length} />
                <div className="flex flex-wrap gap-2 mb-6">
                  {series.genres.map((genre) => (
                    <span
                      key={genre}
                      className="px-2.5 py-1 rounded-full text-xs font-medium border border-[var(--twilight)] bg-[var(--void)]"
                    >
                      {formatGenre(genre)}
                    </span>
                  ))}
                </div>
              </>
            )}

            {/* Trailer button */}
            {series.trailer_url && (
              <>
                <SectionHeader title="Watch" />
                <a
                  href={series.trailer_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--twilight)] text-[var(--cream)] hover:bg-[var(--twilight)]/80 transition-colors mb-6"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Watch Trailer
                </a>
              </>
            )}
          </InfoCard>

          {/* Next Up — upcoming showtimes preview */}
          {events.length > 0 && (
            <section
              id="showtimes"
              className="rounded-xl border border-[var(--twilight)]/85 bg-[var(--night)] px-4 py-4 sm:px-5 sm:py-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.13em] text-[var(--muted)] mb-1">
                    Next Up
                  </p>
                  <h2 className="text-lg font-semibold text-[var(--cream)]">
                    {previewEvents.length} upcoming showtime
                    {previewEvents.length !== 1 ? "s" : ""}
                  </h2>
                  <p className="text-sm text-[var(--muted)] mt-1">
                    Across {venueShowtimes.length} venue
                    {venueShowtimes.length !== 1 ? "s" : ""}.
                  </p>
                </div>
                <a
                  href="#showtimes-full"
                  className="inline-flex items-center gap-1 text-sm text-accent hover:text-[var(--cream)] transition-colors"
                >
                  Open Detailed Schedule
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
                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                    />
                  </svg>
                </a>
              </div>

              <div className="rounded-lg border border-[var(--twilight)]/80 bg-[var(--night)]/95">
                <div className="divide-y divide-[var(--twilight)]/35">
                  {previewEvents.map((event) => (
                    <div
                      key={event.id}
                      className="grid grid-cols-[6.5rem_1fr_auto] items-start gap-3 px-3.5 py-3.5 sm:px-4 sm:py-4"
                    >
                      <div className="pt-0.5">
                        <span className="block font-mono text-[11px] sm:text-xs text-[var(--soft)]">
                          {formatDate(event.start_date)}
                        </span>
                        <span className="inline-flex rounded px-1.5 py-0.5 mt-1 font-mono text-[11px] sm:text-xs text-[var(--soft)] bg-[var(--night)]/95 border border-[var(--twilight)]/40">
                          {formatTime(event.start_time) || "TBA"}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={`/${activePortalSlug}/events/${event.id}`}
                          className="font-medium text-sm sm:text-[15px] text-[var(--cream)] hover:text-accent transition-colors line-clamp-2"
                        >
                          {event.title}
                        </Link>
                        {event.venue && (
                          <Link
                            href={`/${activePortalSlug}/spots/${event.venue.slug}`}
                            className="text-xs text-[var(--soft)] hover:text-[var(--coral)] transition-colors mt-1 inline-block"
                          >
                            {event.venue.name}
                          </Link>
                        )}
                      </div>
                      <Link
                        href={`/${activePortalSlug}/events/${event.id}`}
                        aria-label={`Open ${event.title}`}
                        className="text-[var(--muted)] hover:text-[var(--soft)] transition-colors pt-1"
                      >
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
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </Link>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                <span>
                  Showing {previewEvents.length} of {events.length} upcoming
                  showtime{events.length !== 1 ? "s" : ""}.
                </span>
                {remainingPreviewCount > 0 && (
                  <span>+{remainingPreviewCount} more in detailed schedule.</span>
                )}
              </div>
            </section>
          )}

          {/* Detailed Venue Breakdown */}
          <section
            id="showtimes-full"
            className="rounded-xl border border-[var(--twilight)]/85 bg-[var(--night)] px-4 py-4 sm:px-5 sm:py-5"
          >
            <details className="group" open={events.length <= 12}>
              <summary className="list-none cursor-pointer">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.13em] text-[var(--muted)] mb-1">
                      Detailed View
                    </p>
                    <h2 className="text-lg font-semibold text-[var(--cream)]">
                      Venue-by-venue schedule
                    </h2>
                  </div>
                  <svg
                    className="w-4 h-4 text-[var(--muted)] transition-transform group-open:rotate-180"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </summary>

              <div className="mt-4">
                {venueShowtimes.length > 0 ? (
                  <div className="space-y-6">
                    {venueShowtimes.map((vs) => {
                      const eventsByDate = groupEventsByDate(vs.events);
                      return (
                        <div
                          key={vs.venue.id}
                          className="rounded-lg border border-[var(--twilight)] overflow-hidden bg-[var(--card-bg)]"
                        >
                          <div className="p-4 border-b border-[var(--twilight)]/50">
                            <Link
                              href={`/${activePortalSlug}/spots/${vs.venue.slug}`}
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

                          <div className="divide-y divide-[var(--twilight)]/30">
                            {Array.from(eventsByDate.entries()).map(
                              ([date, dateEvents]) => (
                                <div key={date} className="px-4 py-3">
                                  <div className="flex items-center gap-3">
                                    <div className="flex-shrink-0 w-28">
                                      <span className="text-sm font-medium text-[var(--soft)]">
                                        {formatDate(date)}
                                      </span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      {dateEvents.map((event) => (
                                        <div
                                          key={event.id}
                                          className="flex items-center gap-1"
                                        >
                                          <Link
                                            href={`/${activePortalSlug}/events/${event.id}`}
                                            className="font-mono text-sm px-2 py-1 rounded bg-[var(--twilight)]/50 text-[var(--cream)] hover:bg-[var(--coral)] hover:text-[var(--void)] transition-colors"
                                          >
                                            {formatTime(event.time)}
                                          </Link>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              )
                            )}
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
                          d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
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
              </div>
            </details>
          </section>

          {/* Similar Films */}
          {relatedSeries.length > 0 && (
            <RelatedSection
              title="Similar Films"
              count={relatedSeries.length}
              emptyMessage="No similar films found"
            >
              {relatedSeries.map((related) => (
                <RelatedCard
                  key={related.id}
                  variant="image"
                  href={buildSeriesUrl(related.slug, activePortalSlug, related.series_type)}
                  title={related.title}
                  subtitle={related.year?.toString() || "Film"}
                  imageUrl={related.image_url || undefined}
                  icon={getFilmTypeIcon()}
                  accentColor={getSeriesTypeColor(related.series_type)}
                />
              ))}
            </RelatedSection>
          )}
        </main>
      </div>

      {/* Sticky bar */}
      <DetailStickyBar
        shareLabel="Share"
        className="md:hidden"
        containerClassName="max-w-5xl"
        secondaryActions={
          series.trailer_url ? (
            <a
              href={series.trailer_url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-lg border border-[var(--twilight)] hover:bg-[var(--twilight)] text-[var(--soft)] text-sm font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              Trailer
            </a>
          ) : null
        }
        primaryAction={
          events.length > 0
            ? {
                label: "See Showtimes",
                href: "#showtimes",
              }
            : undefined
        }
      />
    </>
  );
}
