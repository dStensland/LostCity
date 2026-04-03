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
  const title = `Free Events in ${cityName} — No Cover, No Ticket | Lost City`;
  const description = `Free things to do in ${cityName}. No-cover concerts, free festivals, community events, and more.`;

  return {
    title,
    description,
    alternates: { canonical: `/${portal.slug}/free` },
    openGraph: { title, description, type: "website" },
  };
}

export default async function FreePage({ params }: Props) {
  const { portal: portalSlug } = await params;
  const portal = await getCachedPortalBySlug(portalSlug);
  if (!portal) notFound();

  const sourceAccess = await getPortalSourceAccess(portal.id);

  const { events: rawEvents } = await getFilteredEventsWithCursor(
    {
      is_free: true,
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
      title={`Free Events in ${cityName}`}
      description={`Free things to do in ${cityName}. No-cover concerts, free festivals, community events, and more.`}
      portalSlug={portal.slug}
      portalName={cityName}
      canonicalPath={`/${portal.slug}/free`}
      findHref={`/${portal.slug}?view=find&lane=events&price=free`}
      breadcrumbLabel="Free Events"
      events={events}
    />
  );
}
