import ScrollToTop from "@/components/ScrollToTop";
import { getSpotBySlug } from "@/lib/spots";
import { getCachedPortalBySlug } from "@/lib/portal";
import { getSpotDetail } from "@/lib/spot-detail";
import { notFound } from "next/navigation";

import type { Metadata } from "next";
import { cache } from "react";
import { safeJsonLd } from "@/lib/formats";
import { buildBreadcrumbSchema } from "@/lib/breadcrumb-schema";
import { mapSpotDetailToViewData } from "@/lib/mappers/spot-detail-mapper";
import VenueDetailWrapper from "./VenueDetailWrapper";

export const revalidate = 60;

type Props = {
  params: Promise<{ portal: string; slug: string }>;
};

// Deduplicate spot fetches across generateMetadata and page
const getCachedSpotBySlug = cache(getSpotBySlug);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, portal: portalSlug } = await params;
  const spot = await getCachedSpotBySlug(slug);
  const portal = await getCachedPortalBySlug(portalSlug);

  if (!spot) {
    return {
      title: "Spot Not Found | Lost City",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const description = spot.description
    ? spot.description.slice(0, 160)
    : `${spot.name} in ${spot.neighborhood || spot.city}. Discover more spots with Lost City.`;

  return {
    title: `${spot.name} | Lost City`,
    description,
    alternates: {
      canonical: `/${portal?.slug || portalSlug}/spots/${slug}`,
    },
    openGraph: {
      title: spot.name,
      description,
      type: "website",
      images: [
        {
          url: `/${portal?.slug || portalSlug}/spots/${slug}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: spot.name,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: spot.name,
      description,
      images: [
        {
          url: `/${portal?.slug || portalSlug}/spots/${slug}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: spot.name,
        },
      ],
    },
  };
}

// ─── JSON-LD helpers ─────────────────────────────────────────────────────

function mapVenueTypeToSchemaType(
  type: string | null | undefined
): string | undefined {
  if (!type) return undefined;
  const map: Record<string, string> = {
    bar: "BarOrPub",
    sports_bar: "BarOrPub",
    brewery: "Brewery",
    restaurant: "Restaurant",
    food_hall: "Restaurant",
    nightclub: "NightClub",
    club: "NightClub",
    museum: "Museum",
    gallery: "ArtGallery",
    library: "Library",
    cinema: "MovieTheater",
    theater: "PerformingArtsTheater",
    stadium: "StadiumOrArena",
    arena: "StadiumOrArena",
    amphitheater: "StadiumOrArena",
    music_venue: "MusicVenue",
    coffee_shop: "CafeOrCoffeeShop",
    winery: "Winery",
    church: "Church",
    convention_center: "ConventionCenter",
  };
  return map[type] || undefined;
}

const DAY_MAP: Record<string, string> = {
  sun: "Sunday",
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
};

function buildOpeningHours(
  hours:
    | Record<string, { open: string; close: string } | null>
    | null
    | undefined
): object[] | undefined {
  if (!hours || typeof hours !== "object") return undefined;
  const specs: object[] = [];
  for (const [day, slot] of Object.entries(hours)) {
    if (!slot) continue;
    const dayOfWeek = DAY_MAP[day];
    if (!dayOfWeek) continue;
    specs.push({
      "@type": "OpeningHoursSpecification",
      dayOfWeek,
      opens: slot.open,
      closes: slot.close,
    });
  }
  return specs.length > 0 ? specs : undefined;
}

// ─── Page component ──────────────────────────────────────────────────────

export default async function PortalSpotPage({ params }: Props) {
  const { portal: portalSlug, slug } = await params;

  // getSpotDetail already fetches the venue — no need for a separate getCachedSpotBySlug here
  const [portal, detail] = await Promise.all([
    getCachedPortalBySlug(portalSlug),
    getSpotDetail(slug),
  ]);

  if (!detail) {
    notFound();
  }

  const activePortalSlug = portal?.slug || portalSlug;
  const activePortalName =
    portal?.name ||
    portalSlug.charAt(0).toUpperCase() + portalSlug.slice(1);

  // Map server data to client view shape
  const initialData = mapSpotDetailToViewData(detail);

  // Schema.org JSON-LD — detail.spot is Record<string, unknown> from select("*")
  const spotData = detail.spot;
  const spotName = spotData.name as string;
  const schemaType =
    mapVenueTypeToSchemaType(spotData.venue_type as string | null) ||
    "LocalBusiness";
  const spotHours = spotData.hours as
    | Record<string, { open: string; close: string } | null>
    | null
    | undefined;
  const spotLat = spotData.lat as number | null | undefined;
  const spotLng = spotData.lng as number | null | undefined;

  const schema = {
    "@context": "https://schema.org",
    "@type": schemaType,
    name: spotName,
    address: spotData.address
      ? {
          "@type": "PostalAddress",
          streetAddress: spotData.address as string,
          addressLocality: spotData.city as string,
          addressRegion: spotData.state as string,
          addressCountry: "US",
        }
      : undefined,
    geo:
      spotLat && spotLng
        ? {
            "@type": "GeoCoordinates",
            latitude: spotLat,
            longitude: spotLng,
          }
        : undefined,
    url: (spotData.website as string | null) || undefined,
    image: (spotData.image_url as string | null) || undefined,
    description: (spotData.description as string | null) || (spotData.short_description as string | null) || undefined,
    priceRange: spotData.price_level ? "$".repeat(spotData.price_level as number) : undefined,
    openingHoursSpecification: buildOpeningHours(spotHours),
  };

  return (
    <>
      <ScrollToTop />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(schema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLd(
            buildBreadcrumbSchema([
              { name: activePortalName, href: `/${activePortalSlug}` },
              {
                name: "Spots",
                href: `/${activePortalSlug}?view=places`,
              },
              { name: spotName },
            ])
          ),
        }}
      />
      <VenueDetailWrapper
        slug={slug}
        portalSlug={activePortalSlug}
        initialData={initialData}
      />
    </>
  );
}
