import { getSpotBySlug, getUpcomingEventsForSpot, getNearbySpots, formatPriceLevel, getSpotTypeLabel, getSpotTypeLabels, SPOT_TYPES, type SpotType } from "@/lib/spots";
import { getPortalBySlug } from "@/lib/portal";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { format, parseISO } from "date-fns";
import { formatTimeSplit } from "@/lib/formats";
import UnifiedHeader from "@/components/UnifiedHeader";
import PageFooter from "@/components/PageFooter";
import { PortalTheme } from "@/components/PortalTheme";
import VenueTagList from "@/components/VenueTagList";
import FlagButton from "@/components/FlagButton";
import FollowButton from "@/components/FollowButton";
import RecommendButton from "@/components/RecommendButton";
import CategoryIcon, { getCategoryColor } from "@/components/CategoryIcon";
import {
  DetailHero,
  InfoCard,
  MetadataGrid,
  SectionHeader,
  RelatedSection,
  RelatedCard,
  DetailStickyBar,
} from "@/components/detail";

export const revalidate = 60;

type Props = {
  params: Promise<{ portal: string; slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const spot = await getSpotBySlug(slug);

  if (!spot) {
    return {
      title: "Spot Not Found | Lost City",
    };
  }

  const description = spot.description
    ? spot.description.slice(0, 160)
    : `${spot.name} in ${spot.neighborhood || spot.city}. Discover more spots with Lost City.`;

  return {
    title: `${spot.name} | Lost City`,
    description,
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
  const spot = await getSpotBySlug(slug);
  const portal = await getPortalBySlug(portalSlug);

  if (!spot) {
    notFound();
  }

  // Use the URL portal or fall back to spot's city
  const activePortalSlug = portal?.slug || portalSlug;
  const activePortalName = portal?.name || portalSlug.charAt(0).toUpperCase() + portalSlug.slice(1);

  const upcomingEvents = await getUpcomingEventsForSpot(spot.id, 20);
  const nearbySpots = spot.id ? await getNearbySpots(spot.id) : [];
  const primaryType = spot.spot_type as SpotType | null;
  const typeInfo = primaryType ? SPOT_TYPES[primaryType] : null;
  const spotTypeColor = getSpotTypeColor(spot.spot_type);
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
      {/* Schema.org JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />

      {/* Portal-specific theming */}
      {portal && <PortalTheme portal={portal} />}

      <div className="min-h-screen">
        <UnifiedHeader
          portalSlug={activePortalSlug}
          portalName={activePortalName}
          backLink={{ href: `/${activePortalSlug}?view=find&type=destinations`, label: "Destinations" }}
        />

        <main className="max-w-3xl mx-auto px-4 py-6 pb-28 space-y-8">
          {/* Hero Section */}
          <DetailHero
            mode={spot.image_url ? "image" : "fallback"}
            imageUrl={spot.image_url}
            title={spot.name}
            subtitle={spot.neighborhood || spot.city}
            categoryColor={spotTypeColor}
            categoryIcon={
              <div className="text-6xl" role="img" aria-label={formatSpotType(spot.spot_type)}>
                {getSpotTypeIcon(spot.spot_type)}
              </div>
            }
            badge={
              typeInfo && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono uppercase tracking-wider"
                  style={{
                    backgroundColor: `${spotTypeColor}20`,
                    color: spotTypeColor,
                    border: `1px solid ${spotTypeColor}40`,
                  }}
                >
                  <span>{typeInfo.icon}</span>
                  {spot.spot_types && spot.spot_types.length > 1
                    ? getSpotTypeLabels(spot.spot_types)
                    : typeInfo.label}
                </span>
              )
            }
          >
            {/* Follow/Recommend actions in hero */}
            <div className="flex items-center gap-2 mt-3">
              <FollowButton targetVenueId={spot.id} size="sm" />
              <RecommendButton venueId={spot.id} size="sm" />
            </div>
          </DetailHero>

          {/* Main Content Card */}
          <InfoCard accentColor={spotTypeColor}>
            {/* Metadata Grid */}
            <MetadataGrid
              items={[
                {
                  label: "Hours",
                  value: formatHours(spot.hours_display) || "Unknown"
                },
                {
                  label: "Price",
                  value: priceDisplay || "N/A",
                  color: priceDisplay ? "var(--gold)" : "var(--muted)"
                },
                {
                  label: "Type",
                  value: spot.spot_types && spot.spot_types.length > 1
                    ? getSpotTypeLabels(spot.spot_types)
                    : formatSpotType(spot.spot_type)
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

          {/* Upcoming Events */}
          {upcomingEvents.length > 0 && (
            <RelatedSection
              title="Upcoming Events"
              count={upcomingEvents.length}
              emptyMessage="No upcoming events at this venue"
            >
              {upcomingEvents.map((event) => {
                const dateObj = parseISO(event.start_date);
                const eventColor = event.category ? getCategoryColor(event.category) : "var(--coral)";

                let subtitle = format(dateObj, "EEE, MMM d");
                if (event.start_time) {
                  const { time, period } = formatTimeSplit(event.start_time);
                  subtitle += ` · ${time} ${period}`;
                }

                return (
                  <RelatedCard
                    key={event.id}
                    variant="compact"
                    href={`/${activePortalSlug}/events/${event.id}`}
                    title={event.title}
                    subtitle={subtitle}
                    icon={<CategoryIcon type={event.category || "other"} size={20} />}
                    accentColor={eventColor}
                  />
                );
              })}
            </RelatedSection>
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
                  subtitle={getSpotTypeLabel(nearby.spot_type)}
                  imageUrl={nearby.image_url || undefined}
                  icon={
                    <div className="text-2xl" role="img">
                      {getSpotTypeIcon(nearby.spot_type)}
                    </div>
                  }
                />
              ))}
            </RelatedSection>
          )}
        </main>

        <PageFooter />
      </div>

      {/* Sticky bottom bar with CTAs */}
      <DetailStickyBar
        shareLabel="Share Spot"
        secondaryActions={
          <>
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
