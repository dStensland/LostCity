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
import { getLocalDateString, decodeHtmlEntities, formatSmartDate } from "@/lib/formats";
import { safeJsonLd } from "@/lib/formats";
import { toAbsoluteUrl } from "@/lib/site-url";
import { getNeighborhoodColor } from "@/lib/neighborhood-colors";
import { hexToRgb, formatCategoryLabel, NOISE_CATEGORIES } from "@/lib/neighborhood-utils";
import Dot from "@/components/ui/Dot";
import PlaceCard from "@/components/PlaceCard";
import CategoryIcon from "@/components/CategoryIcon";

export const revalidate = 60;

type Props = {
  params: Promise<{ portal: string; slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { portal, slug } = await params;
  const neighborhood = getNeighborhoodById(slug);
  if (!neighborhood) return {};

  const description = getNeighborhoodDescription(slug);
  const title = `${neighborhood.name} — Events & Spots | Lost City`;

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
    .from("places")
    .select("*")
    .eq("neighborhood", neighborhoodName)
    .eq("is_active", true)
    .order("name");

  if (error || !venues) return [];

  const venueIds = venues.map((v: Spot) => v.id);
  if (venueIds.length === 0) return venues.map((v: Spot) => ({ ...v, event_count: 0 }));

  const { data: eventCounts } = await supabase
    .from("events")
    .select("place_id")
    .in("place_id", venueIds)
    .gte("start_date", today)
    .or("is_sensitive.eq.false,is_sensitive.is.null");

  const countMap = new Map<number, number>();
  for (const ev of (eventCounts || []) as { place_id: number | null }[]) {
    if (ev.place_id) countMap.set(ev.place_id, (countMap.get(ev.place_id) || 0) + 1);
  }

  return (venues as Spot[])
    .map((v) => ({ ...v, event_count: countMap.get(v.id) || 0 }))
    .sort((a, b) => b.event_count - a.event_count || a.name.localeCompare(b.name));
}

async function getNeighborhoodEventCounts(placeIds: number[]): Promise<{ todayCount: number; upcomingCount: number }> {
  const today = getLocalDateString();
  if (placeIds.length === 0) return { todayCount: 0, upcomingCount: 0 };

  // Count all upcoming events (not limited)
  const { count: upcomingCount } = await supabase
    .from("events")
    .select("id", { count: "exact", head: true })
    .in("place_id", placeIds)
    .eq("is_active", true)
    .is("canonical_event_id", null)
    .gte("start_date", today)
    .or("is_sensitive.eq.false,is_sensitive.is.null");

  // Count today's events
  const { count: todayCount } = await supabase
    .from("events")
    .select("id", { count: "exact", head: true })
    .in("place_id", placeIds)
    .eq("is_active", true)
    .is("canonical_event_id", null)
    .eq("start_date", today)
    .or("is_sensitive.eq.false,is_sensitive.is.null");

  return { todayCount: todayCount ?? 0, upcomingCount: upcomingCount ?? 0 };
}

async function getNeighborhoodEvents(placeIds: number[]): Promise<Event[]> {
  const today = getLocalDateString();
  if (placeIds.length === 0) return [];

  const { data, error } = await supabase
    .from("events")
    .select(`
      *,
      venue:places!inner(id, name, slug, address, neighborhood, city, state),
      series:series(id, slug, title, series_type, image_url)
    `)
    .in("place_id", placeIds)
    .eq("is_active", true)
    .is("canonical_event_id", null)
    .gte("start_date", today)
    .or("is_sensitive.eq.false,is_sensitive.is.null")
    .order("start_date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(20);

  if (error || !data) return [];
  return data as Event[];
}

/** Split a time string into display parts for the time column. */
function formatTimeParts(time: string | null, isAllDay?: boolean): { main: string; period: string } | null {
  if (isAllDay) return { main: "ALL", period: "DAY" };
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hr = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const main = m === 0 ? `${hr}:00` : `${hr}:${m.toString().padStart(2, "0")}`;
  return { main, period };
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

export default async function NeighborhoodPage({ params }: Props) {
  const { portal, slug } = await params;
  const neighborhood = getNeighborhoodById(slug);

  if (!neighborhood) {
    notFound();
  }

  const spots = await getNeighborhoodSpots(neighborhood.name);
  const placeIds = spots.map((s) => s.id);

  const [events, eventCounts] = await Promise.all([
    getNeighborhoodEvents(placeIds),
    getNeighborhoodEventCounts(placeIds),
  ]);

  const description = getNeighborhoodDescription(slug);
  const related = getRelatedNeighborhoods(neighborhood);

  // Neighborhood color for visual continuity with map + drill-down
  const color = getNeighborhoodColor(neighborhood.name);
  const { r, g, b } = hexToRgb(color);
  const rgb = `${r}, ${g}, ${b}`;

  // Derive top categories from events
  const catCounts: Record<string, number> = {};
  for (const ev of events) {
    const cat = (ev as Event & { category_id?: string | null }).category_id;
    if (cat && !NOISE_CATEGORIES.has(cat)) {
      catCounts[cat] = (catCounts[cat] ?? 0) + 1;
    }
  }
  const topCats = Object.entries(catCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([c]) => c);

  // Real counts from separate query (not capped by display limit)
  const { todayCount, upcomingCount } = eventCounts;

  // Top spots for display (full list available via "See all")
  const displaySpots = spots.slice(0, 10);

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
      <nav aria-label="Breadcrumb" className="pt-4 pb-2">
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

      {/* Hero — color-accented, matching drill-down */}
      <section className="pt-4 pb-6">
        <div className="flex items-start gap-4">
          {/* Color accent bar — threads from map drill-down */}
          <div
            className="w-1.5 self-stretch rounded-sm flex-shrink-0 mt-1"
            style={{ backgroundColor: color }}
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold uppercase tracking-wide text-[var(--cream)] leading-tight">
              {neighborhood.name}
            </h1>
            {description && (
              <p className="mt-2 text-sm text-[var(--soft)] leading-relaxed max-w-2xl">
                {description}
              </p>
            )}
          </div>
        </div>

        {/* Activity strip — mirrors drill-down stats */}
        <div className="flex items-center gap-3 mt-4">
          {todayCount > 0 && (
            <div className="flex items-center gap-1.5">
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: "var(--coral)" }}
              />
              <span className="text-xs font-semibold" style={{ color: "var(--coral)" }}>
                {todayCount} {todayCount === 1 ? "event" : "events"} today
              </span>
            </div>
          )}
          <span className="text-2xs text-[var(--muted)]">
            {spots.length} {spots.length === 1 ? "spot" : "spots"}
          </span>
        </div>

        {/* Vibe pills — neighborhood-colored, matching drill-down */}
        {topCats.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-3">
            {topCats.map((cat) => (
              <span
                key={cat}
                className="inline-flex items-center gap-1 text-2xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
                style={{
                  backgroundColor: `rgba(${rgb}, 0.08)`,
                  border: `1px solid rgba(${rgb}, 0.20)`,
                  color: color,
                }}
              >
                <CategoryIcon type={cat} size={12} glow="none" />
                {formatCategoryLabel(cat)}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Divider — color-tinted */}
      <div
        className="h-px mb-6"
        style={{ background: `linear-gradient(to right, rgba(${rgb}, 0.30), transparent)` }}
      />

      {/* Upcoming Events — drill-down-style rows for visual continuity */}
      {events.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <span
              className="font-mono text-xs font-bold tracking-[0.12em] uppercase"
              style={{ color: color }}
            >
              Upcoming Events
            </span>
            <Link
              href={`/${portal}/find?neighborhood=${encodeURIComponent(neighborhood.name)}`}
              className="text-xs font-medium transition-opacity hover:opacity-70"
              style={{ color: color }}
            >
              See all →
            </Link>
          </div>
          <ul className="divide-y divide-[var(--twilight)]/50">
            {events.map((ev) => {
              const smartDate = formatSmartDate(ev.start_date);
              const timeParts = formatTimeParts(ev.start_time, ev.is_all_day);
              const category = (ev as Event & { category_id?: string | null }).category_id;
              return (
              <li key={ev.id}>
                <Link
                  href={`/${portal}/events/${ev.id}`}
                  className="flex items-stretch gap-2.5 py-3 group"
                >
                  {/* Time column — prominent, right-aligned */}
                  <div className="w-14 flex-shrink-0 flex flex-col items-end justify-center">
                    {timeParts ? (
                      <>
                        <span className="font-mono text-base font-bold text-[var(--cream)] leading-none tabular-nums">
                          {timeParts.main}
                        </span>
                        <span className="font-mono text-2xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
                          {timeParts.period}
                        </span>
                      </>
                    ) : (
                      <span className="font-mono text-2xs text-[var(--muted)]">TBD</span>
                    )}
                  </div>
                  {/* Accent bar */}
                  <div
                    className="w-1 self-stretch rounded-sm flex-shrink-0 opacity-70 group-hover:opacity-100 transition-opacity"
                    style={{ backgroundColor: color }}
                  />
                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {category && (
                        <CategoryIcon type={category} size={14} glow="none" />
                      )}
                      <p className="text-sm font-medium text-[var(--cream)] leading-snug group-hover:text-white transition-colors line-clamp-1">
                        {decodeHtmlEntities(ev.title)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        className="text-2xs font-mono font-medium flex-shrink-0 px-1.5 py-0.5 rounded"
                        style={smartDate.isHighlight
                          ? { backgroundColor: `rgba(${rgb}, 0.12)`, color: color }
                          : { color: "var(--muted)" }
                        }
                      >
                        {smartDate.label}
                      </span>
                      {(ev as Event & { venue?: { name: string } | null }).venue && (
                        <>
                          <Dot />
                          <span className="text-xs text-[var(--muted)] truncate">
                            {(ev as Event & { venue: { name: string } }).venue.name}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <span
                    className="text-sm flex-shrink-0 self-center opacity-40 group-hover:opacity-100 transition-opacity"
                    style={{ color: color }}
                  >
                    →
                  </span>
                </Link>
              </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Popular Spots — top 10 by event count */}
      {displaySpots.length > 0 && (
        <section className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <span
              className="font-mono text-xs font-bold tracking-[0.12em] uppercase"
              style={{ color: color }}
            >
              Popular Spots
            </span>
            <Link
              href={`/${portal}/find?neighborhood=${encodeURIComponent(neighborhood.name)}&view=places`}
              className="text-xs font-medium transition-opacity hover:opacity-70"
              style={{ color: color }}
            >
              {spots.length > displaySpots.length ? `All ${spots.length}` : "See all"} →
            </Link>
          </div>
          <div className="space-y-1">
            {spots.map((spot, i) => (
              <PlaceCard
                key={spot.id}
                venue={spot}
                index={i}
                portalSlug={portal}
                variant="compact"
                hideNeighborhood
              />
            ))}
          </div>
        </section>
      )}

      {/* Explore Nearby — color-tinted cards */}
      {related.length > 0 && (
        <section className="mt-8">
          <span className="font-mono text-xs font-bold tracking-[0.12em] uppercase text-[var(--muted)] mb-3 block">
            Explore Nearby
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {related.map((n) => {
              const nColor = getNeighborhoodColor(n.name);
              const nRgb = hexToRgb(nColor);
              const nDesc = getNeighborhoodDescription(n.id);
              return (
                <Link
                  key={n.id}
                  href={`/${portal}/neighborhoods/${n.id}`}
                  className="p-3 rounded-xl border transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    backgroundColor: `rgba(${nRgb.r}, ${nRgb.g}, ${nRgb.b}, 0.05)`,
                    borderColor: `rgba(${nRgb.r}, ${nRgb.g}, ${nRgb.b}, 0.15)`,
                  }}
                >
                  <div className="text-sm font-semibold text-[var(--cream)] truncate">
                    {n.name}
                  </div>
                  {nDesc && (
                    <div className="text-2xs text-[var(--muted)] mt-0.5 line-clamp-1">
                      {nDesc}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Empty state */}
      {events.length === 0 && spots.length === 0 && (
        <div className="py-16 text-center space-y-3">
          <p className="font-mono text-sm text-[var(--muted)]">
            No spots or events in {neighborhood.name} yet.
          </p>
          <Link
            href={`/${portal}/neighborhoods`}
            className="inline-block font-mono text-xs transition-opacity hover:opacity-80"
            style={{ color: color }}
          >
            ← All neighborhoods
          </Link>
        </div>
      )}
    </div>
  );
}
