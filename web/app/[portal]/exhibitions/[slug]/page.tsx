import { notFound } from "next/navigation";
import Link from "next/link";
import { getCachedPortalBySlug } from "@/lib/portal";
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

export const revalidate = 300;

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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, portal: portalSlug } = await params;
  const [exhibition, portal] = await Promise.all([
    fetchExhibition(slug),
    getCachedPortalBySlug(portalSlug),
  ]);

  if (!exhibition) {
    return {
      title: "Exhibition Not Found",
      robots: { index: false, follow: false },
    };
  }

  const portalName = portal?.name || "Lost City: Arts";
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
      canonical: `/${portalSlug}/exhibitions/${slug}`,
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
  const [exhibition, portal] = await Promise.all([
    fetchExhibition(slug),
    getCachedPortalBySlug(portalSlug),
  ]);

  if (!exhibition) {
    notFound();
  }

  const activePortalSlug = portal?.slug || portalSlug;
  const accentColor = "var(--action-primary)";

  const artists = exhibition.artists ?? [];
  const venue = exhibition.venue ?? null;
  const dateRange = formatDateRange(exhibition.opening_date, exhibition.closing_date);
  const closingSoon = isClosingSoon(exhibition, 7);
  const currentlyShowing = isCurrentlyShowing(exhibition);

  const typeLabel = exhibition.exhibition_type
    ? EXHIBITION_TYPE_LABELS[exhibition.exhibition_type]
    : null;

  const admissionLabel = exhibition.admission_type
    ? ADMISSION_TYPE_LABELS[exhibition.admission_type]
    : null;

  // Metadata grid items
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
    ...(exhibition.medium
      ? [{ label: "Medium", value: exhibition.medium }]
      : []),
  ];

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

          {/* Title block (arts-specific) — shown above InfoCard */}
          {/* Underground Gallery uses Playfair Display italic for exhibition titles */}
          <div className="space-y-1">
            <p className="font-[family-name:var(--font-ibm-plex-mono)] text-xs uppercase tracking-[0.14em] text-[var(--action-primary)]">
              {"// exhibition"}
              {typeLabel && ` · ${typeLabel.toLowerCase()}`}
            </p>
            <h1 className="font-[family-name:var(--font-playfair-display)] italic text-2xl sm:text-3xl text-[var(--cream)] leading-snug">
              {exhibition.title}
            </h1>

            {/* Artists */}
            {artists.length > 0 && (
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

            {/* Date range */}
            <p
              className={`font-[family-name:var(--font-ibm-plex-mono)] text-sm mt-1 ${
                closingSoon
                  ? "text-[var(--action-primary)]"
                  : "text-[var(--muted)]"
              }`}
            >
              {closingSoon && "Closing soon — "}
              {dateRange}
            </p>
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
                  View on gallery website
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
