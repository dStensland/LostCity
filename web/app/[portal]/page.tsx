import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { FeedSurface } from "./_surfaces/feed/FeedSurface";
import { buildSavedUrl } from "@/lib/find-url";
import { resolvePortalRequest } from "@/lib/portal-runtime/resolvePortalRequest";
import {
  isLegacyExploreRequest,
  toCanonicalExploreUrl,
} from "@/lib/normalize-find-url";

export const revalidate = 300;

type PortalSearchParams = {
  q?: string;
  search?: string;
  categories?: string;
  subcategories?: string;
  genres?: string;
  tags?: string;
  vibes?: string;
  neighborhoods?: string;
  price?: string;
  free?: string;
  open_now?: string;
  with_events?: string;
  price_level?: string;
  venue_type?: string;
  venue_types?: string;
  neighborhood?: string;
  cuisine?: string;
  label?: string;
  occasion?: string;
  activity?: string;
  weekday?: string;
  theater?: string;
  class_category?: string;
  class_date?: string;
  class_skill?: string;
  skill_level?: string;
  start_date?: string;
  end_date?: string;
  date?: string;
  view?: string;
  tab?: string;
  type?: string;
  display?: string;
  mood?: string;
  mode?: string;
  persona?: string;
  support?: string;
  content?: string;
  event?: string;
  spot?: string;
  series?: string;
  festival?: string;
  org?: string;
  pillar?: string;
  from?: string;
  lane?: string;
};

type Props = {
  params: Promise<{ portal: string }>;
  searchParams: Promise<PortalSearchParams>;
};

function hasLegacyDetailParams(searchParams: PortalSearchParams): boolean {
  return Boolean(
    searchParams.event ||
      searchParams.spot ||
      searchParams.series ||
      searchParams.festival ||
      searchParams.org,
  );
}

export default async function PortalPage({ params, searchParams }: Props) {
  const { portal: slug } = await params;
  const searchParamsData = await searchParams;
  const rawParams = new URLSearchParams(
    Object.entries(searchParamsData)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, value as string]),
  );
  const headersList = await headers();
  const request = await resolvePortalRequest({
    slug,
    headersList,
    pathname: `/${slug}`,
    searchParams: rawParams,
    surface: "feed",
  });

  if (!request) {
    notFound();
  }

  if (searchParamsData.view === "community") {
    if (request.isDog) {
      redirect(buildSavedUrl({ portalSlug: request.portal.slug }));
    }
    redirect("/your-people");
  }

  if (isLegacyExploreRequest(rawParams) && !hasLegacyDetailParams(searchParamsData)) {
    redirect(toCanonicalExploreUrl(request.portal.slug, rawParams));
  }

  return <FeedSurface request={request} searchParams={searchParamsData} />;
}
