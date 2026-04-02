"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import { MusicNote } from "@phosphor-icons/react";
import { DatePillStrip } from "@/components/find/DatePillStrip";
import { MusicShow } from "@/components/find/MusicShowCard";
import CategoryIcon from "@/components/CategoryIcon";
import { useShowListings } from "@/lib/hooks/useShowListings";
import { TransitionContainer } from "@/components/ui/TransitionContainer";
import { VenueShowsCard, type VenueShowsCardVenue } from "@/components/find/shows/VenueShowsCard";
import { type BaseShow } from "@/components/find/shows/ShowRow";

export interface MusicListingsViewProps {
  portalId: string;
  portalSlug: string;
}

type MusicFilter = "all" | "rock" | "hip-hop" | "jazz" | "electronic" | "r-and-b" | "country" | "latin";

const MUSIC_FILTERS: { key: MusicFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "rock", label: "Rock" },
  { key: "hip-hop", label: "Hip-Hop" },
  { key: "jazz", label: "Jazz" },
  { key: "electronic", label: "Electronic" },
  { key: "r-and-b", label: "R&B" },
  { key: "country", label: "Country" },
  { key: "latin", label: "Latin" },
];

function getInitialGenre(): MusicFilter {
  if (typeof window === "undefined") return "all";
  const param = new URLSearchParams(window.location.search).get("genre");
  const valid: MusicFilter[] = ["all", "rock", "hip-hop", "jazz", "electronic", "r-and-b", "country", "latin"];
  return (valid.includes(param as MusicFilter) ? param : "all") as MusicFilter;
}

function MusicSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-card bg-[var(--night)] border border-[var(--twilight)]/40 overflow-hidden"
        >
          {/* Venue header skeleton */}
          <div className="flex items-center gap-3 p-3">
            <div className="flex-shrink-0 w-16 h-16 rounded-lg skeleton-shimmer" />
            <div className="flex-1 space-y-2 py-0.5">
              <div className="h-4 w-1/2 skeleton-shimmer rounded" />
              <div className="h-3 w-1/3 skeleton-shimmer rounded" />
            </div>
          </div>
          {/* Show rows skeleton */}
          <div className="border-t border-[var(--twilight)]/30 divide-y divide-[var(--twilight)]/30">
            {[1, 2].map((j) => (
              <div key={j} className="flex items-start gap-3 py-2.5 px-3">
                <div className="h-3 w-12 skeleton-shimmer rounded flex-shrink-0 mt-0.5" />
                <div className="flex-1 h-4 skeleton-shimmer rounded" />
                <div className="h-5 w-14 skeleton-shimmer rounded-lg flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function MusicListingsView({ portalId: _portalId, portalSlug }: MusicListingsViewProps) {
  const [activeFilter, setActiveFilter] = useState<MusicFilter>(getInitialGenre);
  const [isPending, startTransition] = useTransition();

  const {
    selectedDate,
    setSelectedDate,
    shows,
    loading,
    metaLoading,
    datePills,
  } = useShowListings<MusicShow>({
    apiPath: "/api/whats-on/music",
    portalSlug,
  });

  function handleDateSelect(date: string) {
    startTransition(() => {
      setSelectedDate(date);
    });
  }

  // Sync genre filter to URL without triggering navigation
  useEffect(() => {
    const url = new URL(window.location.href);
    if (activeFilter === "all") {
      url.searchParams.delete("genre");
    } else {
      url.searchParams.set("genre", activeFilter);
    }
    window.history.replaceState({}, "", url.toString());
  }, [activeFilter]);

  // Genre counts from ALL shows (before filtering) for chip labels
  const genreCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const show of shows) {
      for (const g of show.genres || []) {
        const key = g.toLowerCase();
        counts[key] = (counts[key] || 0) + 1;
      }
    }
    return counts;
  }, [shows]);

  // Apply client-side genre filter
  const filteredShows =
    activeFilter === "all"
      ? shows
      : shows.filter((s) => s.genres?.some((g) => g.toLowerCase().includes(activeFilter)));

  // Group filtered shows by venue, sorted by show count desc
  const venueGroups = useMemo(() => {
    const groups = new Map<number, { venue: VenueShowsCardVenue; shows: BaseShow[] }>();
    for (const show of filteredShows) {
      const venueId = show.venue.id;
      if (!groups.has(venueId)) {
        groups.set(venueId, {
          venue: {
            id: show.venue.id,
            name: show.venue.name,
            slug: show.venue.slug,
            neighborhood: show.venue.neighborhood,
            image_url: show.venue.image_url,
          },
          shows: [],
        });
      }
      groups.get(venueId)!.shows.push(show);
    }
    return [...groups.values()].sort((a, b) => b.shows.length - a.shows.length);
  }, [filteredShows]);

  // Summary: unique venue count
  const uniqueVenueCount = venueGroups.length;
  const totalShows = filteredShows.length;
  const summaryItems =
    totalShows > 0
      ? [
          { label: totalShows === 1 ? "show" : "shows", value: totalShows },
          { label: uniqueVenueCount === 1 ? "venue" : "venues", value: uniqueVenueCount },
        ]
      : undefined;

  return (
    <div>
      <DatePillStrip
        dates={datePills}
        selectedDate={selectedDate}
        onSelect={handleDateSelect}
        todayLabel="Tonight"
        summaryItems={summaryItems}
      />

      {/* Genre filter pills */}
      <div className="flex items-center gap-2 px-3 sm:px-0 mb-3 overflow-x-auto scrollbar-hide">
        {MUSIC_FILTERS.map(({ key, label }) => {
          const isActive = activeFilter === key;
          const count: number | null = key === "all" ? null : (genreCounts[key.replace("-", " ")] ?? genreCounts[key] ?? 0);
          const countLabel = count !== null && count > 0 ? ` (${count})` : "";
          return (
            <button
              key={key}
              onClick={() => setActiveFilter(key)}
              className={`flex-shrink-0 min-h-[36px] px-3.5 py-1.5 rounded-full font-mono text-xs font-medium border transition-all ${
                isActive
                  ? "bg-[var(--neon-magenta)]/15 text-[var(--neon-magenta)] border-[var(--neon-magenta)]/40"
                  : "bg-transparent text-[var(--muted)] border-[var(--twilight)] hover:text-[var(--cream)] hover:border-[var(--soft)]/40"
              }`}
            >
              {label}{countLabel}
            </button>
          );
        })}
      </div>

      {metaLoading && <MusicSkeleton />}

      {!metaLoading && (
        <TransitionContainer isPending={isPending || loading}>
          {venueGroups.length > 0 && (
            <div className="space-y-4">
              {venueGroups.map((group) => (
                <VenueShowsCard
                  key={group.venue.id}
                  venue={group.venue}
                  shows={group.shows}
                  showCount={group.shows.length}
                  portalSlug={portalSlug}
                  accentColor="var(--neon-magenta)"
                  fallbackIcon={
                    <MusicNote
                      size={24}
                      weight="duotone"
                      className="text-[var(--neon-magenta)]"
                    />
                  }
                  renderMeta={(show) => {
                    const ms = show as MusicShow;
                    const hasGenres = ms.genres && ms.genres.length > 0;
                    const hasAgePolicy = Boolean(ms.age_policy);
                    if (!hasGenres && !hasAgePolicy) return null;
                    return (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {ms.genres?.slice(0, 2).map((g) => (
                          <span
                            key={g}
                            className="px-2 py-0.5 rounded-full text-2xs font-mono font-bold uppercase tracking-wider"
                            style={{
                              backgroundColor: "color-mix(in srgb, var(--neon-magenta) 15%, transparent)",
                              color: "var(--neon-magenta)",
                            }}
                          >
                            {g}
                          </span>
                        ))}
                        {hasAgePolicy && (
                          <span className="text-2xs text-[var(--muted)]">{ms.age_policy}</span>
                        )}
                      </div>
                    );
                  }}
                />
              ))}
            </div>
          )}

          {venueGroups.length === 0 && !loading && (
            <div className="py-16 text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--twilight)]/25 border border-[var(--twilight)]/50 mb-4">
                <CategoryIcon type="music" size={28} glow="subtle" />
              </div>
              <p className="text-sm text-[var(--soft)]">No live music on this date.</p>
              <p className="text-xs text-[var(--muted)] mt-2">Check the weekend — that&apos;s when the city comes alive.</p>
            </div>
          )}
        </TransitionContainer>
      )}
    </div>
  );
}
