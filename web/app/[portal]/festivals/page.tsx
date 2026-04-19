import type { Metadata } from "next";
import { loadBigStuffForPage } from "@/lib/city-pulse/loaders/load-big-stuff-page";
import BigStuffPage from "@/components/festivals/BigStuffPage";
import { resolveFeedPageRequest } from "../_surfaces/feed/resolve-feed-page-request";
import FilmPortalNav from "../_components/film/FilmPortalNav";

export const revalidate = 300;

type Props = { params: Promise<{ portal: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { portal: portalSlug } = await params;
  const request = await resolveFeedPageRequest({
    portalSlug,
    pathname: `/${portalSlug}/festivals`,
  });
  const portalName = request?.portal.name || "Lost City";
  return {
    title: `The Big Stuff | ${portalName}`,
    description: `Festivals, tentpole events, and season-defining moments coming up in ${portalName}. Mark your calendar.`,
  };
}

export default async function BigStuffSeeAllPage({ params }: Props) {
  const { portal: portalSlug } = await params;
  const request = await resolveFeedPageRequest({
    portalSlug,
    pathname: `/${portalSlug}/festivals`,
  });
  const portal = request?.portal ?? null;
  const portalName = portal?.name || portalSlug;
  const isFilmPortal = request?.isFilm ?? false;

  const data = await loadBigStuffForPage({
    portalId: portal?.id ?? "",
    portalSlug: portal?.slug ?? portalSlug,
    isLightTheme: false,
  });

  return (
    <div className="min-h-screen">
      {isFilmPortal && <FilmPortalNav portalSlug={portal?.slug ?? portalSlug} />}
      <BigStuffPage portalSlug={portal?.slug ?? portalSlug} portalName={portalName} data={data} />
    </div>
  );
}
