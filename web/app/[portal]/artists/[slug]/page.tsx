import { notFound } from "next/navigation";
import Link from "next/link";
import { cache } from "react";
import { format, parseISO } from "date-fns";
import { PortalHeader } from "@/components/headers";
import { getCachedPortalBySlug } from "@/lib/portal";
import {
  getArtistBySlug,
  getArtistEvents,
  getArtistFestivals,
  getDisciplineColor,
  getDisciplineLabel,
} from "@/lib/artists";
import {
  DetailHero,
  InfoCard,
  MetadataGrid,
  SectionHeader,
  RelatedSection,
  RelatedCard,
  DetailStickyBar,
} from "@/components/detail";
import CategoryIcon, { getCategoryColor } from "@/components/CategoryIcon";
import { formatTimeSplit, safeJsonLd } from "@/lib/formats";
import type { Metadata } from "next";
import ScopedStylesServer from "@/components/ScopedStylesServer";
import { createCssVarClass } from "@/lib/css-utils";

export const revalidate = 300;

type Props = {
  params: Promise<{ portal: string; slug: string }>;
};

const getCachedArtistBySlug = cache(getArtistBySlug);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, portal: portalSlug } = await params;
  const artist = await getCachedArtistBySlug(slug);
  const portal = await getCachedPortalBySlug(portalSlug);

  if (!artist) {
    return { title: "Artist Not Found" };
  }

  const portalName = portal?.name || "Lost City";
  const description = artist.bio
    ? artist.bio.slice(0, 160)
    : `${artist.name} — ${getDisciplineLabel(artist.discipline)}. Find upcoming events and festival appearances.`;

  return {
    title: `${artist.name} | ${portalName}`,
    description,
    openGraph: {
      title: artist.name,
      description,
      type: "profile",
      images: artist.image_url ? [{ url: artist.image_url }] : [],
    },
    twitter: {
      card: artist.image_url ? "summary_large_image" : "summary",
      title: artist.name,
      description,
      images: artist.image_url ? [artist.image_url] : [],
    },
  };
}

function generateArtistSchema(
  artist: NonNullable<Awaited<ReturnType<typeof getArtistBySlug>>>
) {
  const isBand = artist.discipline === "band";
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": isBand ? "MusicGroup" : "Person",
    name: artist.name,
  };

  if (artist.bio) {
    schema.description = artist.bio;
  }

  if (artist.image_url) {
    schema.image = [artist.image_url];
  }

  if (artist.genres && artist.genres.length > 0) {
    schema.genre = artist.genres;
  }

  if (artist.hometown) {
    schema.homeLocation = {
      "@type": "Place",
      name: artist.hometown,
    };
  }

  // External links
  const sameAs: string[] = [];
  if (artist.spotify_id) {
    sameAs.push(`https://open.spotify.com/artist/${artist.spotify_id}`);
  }
  if (artist.wikidata_id) {
    sameAs.push(`https://www.wikidata.org/wiki/${artist.wikidata_id}`);
  }
  if (sameAs.length > 0) {
    schema.sameAs = sameAs;
  }

  return schema;
}

export default async function PortalArtistPage({ params }: Props) {
  const { slug, portal: portalSlug } = await params;
  const artist = await getCachedArtistBySlug(slug);
  const portal = await getCachedPortalBySlug(portalSlug);

  if (!artist) {
    notFound();
  }

  const activePortalSlug = portal?.slug || portalSlug;
  const activePortalName = portal?.name || portalSlug.charAt(0).toUpperCase() + portalSlug.slice(1);

  const [upcomingEvents, festivals] = await Promise.all([
    getArtistEvents(artist.id, true),
    getArtistFestivals(artist.id),
  ]);

  const accentColor = getDisciplineColor(artist.discipline);
  const accentClass = createCssVarClass("--accent-color", accentColor, "artist");
  const artistSchema = generateArtistSchema(artist);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(artistSchema) }}
      />



      <ScopedStylesServer css={accentClass?.css || ""} />

      <div className={`min-h-screen ${accentClass?.className ?? ""}`}>
        <PortalHeader
          portalSlug={activePortalSlug}
          portalName={activePortalName}
          hideNav
        />

        <main className="max-w-3xl mx-auto px-4 py-4 sm:py-6 pb-28 space-y-5 sm:space-y-8">
          {/* Hero */}
          <DetailHero
            mode={artist.image_url ? "image" : "fallback"}
            imageUrl={artist.image_url}
            title={artist.name}
            subtitle={artist.hometown || getDisciplineLabel(artist.discipline)}
            categoryColor={accentColor}
            backFallbackHref={`/${activePortalSlug}`}
            categoryIcon={
              <svg className="w-12 h-12 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
              </svg>
            }
            badge={
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded text-xs font-mono uppercase tracking-wider bg-accent-20 text-accent border border-accent-40">
                {getDisciplineLabel(artist.discipline)}
              </span>
            }
          />

          {/* Info Card */}
          <InfoCard accentColor={accentColor}>
            <MetadataGrid
              items={[
                {
                  label: "Type",
                  value: getDisciplineLabel(artist.discipline),
                },
                ...(artist.hometown
                  ? [{ label: "From", value: artist.hometown }]
                  : []),
                ...(upcomingEvents.length > 0
                  ? [{ label: "Upcoming", value: `${upcomingEvents.length} event${upcomingEvents.length !== 1 ? "s" : ""}` }]
                  : []),
              ]}
              className="mb-8"
            />

            {/* Bio */}
            {artist.bio && (
              <>
                <SectionHeader title="About" />
                <p className="text-[var(--soft)] whitespace-pre-wrap leading-relaxed mb-6">
                  {artist.bio}
                </p>
              </>
            )}

            {/* Genres */}
            {artist.genres && artist.genres.length > 0 && (
              <>
                <SectionHeader title="Genres" count={artist.genres.length} />
                <div className="flex flex-wrap gap-2 mb-6">
                  {artist.genres.map((genre) => (
                    <span
                      key={genre}
                      className="px-2.5 py-1 rounded-full text-xs font-medium border border-[var(--twilight)] bg-[var(--void)] text-[var(--soft)]"
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              </>
            )}
          </InfoCard>

          {/* Upcoming Events */}
          {upcomingEvents.length > 0 && (
            <RelatedSection
              title="Upcoming Events"
              count={upcomingEvents.length}
            >
              {upcomingEvents.map((event) => {
                const dateObj = parseISO(event.start_date);
                const eventColor = event.category ? getCategoryColor(event.category) : "var(--coral)";

                let subtitle = format(dateObj, "EEE, MMM d");
                if (event.start_time) {
                  const { time, period } = formatTimeSplit(event.start_time);
                  subtitle += ` · ${time} ${period}`;
                }
                if (event.venue) {
                  subtitle += ` · ${event.venue.name}`;
                }

                return (
                  <RelatedCard
                    key={event.id}
                    variant="compact"
                    href={`/${activePortalSlug}/events/${event.id}`}
                    title={event.title}
                    subtitle={subtitle}
                    icon={<CategoryIcon type={event.category || "music"} size={20} />}
                    accentColor={eventColor}
                  />
                );
              })}
            </RelatedSection>
          )}

          {/* Festival Appearances */}
          {festivals.length > 0 && (
            <RelatedSection
              title="Festival Appearances"
              count={festivals.length}
            >
              {festivals.map((festival) => (
                <RelatedCard
                  key={festival.id}
                  variant="image"
                  href={`/${activePortalSlug}/festivals/${festival.slug}`}
                  title={festival.name}
                  subtitle={
                    festival.announced_start
                      ? format(parseISO(festival.announced_start), "MMM yyyy")
                      : "Dates TBA"
                  }
                  imageUrl={festival.image_url || undefined}
                  icon={
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 4v16m0-12h9l-1.5 3L14 14H5" />
                    </svg>
                  }
                  accentColor="var(--neon-magenta)"
                />
              ))}
            </RelatedSection>
          )}
        </main>
      </div>

      {/* Sticky bar with external links */}
      <DetailStickyBar
        shareLabel="Share Artist"
        secondaryActions={
          artist.spotify_id ? (
            <a
              href={`https://open.spotify.com/artist/${artist.spotify_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-lg border border-[var(--twilight)] hover:bg-[var(--twilight)] text-[var(--soft)] text-sm font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
              </svg>
              Spotify
            </a>
          ) : null
        }
      />
    </>
  );
}
