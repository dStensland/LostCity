import { getAllFestivals, type Festival } from "@/lib/festivals";
import { getCachedPortalBySlug } from "@/lib/portal";
import { computeCountdown, getUrgencyColor } from "@/lib/moments-utils";
import { getLocalDateString } from "@/lib/formats";
import { PortalHeader } from "@/components/headers";
import PortalFooter from "@/components/PortalFooter";
import Link from "next/link";
import Image from "@/components/SmartImage";
import type { Metadata } from "next";

export const revalidate = 300;

type Props = {
  params: Promise<{ portal: string }>;
  searchParams: Promise<{ category?: string }>;
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

    // Single-day festival — just show one date
    if (festival.announced_start === festival.announced_end) {
      return start.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    }

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

  return "Dates coming soon";
}

export default async function FestivalsIndexPage({ params, searchParams }: Props) {
  const [{ portal: portalSlug }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);
  const selectedCategory = resolvedSearchParams.category || null;

  const portal = await getCachedPortalBySlug(portalSlug);
  const festivals = await getAllFestivals(portal?.id);

  const activePortalSlug = portal?.slug || portalSlug;
  const activePortalName = portal?.name || portalSlug.charAt(0).toUpperCase() + portalSlug.slice(1);
  const today = getLocalDateString();

  // Split into upcoming and past
  const now = new Date().toISOString().split("T")[0];
  let upcoming = festivals.filter(
    (f) => !f.announced_end || f.announced_end >= now
  );
  let past = festivals.filter(
    (f) => f.announced_end && f.announced_end < now
  );

  // Derive unique categories across all festivals
  const allCategories = new Set<string>();
  for (const f of festivals) {
    if (f.categories) {
      for (const cat of f.categories) {
        allCategories.add(cat);
      }
    }
  }
  const categoryList = Array.from(allCategories).sort();

  // Sort upcoming festivals by effective date:
  // Ongoing festivals (started in the past) sort as "today" so they appear first
  upcoming.sort((a, b) => {
    const effectiveA = (a.announced_start && a.announced_start < now) ? now : (a.announced_start || "9999");
    const effectiveB = (b.announced_start && b.announced_start < now) ? now : (b.announced_start || "9999");
    return effectiveA.localeCompare(effectiveB);
  });

  // Filter by category if selected
  if (selectedCategory) {
    upcoming = upcoming.filter(
      (f) => f.categories && f.categories.includes(selectedCategory)
    );
    past = past.filter(
      (f) => f.categories && f.categories.includes(selectedCategory)
    );
  }

  // Pick featured: first upcoming with image
  const featured = upcoming.find((f) => f.image_url);
  const upcomingGrid = featured
    ? upcoming.filter((f) => f.id !== featured.id)
    : upcoming;

  return (
    <>
      <div className="min-h-screen">
        <PortalHeader
          portalSlug={activePortalSlug}
          portalName={activePortalName}
          backLink={{ label: "Back", fallbackHref: `/${activePortalSlug}` }}
          hideNav
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

          {/* Category filter chips */}
          {categoryList.length > 1 && (
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/${activePortalSlug}/festivals`}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  !selectedCategory
                    ? "bg-[var(--coral)] text-white border-[var(--coral)] shadow-sm shadow-[var(--coral)]/25"
                    : "border-[var(--twilight)] text-[var(--soft)] hover:text-[var(--cream)] hover:border-[var(--soft)]"
                }`}
              >
                All
              </Link>
              {categoryList.map((cat) => (
                <Link
                  key={cat}
                  href={`/${activePortalSlug}/festivals?category=${cat}`}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    selectedCategory === cat
                      ? "bg-[var(--coral)] text-white border-[var(--coral)] shadow-sm shadow-[var(--coral)]/25"
                      : "border-[var(--twilight)] text-[var(--soft)] hover:text-[var(--cream)] hover:border-[var(--soft)]"
                  }`}
                >
                  {cat.replace(/_/g, " ")}
                </Link>
              ))}
            </div>
          )}

          {/* Featured hero */}
          {featured && (
            <Link
              href={`/${activePortalSlug}/festivals/${featured.slug}`}
              className="block relative rounded-2xl overflow-hidden group"
            >
              <div className="relative h-[240px] sm:h-[300px] w-full">
                <Image
                  src={featured.image_url!}
                  alt={featured.name}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  sizes="(max-width: 768px) 100vw, 900px"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6">
                <FestivalCountdownBadge festival={featured} today={today} />
                <h3 className="text-2xl sm:text-3xl font-bold text-[var(--cream)] mt-2 leading-tight">
                  {featured.name}
                </h3>
                <p className="text-sm font-mono text-[var(--soft)] mt-1">
                  {formatFestivalDates(featured)}
                </p>
                {featured.location && (
                  <p className="text-xs text-[var(--muted)] mt-0.5">{featured.location}</p>
                )}
              </div>
              <span className="absolute top-4 left-4 px-2.5 py-1 rounded text-[0.65rem] font-mono uppercase tracking-wider bg-accent/20 text-accent border border-accent/30 backdrop-blur-sm">
                Featured
              </span>
            </Link>
          )}

          {/* Upcoming grid */}
          {upcomingGrid.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-[var(--cream)] mb-4">
                {featured ? "More Upcoming" : "Upcoming & Ongoing"}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {upcomingGrid.map((festival) => (
                  <FestivalCard
                    key={festival.id}
                    festival={festival}
                    portalSlug={activePortalSlug}
                    today={today}
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
                    today={today}
                  />
                ))}
              </div>
            </section>
          )}

          {upcoming.length === 0 && past.length === 0 && (
            <div className="py-16 text-center">
              <p className="text-[var(--muted)]">
                {selectedCategory
                  ? `No ${selectedCategory.replace(/_/g, " ")} festivals found.`
                  : "No festivals found."}
              </p>
            </div>
          )}
        </main>

        <PortalFooter />
      </div>
    </>
  );
}

function FestivalCountdownBadge({
  festival,
  today,
}: {
  festival: Festival;
  today: string;
}) {
  const countdown = computeCountdown(festival, today);
  if (countdown.urgency === "tbd" || countdown.text === "Past") return null;

  const color = getUrgencyColor(countdown.urgency);
  return (
    <span
      className="inline-flex items-center rounded-full font-mono font-medium uppercase tracking-wider backdrop-blur-sm px-2 py-0.5 text-[0.6rem]"
      style={{
        color,
        backgroundColor: `color-mix(in srgb, ${color} 25%, transparent)`,
        borderColor: `color-mix(in srgb, ${color} 40%, transparent)`,
        borderWidth: 1,
        borderStyle: "solid",
      }}
    >
      {countdown.text}
    </span>
  );
}

function FestivalCard({
  festival,
  portalSlug,
  today,
}: {
  festival: Festival;
  portalSlug: string;
  today: string;
}) {
  return (
    <Link
      href={`/${portalSlug}/festivals/${festival.slug}`}
      className="group block rounded-lg border border-[var(--twilight)] bg-[var(--card-bg)] overflow-hidden hover:bg-[var(--card-bg-hover)] hover:border-[var(--soft)] hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
    >
      {/* Image */}
      <div className="relative w-full aspect-video bg-[var(--night)] overflow-hidden">
        {!festival.image_url && <div className="absolute inset-0 skeleton-shimmer" />}
        {festival.image_url ? (
          <Image
            src={festival.image_url}
            alt={festival.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center relative z-[1]">
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

        {/* Countdown badge */}
        <div className="absolute top-2 left-2">
          <FestivalCountdownBadge festival={festival} today={today} />
        </div>
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
