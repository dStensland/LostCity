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
    pathname: `/${portalSlug}/tonight`,
  });
  if (!request) return {};

  const cityName = request.portal.name;
  const title = `${cityName} Tonight — Events Happening Now | Lost City`;
  const description = `What's happening in ${cityName} tonight. Live events, concerts, shows, and things to do right now.`;

  return {
    title,
    description,
    alternates: { canonical: `/${request.portal.slug}/tonight` },
    openGraph: { title, description, type: "website" },
  };
}

export default async function TonightPage({ params }: Props) {
  const { portal: portalSlug } = await params;
  const request = await resolveFeedPageRequest({
    portalSlug,
    pathname: `/${portalSlug}/tonight`,
  });
  if (!request) notFound();

  const sourceAccess = await getPortalSourceAccess(request.portal.id);

  const { events: rawEvents } = await getFilteredEventsWithCursor(
    {
      date_filter: "today",
      portal_id: request.portal.id,
      source_ids: sourceAccess.sourceIds,
      exclude_classes: true,
    },
    null,
    50
  );

  const portalCity = request.portal.filters?.city;
  const events = filterByPortalCity(rawEvents, portalCity);

  const cityName = request.portal.name;

  return (
    <EventListingPage
      title={`${cityName} Tonight`}
      description={`Live events, concerts, shows, and things to do in ${cityName} tonight.`}
      portalSlug={request.portal.slug}
      portalName={cityName}
      canonicalPath={`/${request.portal.slug}/tonight`}
      findHref={buildExploreUrl({ portalSlug: request.portal.slug, lane: "events", date: "today" })}
      breadcrumbLabel="Tonight"
      events={events}
    />
  );
}
