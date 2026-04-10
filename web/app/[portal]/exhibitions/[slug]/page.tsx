import { notFound } from "next/navigation";
import Link from "next/link";
import {
  InfoCard,
  MetadataGrid,
  SectionHeader,
  DetailHero,
  DetailStickyBar,
} from "@/components/detail";
import type { Metadata } from "next";
import {
  isClosingSoon,
  isCurrentlyShowing,
  formatDateRange,
  EXHIBITION_TYPE_LABELS,
  ADMISSION_TYPE_LABELS,
  ARTIST_ROLE_LABELS,
} from "@/lib/exhibitions-utils";
import type { ExhibitionWithVenue } from "@/lib/exhibitions-utils";
import { Ticket } from "@phosphor-icons/react/dist/ssr";
import { resolveDetailPageRequest } from "../../_surfaces/detail/resolve-detail-page-request";

const ART_EXHIBITION_TYPES = new Set([
  "solo",
  "group",
  "installation",
  "retrospective",
  "popup",
  "permanent",
]);

export const revalidate = 120;

type Props = {
  params: Promise<{ portal: string; slug: string }>;
};

async function fetchExhibition(
  slug: string
): Promise<ExhibitionWithVenue | null> {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

  const url = `${baseUrl}/api/exhibitions/${encodeURIComponent(slug)}`;

  try {
    const res = await fetch(url, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return (json.exhibition ?? null) as ExhibitionWithVenue | null;
  } catch {
    return null;
  }
}

type VenueEvent = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  is_all_day: boolean | null;
  category: string | null;
};

async function fetchVenueEvents(
  venueId: number,
  baseUrl: string
): Promise<VenueEvent[]> {
  try {
    const res = await fetch(
      `${baseUrl}/api/places/${venueId}/events?limit=5`,
      { next: { revalidate: 300 } }
    );
    if (!res.ok) return [];
    const json = await res.json();
    return (json.events ?? []) as VenueEvent[];
  } catch {
    return [];
  }
}

function formatEventTime(startTime: string | null, isAllDay: boolean | null): string {
  if (isAllDay) return "All day";
  if (!startTime) return "";
  const [h, m] = startTime.split(":").map(Number);
  const date = new Date();
  date.setHours(h, m, 0, 0);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: m === 0 ? undefined : "2-digit",
    hour12: true,
  });
}

function formatEventDate(startDate: string): string {
  const d = new Date(startDate + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getDaysUntil(dateString: string): number {
  return Math.ceil(
    (new Date(dateString).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, portal: portalSlug } = await params;
  const [exhibition, request] = await Promise.all([
    fetchExhibition(slug),
    resolveDetailPageRequest({
      portalSlug,
      pathname: `/${portalSlug}/exhibitions/${slug}`,
    }),
  ]);

  if (!exhibition) {
    return {
      title: "Exhibition Not Found",
      robots: { index: false, follow: false },
    };
  }

  const portalName = request?.portal.name || "Lost City: Arts";
  const activePortalSlug = request?.portal.slug || portalSlug;
  const artistNames =
    exhibition.artists?.map((a) => a.artist_name).join(", ") ?? "";
  const description = exhibition.description
    ? exhibition.description.slice(0, 160)
    : artistNames
    ? `${artistNames} at ${exhibition.venue?.name ?? "Atlanta"}. ${formatDateRange(exhibition.opening_date, exhibition.closing_date)}.`
    : `${exhibition.title} at ${exhibition.venue?.name ?? "Atlanta"}. ${formatDateRange(exhibition.opening_date, exhibition.closing_date)}.`;

  return {
    title: `${exhibition.title} | ${portalName}`,
    description,
    alternates: {
      canonical: `/${activePortalSlug}/exhibitions/${slug}`,
    },
    openGraph: {
      title: exhibition.title,
      description,
      type: "article",
      images: exhibition.image_url
        ? [{ url: exhibition.image_url, alt: exhibition.title }]
        : [],
    },
  };
}

export default async function ExhibitionDetailPage({ params }: Props) {
  const { slug, portal: portalSlug } = await params;

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

  const [exhibition, request] = await Promise.all([
    fetchExhibition(slug),
    resolveDetailPageRequest({
      portalSlug,
      pathname: `/${portalSlug}/exhibitions/${slug}`,
    }),
  ]);

  if (!exhibition) {
    notFound();
  }

  const activePortalSlug = request?.portal.slug || portalSlug;
  const accentColor = "var(--action-primary)";

  const isArtExhibition = ART_EXHIBITION_TYPES.has(exhibition.exhibition_type ?? "");

  const artists = exhibition.artists ?? [];
  const venue = exhibition.venue ?? null;
  const dateRange = formatDateRange(exhibition.opening_date, exhibition.closing_date);

  // Closing-soon threshold varies by type:
  //   seasonal → 14 days, attraction → 7 days, art types + special-exhibit → 30 days
  const closingSoonThreshold =
    exhibition.exhibition_type === "seasonal"
      ? 14
      : exhibition.exhibition_type === "attraction"
      ? 7
      : 30;

  const closingSoon = isClosingSoon(exhibition, closingSoonThreshold);
  const currentlyShowing = isCurrentlyShowing(exhibition);

  // Curators — find artists with role = "curator"
  const curators = artists.filter((a) => a.role === "curator");

  // Closing countdown — threshold matches closingSoonThreshold
  const daysLeft = exhibition.closing_date
    ? getDaysUntil(exhibition.closing_date)
    : null;
  const showCountdown = daysLeft !== null && daysLeft > 0 && daysLeft <= closingSoonThreshold;

  const typeLabel = exhibition.exhibition_type
    ? EXHIBITION_TYPE_LABELS[exhibition.exhibition_type]
    : null;

  const admissionLabel = exhibition.admission_type
    ? ADMISSION_TYPE_LABELS[exhibition.admission_type]
    : null;

  // Metadata grid items — medium only for art exhibitions
  const metadataItems = [
    ...(typeLabel ? [{ label: "Type", value: typeLabel }] : []),
    ...(currentlyShowing
      ? [
          {
            label: "Status",
            value: closingSoon ? "Closing soon" : "Currently showing",
            color: closingSoon ? "var(--action-primary)" : "var(--neon-green)",
          },
        ]
      : [{ label: "Status", value: "Upcoming", color: "var(--muted)" }]),
    ...(admissionLabel
      ? [
          {
            label: "Admission",
            value: admissionLabel,
            color:
              exhibition.admission_type === "free"
                ? "var(--neon-green)"
                : "var(--cream)",
          },
        ]
      : []),
    ...(isArtExhibition && exhibition.medium
      ? [{ label: "Medium", value: exhibition.medium }]
      : []),
  ];

  // Fetch venue events in parallel if we have a venue
  const venueEvents: VenueEvent[] = venue
    ? await fetchVenueEvents(venue.id, baseUrl)
    : [];

  return (
    <>
      <div className="min-h-screen">
        <main className="max-w-3xl mx-auto px-4 py-4 sm:py-6 pb-28 space-y-5 sm:space-y-8">

          {/* Hero */}
          <DetailHero
            mode={exhibition.image_url ? "image" : "fallback"}
            imageUrl={exhibition.image_url}
            title={exhibition.title}
            subtitle={
              artists.length > 0
                ? artists.map((a) => a.artist_name).join(", ")
                : venue?.name ?? undefined
            }
            categoryColor={accentColor}
            backFallbackHref={`/${activePortalSlug}/exhibitions`}
            badge={
              typeLabel ? (
                <span className="inline-flex items-center px-3 py-1 font-[family-name:var(--font-ibm-plex-mono)] text-xs uppercase tracking-[0.14em] border border-[var(--action-primary)] text-[var(--action-primary)] bg-transparent">
                  {typeLabel.toLowerCase()}
                </span>
              ) : undefined
            }
          />

          {/* Title block — shown above InfoCard */}
          <div className="space-y-1">
            <p className="font-[family-name:var(--font-ibm-plex-mono)] text-xs uppercase tracking-[0.14em] text-[var(--action-primary)]">
              {isArtExhibition
                ? `// exhibition${typeLabel ? ` · ${typeLabel.toLowerCase()}` : ""}`
                : (typeLabel ?? "")}
            </p>
            <h1
              className={
                isArtExhibition
                  ? "font-[family-name:var(--font-playfair-display)] italic text-2xl sm:text-3xl text-[var(--cream)] leading-snug"
                  : "font-semibold text-2xl sm:text-3xl text-[var(--cream)] leading-snug"
              }
            >
              {exhibition.title}
            </h1>

            {/* Curator credit — art exhibitions only */}
            {isArtExhibition && curators.length > 0 && (
              <p className="font-[family-name:var(--font-ibm-plex-mono)] text-sm font-semibold text-[#C9874F] mt-0.5">
                Curated by{" "}
                {curators.map((curator, i) => (
                  <span key={i}>
                    {i > 0 && ", "}
                    {curator.artist_id ? (
                      <Link
                        href={`/${activePortalSlug}?artist=${curator.artist_id}`}
                        className="hover:underline"
                      >
                        {curator.artist_name}
                      </Link>
                    ) : (
                      curator.artist_name
                    )}
                  </span>
                ))}
              </p>
            )}

            {/* Artists (non-curators) — art exhibitions only */}
            {isArtExhibition && artists.length > 0 && (
              <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
                {artists.map((artist, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5">
                    {artist.artist_id ? (
                      <Link
                        href={`/${activePortalSlug}/artists/${artist.artist_id}`}
                        className="font-[family-name:var(--font-ibm-plex-mono)] text-sm uppercase tracking-wider text-[var(--action-primary)] hover:underline"
                      >
                        {artist.artist_name}
                      </Link>
                    ) : (
                      <span className="font-[family-name:var(--font-ibm-plex-mono)] text-sm uppercase tracking-wider text-[var(--action-primary)]">
                        {artist.artist_name}
                      </span>
                    )}
                    {artist.role !== "artist" && (
                      <span className="font-[family-name:var(--font-ibm-plex-mono)] text-2xs uppercase tracking-wider text-[var(--muted)]">
                        ({ARTIST_ROLE_LABELS[artist.role]})
                      </span>
                    )}
                  </span>
                ))}
              </div>
            )}

            {/* Date range + closing countdown badge */}
            <div className="flex items-center gap-2 mt-1">
              <p
                className={`font-[family-name:var(--font-ibm-plex-mono)] text-sm ${
                  closingSoon
                    ? "text-[var(--action-primary)]"
                    : "text-[var(--muted)]"
                }`}
              >
                {closingSoon && "Closing soon — "}
                {dateRange}
              </p>
              {showCountdown && (
                <span className="rounded bg-[#FF5A5A1A] px-2 py-0.5 font-mono text-2xs font-medium text-[#FF5A5A]">
                  Closes in {daysLeft} days
                </span>
              )}
            </div>
          </div>

          {/* Info card */}
          <InfoCard accentColor={accentColor}>
            <MetadataGrid items={metadataItems} className="mb-6" />

            {/* Description */}
            {exhibition.description && (
              <>
                <SectionHeader title="About This Exhibition" />
                <p className="text-[var(--soft)] leading-relaxed whitespace-pre-wrap mb-6">
                  {exhibition.description}
                </p>
              </>
            )}

            {/* Details grid — admission + medium info cards (medium: art only) */}
            {(admissionLabel || (isArtExhibition && exhibition.medium)) && (
              <div className="flex gap-3 mb-6">
                {admissionLabel && (
                  <div className="flex-1 rounded-lg bg-[var(--dusk)] p-3.5">
                    <p className="font-[family-name:var(--font-ibm-plex-mono)] text-2xs uppercase tracking-[0.12em] text-[var(--muted)] mb-1">
                      Admission
                    </p>
                    <p
                      className={`text-sm font-semibold ${
                        exhibition.admission_type === "free"
                          ? "text-[var(--neon-green)]"
                          : "text-[var(--cream)]"
                      }`}
                    >
                      {admissionLabel}
                    </p>
                  </div>
                )}
                {isArtExhibition && exhibition.medium && (
                  <div className="flex-1 rounded-lg bg-[var(--dusk)] p-3.5">
                    <p className="font-[family-name:var(--font-ibm-plex-mono)] text-2xs uppercase tracking-[0.12em] text-[var(--muted)] mb-1">
                      Medium
                    </p>
                    <p className="text-sm font-semibold text-[var(--cream)]">
                      {exhibition.medium}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Tags / medium pills */}
            {exhibition.tags && exhibition.tags.length > 0 && (
              <>
                <SectionHeader title="Medium & Tags" />
                <div className="flex flex-wrap gap-2 mb-6">
                  {exhibition.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-2.5 py-1 border border-[var(--twilight)] font-[family-name:var(--font-ibm-plex-mono)] text-xs uppercase tracking-wider text-[var(--muted)]"
                    >
                      {tag.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              </>
            )}

            {/* Related events at this venue */}
            {venueEvents.length > 0 && venue && (
              <>
                <SectionHeader title={`Also at ${venue.name}`} />
                <div className="space-y-2 mb-6">
                  {venueEvents.map((event) => {
                    const timeStr = formatEventTime(event.start_time, event.is_all_day);
                    const dateStr = formatEventDate(event.start_date);
                    const isFreeAdmission =
                      exhibition.admission_type === "free" || exhibition.admission_type === "donation";
                    return (
                      <Link
                        key={event.id}
                        href={`/${activePortalSlug}/events/${event.id}`}
                        className="group flex items-stretch gap-0 rounded-lg overflow-hidden border border-[var(--twilight)] border-l-[2px] border-l-[#C9874F] hover:border-[var(--soft)] transition-colors bg-[var(--dusk)]/40"
                      >
                        {/* Time block */}
                        <div className="flex flex-col items-center justify-center px-3 py-2.5 min-w-[60px] bg-[#C9874F]/10 border-r border-[var(--twilight)]">
                          <span className="font-[family-name:var(--font-ibm-plex-mono)] text-xs font-bold text-[#C9874F] leading-tight tabular-nums">
                            {dateStr}
                          </span>
                          {timeStr && (
                            <span className="font-[family-name:var(--font-ibm-plex-mono)] text-2xs text-[var(--muted)] leading-tight mt-0.5">
                              {timeStr}
                            </span>
                          )}
                        </div>
                        {/* Content */}
                        <div className="flex-1 px-3 py-2.5 min-w-0">
                          <p className="font-[family-name:var(--font-ibm-plex-mono)] text-sm font-medium text-[var(--cream)] group-hover:text-[#C9874F] transition-colors leading-snug line-clamp-2">
                            {event.title}
                          </p>
                          {isFreeAdmission && (
                            <p className="font-[family-name:var(--font-ibm-plex-mono)] text-2xs text-[var(--neon-green)] mt-0.5">
                              Free with admission
                            </p>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </>
            )}

            {/* Venue section */}
            {venue && (
              <>
                <SectionHeader title="Venue" />
                <div className="mb-4">
                  <Link
                    href={`/${activePortalSlug}/venues/${venue.slug}`}
                    className="group flex items-start gap-3 p-3 border border-[var(--twilight)] hover:border-[var(--soft)] transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-[family-name:var(--font-ibm-plex-mono)] text-sm font-medium text-[var(--cream)] group-hover:text-[var(--action-primary)] transition-colors">
                        {venue.name}
                      </p>
                      {venue.neighborhood && (
                        <p className="font-[family-name:var(--font-ibm-plex-mono)] text-xs text-[var(--muted)] mt-0.5">
                          {venue.neighborhood}
                          {venue.city && venue.city !== "Atlanta" && `, ${venue.city}`}
                        </p>
                      )}
                      {venue.address && (
                        <p className="font-[family-name:var(--font-ibm-plex-mono)] text-xs text-[var(--muted)] mt-0.5">
                          {venue.address}
                        </p>
                      )}
                    </div>
                    <svg
                      className="w-4 h-4 text-[var(--muted)] flex-shrink-0 mt-0.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </Link>
                </div>
              </>
            )}

            {/* Plan My Visit CTA */}
            {venue && (
              <Link
                href={`/${activePortalSlug}?spot=${venue.slug}`}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#C9874F] px-4 py-3 font-[family-name:var(--font-ibm-plex-mono)] text-sm font-semibold text-[var(--void)] transition-opacity hover:opacity-90 mb-4"
              >
                <Ticket size={16} weight="bold" aria-hidden="true" />
                Plan My Visit
              </Link>
            )}

            {/* Source link */}
            {exhibition.source_url && (
              <>
                <SectionHeader title="Source" />
                <a
                  href={exhibition.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 font-[family-name:var(--font-ibm-plex-mono)] text-sm text-[var(--action-primary)] hover:underline"
                >
                  {isArtExhibition ? "View on gallery website" : "Visit website"}
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
              </>
            )}
          </InfoCard>
        </main>
      </div>

      {/* Sticky bar */}
      <DetailStickyBar
        shareLabel="Share Exhibition"
        showShareButton
        primaryAction={
          exhibition.admission_url
            ? {
                label:
                  exhibition.admission_type === "free"
                    ? "Plan My Visit"
                    : "Get Tickets",
                href: exhibition.admission_url,
              }
            : undefined
        }
        primaryColor="var(--action-primary)"
      />
    </>
  );
}
