import ScrollToTop from "@/components/ScrollToTop";
import { getSpotBySlug, getUpcomingEventsForSpot, getNearbySpots, formatPriceLevel, getSpotTypeLabel, getSpotTypeLabels, SPOT_TYPES, type SpotType } from "@/lib/spots";
import { getCachedPortalBySlug } from "@/lib/portal";
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
  // Map spot types to accent colors - using existing color palette
  const colorMap: Record<string, string> = {
    music_venue: "var(--neon-magenta)",
    theater: "var(--neon-purple)",
    comedy_club: "var(--neon-amber)",
    club: "var(--neon-cyan)",
    bar: "var(--coral)",
    restaurant: "var(--gold)",
    coffee_shop: "var(--neon-amber)",
    brewery: "var(--neon-amber)",
    gallery: "var(--neon-purple)",
    museum: "var(--neon-purple)",
  };
  return type ? colorMap[type] || "var(--coral)" : "var(--coral)";
}

// Format hours for display
function formatHours(hours: string | null): string | null {
  if (!hours) return null;
  return hours;
}

export default async function PortalSpotPage({ params }: Props) {
  const { portal: portalSlug, slug } = await params;

  // Stage 1: Fetch spot and portal in parallel
  const [spot, portal] = await Promise.all([
    getCachedSpotBySlug(slug),
    getCachedPortalBySlug(portalSlug),
  ]);

  if (!spot) {
    notFound();
  }

  // Use the URL portal or fall back to spot's city
  const activePortalSlug = portal?.slug || portalSlug;
  const activePortalName = portal?.name || portalSlug.charAt(0).toUpperCase() + portalSlug.slice(1);

  // High-event venues (cinemas, theaters) need more events to show full schedule
  const HIGH_EVENT_TYPES = new Set(["cinema", "theater", "music_venue", "arena", "comedy_club"]);
  const eventLimit = HIGH_EVENT_TYPES.has(spot.venue_type ?? "") ? 100 : 30;

  // Stage 2: Fetch events and nearby spots in parallel (depends on spot.id)
  const [upcomingEvents, nearbySpots] = await Promise.all([
    getUpcomingEventsForSpot(spot.id, eventLimit),
    spot.id ? getNearbySpots(spot.id) : Promise.resolve([]),
  ]);
  const primaryType = spot.venue_type as SpotType | null;
  const typeInfo = primaryType ? SPOT_TYPES[primaryType] : null;
  const spotTypeColor = getSpotTypeColor(spot.venue_type);
  const spotTypeAccentClass = createCssVarClass("--accent-color", spotTypeColor, "spot-type");
  const priceDisplay = formatPriceLevel(spot.price_level);

  // Generate Schema.org LocalBusiness JSON-LD
  const schema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: spot.name,
    address: spot.address ? {
      "@type": "PostalAddress",
      streetAddress: spot.address,
      addressLocality: spot.city,
      addressRegion: spot.state,
      addressCountry: "US",
    } : undefined,
    url: spot.website || undefined,
    image: spot.image_url || undefined,
    description: spot.description || spot.short_description || undefined,
  };

  return (
    <>
      <ScrollToTop />
      {/* Schema.org JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(schema) }}
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
            imageUrl={spot.image_url}
            title={spot.name}
            subtitle={spot.neighborhood || spot.city}
            categoryColor={spotTypeColor}
            backFallbackHref={`/${activePortalSlug}`}
            categoryIcon={
              <div className="text-6xl" role="img" aria-label={formatSpotType(spot.venue_type)}>
                {getSpotTypeIcon(spot.venue_type)}
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
                  Claim this venue
                </Link>
              )}
              {spot.claimed_by && spot.is_verified && (
                <span className="text-[var(--neon-green)] font-mono text-xs flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
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
                ...(spot.hours_display ? [{
                  label: "Hours",
                  value: formatHours(spot.hours_display)!
                }] : []),
                {
                  label: "Price",
                  value: priceDisplay || "N/A",
                  color: priceDisplay ? "var(--gold)" : "var(--muted)"
                },
                {
                  label: "Type",
                  value: spot.venue_types && spot.venue_types.length > 1
                    ? getSpotTypeLabels(spot.venue_types)
                    : formatSpotType(spot.venue_type)
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

            {/* Flag for QA */}
            <SectionHeader title="Report an Issue" />
            <FlagButton
              entityType="venue"
              entityId={spot.id}
              entityName={spot.name}
            />
          </InfoCard>

          {/* Upcoming Events / Showtimes */}
          {upcomingEvents.length > 0 && (
            <VenueShowtimes
              events={upcomingEvents}
              portalSlug={activePortalSlug}
              venueType={spot.venue_type}
            />
          )}

          {/* Nearby Spots */}
          {nearbySpots.length > 0 && (
            <RelatedSection
              title={`Nearby in ${spot.neighborhood || spot.city}`}
              count={nearbySpots.length}
            >
              {nearbySpots.map((nearby) => (
                <RelatedCard
                  key={nearby.id}
                  variant="image"
                  href={`/${activePortalSlug}/spots/${nearby.slug}`}
                  title={nearby.name}
                  subtitle={getSpotTypeLabel(nearby.venue_type)}
                  imageUrl={nearby.image_url || undefined}
                  icon={
                    <div className="text-2xl" role="img">
                      {getSpotTypeIcon(nearby.venue_type)}
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
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
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
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                ),
              }
            : undefined
        }
      />
    </>
  );
}
