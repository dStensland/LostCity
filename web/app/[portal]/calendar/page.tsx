import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { PortalHeader } from "@/components/headers";
import { getCachedPortalBySlug, getPortalVertical } from "@/lib/portal";
import FilmPortalNav from "../_components/film/FilmPortalNav";
import FilmShowtimeBoard from "../_components/film/FilmShowtimeBoard";

type Props = {
  params: Promise<{ portal: string }>;
};

export default async function FilmCalendarPage({ params }: Props) {
  const { portal: slug } = await params;
  const portal = await getCachedPortalBySlug(slug);

  if (!portal) {
    notFound();
  }

  if (getPortalVertical(portal) !== "film") {
    redirect(`/${portal.slug}?view=find&type=events&display=calendar`);
  }

  return (
    <div className="min-h-screen bg-[#090d16] text-[#f6f7fb]">
      <PortalHeader portalSlug={portal.slug} portalName={portal.name} backLink={{ label: "Home", fallbackHref: `/${portal.slug}` }} hideNav />
      <main className="mx-auto max-w-[1500px] px-4 pb-16 pt-6 space-y-6">
        <FilmPortalNav portalSlug={portal.slug} />
        <header>
          <p className="text-[0.64rem] uppercase tracking-[0.18em] text-[#8fa2c4]">Atlanta Film</p>
          <h1 className="mt-1 font-[var(--font-film-editorial)] text-4xl text-[#f7f7fb]">Calendar</h1>
          <p className="mt-2 text-sm text-[#b8c7e3]">Date-first exploration of upcoming screenings, programs, and film events.</p>
        </header>

        <FilmShowtimeBoard portalSlug={portal.slug} mode="by-film" />

        <Link
          href={`/${portal.slug}?view=find&type=events&display=calendar&categories=film`}
          className="inline-flex items-center gap-2 rounded-xl border border-[#8da8ea66] bg-[#121b2f] px-4 py-2 text-xs uppercase tracking-[0.13em] text-[#d9e4ff] hover:border-[#8da8ea]"
        >
          Open Full Event Calendar
          <ArrowRight size={12} />
        </Link>
      </main>
    </div>
  );
}
