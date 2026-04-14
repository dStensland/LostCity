"use client";

import { useEffect, useState, useMemo } from "react";
import { MusicNote } from "@phosphor-icons/react";
import { TonightShowCard } from "@/components/feed/venues/TonightShowCard";
import { VenueShowCard } from "@/components/feed/venues/VenueShowCard";
import { GenreFilterStrip } from "@/components/feed/GenreFilterStrip";
import FeedSectionHeader from "@/components/feed/FeedSectionHeader";
import { getGenreBuckets, type GenreBucket } from "@/lib/genre-map";
import { buildExploreUrl } from "@/lib/find-url";

// ── Types ─────────────────────────────────────────────────────────────────────

interface MusicShow {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  doors_time: string | null;
  price_min: number | null;
  image_url: string | null;
  is_free: boolean;
  tags: string[];
  genres: string[];
}

interface MusicVenue {
  id: number;
  name: string;
  slug: string;
  neighborhood: string | null;
  image_url: string | null;
  place_type: string | null;
}

interface MusicVenueGroup {
  venue: MusicVenue;
  shows: MusicShow[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ACCENT = "#E855A0";
const FETCH_TIMEOUT_MS = 10_000;
const MAX_DIRECTORY_VENUES = 6;
const MAX_TONIGHT_SHOWS = 10;

/** Filter out non-music events that leak through category/is_show filters */
const JUNK_TITLE_PATTERNS = [
  /\bfor the very young\b/i,
  /\bkids\b.*\bcrafts?\b/i,
  /\bfield trips?\b/i,
  /\bvinofile\b/i,
  /\bpick-?up party\b/i,
  /\bclosing reception\b/i,
  /\bopening reception\b/i,
  /\blistening session\b/i,
  /\bportrait session\b/i,
  /^event for calendar\b/i,
  /^test\b/i,
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function LiveMusicSection({
  portalSlug,
}: {
  portalSlug: string;
}) {
  const [data, setData] = useState<MusicVenueGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeGenre, setActiveGenre] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    fetch(
      `/api/portals/${encodeURIComponent(portalSlug)}/shows?categories=music&is_show=true`,
      { signal: controller.signal },
    )
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ venues: MusicVenueGroup[] }>;
      })
      .then((json) => {
        if (!controller.signal.aborted) {
          setData(json.venues ?? []);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return;
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [portalSlug]);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const filteredData = useMemo(() => {
    if (!activeGenre) return data;
    return data
      .map((vg) => ({
        ...vg,
        shows: vg.shows.filter((s) => {
          const fromGenres = getGenreBuckets(s.genres);
          const fromTags = getGenreBuckets(s.tags);
          const allBuckets = [...new Set([...fromGenres, ...fromTags])];
          return allBuckets.includes(activeGenre as GenreBucket);
        }),
      }))
      .filter((vg) => vg.shows.length > 0);
  }, [data, activeGenre]);

  const tonightShows = useMemo(() => {
    const flat: { show: MusicShow; venue: MusicVenue }[] = [];
    const seenTitles = new Set<string>();
    for (const vg of filteredData) {
      for (const show of vg.shows) {
        if (show.start_date !== today) continue;
        // Filter junk titles
        if (JUNK_TITLE_PATTERNS.some((p) => p.test(show.title))) continue;
        // Deduplicate by normalized title
        const normTitle = show.title.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (seenTitles.has(normTitle)) continue;
        seenTitles.add(normTitle);
        flat.push({ show, venue: vg.venue });
      }
    }
    // Sort evening-first (17:00+), then by time ascending
    return flat
      .sort((a, b) => {
        const ta = a.show.start_time ?? "23:59";
        const tb = b.show.start_time ?? "23:59";
        const aEvening = ta >= "17:00";
        const bEvening = tb >= "17:00";
        if (aEvening !== bEvening) return aEvening ? -1 : 1;
        return ta.localeCompare(tb);
      })
      .slice(0, MAX_TONIGHT_SHOWS);
  }, [filteredData, today]);

  const allDirectoryVenues = useMemo(() => {
    return filteredData
      .filter((vg) => vg.venue.place_type === "music_venue")
      .sort((a, b) => {
        const aToday = a.shows.some((s) => s.start_date === today);
        const bToday = b.shows.some((s) => s.start_date === today);
        if (aToday !== bToday) return aToday ? -1 : 1;
        return b.shows.length - a.shows.length;
      });
  }, [filteredData, today]);

  const directoryVenues = allDirectoryVenues.slice(0, MAX_DIRECTORY_VENUES);
  const overflowCount = allDirectoryVenues.length - MAX_DIRECTORY_VENUES;

  // Don't render the section at all if there's no data
  if (!loading && data.length === 0) return null;

  const hasContent = tonightShows.length > 0 || directoryVenues.length > 0;
  const seeAllHref = buildExploreUrl({
    portalSlug,
    lane: "shows",
    extraParams: { tab: "music" },
  });

  return (
    <section>
      <FeedSectionHeader
        title="Live Music"
        priority="secondary"
        variant="destinations"
        accentColor={ACCENT}
        icon={<MusicNote weight="duotone" className="w-5 h-5" />}
        seeAllHref={seeAllHref}
      />

      {loading ? (
        <LiveMusicSkeleton />
      ) : (
        <div>
          <GenreFilterStrip
            activeGenre={activeGenre}
            onGenreChange={setActiveGenre}
          />

          {tonightShows.length > 0 && (
            <div className="mb-4">
              <p
                className="font-mono text-xs font-bold tracking-[0.12em] uppercase mb-2.5"
                style={{ color: ACCENT }}
              >
                Tonight
              </p>
              <div className="flex gap-2.5 overflow-x-auto scrollbar-hide snap-x snap-mandatory -mx-1 px-1 pb-2">
                {tonightShows.map(({ show, venue }) => (
                  <TonightShowCard
                    key={show.id}
                    show={show}
                    venue={venue}
                    portalSlug={portalSlug}
                    accentColor={ACCENT}
                  />
                ))}
              </div>
            </div>
          )}

          {directoryVenues.length > 0 && (
            <div>
              <p className="font-mono text-xs font-bold tracking-[0.12em] uppercase text-[var(--muted)] mb-2.5">
                {tonightShows.length > 0
                  ? "This Week at Atlanta Venues"
                  : "Atlanta Music Venues"}
              </p>
              <div className="flex flex-col gap-1.5">
                {directoryVenues.map((vg) => (
                  <VenueShowCard
                    key={vg.venue.id}
                    venue={vg.venue}
                    shows={vg.shows}
                    totalCount={vg.shows.length}
                    portalSlug={portalSlug}
                    accentColor={ACCENT}
                    venueType="music_venue"
                  />
                ))}
              </div>
              {overflowCount > 0 && (
                <div className="flex justify-end pt-2">
                  <a
                    href={seeAllHref}
                    className="text-xs font-mono hover:opacity-80 transition-opacity"
                    style={{ color: ACCENT }}
                  >
                    +{overflowCount} more venues &rarr;
                  </a>
                </div>
              )}
            </div>
          )}

          {activeGenre && !hasContent && (
            <p className="py-6 text-center text-sm text-[var(--muted)]">
              No {activeGenre} shows this week
            </p>
          )}
        </div>
      )}
    </section>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function LiveMusicSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-7 w-16 rounded-full bg-[var(--twilight)]/30 animate-pulse"
          />
        ))}
      </div>
      <div className="flex gap-2.5 overflow-hidden">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="flex-shrink-0 w-[260px] h-[160px] rounded-card bg-[var(--night)] border border-[var(--twilight)]/30 animate-pulse"
          />
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-24 rounded-lg bg-[var(--night)] border border-[var(--twilight)]/30 animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}
