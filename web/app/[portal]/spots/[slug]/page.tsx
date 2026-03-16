import ScrollToTop from "@/components/ScrollToTop";
import {
  getSpotBySlug,
  getSpotTypeLabel,
  getSpotTypeLabels,
  SPOT_TYPES,
  type SpotType,
} from "@/lib/spots";
import { getCachedPortalBySlug } from "@/lib/portal";
import { getSpotDetail } from "@/lib/spot-detail";
import { ATTACHED_CHILD_DESTINATION_SECTION_TITLE } from "@/lib/destination-graph";
import { notFound } from "next/navigation";

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
import { HangButton } from "@/components/hangs/HangButton";
import { VenueHangStripLive } from "@/components/hangs/VenueHangStripLive";
import { ENABLE_HANGS_V1 } from "@/lib/launch-flags";
import { SaveToListButton } from "@/components/SaveToListButton";
import {
  DetailHero,
  SectionHeader,
  RelatedSection,
  RelatedCard,
  DetailStickyBar,
  DescriptionTeaser,
  MetadataGrid,
  type MetadataItem,
  QuickActionLink,
  CollapsibleSection,
  VenueFeaturesSection,
  YonderAdventureSnapshot,
  AccoladesSection,
} from "@/components/detail";
import Badge from "@/components/ui/Badge";
import HoursSection from "@/components/HoursSection";
import VenueShowtimes from "@/components/VenueShowtimes";
import GettingThereSection, {
  type TransitData,
} from "@/components/GettingThereSection";
import { buildBreadcrumbSchema } from "@/lib/breadcrumb-schema";
import { isOpenAt, formatCloseTime } from "@/lib/hours";
import {
  filterVenueFeaturesForPortal,
  type VenueFeature,
} from "@/lib/venue-features";

// Inline to avoid importing @phosphor-icons/react in server component
const EVENT_HEAVY_TYPES = new Set([
  "music_venue",
  "theater",
  "nightclub",
  "comedy_club",
  "cinema",
]);
function isEventHeavyType(venueType: string | null | undefined): boolean {
  return !!venueType && EVENT_HEAVY_TYPES.has(venueType);
}

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

// ─── Helper functions ────────────────────────────────────────────────────

function getSpotTypeIcon(type: string | null): string {
  if (!type) return "\u{1F4CD}";
  const typeInfo = SPOT_TYPES[type as SpotType];
  return typeInfo?.icon || "\u{1F4CD}";
}

function formatSpotType(type: string | null): string {
  if (!type) return "Spot";
  return getSpotTypeLabel(type);
}

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

// ─── Type-aware MetadataGrid builder ─────────────────────────────────────

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
  reservation_url?: string | null;
  accepts_reservations?: boolean | null;
  reservation_recommended?: boolean | null;
  phone?: string | null;
  instagram?: string | null;
  hours?: Record<string, { open: string; close: string } | null> | null;
  hours_display?: string | null;
  is_24_hours?: boolean | null;
  price_level?: number | null;
  vibes?: string[] | null;
  claimed_by?: string | null;
  is_verified?: boolean | null;
  [key: string]: unknown;
};

function buildVenueMetadata(
  spot: SpotFromDetail,
  openStatus: { isOpen: boolean; closesAt?: string },
  upcomingEventsCount: number,
  featuresCount: number
): MetadataItem[] {
  const type = spot.venue_type;
  const hasHoursData = !!(spot.hours || spot.is_24_hours);

  // Reusable items
  const statusItem: MetadataItem | null = hasHoursData
    ? spot.is_24_hours
      ? { label: "Status", value: "Open 24hrs", color: "var(--neon-green)" }
      : openStatus.isOpen
        ? {
            label: "Status",
            value: openStatus.closesAt
              ? `Open til ${formatCloseTime(openStatus.closesAt)}`
              : "Open Now",
            color: "var(--neon-green)",
          }
        : { label: "Status", value: "Closed", color: "var(--coral)" }
    : null;

  const neighborhoodItem: MetadataItem = {
    label: "Neighborhood",
    value: spot.neighborhood || spot.city || "\u2014",
  };

  const priceItem: MetadataItem | null = spot.price_level
    ? { label: "Price", value: "$".repeat(spot.price_level) }
    : null;

  const admissionItem: MetadataItem = spot.price_level
    ? { label: "Admission", value: "$".repeat(spot.price_level) }
    : { label: "Admission", value: "Free", color: "var(--neon-green)" };

  const typeItem: MetadataItem = {
    label: "Type",
    value: formatSpotType(spot.venue_type ?? null),
  };

  const showsItem: MetadataItem = {
    label: "Upcoming",
    value:
      upcomingEventsCount > 0
        ? `${upcomingEventsCount} show${upcomingEventsCount !== 1 ? "s" : ""}`
        : "None scheduled",
    color: upcomingEventsCount > 0 ? "var(--neon-magenta)" : "var(--muted)",
  };

  const items: MetadataItem[] = [];

  switch (type) {
    case "park":
    case "historic_site":
      if (statusItem) items.push(statusItem);
      items.push(admissionItem);
      if (featuresCount > 0) {
        items.push({
          label: "Things to Do",
          value: `${featuresCount}`,
          color: "var(--neon-green)",
        });
      } else {
        items.push(neighborhoodItem);
      }
      break;

    case "bar":
    case "restaurant":
    case "brewery":
    case "coffee_shop":
      if (statusItem) items.push(statusItem);
      if (priceItem) items.push(priceItem);
      items.push(neighborhoodItem);
      break;

    case "music_venue":
    case "theater":
    case "nightclub":
    case "comedy_club":
      items.push(showsItem);
      items.push(typeItem);
      items.push(neighborhoodItem);
      break;

    case "museum":
    case "gallery":
      if (statusItem) items.push(statusItem);
      items.push(admissionItem);
      items.push(typeItem);
      break;

    case "cinema":
      items.push(showsItem);
      items.push(typeItem);
      items.push(neighborhoodItem);
      break;

    default:
      if (statusItem) items.push(statusItem);
      items.push(neighborhoodItem);
      if (priceItem) items.push(priceItem);
      break;
  }

  // Ensure at least 2 items for visual balance
  if (items.length < 2) {
    if (!items.find((i) => i.label === "Neighborhood"))
      items.push(neighborhoodItem);
    if (items.length < 2) items.push(typeItem);
  }

  return items.slice(0, 3);
}

// ─── Page component ──────────────────────────────────────────────────────

export default async function PortalSpotPage({ params }: Props) {
  const { portal: portalSlug, slug } = await params;

  const [portal, detail] = await Promise.all([
    getCachedPortalBySlug(portalSlug),
    getSpotDetail(slug),
  ]);

  if (!detail) {
    notFound();
  }

  const spot = detail.spot as SpotFromDetail;
  const {
    upcomingEvents,
    nearbyDestinations,
    highlights,
    attachedChildDestinations,
    features,
    editorialMentions,
    yonderDestinationIntelligence,
    yonderAccommodationInventorySource,
    yonderRuntimeInventorySnapshot,
  } = detail;

  const activePortalSlug = portal?.slug || portalSlug;
  const activePortalName =
    portal?.name ||
    portalSlug.charAt(0).toUpperCase() + portalSlug.slice(1);
  const isYonderPortal = activePortalSlug === "yonder";
  const visibleFeatures = filterVenueFeaturesForPortal(
    features as VenueFeature[],
    {
      portalSlug: activePortalSlug,
      venueSlug: typeof spot.slug === "string" ? spot.slug : slug,
    }
  );

  const primaryType = spot.venue_type as SpotType | null;
  const typeInfo = primaryType ? SPOT_TYPES[primaryType] : null;
  const spotTypeColor = getSpotTypeColor(spot.venue_type ?? null);
  const spotTypeAccentClass = createCssVarClass(
    "--accent-color",
    spotTypeColor,
    "spot-type"
  );
  const hasHours = !!(spot.hours || spot.hours_display || spot.is_24_hours);
  const hasVibes = spot.vibes && spot.vibes.length > 0;
  const hasActions = !!(
    spot.website ||
    spot.instagram ||
    spot.phone ||
    spot.address
  );

  // Type-aware layout decisions
  const isEventHeavy = isEventHeavyType(spot.venue_type);

  // Open/close status for MetadataGrid (pure function, SSR-safe)
  const now = new Date();
  const openStatus = isOpenAt(spot.hours ?? null, now, spot.is_24_hours ?? false);
  const metadataItems = buildVenueMetadata(
    spot,
    openStatus,
    upcomingEvents.length,
    visibleFeatures.length
  );

  // Flatten nearby destinations
  const categoryOrder = ["food", "drinks", "nightlife", "caffeine", "fun"];
  const nearbyFlat = categoryOrder.flatMap(
    (cat) => nearbyDestinations[cat] || []
  );

  // Schema.org JSON-LD
  const schemaType =
    mapVenueTypeToSchemaType(spot.venue_type) || "LocalBusiness";
  const spotHours = (spot as Record<string, unknown>).hours as
    | Record<string, { open: string; close: string } | null>
    | null
    | undefined;
  const spotLat = (spot as Record<string, unknown>).lat as
    | number
    | null
    | undefined;
  const spotLng = (spot as Record<string, unknown>).lng as
    | number
    | null
    | undefined;

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
                href: `/${activePortalSlug}?view=find&type=destinations`,
              },
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
          {/* ── 1. HERO ────────────────────────────────────────────── */}
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
            <div className="flex items-center gap-2 mt-3">
              {ENABLE_HANGS_V1 && (
                <HangButton
                  venue={{
                    id: spot.id,
                    name: spot.name,
                    slug: spot.slug,
                    image_url: spot.image_url ?? null,
                    neighborhood: spot.neighborhood ?? null,
                  }}
                />
              )}
              <FollowButton targetVenueId={spot.id} size="sm" />
              <RecommendButton venueId={spot.id} size="sm" />
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

          {/* ── 2. EDITORIAL TEASER ────────────────────────────────── */}
          <DescriptionTeaser
            description={spot.description}
            accentColor={spotTypeColor}
          />

          {/* ── 3a. VIBES ──────────────────────────────────────── */}
          {hasVibes && (
            <div className="flex flex-wrap items-center gap-2">
              {spot.vibes?.slice(0, 4).map((vibe) => (
                <Badge key={vibe} variant="neutral" size="md">
                  {vibe.replace(/-/g, " ")}
                </Badge>
              ))}
            </div>
          )}

          {/* ── 3b. QUICK ACTIONS ─────────────────────────────── */}
          {hasActions && (
            <div className="flex flex-wrap items-center gap-2">
              {spot.website && (
                <QuickActionLink
                  href={spot.website}
                  icon={
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M12 21a9 9 0 100-18 9 9 0 000 18zM3.6 9h16.8M3.6 15h16.8M12 3c2.5 2.8 3.9 6.5 3.9 9s-1.4 6.2-3.9 9c-2.5-2.8-3.9-6.5-3.9-9s1.4-6.2 3.9-9z"
                      />
                    </svg>
                  }
                  label="Website"
                />
              )}
              {spot.instagram && (
                <QuickActionLink
                  href={`https://instagram.com/${(spot.instagram as string).replace("@", "")}`}
                  icon={
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <rect
                        x="2"
                        y="2"
                        width="20"
                        height="20"
                        rx="5"
                        strokeWidth={1.5}
                      />
                      <circle cx="12" cy="12" r="5" strokeWidth={1.5} />
                      <circle
                        cx="17.5"
                        cy="6.5"
                        r="1"
                        fill="currentColor"
                      />
                    </svg>
                  }
                  label="Instagram"
                />
              )}
              {spot.phone && (
                <QuickActionLink
                  href={`tel:${spot.phone}`}
                  icon={
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                      />
                    </svg>
                  }
                  label="Call"
                  external={false}
                />
              )}
              {spot.address && (
                <QuickActionLink
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${spot.address}, ${spot.city}, ${spot.state}`)}`}
                  icon={
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  }
                  label="Directions"
                />
              )}
            </div>
          )}

          {/* ── 4. AT A GLANCE — type-aware MetadataGrid ────────────── */}
          <MetadataGrid items={metadataItems} />

          {/* ── 4a. YONDER ADVENTURE SNAPSHOT ───────────────────── */}
          {isYonderPortal && yonderDestinationIntelligence && (
            <YonderAdventureSnapshot
              intelligence={yonderDestinationIntelligence}
              accommodationInventorySource={yonderAccommodationInventorySource}
              runtimeInventorySnapshot={yonderRuntimeInventorySnapshot}
              bookingSupport={{
                acceptsReservations: spot.accepts_reservations ?? null,
                reservationRecommended: spot.reservation_recommended ?? null,
                reservationUrl: spot.reservation_url ?? null,
              }}
            />
          )}

          {/* ── 4b. VENUE HANG STRIP — who's here ────────────────── */}
          {ENABLE_HANGS_V1 && (
            <VenueHangStripLive venueId={spot.id} variant="full" />
          )}

          {/* ── 5. ABOUT + HIGHLIGHTS — flowing, no card wrapper ──── */}
          {spot.description && (
            <div>
              <SectionHeader title="About" variant="divider" />
              <p className="text-[var(--soft)] whitespace-pre-wrap leading-relaxed">
                {spot.description}
              </p>
            </div>
          )}

          {highlights.length > 0 && (
            <div className="space-y-2">
              <SectionHeader title="Highlights" variant={spot.description ? "divider" : "inline"} />
              {highlights.map((h) => {
                const hl = h as {
                  id: number;
                  highlight_type: string;
                  title: string;
                  description?: string | null;
                  url?: string | null;
                };
                return (
                  <div
                    key={hl.id}
                    className="flex items-start gap-2.5 group"
                  >
                    <span
                      className="shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full"
                      style={{ background: spotTypeColor }}
                    />
                    <p className="text-sm leading-relaxed">
                      {hl.url ? (
                        <a
                          href={hl.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-[var(--cream)] underline decoration-[var(--twilight)] underline-offset-2 hover:decoration-[var(--soft)] transition-colors"
                        >
                          {hl.title}
                        </a>
                      ) : (
                        <span className="font-medium text-[var(--cream)]">
                          {hl.title}
                        </span>
                      )}
                      {hl.description && (
                        <span className="text-[var(--soft)]">
                          {" "}
                          &mdash; {hl.description}
                        </span>
                      )}
                      {hl.url && (
                        <svg className="inline-block w-3 h-3 ml-1 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      )}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── 5b. ACCOLADES — editorial mentions ───────────────── */}
          {editorialMentions.length > 0 && (
            <AccoladesSection
              mentions={editorialMentions}
              title={isYonderPortal ? "Field Guides" : "Accolades"}
            />
          )}

          {/* ── 6. EVENTS (promoted for event-heavy venue types) ──── */}
          {isEventHeavy && upcomingEvents.length > 0 && (
            <VenueShowtimes
              events={
                upcomingEvents as Parameters<
                  typeof VenueShowtimes
                >[0]["events"]
              }
              portalSlug={activePortalSlug}
              venueType={spot.venue_type ?? null}
              accentColor={spotTypeColor}
            />
          )}

          {/* ── 7. PRACTICAL — Hours + Location + Getting There ───── */}
          {hasHours && (
            <div>
              <SectionHeader title="Hours" variant="divider" />
              <HoursSection
                hours={spot.hours ?? null}
                hoursDisplay={spot.hours_display}
                is24Hours={spot.is_24_hours ?? false}
              />
            </div>
          )}

          {spot.address && (
            <div>
              <SectionHeader title="Location" variant="divider" />
              <p className="text-[var(--soft)]">
                {spot.address}
                <br />
                {spot.city}, {spot.state}
              </p>
            </div>
          )}

          {(hasHours || spot.address) && (
            <GettingThereSection
              transit={spot as TransitData}
            />
          )}

          {/* ── 8. FEATURES — type-aware attractions/exhibits ──────── */}
          {visibleFeatures.length > 0 && (
            <VenueFeaturesSection
              features={visibleFeatures}
              venueType={spot.venue_type ?? null}
            />
          )}

          {/* ── 9. ARTIFACTS — sub-venues ──────────────────────────── */}
          {attachedChildDestinations.length > 0 && (
            <RelatedSection
              title={ATTACHED_CHILD_DESTINATION_SECTION_TITLE}
              count={attachedChildDestinations.length}
            >
              {attachedChildDestinations.map((a) => {
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
                    subtitle={getSpotTypeLabel(
                      artifact.venue_type ?? null
                    )}
                    imageUrl={artifact.image_url || undefined}
                    category={artifact.venue_type}
                    accentColor={getSpotTypeColor(artifact.venue_type ?? null)}
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

          {/* ── 10. EVENTS (standard position for non-event-heavy) ── */}
          {!isEventHeavy && upcomingEvents.length > 0 && (
            <VenueShowtimes
              events={
                upcomingEvents as Parameters<
                  typeof VenueShowtimes
                >[0]["events"]
              }
              portalSlug={activePortalSlug}
              venueType={spot.venue_type ?? null}
              accentColor={spotTypeColor}
            />
          )}

          {/* ── 11. COMMUNITY — page footer ──────────────────────── */}
          <div className="border-t border-[var(--twilight)]/30 pt-5 space-y-3">
            <NeedsTagList
              entityType="venue"
              entityId={spot.id}
              title="Community Verified"
            />
            <CollapsibleSection title="Community Tags">
              <VenueTagList venueId={spot.id} />
            </CollapsibleSection>
            <FlagButton
              entityType="venue"
              entityId={spot.id}
              entityName={spot.name}
            />
          </div>

          {/* ── 12. NEARBY ─────────────────────────────────────────── */}
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
                  category={nearby.venue_type}
                  accentColor={getSpotTypeColor(nearby.venue_type ?? null)}
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

      {/* ── 13. STICKY BAR ──────────────────────────────────────── */}
      <DetailStickyBar
        shareLabel="Share Spot"
        showShareButton
        primaryVariant="outlined"
        secondaryActions={
          <SaveToListButton itemType="venue" itemId={spot.id} />
        }
        primaryAction={
          spot.website
            ? {
                label: "Visit Website",
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
