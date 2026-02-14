import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { PortalHeader } from "@/components/headers";
import { getCachedPortalBySlug, getPortalVertical } from "@/lib/portal";
import FilmPortalNav from "../_components/film/FilmPortalNav";
import FilmShowtimeBoard from "../_components/film/FilmShowtimeBoard";

type Props = {
  params: Promise<{ portal: string }>;
};

export default async function FilmShowtimesPage({ params }: Props) {
  const { portal: slug } = await params;
  const portal = await getCachedPortalBySlug(slug);

  if (!portal || getPortalVertical(portal) !== "film") {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[#090d16] text-[#f6f7fb]">
      <PortalHeader portalSlug={portal.slug} portalName={portal.name} backLink={{ label: "Home", fallbackHref: `/${portal.slug}` }} hideNav />
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 space-y-7">
        <FilmPortalNav portalSlug={portal.slug} />
        <header className="space-y-2">
          <p className="text-[0.64rem] uppercase tracking-[0.18em] text-[#8fa2c4]">Atlanta Film</p>
          <h1 className="mt-1 font-[var(--font-film-editorial)] text-4xl text-[#f7f7fb]">Showtimes</h1>
          <p className="mt-2 max-w-3xl text-sm text-[#b8c7e3]">
            Full schedule by film and by venue. Use this page when you are planning the week, then jump straight to calendar or venue deep dives.
          </p>
        </header>

        <section className="space-y-4">
          <header className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-[var(--font-film-editorial)] text-2xl text-[#f7f7fb]">By Film</h2>
            <Link href={`/${portal.slug}/calendar`} className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.14em] text-[#c9d9ff] hover:text-[#e1eaff]">
              Open calendar
              <ArrowRight size={12} />
            </Link>
          </header>
          <FilmShowtimeBoard portalSlug={portal.slug} mode="by-film" />
        </section>

        <section className="space-y-4">
          <header className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-[var(--font-film-editorial)] text-2xl text-[#f7f7fb]">By Venue</h2>
            <Link href={`/${portal.slug}/venues`} className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.14em] text-[#c9d9ff] hover:text-[#e1eaff]">
              Open venue page
              <ArrowRight size={12} />
            </Link>
          </header>
          <FilmShowtimeBoard portalSlug={portal.slug} mode="by-theater" hideDateRail />
        </section>
      </main>
    </div>
  );
}
