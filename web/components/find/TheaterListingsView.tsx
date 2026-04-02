"use client";

import { useState, useEffect, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { MaskHappy } from "@phosphor-icons/react";
import { DatePillStrip } from "@/components/find/DatePillStrip";
import { type StageShow } from "@/components/find/StageShowCard";
import { VenueShowsCard } from "@/components/find/shows/VenueShowsCard";
import { type BaseShow } from "@/components/find/shows/ShowRow";
import { TransitionContainer } from "@/components/ui/TransitionContainer";
import { useShowListings } from "@/lib/hooks/useShowListings";

export interface TheaterListingsViewProps {
  portalId: string;
  portalSlug: string;
}

type TheaterFilter = "all" | "drama" | "musical" | "dance" | "improv";

const THEATER_FILTERS: { key: TheaterFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "drama", label: "Drama" },
  { key: "musical", label: "Musical" },
  { key: "dance", label: "Dance" },
  { key: "improv", label: "Improv" },
];

const ACCENT = "var(--neon-cyan)";

function TheaterSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-card bg-[var(--night)] border border-[var(--twilight)]/40 overflow-hidden"
        >
          <div className="flex items-center gap-3 p-3">
            <div className="w-16 h-16 rounded-lg skeleton-shimmer flex-shrink-0" />
            <div className="flex-1 space-y-2 py-1">
              <div className="h-4 w-1/2 skeleton-shimmer rounded" />
              <div className="h-3 w-1/3 skeleton-shimmer rounded" />
            </div>
          </div>
          <div className="border-t border-[var(--twilight)]/30 divide-y divide-[var(--twilight)]/30">
            {[1, 2].map((j) => (
              <div key={j} className="flex gap-3 items-start py-2.5 px-3">
                <div className="h-3 w-12 skeleton-shimmer rounded flex-shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-2/3 skeleton-shimmer rounded" />
                  <div className="h-3 w-1/4 skeleton-shimmer rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function groupShowsByVenue(shows: StageShow[]): Map<number, StageShow[]> {
  const map = new Map<number, StageShow[]>();
  for (const show of shows) {
    const venueId = show.venue.id;
    if (!map.has(venueId)) map.set(venueId, []);
    map.get(venueId)!.push(show);
  }
  return map;
}

function toBaseShow(show: StageShow): BaseShow {
  return {
    event_id: show.event_id,
    title: show.title,
    start_time: show.start_time,
    is_free: show.is_free,
    ticket_url: show.ticket_url,
    price_min: null,
  };
}

function RunPeriodBadge({ show }: { show: StageShow }) {
  const runPeriod =
    show.end_date && show.end_date !== show.start_date
      ? `Runs through ${new Date(show.end_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
      : "Today only";
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-2xs font-mono font-bold uppercase tracking-wider"
      style={{
        backgroundColor: "color-mix(in srgb, var(--neon-cyan) 15%, transparent)",
        color: "var(--neon-cyan)",
      }}
    >
      {runPeriod}
    </span>
  );
}

export default function TheaterListingsView({ portalId: _portalId, portalSlug }: TheaterListingsViewProps) {
  const searchParams = useSearchParams();
  const initialFilter = (searchParams.get("genre") as TheaterFilter) || "all";
  const [activeFilter, setActiveFilter] = useState<TheaterFilter>(initialFilter);
  const [isPending, startTransition] = useTransition();

  const {
    selectedDate,
    setSelectedDate,
    shows,
    loading,
    metaLoading,
    datePills,
  } = useShowListings<StageShow>({
    apiPath: "/api/whats-on/stage?filter=theater",
    portalSlug,
  });

  // Sync filter to URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (activeFilter === "all") {
      params.delete("genre");
    } else {
      params.set("genre", activeFilter);
    }
    const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    window.history.replaceState(null, "", newUrl);
  }, [activeFilter]);

  function handleDateSelect(date: string) {
    startTransition(() => {
      setSelectedDate(date);
    });
  }

  function handleFilterSelect(key: TheaterFilter) {
    startTransition(() => {
      setActiveFilter(key);
    });
  }

  // Apply client-side genre filter
  const filteredShows =
    activeFilter === "all"
      ? shows
      : shows.filter((s) => {
          const g = s.genres.map((g) => g.toLowerCase());
          const t = s.tags.map((t) => t.toLowerCase());
          return g.includes(activeFilter) || t.includes(activeFilter);
        });

  // Group by venue
  const venueGroups = groupShowsByVenue(filteredShows);
  const venueGroupEntries = Array.from(venueGroups.entries());

  // Summary counts
  const uniqueVenueCount = venueGroups.size;
  const summaryItems =
    filteredShows.length > 0
      ? [
          { label: filteredShows.length === 1 ? "show" : "shows", value: filteredShows.length },
          { label: uniqueVenueCount === 1 ? "venue" : "venues", value: uniqueVenueCount },
        ]
      : undefined;

  // Genre count badges for filter pills
  const genreCounts = THEATER_FILTERS.reduce<Record<string, number>>((acc, { key }) => {
    if (key === "all") {
      acc[key] = shows.length;
    } else {
      acc[key] = shows.filter((s) => {
        const g = s.genres.map((g) => g.toLowerCase());
        const t = s.tags.map((t) => t.toLowerCase());
        return g.includes(key) || t.includes(key);
      }).length;
    }
    return acc;
  }, {});

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
        {THEATER_FILTERS.map(({ key, label }) => {
          const isActive = activeFilter === key;
          const count = genreCounts[key] ?? 0;
          return (
            <button
              key={key}
              onClick={() => handleFilterSelect(key)}
              className={`flex-shrink-0 min-h-[36px] px-3.5 py-1.5 rounded-full font-mono text-xs font-medium border transition-all ${
                isActive
                  ? "bg-[var(--neon-cyan)]/15 text-[var(--neon-cyan)] border-[var(--neon-cyan)]/40"
                  : "bg-transparent text-[var(--muted)] border-[var(--twilight)] hover:text-[var(--cream)] hover:border-[var(--soft)]/40"
              }`}
            >
              {label}
              {!metaLoading && key !== "all" && count > 0 && (
                <span
                  className={`ml-1.5 text-2xs tabular-nums ${
                    isActive ? "text-[var(--neon-cyan)]/70" : "text-[var(--muted)]/60"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {metaLoading && <TheaterSkeleton />}

      {!metaLoading && (
        <TransitionContainer isPending={isPending || loading}>
          {venueGroupEntries.length > 0 && (
            <div className="space-y-3">
              {venueGroupEntries.map(([venueId, venueShows]) => {
                const venue = venueShows[0].venue;
                return (
                  <VenueShowsCard
                    key={venueId}
                    venue={venue}
                    shows={venueShows.map(toBaseShow)}
                    showCount={venueShows.length}
                    portalSlug={portalSlug}
                    accentColor={ACCENT}
                    fallbackIcon={
                      <MaskHappy
                        size={28}
                        weight="duotone"
                        style={{ color: "var(--neon-cyan)" }}
                        aria-hidden="true"
                      />
                    }
                    renderMeta={(show) => (
                      <RunPeriodBadge show={venueShows.find((s) => s.event_id === show.event_id)!} />
                    )}
                  />
                );
              })}
            </div>
          )}

          {!loading && !isPending && filteredShows.length === 0 && (
            <div className="py-12 sm:py-16 text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--twilight)]/25 border border-[var(--twilight)]/50 mb-4">
                <MaskHappy
                  size={28}
                  weight="duotone"
                  style={{ color: "var(--neon-cyan)" }}
                  aria-hidden="true"
                />
              </div>
              <div className="text-[var(--muted)] font-mono text-sm">
                No theater shows found for this date
              </div>
              <div className="text-[var(--muted)]/60 font-mono text-xs mt-2">
                Try a different day or check back later
              </div>
            </div>
          )}
        </TransitionContainer>
      )}
    </div>
  );
}
