import ScrollToTop from "@/components/ScrollToTop";
import {
  getSpotBySlug,
  formatPriceLevel,
  getSpotTypeLabel,
  getSpotTypeLabels,
  SPOT_TYPES,
  type SpotType,
} from "@/lib/spots";
import { getCachedPortalBySlug } from "@/lib/portal";
import { getSpotDetail } from "@/lib/spot-detail";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { cache } from "react";
import { safeJsonLd } from "@/lib/formats";
import { PortalHeader } from "@/components/headers";
import ScopedStylesServer from "@/components/ScopedStylesServer";
import { createCssVarClass } from "@/lib/css-utils";
import VenueTagList from "@/components/VenueTagList";
import { NeedsTagList } from "@/components/NeedsTagList";
import FlagButton from "@/components/FlagButton";
import FollowButton from "@/components/FollowButton";
import RecommendButton from "@/components/RecommendButton";
import { SaveToListButton } from "@/components/SaveToListButton";
import {
  DetailHero,
  InfoCard,
  MetadataGrid,
  SectionHeader,
  RelatedSection,
  RelatedCard,
  DetailStickyBar,
} from "@/components/detail";
import VenueShowtimes from "@/components/VenueShowtimes";
import GettingThereSection from "@/components/GettingThereSection";
import { buildBreadcrumbSchema } from "@/lib/breadcrumb-schema";

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
      images: spot.image_url ? [{ url: spot.image_url }] : [],
    },
  };
}

// Helper function to get spot type icon
function getSpotTypeIcon(type: string | null): string {
  if (!type) return "📍";
  const typeInfo = SPOT_TYPES[type as SpotType];
  return typeInfo?.icon || "📍";
}

// Helper function to format spot type for display
function formatSpotType(type: string | null): string {
  if (!type) return "Spot";
  return getSpotTypeLabel(type);
}

// Helper function to get spot type color
function getSpotTypeColor(type: string | null): string {
  const colorMap: Record<string, string> = {
    music_venue: "var(--neon-magenta)",
    theater: "var(--neon-purple)",
    nightclub: "var(--neon-cyan)",
    club: "var(--neon-cyan)",
    bar: "var(--coral)",
    restaurant: "var(--gold)",
    brewery: "var(--neon-amber)",
    cocktail_bar: "var(--neon-magenta)",
    gallery: "var(--neon-purple)",
    museum: "var(--neon-purple)",
    arts_center: "var(--neon-purple)",
    coffee_shop: "var(--neon-amber)",
    comedy_club: "var(--neon-amber)",
  };
  return type ? colorMap[type] || "var(--coral)" : "var(--coral)";
}

// Format hours for display
function formatHours(hours: string | null): string | null {
  if (!hours) return null;
  return hours;
}

// Map venue_type to schema.org type
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

// Convert hours JSONB to OpeningHoursSpecification[]
function buildOpeningHours(
  hours: Record<string, { open: string; close: string } | null> | null | undefined
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

// Inline type for the spot record coming out of SpotDetailPayload
type SpotFromDetail = {
  id: number;
  name: string;
  slug: string;
  venue_type?: string | null;
  venue_types?: string[] | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  address?: string | null;
  description?: string | null;
  short_description?: string | null;
  image_url?: string | null;
  website?: string | null;
  hours_display?: string | null;
  price_level?: number | null;
  vibes?: string[] | null;
  claimed_by?: string | null;
  is_verified?: boolean | null;
  [key: string]: unknown;
};

export default async function PortalSpotPage({ params }: Props) {
  const { portal: portalSlug, slug } = await params;

  // Fetch portal and rich spot detail in parallel.
  // getSpotDetail provides slot-deduped events with artists, highlights,
  // artifacts, and 5-category nearby — the same data path as the drawer.
  const [portal, detail] = await Promise.all([
    getCachedPortalBySlug(portalSlug),
    getSpotDetail(slug),
  ]);

  if (!detail) {
    notFound();
  }

  const spot = detail.spot as SpotFromDetail;
  const { upcomingEvents, nearbyDestinations, highlights, artifacts } = detail;

  // Use the URL portal or fall back to spot's city
  const activePortalSlug = portal?.slug || portalSlug;
  const activePortalName =
    portal?.name ||
    portalSlug.charAt(0).toUpperCase() + portalSlug.slice(1);

  const primaryType = spot.venue_type as SpotType | null;
  const typeInfo = primaryType ? SPOT_TYPES[primaryType] : null;
  const spotTypeColor = getSpotTypeColor(spot.venue_type ?? null);
  const spotTypeAccentClass = createCssVarClass(
    "--accent-color",
    spotTypeColor,
    "spot-type"
  );
  const priceDisplay = formatPriceLevel(spot.price_level ?? null);

  // Flatten nearby destinations into a single list preserving category order.
  const categoryOrder = ["food", "drinks", "nightlife", "caffeine", "fun"];
  const nearbyFlat = categoryOrder.flatMap(
    (cat) => nearbyDestinations[cat] || []
  );

  // Generate Schema.org LocalBusiness JSON-LD
  const schemaType = mapVenueTypeToSchemaType(spot.venue_type) || "LocalBusiness";
  const spotHours = (spot as Record<string, unknown>).hours as
    | Record<string, { open: string; close: string } | null>
    | null
    | undefined;
  const spotLat = (spot as Record<string, unknown>).lat as number | null | undefined;
  const spotLng = (spot as Record<string, unknown>).lng as number | null | undefined;

  const schema = {
    "@context": "https://schema.org",
    "@type": schemaType,
    name: spot.name,
    address: spot.address
      ? {
          "@type": "PostalAddress",
          streetAddress: spot.address,
          addressLocality: spot.city,
          addressRegion: spot.state,
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
    url: spot.website || undefined,
    image: spot.image_url || undefined,
    description: spot.description || spot.short_description || undefined,
    priceRange: spot.price_level ? "$".repeat(spot.price_level) : undefined,
    openingHoursSpecification: buildOpeningHours(spotHours),
  };

  return (
    <>
      <ScrollToTop />
      {/* Schema.org JSON-LD */}
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
              { name: "Spots", href: `/${activePortalSlug}?view=find&type=destinations` },
              { name: spot.name },
            ])
          ),
        }}
      />

      <ScopedStylesServer css={spotTypeAccentClass?.css} />

      <div className="min-h-screen">
        <PortalHeader
          portalSlug={activePortalSlug}
          portalName={activePortalName}
          hideNav
        />

        <main className="max-w-3xl mx-auto px-4 py-4 sm:py-6 pb-28 space-y-5 sm:space-y-8">
          {/* Hero Section */}
          <DetailHero
            mode={spot.image_url ? "image" : "fallback"}
            imageUrl={spot.image_url ?? undefined}
            title={spot.name}
            subtitle={spot.neighborhood || spot.city || undefined}
            categoryColor={spotTypeColor}
            backFallbackHref={`/${activePortalSlug}`}
            categoryIcon={
              <div
                className="text-6xl"
                role="img"
                aria-label={formatSpotType(spot.venue_type ?? null)}
              >
                {getSpotTypeIcon(spot.venue_type ?? null)}
              </div>
            }
            badge={
              typeInfo && (
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono uppercase tracking-wider bg-accent-20 text-accent border border-accent-40 ${
                    spotTypeAccentClass?.className ?? ""
                  }`}
                >
                  <span>{typeInfo.icon}</span>
                  {spot.venue_types && spot.venue_types.length > 1
                    ? getSpotTypeLabels(spot.venue_types)
                    : typeInfo.label}
                </span>
              )
            }
          >
            {/* Follow/Recommend actions in hero */}
            <div className="flex items-center gap-2 mt-3">
              <FollowButton targetVenueId={spot.id} size="sm" />
              <RecommendButton venueId={spot.id} size="sm" />
              {!spot.claimed_by && (
                <Link
                  href={`/venue/${spot.slug}/claim`}
                  className="text-[var(--muted)] hover:text-[var(--cream)] font-mono text-xs"
                >
                  Claim this spot
                </Link>
              )}
              {spot.claimed_by && spot.is_verified && (
                <span className="text-[var(--neon-green)] font-mono text-xs flex items-center gap-1">
                  <svg
                    className="w-3 h-3"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Verified
                </span>
              )}
            </div>
          </DetailHero>

          {/* Main Content Card */}
          <InfoCard accentColor={spotTypeColor}>
            {/* Metadata Grid */}
            <MetadataGrid
              items={[
                ...(spot.hours_display
                  ? [
                      {
                        label: "Hours",
                        value: formatHours(spot.hours_display)!,
                      },
                    ]
                  : []),
                {
                  label: "Price",
                  value: priceDisplay || "N/A",
                  color: priceDisplay ? "var(--gold)" : "var(--muted)",
                },
                {
                  label: "Type",
                  value:
                    spot.venue_types && spot.venue_types.length > 1
                      ? getSpotTypeLabels(spot.venue_types)
                      : formatSpotType(spot.venue_type ?? null),
                },
              ]}
              className="mb-8"
            />

            {/* Description */}
            {spot.description && (
              <>
                <SectionHeader title="About" />
                <p className="text-[var(--soft)] whitespace-pre-wrap leading-relaxed mb-6">
                  {spot.description}
                </p>
              </>
            )}

            {/* Highlights — editorial/curated info cards from venue_highlights */}
            {highlights.length > 0 && (
              <>
                <SectionHeader title="Highlights" count={highlights.length} />
                <div className="space-y-3 mb-6">
                  {highlights.map((h) => {
                    const hl = h as {
                      id: number;
                      highlight_type: string;
                      title: string;
                      description?: string | null;
                      image_url?: string | null;
                    };
                    return (
                      <div
                        key={hl.id}
                        className="rounded-lg border border-[var(--twilight)] bg-[var(--dusk)] p-3"
                      >
                        <p className="text-[var(--cream)] text-sm font-medium mb-1">
                          {hl.title}
                        </p>
                        {hl.description && (
                          <p className="text-[var(--soft)] text-sm leading-relaxed">
                            {hl.description}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Vibes */}
            {spot.vibes && spot.vibes.length > 0 && (
              <>
                <SectionHeader title="Vibes" count={spot.vibes.length} />
                <div className="flex flex-wrap gap-2 mb-6">
                  {spot.vibes.map((vibe) => (
                    <span
                      key={vibe}
                      className="px-3 py-1.5 bg-[var(--neon-cyan)]/10 text-[var(--neon-cyan)] rounded-full border border-[var(--neon-cyan)]/20 text-sm font-mono"
                    >
                      {vibe.replace(/-/g, " ")}
                    </span>
                  ))}
                </div>
              </>
            )}

            {/* Community Verified Needs */}
            <SectionHeader title="Community Verified" />
            <div className="mb-6">
              <NeedsTagList entityType="venue" entityId={spot.id} title="" />
            </div>

            {/* Community Tags */}
            <SectionHeader title="Community Tags" />
            <div className="mb-6">
              <VenueTagList venueId={spot.id} />
            </div>

            {/* Location */}
            {spot.address && (
              <>
                <SectionHeader title="Location" />
                <p className="text-[var(--soft)] mb-6">
                  {spot.address}
                  <br />
                  {spot.city}, {spot.state}
                </p>
              </>
            )}

            {/* Getting There — transit, parking, walkability */}
            <div className="mb-6">
              <GettingThereSection transit={spot as import("@/components/GettingThereSection").TransitData} />
            </div>

            {/* Flag for QA */}
            <SectionHeader title="Report an Issue" />
            <FlagButton
              entityType="venue"
              entityId={spot.id}
              entityName={spot.name}
            />
          </InfoCard>

          {/* Sub-venues / artifacts (e.g. stages within a festival venue) */}
          {artifacts.length > 0 && (
            <RelatedSection title="Inside This Venue" count={artifacts.length}>
              {artifacts.map((a) => {
                const artifact = a as {
                  id: number;
                  name: string;
                  slug: string;
                  venue_type?: string | null;
                  image_url?: string | null;
                  short_description?: string | null;
                };
                return (
                  <RelatedCard
                    key={artifact.id}
                    variant="image"
                    href={`/${activePortalSlug}/spots/${artifact.slug}`}
                    title={artifact.name}
                    subtitle={getSpotTypeLabel(artifact.venue_type ?? null)}
                    imageUrl={artifact.image_url || undefined}
                    icon={
                      <div className="text-2xl" role="img">
                        {getSpotTypeIcon(artifact.venue_type ?? null)}
                      </div>
                    }
                  />
                );
              })}
            </RelatedSection>
          )}

          {/* Upcoming Events / Showtimes */}
          {upcomingEvents.length > 0 && (
            <VenueShowtimes
              events={
                upcomingEvents as Parameters<
                  typeof VenueShowtimes
                >[0]["events"]
              }
              portalSlug={activePortalSlug}
              venueType={spot.venue_type ?? null}
            />
          )}

          {/* Nearby Spots — 5-category nearby from rich data path */}
          {nearbyFlat.length > 0 && (
            <RelatedSection
              title={`Nearby in ${spot.neighborhood || spot.city}`}
              count={nearbyFlat.length}
            >
              {nearbyFlat.map((nearby) => (
                <RelatedCard
                  key={nearby.id}
                  variant="image"
                  href={`/${activePortalSlug}/spots/${nearby.slug}`}
                  title={nearby.name}
                  subtitle={getSpotTypeLabel(nearby.venue_type ?? null)}
                  imageUrl={nearby.image_url || undefined}
                  icon={
                    <div className="text-2xl" role="img">
                      {getSpotTypeIcon(nearby.venue_type ?? null)}
                    </div>
                  }
                />
              ))}
            </RelatedSection>
          )}
        </main>
      </div>

      {/* Sticky bottom bar with CTAs */}
      <DetailStickyBar
        shareLabel="Share Spot"
        secondaryActions={
          <>
            <SaveToListButton itemType="venue" itemId={spot.id} />
            <FollowButton targetVenueId={spot.id} size="sm" />
            <RecommendButton venueId={spot.id} size="sm" />
          </>
        }
        primaryAction={
          spot.website
            ? {
                label: "Website",
                href: spot.website,
                icon: (
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                ),
              }
            : spot.address
              ? {
                  label: "Directions",
                  href: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                    `${spot.address}, ${spot.city}, ${spot.state}`
                  )}`,
                  icon: (
                    <svg
                      className="w-5 h-5"
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
                  ),
                }
              : undefined
        }
      />
    </>
  );
}
