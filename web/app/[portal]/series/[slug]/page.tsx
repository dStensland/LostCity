import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";
import ScrollToTop from "@/components/ScrollToTop";
import {
  getSeriesBySlug,
  getSeriesEvents,
  getSeriesTypeLabel,
  getSeriesTypeColor,
  formatGenre,
  groupSeriesEventsByVenue,
} from "@/lib/series";
import { safeJsonLd } from "@/lib/formats";
import { buildBreadcrumbSchema } from "@/lib/breadcrumb-schema";
import type { Metadata } from "next";
import ScopedStylesServer from "@/components/ScopedStylesServer";
import { createCssVarClass } from "@/lib/css-utils";
import { buildExploreUrl } from "@/lib/find-url";
import { resolveDetailPageRequest } from "../../_surfaces/detail/resolve-detail-page-request";
import SeriesDetailView from "@/components/views/SeriesDetailView";
import type { SeriesApiResponse } from "@/lib/detail/types";

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
    pathname: `/${portalSlug}/series/${slug}`,
  });

  if (!series) {
    return {
      title: "Series Not Found",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const activePortalSlug = request?.portal.slug || portalSlug;
  const portalName = request?.portal.name || "Lost City";
  const contextLabel = series.festival
    ? series.series_type === "festival_program"
      ? `Program in ${series.festival.name}`
      : `Part of ${series.festival.name}`
    : null;
  const fallbackDescription = contextLabel
    ? `${contextLabel}. See all sessions and venues for ${series.title}.`
    : `See all showtimes and venues for ${series.title}`;
  const description = series.description || fallbackDescription;

  return {
    title: `${series.title} | ${portalName}`,
    description,
    alternates: {
      canonical: `/${activePortalSlug}/series/${slug}`,
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

// Generate Schema.org structured data for series
function generateSeriesSchema(
  series: NonNullable<Awaited<ReturnType<typeof getSeriesBySlug>>>,
  events: Awaited<ReturnType<typeof getSeriesEvents>>
) {
  if (series.series_type === "film") {
    // Movie schema for films
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

    return schema;
  } else {
    // Event series schema for recurring shows and festivals
    const schema: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "EventSeries",
      name: series.title,
    };

    if (series.description) {
      schema.description = series.description;
    }

    if (series.image_url) {
      schema.image = [series.image_url];
    }

    // Add sub-events if available
    if (events.length > 0) {
      schema.subEvents = events.slice(0, 10).map((event) => ({
        "@type": "Event",
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
}

// Format recurrence for display (used in schema only now)
function formatRecurrence(series: NonNullable<Awaited<ReturnType<typeof getSeriesBySlug>>>): string {
  if (series.frequency) {
    const parts = [series.frequency.charAt(0).toUpperCase() + series.frequency.slice(1)];
    if (series.day_of_week) {
      parts.push(`on ${series.day_of_week}s`);
    }
    return parts.join(" ");
  }
  return getSeriesTypeLabel(series.series_type);
}

export default async function PortalSeriesPage({ params }: Props) {
  const { slug, portal: portalSlug } = await params;
  const series = await getCachedSeriesBySlug(slug);
  const request = await resolveDetailPageRequest({
    portalSlug,
    pathname: `/${portalSlug}/series/${slug}`,
  });

  if (!series) {
    notFound();
  }

  // Use the URL portal or fall back to default
  const activePortalSlug = request?.portal.slug || portalSlug;
  const activePortalName = request?.portal.name || portalSlug.charAt(0).toUpperCase() + portalSlug.slice(1);

  // Films have a dedicated route at /showtimes/[slug]
  if (series.series_type === "film") {
    permanentRedirect(`/${activePortalSlug}/showtimes/${series.slug}`);
  }

  const events = await getSeriesEvents(series.id);
  const venueShowtimes = groupSeriesEventsByVenue(events);
  const typeColor = getSeriesTypeColor(series.series_type);
  const festivalAccentColor = series.festival ? getSeriesTypeColor("festival_program") : null;
  const seriesAccentClass = createCssVarClass("--accent-color", typeColor, "accent");
  const festivalAccentClass = festivalAccentColor
    ? createCssVarClass("--accent-color", festivalAccentColor, "festival-accent")
    : null;
  const seriesSchema = generateSeriesSchema(series, events);

  const initialData: SeriesApiResponse = {
    series: series as unknown as SeriesApiResponse["series"],
    events: events,
    venueShowtimes: venueShowtimes.map((vs) => ({
      venue: vs.venue,
      events: vs.events,
    })),
  };

  return (
    <>
      <ScrollToTop />
      {/* Schema.org JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(seriesSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLd(
            buildBreadcrumbSchema([
              { name: activePortalName, href: `/${activePortalSlug}` },
              {
                name: getSeriesTypeLabel(series.series_type),
                href: buildExploreUrl({ portalSlug: activePortalSlug, lane: "events" }),
              },
              { name: series.title },
            ])
          ),
        }}
      />

      <ScopedStylesServer css={[seriesAccentClass?.css, festivalAccentClass?.css].filter(Boolean).join("\n")} />

      <SeriesDetailView
        slug={slug}
        portalSlug={activePortalSlug}
        initialData={initialData}
      />
    </>
  );
}
