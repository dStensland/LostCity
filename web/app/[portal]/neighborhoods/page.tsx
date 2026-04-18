import { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildNeighborhoodIndexSections } from "@/lib/neighborhood-index";
import { toAbsoluteUrl } from "@/lib/site-url";
import NeighborhoodsPageClient from "@/components/neighborhoods/NeighborhoodsPageClient";
import NeighborhoodIndexCard from "@/components/neighborhoods/NeighborhoodIndexCard";
import { getNeighborhoodColor } from "@/lib/neighborhood-colors";
import {
  getNeighborhoodsActivity,
  getVenueCountsByNeighborhood,
} from "@/lib/neighborhoods/loaders";
import { resolveFeedPageRequest } from "../_surfaces/feed/resolve-feed-page-request";

export const revalidate = 300;

type Props = {
  params: Promise<{ portal: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { portal } = await params;
  return {
    title: "Neighborhoods — Atlanta Events & Places | Lost City",
    description:
      "Explore Atlanta neighborhoods and find events, places, and things to do across the city.",
    alternates: {
      canonical: toAbsoluteUrl(`/${portal}/neighborhoods`),
    },
  };
}

export default async function NeighborhoodsIndexPage({ params }: Props) {
  const { portal: portalSlug } = await params;
  const request = await resolveFeedPageRequest({
    portalSlug,
    pathname: `/${portalSlug}/neighborhoods`,
  });
  const portal = request?.portal;
  if (!portal) {
    notFound();
  }

  const [counts, activityData] = await Promise.all([
    getVenueCountsByNeighborhood(),
    getNeighborhoodsActivity(portal.id),
  ]);
  const sections = buildNeighborhoodIndexSections(counts);

  const activityBySlug = new Map(activityData.map((a) => [a.slug, a]));

  // Counts for the editorial overlay rendered atop the map.
  const tonightNeighborhoodCount = activityData.filter(
    (a) => a.eventsTodayCount > 0,
  ).length;
  const weekNeighborhoodCount = activityData.filter(
    (a) => a.eventsWeekCount > 0,
  ).length;

  return (
    <div className="max-w-6xl mx-auto px-4 pb-20">
      <section className="py-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--cream)]">
          Neighborhoods
        </h1>
        <p className="text-sm text-[var(--soft)] mt-2 max-w-xl">
          Atlanta, block by block — what&apos;s alive tonight and across the week.
        </p>
      </section>

      {/* Interactive map hero with editorial overlay */}
      {activityData.length > 0 && (
        <section className="mb-8">
          <NeighborhoodsPageClient
            activityData={activityData}
            portalSlug={portal.slug}
            tonightNeighborhoodCount={tonightNeighborhoodCount}
            weekNeighborhoodCount={weekNeighborhoodCount}
          />
        </section>
      )}

      {/* Tiered grid — uniform density across tiers per plan revision */}
      {sections.map((section) => (
        <section key={section.title} className="mb-8">
          <div className="flex items-center gap-3 py-3 border-t border-[var(--twilight)]">
            <h2 className="font-mono text-xs uppercase tracking-[0.12em] font-bold text-[var(--muted)]">
              {section.title}
            </h2>
            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-2xs font-mono bg-[var(--twilight)] text-[var(--soft)] tabular-nums">
              {section.neighborhoods.length}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {section.neighborhoods.map(({ neighborhood, count }) => {
              const activity = activityBySlug.get(neighborhood.id);
              return (
                <NeighborhoodIndexCard
                  key={neighborhood.id}
                  name={neighborhood.name}
                  slug={neighborhood.id}
                  portalSlug={portal.slug}
                  color={getNeighborhoodColor(neighborhood.name)}
                  eventsTodayCount={activity?.eventsTodayCount ?? 0}
                  eventsWeekCount={activity?.eventsWeekCount ?? 0}
                  venueCount={activity?.venueCount ?? count}
                />
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
