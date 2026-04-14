// web/components/feed/sections/MusicTabContent.tsx
"use client";

import { useEffect, useState, useMemo } from "react";
import { TonightShowCard } from "@/components/feed/venues/TonightShowCard";
import { VenueShowCard } from "@/components/feed/venues/VenueShowCard";
import { GenreFilterStrip } from "@/components/feed/GenreFilterStrip";
import { getGenreBuckets, type GenreBucket } from "@/lib/genre-map";

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

// ── Component ─────────────────────────────────────────────────────────────────

export default function MusicTabContent({
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

  // Apply genre filter to all data — use genres column (dedicated genre data
  // from LLM extraction + artist enrichment), falling back to tags for events
  // that only have genre info in tags
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

  // Tonight: flatten all shows from all venues where start_date === today
  const tonightShows = useMemo(() => {
    const flat: { show: MusicShow; venue: MusicVenue }[] = [];
    for (const vg of filteredData) {
      for (const show of vg.shows) {
        if (show.start_date === today) {
          flat.push({ show, venue: vg.venue });
        }
      }
    }
    return flat.sort((a, b) =>
      (a.show.start_time ?? "").localeCompare(b.show.start_time ?? ""),
    );
  }, [filteredData, today]);

  // Directory: only music_venue place_type, sorted by today-first then show count
  const directoryVenues = useMemo(() => {
    return filteredData
      .filter((vg) => vg.venue.place_type === "music_venue")
      .sort((a, b) => {
        const aToday = a.shows.some((s) => s.start_date === today);
        const bToday = b.shows.some((s) => s.start_date === today);
        if (aToday !== bToday) return aToday ? -1 : 1;
        return b.shows.length - a.shows.length;
      });
  }, [filteredData, today]);

  if (loading) return <MusicTabSkeleton />;

  if (data.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-[var(--muted)]">
        No music shows this week
      </p>
    );
  }

  const hasContent = tonightShows.length > 0 || directoryVenues.length > 0;

  return (
    <div>
      <GenreFilterStrip
        activeGenre={activeGenre}
        onGenreChange={setActiveGenre}
      />

      {/* Tonight carousel */}
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

      {/* Venue directory */}
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
        </div>
      )}

      {/* Genre filter yields nothing */}
      {activeGenre && !hasContent && (
        <p className="py-6 text-center text-sm text-[var(--muted)]">
          No {activeGenre} shows this week
        </p>
      )}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function MusicTabSkeleton() {
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
