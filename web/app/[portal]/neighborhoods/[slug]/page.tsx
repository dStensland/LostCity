import { notFound } from "next/navigation";
import { Metadata } from "next";
import Link from "next/link";
import {
  getNeighborhoodById,
  getNeighborhoodDescription,
  getNeighborhoodsByTier,
  type Neighborhood,
} from "@/config/neighborhoods";
import type { Event } from "@/lib/supabase";
import { safeJsonLd } from "@/lib/formats";
import { toAbsoluteUrl } from "@/lib/site-url";
import { getNeighborhoodColor } from "@/lib/neighborhood-colors";
import { buildExploreUrl } from "@/lib/find-url";
import PlaceCard from "@/components/PlaceCard";
import NeighborhoodDetailTabs, {
  type NeighborhoodDetailTab,
} from "@/components/neighborhoods/NeighborhoodDetailTabs";
import ScheduleRow, {
  type ScheduleRowEvent,
} from "@/components/shared/ScheduleRow";
import { getNeighborhoodHeroStyle } from "@/components/neighborhoods/NeighborhoodHeroStyle";
import {
  getNeighborhoodEvents,
  getNeighborhoodEventCounts,
  getNeighborhoodSpots,
} from "@/lib/neighborhoods/loaders";
import { bucketEvents } from "@/lib/neighborhoods/bucket-events";
import { resolveFeedPageRequest } from "../../_surfaces/feed/resolve-feed-page-request";

export const revalidate = 300;

const PORTAL_TZ = "America/New_York";

type Props = {
  params: Promise<{ portal: string; slug: string }>;
  searchParams: Promise<{ tab?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { portal, slug } = await params;
  const neighborhood = getNeighborhoodById(slug);
  if (!neighborhood) return {};

  const description = getNeighborhoodDescription(slug);
  const title = `${neighborhood.name} — Events & Spots | Lost City`;

  return {
    title,
    description:
      description ||
      `Discover events, venues, and things to do in ${neighborhood.name}, Atlanta.`,
    alternates: {
      canonical: toAbsoluteUrl(`/${portal}/neighborhoods/${slug}`),
    },
  };
}

function getRelatedNeighborhoods(current: Neighborhood): Neighborhood[] {
  const allSameTier = getNeighborhoodsByTier(current.tier).filter(
    (n) => n.id !== current.id,
  );
  const withDist = allSameTier.map((n) => {
    const dLat = n.lat - current.lat;
    const dLng = n.lng - current.lng;
    return { ...n, dist: Math.sqrt(dLat * dLat + dLng * dLng) };
  });
  withDist.sort((a, b) => a.dist - b.dist);
  return withDist.slice(0, 6);
}

function toScheduleRowEvent(ev: Event): ScheduleRowEvent {
  const venue = (ev as Event & { venue?: { name: string; slug?: string } | null })
    .venue;
  return {
    id: ev.id,
    title: ev.title,
    start_date: ev.start_date,
    start_time: ev.start_time,
    is_all_day: ev.is_all_day ?? null,
    place: venue ? { name: venue.name, slug: venue.slug } : null,
    category_id:
      (ev as Event & { category_id?: string | null }).category_id ?? null,
    image_url: ev.image_url ?? null,
  };
}

export default async function NeighborhoodPage({
  params,
  searchParams,
}: Props) {
  const { portal, slug } = await params;
  const { tab: tabParam } = await searchParams;
  const neighborhood = getNeighborhoodById(slug);

  if (!neighborhood) {
    notFound();
  }

  const request = await resolveFeedPageRequest({
    portalSlug: portal,
    pathname: `/${portal}/neighborhoods/${slug}`,
  });
  const portalId = request?.portal?.id ?? null;

  const spots = await getNeighborhoodSpots(neighborhood.name);
  const placeIds = spots.map((s) => s.id);

  const [events, eventCounts] = await Promise.all([
    getNeighborhoodEvents(placeIds, portalId),
    getNeighborhoodEventCounts(placeIds, portalId),
  ]);

  const description = getNeighborhoodDescription(slug);
  const related = getRelatedNeighborhoods(neighborhood);

  const color = getNeighborhoodColor(neighborhood.name);
  const heroStyle = getNeighborhoodHeroStyle(color, neighborhood.heroImage);

  const { todayCount, upcomingCount } = eventCounts;
  const buckets = bucketEvents(events, new Date(), PORTAL_TZ);

  const initialTab: NeighborhoodDetailTab =
    tabParam === "places" ? "places" : "events";

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

  const kicker =
    todayCount > 0
      ? `${neighborhood.name.toUpperCase()} · ALIVE TONIGHT`
      : neighborhood.name.toUpperCase();

  const statsParts: string[] = [];
  if (todayCount > 0)
    statsParts.push(
      `${todayCount} ${todayCount === 1 ? "event" : "events"} tonight`,
    );
  if (upcomingCount > todayCount) statsParts.push(`${upcomingCount} this week`);
  statsParts.push(`${spots.length} ${spots.length === 1 ? "spot" : "spots"}`);

  return (
    <div className="max-w-5xl mx-auto px-4 pb-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(placeSchema) }}
      />

      <nav aria-label="Breadcrumb" className="pt-4 pb-3">
        <Link
          href={`/${portal}/explore?lane=neighborhoods`}
          className="inline-flex items-center gap-1.5 font-mono text-xs text-[var(--soft)] hover:text-[var(--cream)] transition-colors"
        >
          ← Neighborhoods
        </Link>
      </nav>

      <section
        className="relative overflow-hidden rounded-card-xl border border-[var(--twilight)] h-[280px] sm:h-[320px]"
        style={heroStyle.gradient}
      >
        {heroStyle.imageSrc && (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-80"
            style={{ backgroundImage: `url(${heroStyle.imageSrc})` }}
            aria-hidden="true"
          />
        )}
        <div
          className="absolute inset-x-0 bottom-0 h-3/5 pointer-events-none"
          style={{
            background:
              "linear-gradient(180deg, transparent 0%, rgba(9,9,11,0.75) 60%, rgba(9,9,11,0.95) 100%)",
          }}
          aria-hidden="true"
        />
        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span
              className="w-[7px] h-[7px] rounded-full flex-shrink-0"
              style={{ backgroundColor: color }}
              aria-hidden="true"
            />
            <span
              className="font-mono text-2xs font-bold uppercase tracking-[0.14em]"
              style={{ color: todayCount > 0 ? color : "var(--muted)" }}
            >
              {kicker}
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-[var(--cream)] leading-none">
            {neighborhood.name}
          </h1>
          <p className="text-sm text-[var(--soft)]">{statsParts.join(" · ")}</p>
        </div>
      </section>

      {description && (
        <p className="mt-5 text-sm text-[var(--soft)] leading-relaxed max-w-2xl">
          {description}
        </p>
      )}

      <div className="mt-7">
        <NeighborhoodDetailTabs
          initialTab={initialTab}
          accentColor={color}
          eventsCount={events.length}
          placesCount={spots.length}
          eventsContent={
            <EventsView
              buckets={buckets}
              accentColor={color}
              portalSlug={portal}
              neighborhoodName={neighborhood.name}
              totalUpcoming={upcomingCount}
            />
          }
          placesContent={
            <PlacesView
              spots={spots}
              portalSlug={portal}
              neighborhoodName={neighborhood.name}
            />
          }
        />
      </div>

      {related.length > 0 && (
        <section className="mt-10">
          <h2 className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)] mb-3">
            Nearby Neighborhoods
          </h2>
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
            {related.map((n) => {
              const nColor = getNeighborhoodColor(n.name);
              return (
                <Link
                  key={n.id}
                  href={`/${portal}/neighborhoods/${n.id}`}
                  className="flex-shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-full border border-[var(--twilight)] bg-[var(--night)] hover:border-[var(--muted)] transition-colors"
                >
                  <span
                    className="w-[7px] h-[7px] rounded-full flex-shrink-0"
                    style={{ backgroundColor: nColor }}
                    aria-hidden="true"
                  />
                  <span className="text-sm text-[var(--cream)] whitespace-nowrap">
                    {n.name}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {events.length === 0 && spots.length === 0 && (
        <div className="py-16 text-center space-y-3">
          <p className="font-mono text-sm text-[var(--muted)]">
            No spots or events in {neighborhood.name} yet.
          </p>
          <Link
            href={`/${portal}/explore?lane=neighborhoods`}
            className="inline-block font-mono text-xs text-[var(--coral)] hover:opacity-80 transition-opacity"
          >
            ← All neighborhoods
          </Link>
        </div>
      )}
    </div>
  );
}

interface EventsViewProps {
  buckets: ReturnType<typeof bucketEvents<Event>>;
  accentColor: string;
  portalSlug: string;
  neighborhoodName: string;
  totalUpcoming: number;
}

function EventsView({
  buckets,
  accentColor,
  portalSlug,
  neighborhoodName,
  totalUpcoming,
}: EventsViewProps) {
  const hasAny =
    buckets.tonight.length > 0 ||
    buckets.weekend.length > 0 ||
    buckets.nextWeek.length > 0 ||
    buckets.later.length > 0;

  if (!hasAny) {
    return (
      <p className="mt-8 text-sm text-[var(--muted)]">
        No upcoming events in {neighborhoodName}.
      </p>
    );
  }

  return (
    <div className="mt-6 space-y-8">
      <BucketSection
        label="Tonight"
        kickerColor="var(--coral)"
        count={buckets.tonight.length}
        events={buckets.tonight}
        accentColor={accentColor}
        portalSlug={portalSlug}
      />
      <BucketSection
        label="This Weekend"
        kickerColor="var(--muted)"
        count={buckets.weekend.length}
        events={buckets.weekend}
        accentColor={accentColor}
        portalSlug={portalSlug}
      />
      <BucketSection
        label="Next Week"
        kickerColor="var(--muted)"
        count={buckets.nextWeek.length}
        events={buckets.nextWeek}
        accentColor={accentColor}
        portalSlug={portalSlug}
      />
      {totalUpcoming > 20 && (
        <div className="pt-2">
          <Link
            href={`/${portalSlug}/find?neighborhood=${encodeURIComponent(neighborhoodName)}`}
            className="inline-flex items-center font-mono text-xs text-[var(--coral)] hover:opacity-80 transition-opacity"
          >
            View all {totalUpcoming} events →
          </Link>
        </div>
      )}
    </div>
  );
}

interface BucketSectionProps {
  label: string;
  kickerColor: string;
  count: number;
  events: Event[];
  accentColor: string;
  portalSlug: string;
}

function BucketSection({
  label,
  kickerColor,
  count,
  events,
  accentColor,
  portalSlug,
}: BucketSectionProps) {
  if (events.length === 0) return null;
  return (
    <section>
      <div className="flex items-center justify-between pt-3 border-t border-[var(--twilight)] mb-3">
        <div className="flex items-center gap-3">
          <span
            className="font-mono text-xs font-bold uppercase tracking-[0.14em]"
            style={{ color: kickerColor }}
          >
            {label}
          </span>
          <span className="font-mono text-2xs tabular-nums text-[var(--muted)]">
            {count}
          </span>
        </div>
      </div>
      <div className="space-y-2.5">
        {events.map((ev) => (
          <ScheduleRow
            key={ev.id}
            event={toScheduleRowEvent(ev)}
            accentColor={accentColor}
            portalSlug={portalSlug}
            context="canonical"
          />
        ))}
      </div>
    </section>
  );
}

interface PlacesViewProps {
  spots: Awaited<ReturnType<typeof getNeighborhoodSpots>>;
  portalSlug: string;
  neighborhoodName: string;
}

function PlacesView({ spots, portalSlug, neighborhoodName }: PlacesViewProps) {
  if (spots.length === 0) {
    return (
      <p className="mt-8 text-sm text-[var(--muted)]">
        No spots in {neighborhoodName} yet.
      </p>
    );
  }

  const displaySpots = spots.slice(0, 20);
  const hasMore = spots.length > displaySpots.length;

  return (
    <div className="mt-6 space-y-2">
      {displaySpots.map((spot, i) => (
        <PlaceCard
          key={spot.id}
          venue={spot}
          index={i}
          portalSlug={portalSlug}
          variant="compact"
          hideNeighborhood
        />
      ))}
      {hasMore && (
        <div className="pt-3">
          <Link
            href={buildExploreUrl({
              portalSlug,
              lane: "places",
              extraParams: { neighborhood: neighborhoodName },
            })}
            className="inline-flex items-center font-mono text-xs text-[var(--coral)] hover:opacity-80 transition-opacity"
          >
            All {spots.length} spots →
          </Link>
        </div>
      )}
    </div>
  );
}
