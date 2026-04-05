import { notFound } from "next/navigation";
import FilmPortalNav from "../_components/film/FilmPortalNav";
import CalendarView from "@/components/CalendarView";
import { resolveFilmPageRequest } from "../_surfaces/detail/resolve-film-page-request";

type Props = {
  params: Promise<{ portal: string }>;
};

export const revalidate = 120;

export default async function FilmCalendarPage({ params }: Props) {
  const { portal: slug } = await params;
  const request = await resolveFilmPageRequest({
    portalSlug: slug,
    pathname: `/${slug}/calendar`,
  });

  if (!request) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[#090d16] text-[#f6f7fb]">
      <main className="mx-auto max-w-[1500px] px-4 pb-16 pt-6 space-y-6">
        <FilmPortalNav portalSlug={request.portal.slug} />
        <header>
          <p className="text-xs uppercase tracking-[0.18em] text-[#8fa2c4]">Atlanta Film</p>
          <h1 className="mt-1 font-[var(--font-film-editorial)] text-4xl text-[#f7f7fb]">Calendar</h1>
          <p className="mt-2 text-sm text-[#b8c7e3]">Full month view of upcoming screenings, programs, and film events.</p>
        </header>

        <CalendarView portalId={request.portal.id} portalSlug={request.portal.slug} />
      </main>
    </div>
  );
}
