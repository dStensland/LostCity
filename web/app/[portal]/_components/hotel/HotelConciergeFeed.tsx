"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import type { Portal } from "@/lib/portal-context";
import HotelHeader from "./HotelHeader";
import TimeGreeting from "./TimeGreeting";
import HotelSection from "./HotelSection";
import HotelCarousel from "./HotelCarousel";
import HotelHeroCard from "./HotelHeroCard";
import HotelEventCard from "./HotelEventCard";
import HotelDestinationCard from "./HotelDestinationCard";

interface FeedSection {
  title: string;
  description?: string;
  slug?: string;
  layout?: string;
  events: Array<{
    id: string;
    title: string;
    start_date: string;
    start_time?: string | null;
    image_url?: string | null;
    description?: string | null;
    venue_name?: string | null;
    is_free?: boolean;
    price_min?: number | null;
    distance_km?: number | null;
  }>;
}

type Destination = {
  venue: {
    id: number;
    slug: string;
    name: string;
    neighborhood: string | null;
    venue_type: string | null;
    image_url: string | null;
    short_description: string | null;
  };
  distance_km: number;
  proximity_tier: "walkable" | "close" | "destination";
  proximity_label: string;
  special_state: "active_now" | "starting_soon" | "none";
  top_special: {
    title: string;
    type: string;
    price_note: string | null;
    starts_in_minutes: number | null;
    remaining_minutes: number | null;
  } | null;
  next_event: {
    title: string;
    start_date: string;
    start_time: string | null;
  } | null;
};

type DayPart = "morning" | "afternoon" | "evening" | "late_night";

const DINE_TYPES = new Set(["restaurant", "food_hall"]);
const DRINK_TYPES = new Set(["bar", "brewery", "rooftop", "sports_bar", "distillery", "nightclub"]);
const COFFEE_TYPES = new Set(["coffee_shop"]);
const HOTEL_AMENITY_TYPES = new Set(["hotel", "spa", "fitness_center", "restaurant", "bar", "rooftop"]);

function getDayPart(now: Date): DayPart {
  const hour = now.getHours();
  if (hour >= 6 && hour < 11) return "morning";
  if (hour >= 11 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 23) return "evening";
  return "late_night";
}

function getDayPartSubtitle(part: DayPart): string {
  if (part === "morning") return "Start your day with walkable coffee, brunch, and design-forward spaces.";
  if (part === "afternoon") return "Happy hours are about to open and the evening starts here.";
  if (part === "evening") return "Your evening, curated around what is live right now.";
  return "Late-night destinations and tomorrow's best options.";
}

function getCategory(venueType: string | null): "dine" | "drink" | "coffee" | "explore" {
  if (!venueType) return "explore";
  if (DINE_TYPES.has(venueType)) return "dine";
  if (DRINK_TYPES.has(venueType)) return "drink";
  if (COFFEE_TYPES.has(venueType)) return "coffee";
  return "explore";
}

function isLikelyHotelAmenity(destination: Destination, portalName: string): boolean {
  const tokens = portalName
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length >= 4);

  const nameLower = destination.venue.name.toLowerCase();
  const tokenMatch = tokens.some((token) => nameLower.includes(token));
  const veryClose = destination.distance_km <= 0.35;
  const typeMatch = destination.venue.venue_type ? HOTEL_AMENITY_TYPES.has(destination.venue.venue_type) : false;

  return tokenMatch || (veryClose && typeMatch);
}

function isWorldCupWindow(now: Date): boolean {
  const current = now.toISOString().slice(0, 10);
  return current >= "2026-06-11" && current <= "2026-07-19";
}

interface HotelConciergeFeedProps {
  portal: Portal;
}

export default function HotelConciergeFeed({ portal }: HotelConciergeFeedProps) {
  const [sections, setSections] = useState<FeedSection[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [liveDestinations, setLiveDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);

  const logoUrl = portal.branding?.logo_url as string | null | undefined;

  useEffect(() => {
    async function fetchData() {
      try {
        const search = new URLSearchParams();
        const center = portal.filters?.geo_center;
        if (center?.[0] !== undefined && center?.[1] !== undefined) {
          search.set("lat", String(center[0]));
          search.set("lng", String(center[1]));
        }
        if (portal.filters?.geo_radius_km) {
          search.set("radius_km", String(portal.filters.geo_radius_km));
        }

        const baseQuery = search.toString();
        const allQuery = baseQuery ? `${baseQuery}&include_upcoming_hours=4&limit=90` : "include_upcoming_hours=4&limit=90";
        const activeQuery = baseQuery ? `${baseQuery}&active_now=true&limit=24` : "active_now=true&limit=24";

        const [feedRes, allDestRes, liveDestRes] = await Promise.all([
          fetch(`/api/portals/${portal.slug}/feed`),
          fetch(`/api/portals/${portal.slug}/destinations/specials?${allQuery}`),
          fetch(`/api/portals/${portal.slug}/destinations/specials?${activeQuery}`),
        ]);

        const feedData = await feedRes.json();
        const allDestData = await allDestRes.json();
        const liveDestData = await liveDestRes.json();

        if (feedData.sections) {
          const normalized: FeedSection[] = feedData.sections
            .filter((s: { events?: unknown[] }) => (s.events || []).length > 0)
            .map((section: {
              title: string;
              description?: string;
              slug?: string;
              layout?: string;
              events: Array<Record<string, unknown>>;
            }) => ({
              title: section.title,
              description: section.description,
              slug: section.slug,
              layout: section.layout,
              events: section.events.map((event) => ({
                id: String(event.id),
                title: String(event.title || ""),
                start_date: String(event.start_date || ""),
                start_time: event.start_time ? String(event.start_time) : null,
                image_url: event.image_url ? String(event.image_url) : null,
                description: event.description ? String(event.description) : null,
                venue_name: event.venue_name
                  ? String(event.venue_name)
                  : event.venue && typeof event.venue === "object" && "name" in event.venue
                    ? String((event.venue as { name?: string }).name || "")
                    : null,
                is_free: Boolean(event.is_free),
                price_min: typeof event.price_min === "number" ? event.price_min : null,
              })),
            }));
          setSections(normalized);
        }

        setDestinations((allDestData.destinations || []) as Destination[]);
        setLiveDestinations((liveDestData.destinations || []) as Destination[]);
      } catch (error) {
        console.error("Failed to fetch hotel concierge data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [portal.slug, portal.filters?.geo_center, portal.filters?.geo_radius_km]);

  const dayPart = useMemo(() => getDayPart(new Date()), []);
  const worldCupActive = useMemo(() => isWorldCupWindow(new Date()), []);

  const todaySection = sections.find((s) => s.slug === "tonight" || s.slug === "today" || s.slug === "this-evening") || sections[0];
  const picksSection = sections.find((s) => s.slug === "curated" || s.slug === "picks" || s.slug === "our-picks");
  const comingUpSection = sections.find((s) => s.slug === "coming-up" || s.slug === "upcoming" || s.slug === "this-week" || s.slug === "next-7-days");
  const freeSection = sections.find((s) => s.slug === "free" || s.slug === "complimentary");

  const categorized = useMemo(() => {
    const result: Record<"dine" | "drink" | "coffee" | "explore", Destination[]> = {
      dine: [],
      drink: [],
      coffee: [],
      explore: [],
    };

    for (const destination of destinations) {
      result[getCategory(destination.venue.venue_type)].push(destination);
    }

    return result;
  }, [destinations]);

  const walkable = useMemo(() => destinations.filter((d) => d.proximity_tier === "walkable"), [destinations]);
  const closeTier = useMemo(() => destinations.filter((d) => d.proximity_tier === "close"), [destinations]);
  const startingSoon = useMemo(() => destinations.filter((d) => d.special_state === "starting_soon"), [destinations]);
  const amenities = useMemo(
    () => destinations.filter((d) => isLikelyHotelAmenity(d, portal.name)).slice(0, 8),
    [destinations, portal.name]
  );

  const leadDestinations = useMemo(() => {
    if (dayPart === "morning") {
      return categorized.coffee.slice(0, 12);
    }
    if (dayPart === "afternoon" && startingSoon.length > 0) {
      return startingSoon.slice(0, 12);
    }
    if (liveDestinations.length > 0) {
      return liveDestinations.slice(0, 12);
    }
    return walkable.slice(0, 12);
  }, [categorized.coffee, dayPart, liveDestinations, startingSoon, walkable]);

  const leadTitle = dayPart === "morning"
    ? "Morning Nearby"
    : dayPart === "afternoon" && startingSoon.length > 0
      ? "Starting Soon"
      : "Right Now Near You";

  const leadSubtitle = dayPart === "morning"
    ? "Coffee, brunch, and close-by daytime destinations."
    : dayPart === "afternoon" && startingSoon.length > 0
      ? "Specials opening in the next few hours."
      : "Live specials and high-signal destinations around the hotel.";

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="min-h-screen bg-[var(--hotel-ivory)] hotel-enter">
      <HotelHeader portalSlug={portal.slug} portalName={portal.name} logoUrl={logoUrl} />

      <main className="max-w-6xl mx-auto px-6 py-10 md:py-14">
        <Suspense fallback={<div className="h-24" />}>
          <TimeGreeting subtitle={getDayPartSubtitle(dayPart)} />
        </Suspense>

        {worldCupActive && (
          <section className="mb-14 rounded-2xl border border-[var(--hotel-champagne)]/40 bg-[linear-gradient(120deg,rgba(212,175,122,0.12),rgba(201,168,138,0.05))] p-6">
            <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--hotel-champagne)] mb-2">World Cup Mode</p>
            <h2 className="font-display text-3xl text-[var(--hotel-charcoal)] mb-2">Match Days In Atlanta</h2>
            <p className="text-[var(--hotel-stone)] leading-relaxed">
              Concierge callouts prioritize watch parties, nearby pre-match dining, and post-match destinations.
            </p>
          </section>
        )}

        {leadDestinations.length > 0 && (
          <HotelSection
            title={leadTitle}
            subtitle={leadSubtitle}
            className="mb-16"
            action={{ label: "All destinations", href: `/${portal.slug}?view=find&type=destinations` }}
          >
            <HotelCarousel>
              {leadDestinations.map((destination) => (
                <div key={destination.venue.id} className="flex-shrink-0 snap-start w-[300px]">
                  <HotelDestinationCard destination={destination} portalSlug={portal.slug} variant="live" />
                </div>
              ))}
            </HotelCarousel>
          </HotelSection>
        )}

        <div className="hotel-divider" />

        {todaySection && todaySection.events.length > 0 && (
          <HotelSection
            title="Tonight"
            subtitle="Events with strong signal for this evening."
            className="mb-16"
            action={{ label: "All events", href: `/${portal.slug}?view=find&type=events` }}
          >
            <HotelHeroCard event={todaySection.events[0]} portalSlug={portal.slug} />
            {todaySection.events.length > 1 && (
              <div className="space-y-3 mt-6 hotel-grid">
                {todaySection.events.slice(1, 7).map((event) => (
                  <HotelEventCard key={event.id} event={event} portalSlug={portal.slug} variant="compact" />
                ))}
              </div>
            )}
          </HotelSection>
        )}

        <div className="hotel-divider" />

        {amenities.length > 0 && (
          <HotelSection title="At The Property" subtitle="Data-backed hotel venues and closest in-house experiences." className="mb-16">
            <HotelCarousel>
              {amenities.map((destination) => (
                <div key={destination.venue.id} className="flex-shrink-0 snap-start w-[280px]">
                  <HotelDestinationCard destination={destination} portalSlug={portal.slug} />
                </div>
              ))}
            </HotelCarousel>
          </HotelSection>
        )}

        {walkable.length > 0 && (
          <HotelSection title="Walkable Now" subtitle="Under roughly 15 minutes on foot." className="mb-16">
            <HotelCarousel>
              {walkable.slice(0, 16).map((destination) => (
                <div key={destination.venue.id} className="flex-shrink-0 snap-start w-[280px]">
                  <HotelDestinationCard destination={destination} portalSlug={portal.slug} />
                </div>
              ))}
            </HotelCarousel>
          </HotelSection>
        )}

        {categorized.dine.length > 0 && (
          <HotelSection
            title="Where To Eat"
            subtitle="Dining destinations prioritized for this part of day."
            className="mb-16"
            action={{ label: "All dining", href: `/${portal.slug}?view=find&type=destinations&venue_type=restaurant,food_hall` }}
          >
            <HotelCarousel>
              {categorized.dine.slice(0, 15).map((destination) => (
                <div key={destination.venue.id} className="flex-shrink-0 snap-start w-[280px]">
                  <HotelDestinationCard destination={destination} portalSlug={portal.slug} />
                </div>
              ))}
            </HotelCarousel>
          </HotelSection>
        )}

        {categorized.drink.length > 0 && (
          <HotelSection
            title="Where To Drink"
            subtitle="Cocktail bars, rooftops, and nightlife with live context."
            className="mb-16"
            action={{ label: "All bars", href: `/${portal.slug}?view=find&type=destinations&venue_type=bar,brewery,rooftop,nightclub` }}
          >
            <HotelCarousel>
              {categorized.drink.slice(0, 15).map((destination) => (
                <div key={destination.venue.id} className="flex-shrink-0 snap-start w-[280px]">
                  <HotelDestinationCard destination={destination} portalSlug={portal.slug} />
                </div>
              ))}
            </HotelCarousel>
          </HotelSection>
        )}

        {closeTier.length > 0 && (
          <HotelSection title="A Short Ride Away" subtitle="Close-tier destinations worth leaving the immediate corridor for." className="mb-16">
            <HotelCarousel>
              {closeTier.slice(0, 12).map((destination) => (
                <div key={destination.venue.id} className="flex-shrink-0 snap-start w-[280px]">
                  <HotelDestinationCard destination={destination} portalSlug={portal.slug} />
                </div>
              ))}
            </HotelCarousel>
          </HotelSection>
        )}

        {picksSection && picksSection.events.length > 0 && (
          <HotelSection title="Concierge Picks" subtitle="Curated recommendations from the property and local team." className="mb-16">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 hotel-grid">
              {picksSection.events.slice(0, 6).map((event) => (
                <HotelEventCard key={event.id} event={event} portalSlug={portal.slug} variant="featured" />
              ))}
            </div>
          </HotelSection>
        )}

        {comingUpSection && comingUpSection.events.length > 0 && (
          <HotelSection title="Coming Up" subtitle="High-quality events in the next week." className="mb-16">
            <div className="space-y-3 hotel-grid">
              {comingUpSection.events.slice(0, 8).map((event) => (
                <HotelEventCard key={event.id} event={event} portalSlug={portal.slug} variant="compact" />
              ))}
            </div>
          </HotelSection>
        )}

        {freeSection && freeSection.events.length > 0 && (
          <HotelSection title="Complimentary Experiences" subtitle="No ticket required." className="mb-16">
            <div className="space-y-3 hotel-grid">
              {freeSection.events.slice(0, 6).map((event) => (
                <HotelEventCard key={event.id} event={event} portalSlug={portal.slug} variant="compact" />
              ))}
            </div>
          </HotelSection>
        )}

        {sections.length === 0 && destinations.length === 0 && (
          <div className="text-center py-20">
            <p className="font-display text-3xl text-[var(--hotel-charcoal)] mb-3">Concierge data is warming up</p>
            <p className="font-body text-[var(--hotel-stone)]">Refresh shortly to see live destinations and tonight&apos;s recommendations.</p>
          </div>
        )}
      </main>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--hotel-ivory)]">
      <div className="sticky top-0 z-50 bg-[var(--hotel-ivory)]/95 backdrop-blur-md border-b border-[var(--hotel-sand)] shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="h-8 w-40 bg-[var(--hotel-sand)] rounded animate-pulse" />
          <div className="h-5 w-5 bg-[var(--hotel-sand)] rounded animate-pulse" />
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 py-12 space-y-8">
        <div className="h-20 bg-[var(--hotel-cream)] rounded-xl animate-pulse" />
        <div className="h-64 bg-[var(--hotel-cream)] rounded-xl animate-pulse" />
        <div className="flex gap-4 overflow-hidden">
          <div className="w-[280px] h-[360px] bg-[var(--hotel-cream)] rounded-xl animate-pulse" />
          <div className="w-[280px] h-[360px] bg-[var(--hotel-cream)] rounded-xl animate-pulse" />
          <div className="w-[280px] h-[360px] bg-[var(--hotel-cream)] rounded-xl animate-pulse" />
        </div>
      </main>
    </div>
  );
}
