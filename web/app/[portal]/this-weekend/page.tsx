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
  const title = `This Weekend in ${cityName} — Events & Things to Do | Lost City`;
  const description = `Weekend events in ${cityName}. Concerts, festivals, food, nightlife, and things to do this Saturday and Sunday.`;

  return {
    title,
    description,
    alternates: { canonical: `/${portal.slug}/this-weekend` },
    openGraph: { title, description, type: "website" },
  };
}

export default async function ThisWeekendPage({ params }: Props) {
  const { portal: portalSlug } = await params;
  const portal = await getCachedPortalBySlug(portalSlug);
  if (!portal) notFound();

  const sourceAccess = await getPortalSourceAccess(portal.id);

  const { events: rawEvents } = await getFilteredEventsWithCursor(
    {
      date_filter: "weekend",
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
      title={`This Weekend in ${cityName}`}
      description={`Concerts, festivals, food, nightlife, and things to do this weekend in ${cityName}.`}
      portalSlug={portal.slug}
      portalName={cityName}
      canonicalPath={`/${portal.slug}/this-weekend`}
      findHref={`/${portal.slug}?view=find&lane=events&date=weekend`}
      breadcrumbLabel="This Weekend"
      events={events}
    />
  );
}
