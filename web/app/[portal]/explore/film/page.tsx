import { notFound, redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { resolvePortalRequest } from '@/lib/portal-runtime/resolvePortalRequest';
import { loadThisWeek } from '@/lib/film/this-week-loader';
import { loadTodayPlaybill } from '@/lib/film/today-playbill-loader';
import { loadDateCounts } from '@/lib/film/date-counts-loader';
import { buildEditorialSubtitle } from '@/lib/film/editorial-subtitle';
import FilmExploreShell from './_components/FilmExploreShell';

type Props = {
  params: Promise<{ portal: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const revalidate = 300;

function todayYyyymmdd(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function PortalExploreFilmPage({ params, searchParams }: Props) {
  const { portal: slug } = await params;
  const searchParamsData = await searchParams;
  const normalizedEntries = Object.entries(searchParamsData).flatMap(([key, value]) =>
    value === undefined
      ? []
      : Array.isArray(value)
        ? value.map((entry) => [key, entry])
        : [[key, value]],
  ) as string[][];
  const rawParams = new URLSearchParams(normalizedEntries);
  const headersList = await headers();
  const request = await resolvePortalRequest({
    slug,
    headersList,
    pathname: `/${slug}/explore/film`,
    searchParams: rawParams,
    surface: 'explore',
  });

  if (!request) {
    notFound();
  }

  if (request.isHotel || request.isMarketplace) {
    redirect(`/${request.portal.slug}`);
  }

  if (request.isDog) {
    const dogParams = Object.entries(searchParamsData).flatMap(([key, value]) =>
      value === undefined
        ? []
        : Array.isArray(value)
          ? value.map((entry) => [key, entry])
          : [[key, value]],
    ) as string[][];
    const paramsString = new URLSearchParams(dogParams).toString();
    redirect(`/${request.portal.slug}/map${paramsString ? `?${paramsString}` : ''}`);
  }

  const today = todayYyyymmdd();
  const to = addDays(today, 13);

  const [thisWeek, playbill, counts] = await Promise.all([
    loadThisWeek({ portalSlug: slug }),
    loadTodayPlaybill({ portalSlug: slug, date: today }),
    loadDateCounts({ portalSlug: slug, from: today, to }),
  ]);

  const editorialSubtitle = buildEditorialSubtitle(thisWeek.heroes);

  return (
    <main className="max-w-screen-xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6 pb-16 space-y-6 sm:space-y-8">
      <FilmExploreShell
        portalSlug={slug}
        today={today}
        initialDate={today}
        initialCounts={counts}
        initialThisWeek={thisWeek}
        initialPlaybill={playbill}
        editorialSubtitle={editorialSubtitle}
      />
    </main>
  );
}
