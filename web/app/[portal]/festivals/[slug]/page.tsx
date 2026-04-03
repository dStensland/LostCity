import { notFound } from "next/navigation";
import Link from "next/link";
import { cache, Suspense } from "react";
import ScrollToTop from "@/components/ScrollToTop";
import { getCachedPortalBySlug } from "@/lib/portal";
import {
  getFestivalBySlug,
  getFestivalPrograms,
  getFestivalEvents,
} from "@/lib/festivals";
import { getFestivalArtists } from "@/lib/artists";
import LineupSection from "@/components/LineupSection";
import FestivalMap from "@/components/FestivalMap";
import {
  DetailHero,
  InfoCard,
  MetadataGrid,
  SectionHeader,
  DetailStickyBar,
  RelatedCard,
} from "@/components/detail";
import { safeJsonLd, decodeHtmlEntities, formatTime } from "@/lib/formats";
import GettingThereSection from "@/components/GettingThereSection";
import type { Metadata } from "next";
import ScopedStylesServer from "@/components/ScopedStylesServer";
import { createCssVarClass } from "@/lib/css-utils";
import { getCategoryAccentColor } from "@/lib/moments-utils";
import { buildBreadcrumbSchema } from "@/lib/breadcrumb-schema";
import { getFestivalLayout, type FestivalLayout } from "@/lib/festival-layout";

export const revalidate = 300; // 5 minutes

type Props = {
  params: Promise<{ portal: string; slug: string }>;
};

// Deduplicate festival fetches across generateMetadata and page
const getCachedFestivalBySlug = cache(getFestivalBySlug);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, portal: portalSlug } = await params;
  const festival = await getCachedFestivalBySlug(slug);
  const portal = await getCachedPortalBySlug(portalSlug);

  if (!festival) {
    return {
      title: "Festival Not Found",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const portalName = portal?.name || "Lost City";
  const description = festival.description || `${festival.name} festival schedule, programs, and tickets.`;

  return {
    title: `${festival.name} | ${portalName}`,
    description,
    alternates: {
      canonical: `/${portal?.slug || portalSlug}/festivals/${slug}`,
    },
    openGraph: {
      title: festival.name,
      description,
      type: "website",
      images: [
        {
          url: `/${portal?.slug || portalSlug}/festivals/${slug}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: festival.name,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: festival.name,
      description,
      images: [
        {
          url: `/${portal?.slug || portalSlug}/festivals/${slug}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: festival.name,
        },
      ],
    },
  };
}

// Generate Schema.org structured data for festival
function generateFestivalSchema(
  festival: NonNullable<Awaited<ReturnType<typeof getFestivalBySlug>>>,
  sessions: Awaited<ReturnType<typeof getFestivalEvents>>
) {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Festival",
    name: festival.name,
  };

  if (festival.description) {
    schema.description = festival.description;
  }

  if (festival.image_url) {
    schema.image = [festival.image_url];
  }

  if (festival.location) {
    schema.location = {
      "@type": "Place",
      name: festival.location,
    };
  }

  // Add dates if announced
  if (festival.announced_start) {
    schema.startDate = festival.announced_start;
  }

  if (festival.announced_end) {
    schema.endDate = festival.announced_end;
  }

  // Add sub-events
  if (sessions.length > 0) {
    schema.subEvents = sessions.slice(0, 20).map((session) => ({
      "@type": "Event",
      name: session.title,
      startDate: session.start_time
        ? `${session.start_date}T${session.start_time}:00`
        : session.start_date,
      location: session.venue
        ? {
            "@type": "Place",
            name: session.venue.name,
          }
        : undefined,
    }));
  }

  return schema;
}

// Format festival dates for hero subtitle
function formatFestivalDates(festival: NonNullable<Awaited<ReturnType<typeof getFestivalBySlug>>>): string {
  if (festival.announced_start && festival.announced_end) {
    // Single-day festival
    if (festival.announced_start === festival.announced_end) {
      const start = new Date(festival.announced_start + "T00:00:00");
      return start.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    }

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
    return start.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  }

  // Fallback to typical timing
  if (festival.typical_month) {
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const duration = festival.typical_duration_days || 1;
    return `Typically ${monthNames[festival.typical_month - 1]} (${duration} day${duration > 1 ? "s" : ""})`;
  }

  return "Dates coming soon";
}

function getDurationLabel(festival: NonNullable<Awaited<ReturnType<typeof getFestivalBySlug>>>): string {
  if (festival.announced_start && festival.announced_end) {
    const start = new Date(festival.announced_start + "T00:00:00").getTime();
    const end = new Date(festival.announced_end + "T00:00:00").getTime();
    const days = Math.max(1, Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1);
    return `${days} day${days > 1 ? "s" : ""}`;
  }

  if (festival.typical_duration_days) {
    return `${festival.typical_duration_days} day${festival.typical_duration_days > 1 ? "s" : ""}`;
  }

  return "Varies";
}

function formatScheduleDateLabel(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatSessionTimeRangeLabel(startTime: string | null, endTime: string | null): string {
  if (!startTime && !endTime) return "TBA";
  if (!startTime) return formatTime(endTime);
  if (!endTime) return formatTime(startTime);
  return `${formatTime(startTime)} – ${formatTime(endTime)}`;
}

function normalizeText(value: string): string {
  return decodeHtmlEntities(value).trim().toLowerCase();
}


export default async function PortalFestivalPage({ params }: Props) {
  const { slug, portal: portalSlug } = await params;
  const festival = await getCachedFestivalBySlug(slug);
  const portal = await getCachedPortalBySlug(portalSlug);

  if (!festival) {
    notFound();
  }

  // Use the URL portal or fall back to default
  const activePortalSlug = portal?.slug || portalSlug;
  const activePortalName = portal?.name || portalSlug.charAt(0).toUpperCase() + portalSlug.slice(1);

  const layout = getFestivalLayout(festival.festival_type);
  const accentColor = getCategoryAccentColor(festival.categories?.[0]);
  const festivalAccentClass = createCssVarClass("--accent-color", accentColor, "festival");
  const primaryActionUrl = festival.ticket_url || festival.website || undefined;
  const primaryActionLabel = festival.ticket_url ? "Get Tickets" : "Visit Website";

  // Build subtitle for hero
  const heroSubtitle = formatFestivalDates(festival);

  return (
    <>
      <ScrollToTop />
      {/* Breadcrumb schema only — no sessions needed */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLd(
            buildBreadcrumbSchema([
              { name: activePortalName, href: `/${activePortalSlug}` },
              { name: "Festivals", href: `/${activePortalSlug}?view=find&lane=events&categories=festivals` },
              { name: festival.name },
            ])
          ),
        }}
      />

      <ScopedStylesServer css={festivalAccentClass?.css || ""} />

      <div className={`min-h-screen ${festivalAccentClass?.className ?? ""}`}>
        <main
          data-festival-detail="true"
          className={`max-w-5xl mx-auto px-4 py-4 sm:py-6 ${
            primaryActionUrl ? "pb-32 md:pb-14" : "pb-12"
          } space-y-6 sm:space-y-9`}
        >
          {/* Hero Section — renders immediately (festival is cached) */}
          <DetailHero
            mode="image"
            imageUrl={festival.image_url}
            title={festival.name}
            subtitle={heroSubtitle}
            categoryColor={accentColor}
            backFallbackHref={`/${activePortalSlug}`}
            portrait
            badge={
              <span
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded text-xs font-mono uppercase tracking-wider bg-accent-20 text-accent border border-accent-40"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 4v16m0-12h9l-1.5 3L14 14H5" />
                </svg>
                {layout.typeLabel}
              </span>
            }
          />

          {/* CTAs — renders immediately */}
          {(festival.ticket_url || festival.website) && (
            <div className="flex gap-3">
              {festival.ticket_url && (
                <a
                  href={festival.ticket_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-[var(--coral)] text-white font-semibold rounded-lg hover:bg-[var(--rose)] transition-all shadow-[0_0_20px_rgba(255,107,122,0.3)]"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                  </svg>
                  Get Tickets
                </a>
              )}
              {festival.website && (
                <a
                  href={festival.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg border border-[var(--twilight)] hover:bg-[var(--twilight)] text-[var(--soft)] text-sm font-medium transition-colors ${festival.ticket_url ? "" : "flex-1"}`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Website
                </a>
              )}
            </div>
          )}

          {/* Schedule + Map + Programs — streams when sessions/programs load */}
          <Suspense fallback={<ScheduleSkeleton festival={festival} accentColor={accentColor} heroSubtitle={heroSubtitle} />}>
            <FestivalScheduleSection
              festival={festival}
              festivalId={festival.id}
              festivalSlug={festival.slug}
              festivalName={festival.name}
              portalSlug={activePortalSlug}
              accentColor={accentColor}
              layout={layout}
              heroSubtitle={heroSubtitle}
              primaryActionUrl={primaryActionUrl}
              primaryActionLabel={primaryActionLabel}
            />
          </Suspense>

          {/* Lineup — streams when artists load */}
          <Suspense fallback={<LineupSkeleton />}>
            <FestivalLineupSection
              festivalId={festival.id}
              portalSlug={activePortalSlug}
              showLineup={layout.showLineup}
            />
          </Suspense>
        </main>

        {primaryActionUrl && (
          <DetailStickyBar
            primaryAction={{
              label: primaryActionLabel,
              href: primaryActionUrl,
            }}
            className="md:hidden"
            containerClassName="max-w-5xl"
            secondaryActions={
              (
                <Link
                  href={`/${activePortalSlug}/festivals/${festival.slug}/schedule`}
                  className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg border border-[var(--twilight)] text-sm text-[var(--soft)] hover:text-[var(--cream)] hover:border-[var(--soft)] transition-colors"
                >
                  Schedule
                </Link>
              )
            }
            scrollThreshold={220}
          />
        )}
      </div>

    </>
  );
}

// ─── Skeleton fallbacks ────────────────────────────────────────────────────────

function ScheduleSkeleton({
  festival,
  accentColor,
  heroSubtitle,
}: {
  festival: NonNullable<Awaited<ReturnType<typeof getFestivalBySlug>>>;
  accentColor: string;
  heroSubtitle: string;
}) {
  return (
    <>
      {/* At a Glance card — static data available immediately, session counts shimmer */}
      <InfoCard accentColor={accentColor} className="!bg-[var(--night)] !border-[var(--twilight)]/90">
        <SectionHeader title="At a Glance" className="border-t-0 pt-0 pb-2" />
        <p className="text-sm text-[var(--muted)] mb-4">
          Use this page for a quick overview. For date-by-date planning, open the full schedule.
        </p>
        <MetadataGrid
          items={[
            { label: "Duration", value: getDurationLabel(festival) },
            { label: "Dates", value: heroSubtitle },
            { label: "Price", value: festival.free ? "Free" : "Paid" },
            { label: "Location", value: festival.location || festival.neighborhood || "Various Venues" },
          ]}
          className="mb-6"
        />
        {festival.description && (
          <>
            <SectionHeader title="About" className="pt-4 pb-2" />
            <p className="text-sm sm:text-[15px] text-[var(--soft)] whitespace-pre-wrap leading-relaxed max-w-measure mb-6">
              {festival.description}
            </p>
          </>
        )}
        {festival.categories && festival.categories.length > 0 && (
          <>
            <SectionHeader title="Categories" count={festival.categories.length} />
            <div className="flex flex-wrap gap-2 mb-6">
              {festival.categories.map((category) => (
                <span
                  key={category}
                  className="px-2.5 py-1 rounded-full text-xs font-medium border border-[var(--coral)]/30 bg-[var(--coral)]/10 text-[var(--coral)]"
                >
                  {category.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          </>
        )}
      </InfoCard>

      {/* Next Up skeleton */}
      <div className="rounded-xl border border-[var(--twilight)]/85 bg-[var(--night)] px-4 py-4 sm:px-5 sm:py-5 animate-pulse">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <div className="h-2.5 w-14 rounded bg-[var(--twilight)] mb-2" />
            <div className="h-5 w-36 rounded bg-[var(--twilight)]" />
          </div>
          <div className="h-4 w-28 rounded bg-[var(--twilight)]" />
        </div>
        <div className="rounded-lg border border-[var(--twilight)]/80 bg-[var(--night)]/95 divide-y divide-[var(--twilight)]/35">
          {[1, 2, 3].map((i) => (
            <div key={i} className="grid grid-cols-[5.5rem_1fr_auto] items-start gap-3 px-3.5 py-3.5 sm:px-4 sm:py-4" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="h-5 w-16 rounded bg-[var(--twilight)]" />
              <div className="space-y-2">
                <div className="h-4 w-48 rounded bg-[var(--twilight)]" />
                <div className="h-3 w-24 rounded bg-[var(--twilight)]" />
              </div>
              <div className="h-4 w-4 rounded bg-[var(--twilight)]" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function LineupSkeleton() {
  return (
    <div className="rounded-xl border border-[var(--twilight)] bg-[var(--night)] p-5 animate-pulse">
      <div className="h-3.5 w-28 rounded bg-[var(--twilight)] mb-4" />
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="aspect-square rounded-lg bg-[var(--twilight)]"
            style={{ animationDelay: `${i * 60}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Async sub-components ──────────────────────────────────────────────────────

async function FestivalScheduleSection({
  festival,
  festivalId,
  festivalSlug,
  festivalName,
  portalSlug,
  accentColor,
  layout,
  heroSubtitle,
  primaryActionUrl,
  primaryActionLabel,
}: {
  festival: NonNullable<Awaited<ReturnType<typeof getFestivalBySlug>>>;
  festivalId: string;
  festivalSlug: string;
  festivalName: string;
  portalSlug: string;
  accentColor: string;
  layout: FestivalLayout;
  heroSubtitle: string;
  primaryActionUrl: string | undefined;
  primaryActionLabel: string;
}) {
  const [programs, sessions] = await Promise.all([
    getFestivalPrograms(festivalId),
    getFestivalEvents(festivalId),
  ]);

  // Detect single-venue festival for transit info
  const venueIds = new Set(sessions.filter((s) => s.venue).map((s) => s.venue!.id));
  const singleVenue = venueIds.size === 1
    ? sessions.find((s) => s.venue)?.venue ?? null
    : null;

  const festivalSchema = generateFestivalSchema(festival, sessions);

  const programPages = programs.filter(
    (program) =>
      (program.event_count ?? 0) > 0 &&
      decodeHtmlEntities(program.title).trim().toLowerCase() !== "general program"
  );
  const programHighlights = [...programPages]
    .sort((a, b) => {
      const countDiff = (b.event_count ?? 0) - (a.event_count ?? 0);
      if (countDiff !== 0) return countDiff;
      return decodeHtmlEntities(a.title).localeCompare(decodeHtmlEntities(b.title));
    })
    .slice(0, 8);
  const hiddenProgramCount = Math.max(0, programPages.length - programHighlights.length);

  const sortedSessions = [...sessions].sort((a, b) => {
    if (a.start_date !== b.start_date) return a.start_date.localeCompare(b.start_date);
    return (a.start_time || "").localeCompare(b.start_time || "");
  });
  const sessionDays = Array.from(new Set(sortedSessions.map((session) => session.start_date))).sort();
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const nextScheduleDay = sessionDays.find((day) => day >= todayStr) || sessionDays[0] || null;
  const nextDaySessions = nextScheduleDay
    ? sortedSessions.filter((session) => session.start_date === nextScheduleDay)
    : [];
  const festivalNameNormalized = normalizeText(festivalName);
  const nextDaySortedForPreview = [...nextDaySessions].sort((a, b) => {
    const aTimed = a.start_time ? 0 : 1;
    const bTimed = b.start_time ? 0 : 1;
    if (aTimed !== bTimed) return aTimed - bTimed;
    const aStart = a.start_time || "99:99";
    const bStart = b.start_time || "99:99";
    if (aStart !== bStart) return aStart.localeCompare(bStart);
    return normalizeText(a.title).localeCompare(normalizeText(b.title));
  });
  const highSignalSessions = nextDaySortedForPreview.filter(
    (session) => normalizeText(session.title) !== festivalNameNormalized || Boolean(session.start_time)
  );
  const fallbackSessions = nextDaySortedForPreview.filter(
    (session) => normalizeText(session.title) === festivalNameNormalized && !session.start_time
  );
  const nextDayPreview = [...highSignalSessions, ...fallbackSessions].slice(0, 8);
  const nextDayRemainingCount = Math.max(0, nextDaySessions.length - nextDayPreview.length);

  return (
    <>
      {/* Festival JSON-LD schema — depends on sessions, fine here for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(festivalSchema) }}
      />

      {/* Main Content Card — overview */}
      <InfoCard accentColor={accentColor} className="!bg-[var(--night)] !border-[var(--twilight)]/90">
        <SectionHeader title="At a Glance" className="border-t-0 pt-0 pb-2" />
        <p className="text-sm text-[var(--muted)] mb-4">
          Use this page for a quick overview. For date-by-date planning, open the full schedule.
        </p>

        <MetadataGrid
          items={[
            {
              label: "Duration",
              value: getDurationLabel(festival),
            },
            {
              label: "Dates",
              value: heroSubtitle,
            },
            {
              label: "Price",
              value: festival.free ? "Free" : "Paid",
            },
            {
              label: "Location",
              value: festival.location || festival.neighborhood || "Various Venues",
            },
            ...(sessions.length > 0
              ? [{
                  label: "Sessions",
                  value: `${sessions.length}`,
                }]
              : []),
            ...(sessions.length > 0
              ? [{
                  label: "Venues",
                  value: `${new Set(sessions.filter((s) => s.venue).map((s) => s.venue!.id)).size}`,
                }]
              : []),
          ]}
          className="mb-6"
        />

        {festival.description && (
          <>
            <SectionHeader title="About" className="pt-4 pb-2" />
            <p className="text-sm sm:text-[15px] text-[var(--soft)] whitespace-pre-wrap leading-relaxed max-w-measure mb-6">
              {festival.description}
            </p>
          </>
        )}

        {singleVenue && (
          <div className="mt-6">
            <GettingThereSection transit={singleVenue} />
          </div>
        )}

        {festival.categories && festival.categories.length > 0 && (
          <>
            <SectionHeader title="Categories" count={festival.categories.length} />
            <div className="flex flex-wrap gap-2 mb-6">
              {festival.categories.map((category) => (
                <span
                  key={category}
                  className="px-2.5 py-1 rounded-full text-xs font-medium border border-[var(--coral)]/30 bg-[var(--coral)]/10 text-[var(--coral)]"
                >
                  {category.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          </>
        )}
      </InfoCard>

      {/* Next Up — concise preview, full planner on dedicated page */}
      {sessions.length > 0 ? (
        <section id="next-up" className="rounded-xl border border-[var(--twilight)]/85 bg-[var(--night)] px-4 py-4 sm:px-5 sm:py-5">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.13em] text-[var(--muted)] mb-1">
                Next Up
              </p>
              <h2 className="text-lg font-semibold text-[var(--cream)]">
                {nextScheduleDay ? formatScheduleDateLabel(nextScheduleDay) : "Upcoming Sessions"}
              </h2>
              <p className="text-sm text-[var(--muted)] mt-1">
                {nextDaySessions.length} session{nextDaySessions.length !== 1 ? "s" : ""} scheduled.
              </p>
            </div>
            <Link
              href={`/${portalSlug}/festivals/${festivalSlug}/schedule`}
              className="inline-flex items-center gap-1 text-sm text-accent hover:text-[var(--cream)] transition-colors"
            >
              Open Full Schedule
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>

          <div className="rounded-lg border border-[var(--twilight)]/80 bg-[var(--night)]/95">
            <div className="divide-y divide-[var(--twilight)]/35">
              {nextDayPreview.map((session) => (
                <div key={session.id} className="grid grid-cols-[5.5rem_1fr_auto] items-start gap-3 px-3.5 py-3.5 sm:px-4 sm:py-4">
                  <div className="pt-0.5">
                    <span className="inline-flex rounded px-1.5 py-0.5 font-mono text-[11px] sm:text-xs text-[var(--soft)] bg-[var(--night)]/95 border border-[var(--twilight)]/40">
                      {formatSessionTimeRangeLabel(session.start_time, session.end_time)}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <Link
                      href={`/${portalSlug}/events/${session.id}`}
                      className="font-medium text-sm sm:text-[15px] text-[var(--cream)] hover:text-accent transition-colors line-clamp-2"
                    >
                      {decodeHtmlEntities(session.title)}
                    </Link>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {session.venue && (
                        <Link
                          href={`/${portalSlug}/spots/${session.venue.slug}`}
                          className="text-xs text-[var(--soft)] hover:text-[var(--coral)] transition-colors"
                        >
                          {session.venue.name}
                        </Link>
                      )}
                      {session.category && (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] sm:text-xs font-medium border border-[var(--twilight)]/50 bg-[var(--twilight)]/20 text-[var(--soft)]">
                          {session.category.replace(/_/g, " ")}
                        </span>
                      )}
                    </div>
                  </div>
                  <Link
                    href={`/${portalSlug}/events/${session.id}`}
                    aria-label={`Open ${decodeHtmlEntities(session.title)}`}
                    className="text-[var(--muted)] hover:text-[var(--soft)] transition-colors pt-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
            <span>
              Showing {nextDayPreview.length} of {nextDaySessions.length} sessions for this date.
            </span>
            {nextDayRemainingCount > 0 && (
              <span>
                +{nextDayRemainingCount} more in the full schedule.
              </span>
            )}
          </div>
        </section>
      ) : (
        <section className="rounded-lg border border-[var(--twilight)] bg-[var(--card-bg)] p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-[var(--twilight)]/50 border border-[var(--twilight)]/60 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="font-mono text-xs font-bold text-[var(--muted)] uppercase tracking-[0.14em] mb-2">
                Schedule Coming Soon
              </h2>
              <p className="text-sm text-[var(--soft)] leading-relaxed">
                Session times and program details have not been published yet. Check back soon, or use the official
                festival link for the latest updates.
              </p>
              {primaryActionUrl && (
                <a
                  href={primaryActionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 mt-3 text-sm font-medium text-accent hover:text-[var(--rose)] transition-colors"
                >
                  {primaryActionLabel}
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Multi-venue map */}
      <FestivalMap sessions={sessions} portalSlug={portalSlug} />

      {/* Program Tracks — secondary to schedule filters */}
      {layout.showTracks && programPages.length > 0 && (
        <section className="rounded-xl border border-[var(--twilight)]/85 bg-[var(--night)] px-4 py-4 sm:px-5 sm:py-5">
          <SectionHeader title="Program Highlights" count={programPages.length} />
          <p className="text-xs text-[var(--muted)] mb-3">
            Highest-volume program series. Use the schedule filters for the complete list.
          </p>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {programHighlights.map((program) => (
              <RelatedCard
                key={program.id}
                variant="compact"
                href={`/${portalSlug}/series/${program.slug}`}
                title={decodeHtmlEntities(program.title)}
                subtitle={`${program.event_count} session${program.event_count !== 1 ? "s" : ""}`}
                accentColor={accentColor}
              />
            ))}
          </div>
          {hiddenProgramCount > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-[var(--muted)]">
                +{hiddenProgramCount} more program series
              </span>
              <Link
                href={`/${portalSlug}/festivals/${festivalSlug}/schedule`}
                className="inline-flex items-center gap-1 text-xs text-accent hover:text-[var(--cream)] transition-colors"
              >
                Browse full schedule
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>
          )}
        </section>
      )}
    </>
  );
}

async function FestivalLineupSection({
  festivalId,
  portalSlug,
  showLineup,
}: {
  festivalId: string;
  portalSlug: string;
  showLineup: boolean;
}) {
  if (!showLineup) return null;
  const festivalArtists = await getFestivalArtists(festivalId);
  if (festivalArtists.length === 0) return null;

  return (
    <LineupSection
      artists={festivalArtists}
      portalSlug={portalSlug}
      maxDisplay={9}
    />
  );
}
