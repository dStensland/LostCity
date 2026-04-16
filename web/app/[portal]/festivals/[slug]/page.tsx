import { notFound } from "next/navigation";
import { cache } from "react";
import ScrollToTop from "@/components/ScrollToTop";
import {
  getFestivalBySlug,
  getFestivalPrograms,
  getFestivalEvents,
  getFestivalScreenings,
} from "@/lib/festivals";
import { safeJsonLd } from "@/lib/formats";
import type { Metadata } from "next";
import ScopedStylesServer from "@/components/ScopedStylesServer";
import { createCssVarClass } from "@/lib/css-utils";
import { getCategoryAccentColor } from "@/lib/moments-utils";
import { buildBreadcrumbSchema } from "@/lib/breadcrumb-schema";
import { buildExploreUrl } from "@/lib/find-url";
import { resolveDetailPageRequest } from "../../_surfaces/detail/resolve-detail-page-request";
import FestivalDetailWrapper from "./FestivalDetailWrapper";
import type { FestivalApiResponse } from "@/lib/detail/types";

export const revalidate = 120;

type Props = {
  params: Promise<{ portal: string; slug: string }>;
};

// Deduplicate festival fetches across generateMetadata and page
const getCachedFestivalBySlug = cache(getFestivalBySlug);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, portal: portalSlug } = await params;
  const festival = await getCachedFestivalBySlug(slug);
  const request = await resolveDetailPageRequest({
    portalSlug,
    pathname: `/${portalSlug}/festivals/${slug}`,
  });

  if (!festival) {
    return {
      title: "Festival Not Found",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const activePortalSlug = request?.portal.slug || portalSlug;
  const portalName = request?.portal.name || "Lost City";
  const description = festival.description || `${festival.name} festival schedule, programs, and tickets.`;

  return {
    title: `${festival.name} | ${portalName}`,
    description,
    alternates: {
      canonical: `/${activePortalSlug}/festivals/${slug}`,
    },
    openGraph: {
      title: festival.name,
      description,
      type: "website",
      images: [
        {
          url: `/${activePortalSlug}/festivals/${slug}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: festival.name,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: festival.name,
      description,
      images: [
        {
          url: `/${activePortalSlug}/festivals/${slug}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: festival.name,
        },
      ],
    },
  };
}

// Generate Schema.org structured data for festival
function generateFestivalSchema(
  festival: NonNullable<Awaited<ReturnType<typeof getFestivalBySlug>>>,
  sessions: Awaited<ReturnType<typeof getFestivalEvents>>
) {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Festival",
    name: festival.name,
  };

  if (festival.description) {
    schema.description = festival.description;
  }

  if (festival.image_url) {
    schema.image = [festival.image_url];
  }

  if (festival.location) {
    schema.location = {
      "@type": "Place",
      name: festival.location,
    };
  }

  if (festival.announced_start) {
    schema.startDate = festival.announced_start;
  }

  if (festival.announced_end) {
    schema.endDate = festival.announced_end;
  }

  if (sessions.length > 0) {
    schema.subEvents = sessions.slice(0, 20).map((session) => ({
      "@type": "Event",
      name: session.title,
      startDate: session.start_time
        ? `${session.start_date}T${session.start_time}:00`
        : session.start_date,
      location: session.venue
        ? {
            "@type": "Place",
            name: session.venue.name,
          }
        : undefined,
    }));
  }

  return schema;
}

export default async function PortalFestivalPage({ params }: Props) {
  const { slug, portal: portalSlug } = await params;
  const festival = await getCachedFestivalBySlug(slug);
  const request = await resolveDetailPageRequest({
    portalSlug,
    pathname: `/${portalSlug}/festivals/${slug}`,
  });

  if (!festival) {
    notFound();
  }

  const activePortalSlug = request?.portal.slug || portalSlug;
  const activePortalName = request?.portal.name || portalSlug.charAt(0).toUpperCase() + portalSlug.slice(1);

  const accentColor = getCategoryAccentColor(festival.categories?.[0]);
  const festivalAccentClass = createCssVarClass("--accent-color", accentColor, "festival");

  // Fetch all data server-side to populate initialData
  const [programs, sessions, screenings] = await Promise.all([
    getFestivalPrograms(festival.id),
    getFestivalEvents(festival.id),
    getFestivalScreenings(festival.id),
  ]);

  const festivalSchema = generateFestivalSchema(festival, sessions);

  // Group sessions by series_id for programs
  const sessionsByProgram = new Map<string, typeof sessions>();
  for (const session of sessions) {
    if (!session.series_id) continue;
    if (!sessionsByProgram.has(session.series_id)) {
      sessionsByProgram.set(session.series_id, []);
    }
    sessionsByProgram.get(session.series_id)!.push(session);
  }

  // Build programs with sessions for FestivalApiResponse
  const programsWithSessions = programs.map((program) => ({
    id: program.id,
    slug: program.slug,
    title: program.title,
    description: program.description,
    image_url: program.image_url,
    sessions: (sessionsByProgram.get(program.id) || []).map((s) => ({
      id: s.id,
      title: s.title,
      start_date: s.start_date,
      start_time: s.start_time,
      end_time: s.end_time,
      venue: s.venue
        ? {
            id: s.venue.id,
            name: s.venue.name,
            slug: s.venue.slug,
            neighborhood: s.venue.neighborhood,
            nearest_marta_station: s.venue.nearest_marta_station ?? null,
            marta_walk_minutes: s.venue.marta_walk_minutes ?? null,
            marta_lines: s.venue.marta_lines ?? null,
            beltline_adjacent: s.venue.beltline_adjacent ?? null,
            beltline_segment: s.venue.beltline_segment ?? null,
            parking_type: s.venue.parking_type ?? null,
            parking_free: s.venue.parking_free ?? null,
            transit_score: s.venue.transit_score ?? null,
          }
        : null,
    })),
  }));

  const initialData: FestivalApiResponse = {
    festival: festival as unknown as FestivalApiResponse["festival"],
    programs: programsWithSessions,
    screenings: screenings ?? undefined,
  };

  return (
    <>
      <ScrollToTop />
      {/* Schema.org JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(festivalSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLd(
            buildBreadcrumbSchema([
              { name: activePortalName, href: `/${activePortalSlug}` },
              {
                name: "Festivals",
                href: buildExploreUrl({
                  portalSlug: activePortalSlug,
                  lane: "events",
                  categories: "festivals",
                }),
              },
              { name: festival.name },
            ])
          ),
        }}
      />

      <ScopedStylesServer css={festivalAccentClass?.css || ""} />

      <FestivalDetailWrapper
        slug={slug}
        portalSlug={activePortalSlug}
        initialData={initialData}
      />
    </>
  );
}
