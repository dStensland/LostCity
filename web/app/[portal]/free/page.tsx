import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getFilteredEventsWithCursor } from "@/lib/search";
import { getPortalSourceAccess } from "@/lib/federation";
import { filterByPortalCity } from "@/lib/portal-scope";
import EventListingPage from "@/components/seo/EventListingPage";
import { buildExploreUrl } from "@/lib/find-url";
import { resolveFeedPageRequest } from "../_surfaces/feed/resolve-feed-page-request";

export const revalidate = 300;

type Props = {
  params: Promise<{ portal: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { portal: portalSlug } = await params;
  const request = await resolveFeedPageRequest({
    portalSlug,
    pathname: `/${portalSlug}/free`,
  });
  if (!request) return {};

  const cityName = request.portal.name;
  const title = `Free Events in ${cityName} — No Cover, No Ticket | Lost City`;
  const description = `Free things to do in ${cityName}. No-cover concerts, free festivals, community events, and more.`;

  return {
    title,
    description,
    alternates: { canonical: `/${request.portal.slug}/free` },
    openGraph: { title, description, type: "website" },
  };
}

export default async function FreePage({ params }: Props) {
  const { portal: portalSlug } = await params;
  const request = await resolveFeedPageRequest({
    portalSlug,
    pathname: `/${portalSlug}/free`,
  });
  if (!request) notFound();

  const sourceAccess = await getPortalSourceAccess(request.portal.id);

  // Floor start_date to 7 days ago to exclude stale multi-day events
  // with absurdly long date ranges (e.g., start_date 7 months ago)
  const floorDate = new Date();
  floorDate.setDate(floorDate.getDate() - 7);
  const dateFloor = floorDate.toISOString().slice(0, 10);

  const { events: rawEvents } = await getFilteredEventsWithCursor(
    {
      is_free: true,
      portal_id: request.portal.id,
      source_ids: sourceAccess.sourceIds,
      exclude_classes: true,
      date_range_start: dateFloor,
    },
    null,
    50
  );

  const portalCity = request.portal.filters?.city;
  const events = filterByPortalCity(rawEvents, portalCity);

  const cityName = request.portal.name;

  return (
    <EventListingPage
      title={`Free Events in ${cityName}`}
      description={`Free things to do in ${cityName}. No-cover concerts, free festivals, community events, and more.`}
      portalSlug={request.portal.slug}
      portalName={cityName}
      canonicalPath={`/${request.portal.slug}/free`}
      findHref={buildExploreUrl({ portalSlug: request.portal.slug, lane: "events", price: "free" })}
      breadcrumbLabel="Free Events"
      events={events}
    />
  );
}
