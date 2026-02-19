import { notFound } from "next/navigation";
import { Metadata } from "next";
import Link from "next/link";
import {
  getNeighborhoodById,
  getNeighborhoodDescription,
  getNeighborhoodsByTier,
  type Neighborhood,
} from "@/config/neighborhoods";
import { supabase } from "@/lib/supabase";
import type { Event } from "@/lib/supabase";
import type { Spot } from "@/lib/spots-constants";
import { getLocalDateString } from "@/lib/formats";
import { safeJsonLd } from "@/lib/formats";
import { toAbsoluteUrl } from "@/lib/site-url";
import { SectionHeader } from "@/components/detail/SectionHeader";
import EventCard from "@/components/EventCard";
import SpotCard from "@/components/SpotCard";

export const revalidate = 60;

type Props = {
  params: Promise<{ portal: string; slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { portal, slug } = await params;
  const neighborhood = getNeighborhoodById(slug);
  if (!neighborhood) return {};

  const description = getNeighborhoodDescription(slug);
  const title = `${neighborhood.name} — Events & Destinations | Lost City`;

  return {
    title,
    description: description || `Discover events, venues, and things to do in ${neighborhood.name}, Atlanta.`,
    alternates: {
      canonical: toAbsoluteUrl(`/${portal}/neighborhoods/${slug}`),
    },
  };
}

async function getNeighborhoodSpots(neighborhoodName: string): Promise<(Spot & { event_count: number })[]> {
  const today = getLocalDateString();

  const { data: venues, error } = await supabase
    .from("venues")
    .select("*")
    .eq("neighborhood", neighborhoodName)
    .eq("active", true)
    .order("name");

  if (error || !venues) return [];

  // Get event counts for these venues
  const venueIds = (venues as Spot[]).map((v) => v.id);
  if (venueIds.length === 0) return venues.map((v) => ({ ...(v as Spot), event_count: 0 }));

  const { data: eventCounts } = await supabase
    .from("events")
    .select("venue_id")
    .in("venue_id", venueIds)
    .gte("start_date", today)
    .or("is_sensitive.eq.false,is_sensitive.is.null");

  const countMap = new Map<number, number>();
  for (const ev of (eventCounts || []) as { venue_id: number | null }[]) {
    if (ev.venue_id) countMap.set(ev.venue_id, (countMap.get(ev.venue_id) || 0) + 1);
  }

  return (venues as Spot[])
    .map((v) => ({ ...v, event_count: countMap.get(v.id) || 0 }))
    .sort((a, b) => b.event_count - a.event_count || a.name.localeCompare(b.name));
}

async function getNeighborhoodEvents(neighborhoodName: string): Promise<Event[]> {
  const today = getLocalDateString();

  const { data, error } = await supabase
    .from("events")
    .select(`
      *,
      venue:venues!inner(id, name, slug, address, neighborhood, city, state),
      series:series(id, slug, title, series_type, image_url)
    `)
    .eq("venue.neighborhood", neighborhoodName)
    .or(`start_date.gte.${today},end_date.gte.${today}`)
    .or("is_sensitive.eq.false,is_sensitive.is.null")
    .order("start_date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(20);

  if (error || !data) return [];
  return data as Event[];
}

function getRelatedNeighborhoods(current: Neighborhood): Neighborhood[] {
  // Same tier or geographically close
  const allSameTier = getNeighborhoodsByTier(current.tier).filter((n) => n.id !== current.id);

  // Sort by distance to current
  const withDist = allSameTier.map((n) => {
    const dLat = n.lat - current.lat;
    const dLng = n.lng - current.lng;
    return { ...n, dist: Math.sqrt(dLat * dLat + dLng * dLng) };
  });
  withDist.sort((a, b) => a.dist - b.dist);

  return withDist.slice(0, 6);
}

function getTierLabel(tier: 1 | 2 | 3): string {
  if (tier === 1) return "Active";
  if (tier === 2) return "Neighborhood";
  return "Emerging";
}

export default async function NeighborhoodPage({ params }: Props) {
  const { portal, slug } = await params;
  const neighborhood = getNeighborhoodById(slug);

  if (!neighborhood) {
    notFound();
  }

  const [spots, events] = await Promise.all([
    getNeighborhoodSpots(neighborhood.name),
    getNeighborhoodEvents(neighborhood.name),
  ]);

  const description = getNeighborhoodDescription(slug);
  const related = getRelatedNeighborhoods(neighborhood);

  const placeSchema = {
    "@context": "https://schema.org",
    "@type": "Place",
    name: neighborhood.name,
    description: description || `Neighborhood in Atlanta, Georgia`,
    geo: {
      "@type": "GeoCoordinates",
      latitude: neighborhood.lat,
      longitude: neighborhood.lng,
    },
    containedInPlace: {
      "@type": "City",
      name: "Atlanta",
      addressRegion: "GA",
    },
  };

  return (
    <div className="max-w-5xl mx-auto px-4 pb-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(placeSchema) }}
      />

      {/* Breadcrumb */}
      <nav className="pt-4 pb-2">
        <div className="flex items-center gap-1.5 text-xs font-mono text-[var(--muted)]">
          <Link
            href={`/${portal}/neighborhoods`}
            className="hover:text-[var(--cream)] transition-colors"
          >
            Neighborhoods
          </Link>
          <span className="opacity-40">/</span>
          <span className="text-[var(--soft)]">{neighborhood.name}</span>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-6">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--cream)]">
            {neighborhood.name}
          </h1>
          {neighborhood.tier === 1 && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[0.6rem] font-mono font-semibold uppercase tracking-wider bg-[var(--neon-amber)]/15 text-[var(--neon-amber)] border border-[var(--neon-amber)]/30">
              Active
            </span>
          )}
        </div>
        {description && (
          <p className="text-sm text-[var(--soft)] leading-relaxed max-w-2xl">
            {description}
          </p>
        )}
      </section>

      {/* Stats bar */}
      <section className="flex items-center gap-4 py-3 border-t border-b border-[var(--twilight)] mb-6">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-lg font-bold text-[var(--cream)]">{spots.length}</span>
          <span className="font-mono text-xs text-[var(--muted)]">venues</span>
        </div>
        <div className="w-px h-4 bg-[var(--twilight)]" />
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-lg font-bold text-[var(--cream)]">{events.length}</span>
          <span className="font-mono text-xs text-[var(--muted)]">upcoming events</span>
        </div>
        <div className="w-px h-4 bg-[var(--twilight)]" />
        <span className="font-mono text-xs text-[var(--muted)] px-2 py-0.5 rounded bg-[var(--surface-elevated)]/60">
          {getTierLabel(neighborhood.tier)}
        </span>
      </section>

      {/* Upcoming Events */}
      {events.length > 0 && (
        <section>
          <SectionHeader title="Upcoming Events" count={events.length} />
          <div className="space-y-1">
            {events.map((event, i) => (
              <EventCard
                key={event.id}
                event={event}
                index={i}
                portalSlug={portal}
                density="compact"
              />
            ))}
          </div>
        </section>
      )}

      {/* Destinations */}
      {spots.length > 0 && (
        <section className="mt-8">
          <SectionHeader title="Destinations" count={spots.length} />
          <div className="space-y-1">
            {spots.map((spot, i) => (
              <SpotCard
                key={spot.id}
                spot={spot}
                index={i}
                portalSlug={portal}
              />
            ))}
          </div>
        </section>
      )}

      {/* Explore Nearby */}
      {related.length > 0 && (
        <section className="mt-8">
          <SectionHeader title="Explore Nearby" count={related.length} />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {related.map((n) => (
              <Link
                key={n.id}
                href={`/${portal}/neighborhoods/${n.id}`}
                className="p-3 rounded-lg border border-[var(--twilight)] bg-[var(--dusk)]/30 hover:bg-[var(--dusk)]/60 hover:border-[var(--muted)] transition-all"
              >
                <div className="font-mono text-xs font-medium text-[var(--cream)] truncate">
                  {n.name}
                </div>
                <div className="font-mono text-[0.55rem] text-[var(--muted)] mt-0.5">
                  {getTierLabel(n.tier)}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {events.length === 0 && spots.length === 0 && (
        <div className="py-16 text-center">
          <p className="font-mono text-sm text-[var(--muted)]">
            No venues or events in {neighborhood.name} yet.
          </p>
        </div>
      )}
    </div>
  );
}
