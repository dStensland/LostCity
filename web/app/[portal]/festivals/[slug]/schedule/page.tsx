import Link from "next/link";
import { notFound } from "next/navigation";
import ScrollToTop from "@/components/ScrollToTop";
import { PortalHeader } from "@/components/headers";
import FestivalSchedule from "@/components/FestivalSchedule";
import { getCachedPortalBySlug } from "@/lib/portal";
import {
  getFestivalBySlug,
  getFestivalPrograms,
  getFestivalEvents,
} from "@/lib/festivals";

export const revalidate = 300;

type Props = {
  params: Promise<{ portal: string; slug: string }>;
};

export default async function FestivalSchedulePage({ params }: Props) {
  const { slug, portal: portalSlug } = await params;
  const [festival, portal] = await Promise.all([
    getFestivalBySlug(slug),
    getCachedPortalBySlug(portalSlug),
  ]);

  if (!festival) {
    notFound();
  }

  const activePortalSlug = portal?.slug || portalSlug;
  const activePortalName = portal?.name || portalSlug.charAt(0).toUpperCase() + portalSlug.slice(1);

  const [programs, sessions] = await Promise.all([
    getFestivalPrograms(festival.id),
    getFestivalEvents(festival.id),
  ]);

  const primaryActionUrl = festival.ticket_url || festival.website || undefined;
  const primaryActionLabel = festival.ticket_url ? "Get Tickets" : "Visit Website";

  return (
    <div className="min-h-screen">
      <ScrollToTop />
      <PortalHeader portalSlug={activePortalSlug} portalName={activePortalName} hideNav />

      <main className="max-w-3xl mx-auto px-4 py-4 sm:py-6 pb-12 space-y-5 sm:space-y-7">
        <section className="rounded-lg border border-[var(--twilight)] bg-[var(--card-bg)] p-4 sm:p-5">
          <p className="text-[0.65rem] font-mono uppercase tracking-widest text-[var(--muted)] mb-2">
            Dedicated Schedule
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-[var(--cream)]">
                {festival.name}
              </h1>
              <p className="text-sm text-[var(--soft)] mt-1">
                Full program schedule with day, venue, category, and program filters.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/${activePortalSlug}/festivals/${festival.slug}`}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--twilight)] text-sm text-[var(--soft)] hover:text-[var(--cream)] hover:border-[var(--soft)] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Festival Page
              </Link>
              {primaryActionUrl && (
                <a
                  href={primaryActionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--coral)] text-white text-sm font-medium hover:bg-[var(--rose)] transition-colors"
                >
                  {primaryActionLabel}
                </a>
              )}
            </div>
          </div>
        </section>

        {sessions.length > 0 ? (
          <FestivalSchedule
            sessions={sessions}
            programs={programs}
            portalSlug={activePortalSlug}
            previewLimit={0}
            prefetchLimit={16}
          />
        ) : (
          <section className="rounded-lg border border-[var(--twilight)] bg-[var(--card-bg)] p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-[var(--cream)] mb-2">Schedule Coming Soon</h2>
            <p className="text-sm text-[var(--soft)] leading-relaxed">
              Session times have not been published yet for this festival.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
