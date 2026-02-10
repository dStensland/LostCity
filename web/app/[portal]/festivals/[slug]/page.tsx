import { notFound } from "next/navigation";
import { cache } from "react";
import ScrollToTop from "@/components/ScrollToTop";
import { PortalHeader } from "@/components/headers";
import { getCachedPortalBySlug } from "@/lib/portal";
import {
  getFestivalBySlug,
  getFestivalPrograms,
  getFestivalEvents,
} from "@/lib/festivals";
import { getFestivalArtists } from "@/lib/artists";
import LineupSection from "@/components/LineupSection";
import FestivalSchedule from "@/components/FestivalSchedule";
import FestivalMap from "@/components/FestivalMap";
import {
  DetailHero,
  InfoCard,
  MetadataGrid,
  SectionHeader,
  DetailStickyBar,
  RelatedCard,
} from "@/components/detail";
import { safeJsonLd, decodeHtmlEntities } from "@/lib/formats";
import type { Metadata } from "next";
import ScopedStylesServer from "@/components/ScopedStylesServer";
import { createCssVarClass } from "@/lib/css-utils";
import { getCategoryAccentColor } from "@/lib/moments-utils";

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
    return { title: "Festival Not Found" };
  }

  const portalName = portal?.name || "Lost City";
  const description = festival.description || `${festival.name} festival schedule, programs, and tickets.`;

  return {
    title: `${festival.name} | ${portalName}`,
    description,
    openGraph: {
      title: festival.name,
      description,
      type: "website",
      images: festival.image_url ? [{ url: festival.image_url }] : [],
    },
    twitter: {
      card: festival.image_url ? "summary_large_image" : "summary",
      title: festival.name,
      description,
      images: festival.image_url ? [festival.image_url] : [],
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

  const [programs, sessions, festivalArtists] = await Promise.all([
    getFestivalPrograms(festival.id),
    getFestivalEvents(festival.id),
    getFestivalArtists(festival.id),
  ]);
  const accentColor = getCategoryAccentColor(festival.categories?.[0]);
  const festivalAccentClass = createCssVarClass("--accent-color", accentColor, "festival");
  const festivalSchema = generateFestivalSchema(festival, sessions);
  const primaryActionUrl = festival.ticket_url || festival.website || undefined;
  const primaryActionLabel = festival.ticket_url ? "Get Tickets" : "Visit Website";
  const programPages = programs.filter(
    (program) =>
      (program.event_count ?? 0) > 0 &&
      decodeHtmlEntities(program.title).trim().toLowerCase() !== "general program"
  );

  // Build subtitle for hero
  const heroSubtitle = formatFestivalDates(festival);

  return (
    <>
      <ScrollToTop />
      {/* Schema.org JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(festivalSchema) }}
      />

      <ScopedStylesServer css={festivalAccentClass?.css || ""} />



      <div className={`min-h-screen ${festivalAccentClass?.className ?? ""}`}>
        <PortalHeader
          portalSlug={activePortalSlug}
          portalName={activePortalName}
          hideNav
        />

        <main
          className={`max-w-3xl mx-auto px-4 py-4 sm:py-6 ${
            primaryActionUrl ? "pb-28 sm:pb-24" : "pb-12"
          } space-y-5 sm:space-y-8`}
        >
          {/* Hero Section */}
          <DetailHero
            mode="image"
            imageUrl={festival.image_url}
            title={festival.name}
            subtitle={heroSubtitle}
            categoryColor={accentColor}
            backFallbackHref={`/${activePortalSlug}`}
            tall
            badge={
              <span
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded text-xs font-mono uppercase tracking-wider bg-accent-20 text-accent border border-accent-40"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 4v16m0-12h9l-1.5 3L14 14H5" />
                </svg>
                Festival
              </span>
            }
          />

          {/* CTAs — inline, right after hero */}
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

          {/* Interactive Schedule — high up for immediate engagement */}
          {sessions.length > 0 ? (
            <FestivalSchedule
              sessions={sessions}
              programs={programs}
              portalSlug={activePortalSlug}
            />
          ) : (
            <section className="rounded-lg border border-[var(--twilight)] bg-[var(--card-bg)] p-5 sm:p-6">
              <h2 className="text-lg font-semibold text-[var(--cream)] mb-2">Schedule Coming Soon</h2>
              <p className="text-sm text-[var(--soft)] leading-relaxed">
                Session times and program details have not been published yet. Check back soon, or use the official
                festival link for the latest updates.
              </p>
              {primaryActionUrl && (
                <a
                  href={primaryActionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 mt-4 text-sm font-medium text-accent hover:text-[var(--rose)] transition-colors"
                >
                  {primaryActionLabel}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
            </section>
          )}

          {/* Main Content Card */}
          <InfoCard accentColor={accentColor}>
            {/* Metadata Grid */}
            <MetadataGrid
              items={[
                {
                  label: "Duration",
                  value: getDurationLabel(festival),
                },
                {
                  label: "Location",
                  value: festival.location || festival.neighborhood || "Various Venues",
                },
                {
                  label: "Price",
                  value: festival.free ? "Free" : "Paid",
                },
                ...(festivalArtists.length > 0
                  ? [{ label: "Artists", value: `${festivalArtists.length}` }]
                  : []),
                ...(sessions.length > 0
                  ? [{
                      label: "Venues",
                      value: `${new Set(sessions.filter((s) => s.venue).map((s) => s.venue!.id)).size}`,
                    }]
                  : []),
              ]}
              className="mb-8"
            />

            {/* Description */}
            {festival.description && (
              <>
                <SectionHeader title="About" />
                <p className="text-[var(--soft)] whitespace-pre-wrap leading-relaxed mb-6">
                  {festival.description}
                </p>
              </>
            )}

            {/* Categories */}
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

          {/* Lineup / Featured Artists — labels auto-derived from artist disciplines */}
          {festivalArtists.length > 0 && (
            <LineupSection
              artists={festivalArtists}
              portalSlug={activePortalSlug}
              maxDisplay={9}
            />
          )}

          {/* Multi-venue map */}
          <FestivalMap sessions={sessions} portalSlug={activePortalSlug} />

          {/* Program Pages — secondary to schedule filters */}
          {programPages.length > 0 && (
            <section>
              <SectionHeader title="Program Pages" count={programPages.length} />
              <p className="text-xs text-[var(--muted)] mb-3">
                Use schedule filters above for exact times. Program pages are editorial groupings.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {programPages.map((program) => (
                  <RelatedCard
                    key={program.id}
                    variant="compact"
                    href={`/${activePortalSlug}/series/${program.slug}`}
                    title={decodeHtmlEntities(program.title)}
                    subtitle={`${program.event_count} session${program.event_count !== 1 ? "s" : ""}`}
                    accentColor={accentColor}
                  />
                ))}
              </div>
            </section>
          )}
        </main>

        {primaryActionUrl && (
          <DetailStickyBar
            primaryAction={{
              label: primaryActionLabel,
              href: primaryActionUrl,
            }}
            secondaryActions={
              sessions.length > 0 ? (
                <a
                  href="#schedule"
                  className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg border border-[var(--twilight)] text-sm text-[var(--soft)] hover:text-[var(--cream)] hover:border-[var(--soft)] transition-colors"
                >
                  Schedule
                </a>
              ) : undefined
            }
            scrollThreshold={220}
          />
        )}
      </div>

    </>
  );
}
