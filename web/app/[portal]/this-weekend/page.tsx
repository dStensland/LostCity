import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getFilteredEventsWithCursor } from "@/lib/event-search";
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
    pathname: `/${portalSlug}/this-weekend`,
  });
  if (!request) return {};

  const cityName = request.portal.name;
  const title = `This Weekend in ${cityName} — Events & Things to Do | Lost City`;
  const description = `Weekend events in ${cityName}. Concerts, festivals, food, nightlife, and things to do this Saturday and Sunday.`;

  return {
    title,
    description,
    alternates: { canonical: `/${request.portal.slug}/this-weekend` },
    openGraph: { title, description, type: "website" },
  };
}

export default async function ThisWeekendPage({ params }: Props) {
  const { portal: portalSlug } = await params;
  const request = await resolveFeedPageRequest({
    portalSlug,
    pathname: `/${portalSlug}/this-weekend`,
  });
  if (!request) notFound();

  const sourceAccess = await getPortalSourceAccess(request.portal.id);

  const { events: rawEvents } = await getFilteredEventsWithCursor(
    {
      date_filter: "weekend",
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
      title={`This Weekend in ${cityName}`}
      description={`Concerts, festivals, food, nightlife, and things to do this weekend in ${cityName}.`}
      portalSlug={request.portal.slug}
      portalName={cityName}
      canonicalPath={`/${request.portal.slug}/this-weekend`}
      findHref={buildExploreUrl({ portalSlug: request.portal.slug, lane: "events", date: "weekend" })}
      breadcrumbLabel="This Weekend"
      events={events}
    />
  );
}
