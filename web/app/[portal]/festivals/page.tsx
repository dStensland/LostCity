import { getAllFestivals, type Festival } from "@/lib/festivals";
import { getCachedPortalBySlug } from "@/lib/portal";
import UnifiedHeader from "@/components/UnifiedHeader";
import PortalFooter from "@/components/PortalFooter";
import { PortalTheme } from "@/components/PortalTheme";
import Link from "next/link";
import Image from "@/components/SmartImage";
import type { Metadata } from "next";

export const revalidate = 300;

type Props = {
  params: Promise<{ portal: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { portal: portalSlug } = await params;
  const portal = await getCachedPortalBySlug(portalSlug);
  const portalName = portal?.name || "Lost City";

  return {
    title: `Festivals | ${portalName}`,
    description: `Browse upcoming festivals and events in ${portalName}. Find lineups, schedules, and tickets.`,
  };
}

function formatFestivalDates(festival: Festival): string {
  if (festival.announced_start && festival.announced_end) {
    const start = new Date(festival.announced_start + "T00:00:00");
    const end = new Date(festival.announced_end + "T00:00:00");
    const startMonth = start.toLocaleDateString("en-US", { month: "short" });
    const endMonth = end.toLocaleDateString("en-US", { month: "short" });

    if (startMonth === endMonth) {
      return `${startMonth} ${start.getDate()}–${end.getDate()}, ${start.getFullYear()}`;
    }
    return `${startMonth} ${start.getDate()} – ${endMonth} ${end.getDate()}, ${start.getFullYear()}`;
  }

  if (festival.announced_start) {
    const start = new Date(festival.announced_start + "T00:00:00");
    return start.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  if (festival.typical_month) {
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];
    return `Typically ${monthNames[festival.typical_month - 1]}`;
  }

  return "Dates TBA";
}

export default async function FestivalsIndexPage({ params }: Props) {
  const { portal: portalSlug } = await params;
  const [festivals, portal] = await Promise.all([
    getAllFestivals(),
    getCachedPortalBySlug(portalSlug),
  ]);

  const activePortalSlug = portal?.slug || portalSlug;
  const activePortalName = portal?.name || portalSlug.charAt(0).toUpperCase() + portalSlug.slice(1);

  // Split into upcoming and past
  const now = new Date().toISOString().split("T")[0];
  const upcoming = festivals.filter(
    (f) => !f.announced_end || f.announced_end >= now
  );
  const past = festivals.filter(
    (f) => f.announced_end && f.announced_end < now
  );

  return (
    <>
      {portal && <PortalTheme portal={portal} />}

      <div className="min-h-screen">
        <UnifiedHeader
          portalSlug={activePortalSlug}
          portalName={activePortalName}
        />

        <main className="max-w-4xl mx-auto px-4 py-6 pb-16 space-y-8">
          {/* Page header */}
          <div>
            <h1 className="text-2xl font-bold text-[var(--cream)] mb-2">
              Festivals
            </h1>
            <p className="text-[var(--soft)]">
              {festivals.length} festival{festivals.length !== 1 ? "s" : ""} in {activePortalName}
            </p>
          </div>

          {/* Upcoming */}
          {upcoming.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-[var(--cream)] mb-4">
                Upcoming & Ongoing
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {upcoming.map((festival) => (
                  <FestivalCard
                    key={festival.id}
                    festival={festival}
                    portalSlug={activePortalSlug}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Past */}
          {past.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-[var(--muted)] mb-4">
                Past Festivals
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 opacity-70">
                {past.map((festival) => (
                  <FestivalCard
                    key={festival.id}
                    festival={festival}
                    portalSlug={activePortalSlug}
                  />
                ))}
              </div>
            </section>
          )}

          {festivals.length === 0 && (
            <div className="py-16 text-center">
              <p className="text-[var(--muted)]">No festivals found.</p>
            </div>
          )}
        </main>

        <PortalFooter />
      </div>
    </>
  );
}

function FestivalCard({
  festival,
  portalSlug,
}: {
  festival: Festival;
  portalSlug: string;
}) {
  return (
    <Link
      href={`/${portalSlug}/festivals/${festival.slug}`}
      className="group block rounded-lg border border-[var(--twilight)] bg-[var(--card-bg)] overflow-hidden transition-all hover:bg-[var(--card-bg-hover)] hover:border-[var(--soft)]"
    >
      {/* Image */}
      <div className="relative w-full aspect-video bg-[var(--night)] overflow-hidden">
        {festival.image_url ? (
          <Image
            src={festival.image_url}
            alt={festival.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-12 h-12 text-[var(--twilight)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 4v16m0-12h9l-1.5 3L14 14H5" />
            </svg>
          </div>
        )}

        {/* Free badge */}
        {festival.free && (
          <span className="absolute top-2 right-2 px-2 py-0.5 rounded text-xs font-bold bg-[var(--neon-green)] text-[var(--void)]">
            FREE
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-[var(--cream)] mb-1 line-clamp-2 group-hover:text-accent transition-colors">
          {festival.name}
        </h3>
        <p className="text-sm text-[var(--muted)] mb-2">
          {formatFestivalDates(festival)}
        </p>
        {festival.location && (
          <p className="text-xs text-[var(--soft)] flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {festival.location}
          </p>
        )}
        {festival.categories && festival.categories.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {festival.categories.slice(0, 3).map((cat) => (
              <span
                key={cat}
                className="px-1.5 py-0.5 rounded text-[0.6rem] font-mono uppercase border border-[var(--twilight)] text-[var(--muted)]"
              >
                {cat.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
