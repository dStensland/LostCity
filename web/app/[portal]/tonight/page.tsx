import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCachedPortalBySlug } from "@/lib/portal";
import { getFilteredEventsWithCursor } from "@/lib/search";
import { getPortalSourceAccess } from "@/lib/federation";
import { filterByPortalCity } from "@/lib/portal-scope";
import EventListingPage from "@/components/seo/EventListingPage";

export const revalidate = 300;

type Props = {
  params: Promise<{ portal: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { portal: portalSlug } = await params;
  const portal = await getCachedPortalBySlug(portalSlug);
  if (!portal) return {};

  const cityName = portal.name;
  const title = `${cityName} Tonight — Events Happening Now | Lost City`;
  const description = `What's happening in ${cityName} tonight. Live events, concerts, shows, and things to do right now.`;

  return {
    title,
    description,
    alternates: { canonical: `/${portal.slug}/tonight` },
    openGraph: { title, description, type: "website" },
  };
}

export default async function TonightPage({ params }: Props) {
  const { portal: portalSlug } = await params;
  const portal = await getCachedPortalBySlug(portalSlug);
  if (!portal) notFound();

  const sourceAccess = await getPortalSourceAccess(portal.id);

  const { events: rawEvents } = await getFilteredEventsWithCursor(
    {
      date_filter: "today",
      portal_id: portal.id,
      source_ids: sourceAccess.sourceIds,
      exclude_classes: true,
    },
    null,
    50
  );

  const portalCity = portal.filters?.city;
  const events = filterByPortalCity(rawEvents, portalCity);

  const cityName = portal.name;

  return (
    <EventListingPage
      title={`${cityName} Tonight`}
      description={`Live events, concerts, shows, and things to do in ${cityName} tonight.`}
      portalSlug={portal.slug}
      portalName={cityName}
      canonicalPath={`/${portal.slug}/tonight`}
      findHref={`/${portal.slug}?view=find&lane=events&date=today`}
      breadcrumbLabel="Tonight"
      events={events}
    />
  );
}
