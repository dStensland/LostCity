"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import type { Portal } from "@/lib/portal-context";
import HotelHeader from "./HotelHeader";
import TimeGreeting from "./TimeGreeting";
import HotelSection from "./HotelSection";
import HotelCarousel from "./HotelCarousel";
import HotelHeroCard from "./HotelHeroCard";
import HotelAmenityCard from "./HotelAmenityCard";
import HotelCategoryPills from "./HotelCategoryPills";
import HotelEventCard from "./HotelEventCard";
import HotelVenueCard from "./HotelVenueCard";

// ============================================================================
// Types
// ============================================================================

interface FeedSection {
  title: string;
  description?: string;
  slug?: string;
  layout?: string;
  events: any[];
}

interface Spot {
  id: number;
  slug: string;
  name: string;
  image_url?: string | null;
  venue_type?: string | null;
  neighborhood?: string | null;
  vibes?: string[] | null;
  distance_km?: number | null;
  next_event?: {
    title: string;
    start_date: string;
    start_time?: string | null;
  } | null;
}

// ============================================================================
// Amenities Data (FORTH Hotel)
// ============================================================================

const AMENITIES = [
  { name: "The Pool", icon: "\u{1F3CA}", hours: "Open 7AM \u2013 10PM", description: "Heated infinity pool overlooking the BeltLine" },
  { name: "FORTH Spa", icon: "\u{1F9D6}", hours: "Open 9AM \u2013 8PM", description: "Massages, facials, and body treatments" },
  { name: "Ember Restaurant", icon: "\u{1F37D}\uFE0F", hours: "Open 6:30AM \u2013 10PM", description: "Farm-to-table Southern cuisine" },
  { name: "The Copper Bar", icon: "\u{1F378}", hours: "Open 4PM \u2013 Midnight", description: "Craft cocktails and curated wines" },
  { name: "Fitness Center", icon: "\u{1F4AA}", hours: "Open 24/7", description: "Peloton bikes, free weights, yoga mats" },
  { name: "The Terrace", icon: "\u{1F305}", hours: "Open 5PM \u2013 11PM", description: "Sunset views with small plates" },
];

// ============================================================================
// Neighborhood Categories
// ============================================================================

const NEIGHBORHOOD_CATEGORIES = [
  { key: "all", label: "All", icon: "\u2728" },
  { key: "dine", label: "Dine", icon: "\u{1F37D}\uFE0F" },
  { key: "drink", label: "Drink", icon: "\u{1F378}" },
  { key: "coffee", label: "Coffee", icon: "\u2615" },
  { key: "explore", label: "Explore", icon: "\u{1F5FA}\uFE0F" },
];

const DINE_TYPES = new Set(["restaurant", "food_hall"]);
const DRINK_TYPES = new Set(["bar", "brewery", "rooftop", "sports_bar", "distillery", "nightclub"]);
const COFFEE_TYPES = new Set(["coffee_shop"]);

function categorizeSpot(venueType: string | null | undefined): string {
  if (!venueType) return "explore";
  if (DINE_TYPES.has(venueType)) return "dine";
  if (DRINK_TYPES.has(venueType)) return "drink";
  if (COFFEE_TYPES.has(venueType)) return "coffee";
  return "explore";
}

// ============================================================================
// Suppressed feed sections (we render these as venue carousels instead)
// ============================================================================

const SUPPRESSED_SLUGS = new Set(["dining", "drinks", "bars", "restaurants", "nightlife"]);

// ============================================================================
// Component
// ============================================================================

interface HotelConciergeFeedProps {
  portal: Portal;
}

export default function HotelConciergeFeed({ portal }: HotelConciergeFeedProps) {
  const [sections, setSections] = useState<FeedSection[]>([]);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("all");

  const logoUrl = portal.branding?.logo_url as string | null | undefined;

  // Fetch feed + spots in parallel
  useEffect(() => {
    async function fetchData() {
      try {
        const [feedRes, spotsRes] = await Promise.all([
          fetch(`/api/portals/${portal.slug}/feed`),
          fetch(`/api/spots?neighborhood=Old Fourth Ward,Inman Park,Ponce City Market Area&venue_type=restaurant,food_hall,bar,brewery,rooftop,sports_bar,coffee_shop,distillery,nightclub&limit=60`),
        ]);

        const feedData = await feedRes.json();
        const spotsData = await spotsRes.json();

        if (feedData.sections) {
          const normalized: FeedSection[] = feedData.sections
            .filter((s: any) => s.events?.length > 0)
            .map((section: any) => ({
              title: section.title,
              description: section.description,
              slug: section.slug,
              layout: section.layout,
              events: section.events.map((event: any) => ({
                ...event,
                venue_name: event.venue?.name || event.venue_name || null,
              })),
            }));
          setSections(normalized);
        }

        setSpots(spotsData.spots || []);
      } catch (error) {
        console.error("Failed to fetch hotel concierge data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [portal.slug]);

  // Partition spots by category
  const spotsByCategory = useMemo(() => {
    const map: Record<string, Spot[]> = { dine: [], drink: [], coffee: [], explore: [] };
    for (const spot of spots) {
      const cat = categorizeSpot(spot.venue_type);
      map[cat]?.push(spot);
    }
    return map;
  }, [spots]);

  // Filter neighborhood spots by active category
  const neighborhoodSpots = useMemo(() => {
    if (activeCategory === "all") return spots;
    return spotsByCategory[activeCategory] || [];
  }, [spots, spotsByCategory, activeCategory]);

  // Extract feed sections by purpose
  const todaySection = sections.find((s) => s.slug === "tonight" || s.slug === "today") || sections[0];
  const picksSection = sections.find((s) => s.slug === "curated" || s.slug === "picks" || s.slug === "our-picks");
  const highlightsSection = sections.find((s) => s.slug === "popular" || s.slug === "highlights" || s.slug === "trending");
  const comingUpSection = sections.find((s) => s.slug === "coming-up" || s.slug === "upcoming" || s.slug === "this-week" || s.slug === "next-7-days");
  const freeSection = sections.find((s) => s.slug === "free" || s.slug === "complimentary");

  // Remaining sections not already rendered
  const renderedSlugs = new Set([
    todaySection?.slug,
    picksSection?.slug,
    highlightsSection?.slug,
    comingUpSection?.slug,
    freeSection?.slug,
    ...SUPPRESSED_SLUGS,
  ]);
  const extraSections = sections.filter((s) => s.slug && !renderedSlugs.has(s.slug));

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="min-h-screen bg-[var(--hotel-ivory)]">
      <HotelHeader portalSlug={portal.slug} portalName={portal.name} logoUrl={logoUrl} />

      <main className="max-w-5xl mx-auto px-6 py-12">
        {/* 1. Time Greeting */}
        <Suspense fallback={<div className="h-32" />}>
          <TimeGreeting subtitle="Your personal guide to Atlanta" />
        </Suspense>

        {/* 2. Tonight / Today */}
        {todaySection && todaySection.events.length > 0 && (
          <HotelSection
            title="Tonight"
            subtitle="Handpicked for your evening"
            className="mb-16"
            action={{ label: "See all events", href: `/${portal.slug}?view=find&type=events` }}
          >
            {/* Hero card for top pick */}
            <HotelHeroCard
              event={todaySection.events[0]}
              portalSlug={portal.slug}
            />
            {/* Compact list for remaining */}
            {todaySection.events.length > 1 && (
              <div className="space-y-3 mt-6 hotel-grid">
                {todaySection.events.slice(1, 6).map((event: any) => (
                  <HotelEventCard
                    key={event.id}
                    event={event}
                    portalSlug={portal.slug}
                    variant="compact"
                  />
                ))}
              </div>
            )}
          </HotelSection>
        )}

        <div className="hotel-divider" />

        {/* 3. Hotel Amenities */}
        <HotelSection
          title="Hotel Amenities"
          subtitle="Exclusive to FORTH guests"
          className="mb-16"
        >
          <HotelCarousel>
            {AMENITIES.map((amenity) => (
              <HotelAmenityCard key={amenity.name} amenity={amenity} />
            ))}
          </HotelCarousel>
        </HotelSection>

        <div className="hotel-divider" />

        {/* 4. The Neighborhood */}
        {spots.length > 0 && (
          <HotelSection
            title="The Neighborhood"
            subtitle="Old Fourth Ward, Inman Park & beyond"
            className="mb-16"
            id="neighborhood"
            action={{ label: "Explore all", href: `/${portal.slug}?view=find&type=destinations` }}
          >
            <HotelCategoryPills
              categories={NEIGHBORHOOD_CATEGORIES}
              active={activeCategory}
              onSelect={setActiveCategory}
            />
            <HotelCarousel>
              {neighborhoodSpots.slice(0, 20).map((spot) => (
                <HotelVenueCard
                  key={spot.slug}
                  venue={spot}
                  portalSlug={portal.slug}
                  variant="carousel"
                />
              ))}
            </HotelCarousel>
          </HotelSection>
        )}

        <div className="hotel-divider" />

        {/* 5. Where to Eat */}
        {spotsByCategory.dine.length > 0 && (
          <HotelSection
            title="Where to Eat"
            subtitle="The best tables nearby"
            className="mb-16"
            action={{ label: "See all dining", href: `/${portal.slug}?view=find&type=destinations&venue_type=restaurant,food_hall` }}
          >
            <HotelCarousel>
              {spotsByCategory.dine.slice(0, 15).map((spot) => (
                <HotelVenueCard
                  key={spot.slug}
                  venue={spot}
                  portalSlug={portal.slug}
                  variant="carousel"
                />
              ))}
            </HotelCarousel>
          </HotelSection>
        )}

        {/* 6. Where to Drink */}
        {spotsByCategory.drink.length > 0 && (
          <HotelSection
            title="Where to Drink"
            subtitle="Cocktails, craft beer & more"
            className="mb-16"
            action={{ label: "See all bars", href: `/${portal.slug}?view=find&type=destinations&venue_type=bar,brewery,rooftop` }}
          >
            <HotelCarousel>
              {spotsByCategory.drink.slice(0, 15).map((spot) => (
                <HotelVenueCard
                  key={spot.slug}
                  venue={spot}
                  portalSlug={portal.slug}
                  variant="carousel"
                />
              ))}
            </HotelCarousel>
          </HotelSection>
        )}

        <div className="hotel-divider" />

        {/* 7. Our Picks (curated section from feed) */}
        {picksSection && picksSection.events.length > 0 && (
          <HotelSection
            title="Our Picks"
            subtitle="Curated by your concierge"
            className="mb-16"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 hotel-grid">
              {picksSection.events.slice(0, 6).map((event: any) => (
                <HotelEventCard
                  key={event.id}
                  event={event}
                  portalSlug={portal.slug}
                  variant="featured"
                />
              ))}
            </div>
          </HotelSection>
        )}

        {/* 8. City Highlights */}
        {highlightsSection && highlightsSection.events.length > 0 && (
          <HotelSection
            title="City Highlights"
            subtitle="What Atlanta is talking about"
            className="mb-16"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 hotel-grid">
              {highlightsSection.events.slice(0, 6).map((event: any) => (
                <HotelEventCard
                  key={event.id}
                  event={event}
                  portalSlug={portal.slug}
                  variant="featured"
                />
              ))}
            </div>
          </HotelSection>
        )}

        <div className="hotel-divider" />

        {/* 9. Coming Up */}
        {comingUpSection && comingUpSection.events.length > 0 && (
          <HotelSection
            title="Coming Up"
            subtitle="This week and beyond"
            className="mb-16"
            action={{ label: "Full calendar", href: `/${portal.slug}?view=find&type=events` }}
          >
            <div className="space-y-3 hotel-grid">
              {comingUpSection.events.slice(0, 8).map((event: any) => (
                <HotelEventCard
                  key={event.id}
                  event={event}
                  portalSlug={portal.slug}
                  variant="compact"
                />
              ))}
            </div>
          </HotelSection>
        )}

        {/* 10. Complimentary Experiences */}
        {freeSection && freeSection.events.length > 0 && (
          <HotelSection
            title="Complimentary Experiences"
            subtitle="No ticket required"
            className="mb-16"
          >
            <div className="space-y-3 hotel-grid">
              {freeSection.events.slice(0, 6).map((event: any) => (
                <HotelEventCard
                  key={event.id}
                  event={event}
                  portalSlug={portal.slug}
                  variant="compact"
                />
              ))}
            </div>
          </HotelSection>
        )}

        {/* Extra feed sections not already shown */}
        {extraSections.map((section) => (
          <HotelSection
            key={section.slug || section.title}
            title={section.title}
            subtitle={section.description}
            className="mb-16"
          >
            {section.layout === "list" ? (
              <div className="space-y-3 hotel-grid">
                {section.events.slice(0, 8).map((event: any) => (
                  <HotelEventCard
                    key={event.id}
                    event={event}
                    portalSlug={portal.slug}
                    variant="compact"
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 hotel-grid">
                {section.events.slice(0, 6).map((event: any) => (
                  <HotelEventCard
                    key={event.id}
                    event={event}
                    portalSlug={portal.slug}
                    variant="featured"
                  />
                ))}
              </div>
            )}
          </HotelSection>
        ))}

        {sections.length === 0 && spots.length === 0 && (
          <div className="text-center py-16">
            <p className="font-display text-2xl text-[var(--hotel-stone)] mb-4">
              Your concierge guide is being prepared
            </p>
            <p className="font-body text-base text-[var(--hotel-stone)]">
              Check back soon for curated experiences
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--hotel-ivory)]">
      <div className="sticky top-0 z-50 bg-[var(--hotel-ivory)]/95 backdrop-blur-md border-b border-[var(--hotel-sand)] shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="h-8 w-32 bg-[var(--hotel-sand)] rounded animate-pulse" />
          <div className="flex gap-8">
            <div className="h-4 w-16 bg-[var(--hotel-sand)] rounded animate-pulse" />
            <div className="h-4 w-20 bg-[var(--hotel-sand)] rounded animate-pulse" />
            <div className="h-4 w-16 bg-[var(--hotel-sand)] rounded animate-pulse" />
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 py-12">
        {/* Greeting skeleton */}
        <div className="mb-16">
          <div className="h-12 w-64 bg-[var(--hotel-sand)] rounded mb-3 animate-pulse" />
          <div className="h-6 w-48 bg-[var(--hotel-sand)] rounded animate-pulse" />
        </div>

        {/* Hero skeleton */}
        <div className="h-64 bg-[var(--hotel-cream)] rounded-xl mb-6 animate-pulse" />

        {/* Compact list skeleton */}
        <div className="space-y-3 mb-16">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-[var(--hotel-cream)] rounded-lg animate-pulse" />
          ))}
        </div>

        {/* Carousel skeleton */}
        <div className="mb-16">
          <div className="h-8 w-40 bg-[var(--hotel-sand)] rounded mb-6 animate-pulse" />
          <div className="flex gap-4 overflow-hidden">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex-shrink-0 w-[260px] h-40 bg-[var(--hotel-cream)] rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
