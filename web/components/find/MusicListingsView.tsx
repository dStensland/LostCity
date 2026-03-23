"use client";

import { useState } from "react";
import { DatePillStrip } from "@/components/find/DatePillStrip";
import { MusicShowCard, type MusicShow } from "@/components/find/MusicShowCard";
import CategoryIcon from "@/components/CategoryIcon";
import { useShowListings } from "@/lib/hooks/useShowListings";

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

function MusicSkeleton() {
  return (
    <div className="space-y-2.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="flex gap-3 items-start p-3 rounded-xl border border-[var(--twilight)]/30"
        >
          <div className="flex-1 space-y-2 py-0.5">
            <div className="h-4 w-2/3 skeleton-shimmer rounded" />
            <div className="h-3 w-1/3 skeleton-shimmer rounded" />
            <div className="h-3 w-2/5 skeleton-shimmer rounded" />
          </div>
          <div className="h-6 w-16 skeleton-shimmer rounded-lg flex-shrink-0 mt-0.5" />
        </div>
      ))}
    </div>
  );
}

export default function MusicListingsView({ portalId, portalSlug }: MusicListingsViewProps) {
  const [activeFilter, setActiveFilter] = useState<MusicFilter>("all");

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

  // Apply client-side genre filter
  const filteredShows =
    activeFilter === "all"
      ? shows
      : shows.filter((s) => s.genres?.some((g) => g.toLowerCase().includes(activeFilter)));

  // Summary: unique venue count
  const uniqueVenueCount = new Set(filteredShows.map((s) => s.venue.id)).size;
  const summaryItems =
    filteredShows.length > 0
      ? [
          { label: filteredShows.length === 1 ? "show" : "shows", value: filteredShows.length },
          { label: uniqueVenueCount === 1 ? "venue" : "venues", value: uniqueVenueCount },
        ]
      : undefined;

  return (
    <div>
      <DatePillStrip
        dates={datePills}
        selectedDate={selectedDate}
        onSelect={setSelectedDate}
        todayLabel="Tonight"
        summaryItems={summaryItems}
      />

      {/* Genre filter pills */}
      <div className="flex items-center gap-2 px-3 sm:px-0 mb-3 overflow-x-auto scrollbar-hide">
        {MUSIC_FILTERS.map(({ key, label }) => {
          const isActive = activeFilter === key;
          return (
            <button
              key={key}
              onClick={() => setActiveFilter(key)}
              className={`flex-shrink-0 min-h-[36px] px-3.5 py-1.5 rounded-full font-mono text-xs font-medium border transition-all ${
                isActive
                  ? "bg-[var(--coral)]/15 text-[var(--coral)] border-[var(--coral)]/40"
                  : "bg-transparent text-[var(--muted)] border-[var(--twilight)] hover:text-[var(--cream)] hover:border-[var(--soft)]/40"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {metaLoading && <MusicSkeleton />}

      {!metaLoading && (
        <div className="relative">
          {loading && shows.length > 0 && (
            <div className="absolute inset-0 z-10 bg-[var(--void)]/40 backdrop-blur-[1px] rounded-xl flex items-start justify-center pt-24 pointer-events-none">
              <div className="w-5 h-5 border-2 border-[var(--coral)]/40 border-t-[var(--coral)] rounded-full animate-spin" />
            </div>
          )}

          {loading && shows.length === 0 && <MusicSkeleton />}

          {filteredShows.length > 0 && (
            <div
              className={`space-y-2.5 sm:grid sm:grid-cols-2 sm:gap-3 sm:space-y-0 ${loading ? "pointer-events-none" : ""}`}
            >
              {filteredShows.map((show) => (
                <MusicShowCard
                  key={show.event_id}
                  show={show}
                  portalSlug={portalSlug}
                  portalId={portalId}
                  selectedDate={selectedDate}
                />
              ))}
            </div>
          )}

          {!loading && filteredShows.length === 0 && (
            <div className="py-12 sm:py-16 text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--twilight)]/25 border border-[var(--twilight)]/50 mb-4">
                <CategoryIcon type="music" size={28} glow="subtle" />
              </div>
              <div className="text-[var(--muted)] font-mono text-sm">
                No shows found for this date
              </div>
              <div className="text-[var(--muted)]/60 font-mono text-xs mt-2">
                Try a different day or check back later
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
