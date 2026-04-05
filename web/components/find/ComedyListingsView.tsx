"use client";

import { useState, useEffect, useTransition } from "react";
import { Microphone } from "@phosphor-icons/react";
import { DatePillStrip } from "@/components/find/DatePillStrip";
import { type StageShow } from "@/components/find/StageShowCard";
import { VenueShowsCard } from "@/components/find/shows/VenueShowsCard";
import { type BaseShow } from "@/components/find/shows/ShowRow";
import { TransitionContainer } from "@/components/ui/TransitionContainer";
import { useShowListings } from "@/lib/hooks/useShowListings";
import { useExploreUrlState } from "@/lib/explore-platform/url-state";
import type { ShowsListingsInitialData } from "@/lib/explore-platform/lane-data";

export interface ComedyListingsViewProps {
  portalId: string;
  portalSlug: string;
  initialData?: ShowsListingsInitialData<"comedy"> | null;
}

type ComedyFilter = "all" | "standup" | "improv" | "open-mic";

const COMEDY_FILTERS: { key: ComedyFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "standup", label: "Stand-Up" },
  { key: "improv", label: "Improv" },
  { key: "open-mic", label: "Open Mic" },
];

const ACCENT = "var(--gold)";

function ComedySkeleton() {
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

function inferComedyFormat(show: StageShow): string {
  const t = (show.title || "").toLowerCase();
  const tags = (show.tags || []).map((tag) => tag.toLowerCase());
  if (t.includes("open mic") || tags.includes("open-mic")) return "Open Mic";
  if (t.includes("improv") || tags.includes("improv")) return "Improv";
  return "Stand-Up";
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

function FormatBadge({ show }: { show: StageShow }) {
  const format = inferComedyFormat(show);
  return (
    <span
      className="px-2 py-0.5 rounded-full text-2xs font-mono font-bold uppercase tracking-wider"
      style={{
        backgroundColor: "color-mix(in srgb, var(--gold) 15%, transparent)",
        color: "var(--gold)",
      }}
    >
      {format}
    </span>
  );
}

/** Map comedy filter key to a format label for filtering */
function filterMatchesFormat(key: ComedyFilter, show: StageShow): boolean {
  const format = inferComedyFormat(show);
  if (key === "standup") return format === "Stand-Up";
  if (key === "improv") return format === "Improv";
  if (key === "open-mic") return format === "Open Mic";
  return true;
}

const VALID_FILTERS = new Set<ComedyFilter>(["all", "standup", "improv", "open-mic"]);

export default function ComedyListingsView({
  portalSlug,
  initialData,
}: ComedyListingsViewProps) {
  const state = useExploreUrlState();
  const rawGenre = state.params.get("genre");
  const rawDate = state.params.get("date");
  const genreFromUrl =
    rawGenre && VALID_FILTERS.has(rawGenre as ComedyFilter)
      ? (rawGenre as ComedyFilter)
      : "all";
  const [activeFilter, setActiveFilter] = useState<ComedyFilter>(genreFromUrl);
  const [isPending, startTransition] = useTransition();

  const {
    selectedDate,
    setSelectedDate,
    shows,
    loading,
    metaLoading,
    datePills,
  } = useShowListings<StageShow>({
    apiPath: "/api/whats-on/stage?filter=comedy",
    portalSlug,
    initialPayload: initialData
      ? {
          date: initialData.date,
          meta: initialData.meta,
          shows: initialData.shows,
          requestKey: initialData.requestKey,
        }
      : null,
  });

  useEffect(() => {
    setActiveFilter(genreFromUrl);
  }, [genreFromUrl]);

  useEffect(() => {
    if (rawDate && rawDate !== selectedDate) {
      setSelectedDate(rawDate);
    }
  }, [rawDate, selectedDate, setSelectedDate]);

  function handleDateSelect(date: string) {
    startTransition(() => {
      setSelectedDate(date);
      state.setLaneParams({ date }, "replace");
    });
  }

  function handleFilterSelect(key: ComedyFilter) {
    startTransition(() => {
      setActiveFilter(key);
      state.setLaneParams({ genre: key === "all" ? null : key }, "replace");
    });
  }

  // Apply client-side format filter
  const filteredShows =
    activeFilter === "all"
      ? shows
      : shows.filter((s) => filterMatchesFormat(activeFilter, s));

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

  // Format count badges for filter pills
  const formatCounts = COMEDY_FILTERS.reduce<Record<string, number>>((acc, { key }) => {
    if (key === "all") {
      acc[key] = shows.length;
    } else {
      acc[key] = shows.filter((s) => filterMatchesFormat(key, s)).length;
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

      {/* Format filter pills */}
      <div className="flex items-center gap-2 px-3 sm:px-0 mb-3 overflow-x-auto scrollbar-hide">
        {COMEDY_FILTERS.map(({ key, label }) => {
          const isActive = activeFilter === key;
          const count = formatCounts[key] ?? 0;
          return (
            <button
              key={key}
              onClick={() => handleFilterSelect(key)}
              className={`flex-shrink-0 min-h-[36px] px-3.5 py-1.5 rounded-full font-mono text-xs font-medium border transition-all ${
                isActive
                  ? "bg-[var(--gold)]/15 text-[var(--gold)] border-[var(--gold)]/40"
                  : "bg-transparent text-[var(--muted)] border-[var(--twilight)] hover:text-[var(--cream)] hover:border-[var(--soft)]/40"
              }`}
            >
              {label}
              {!metaLoading && key !== "all" && count > 0 && (
                <span
                  className={`ml-1.5 text-2xs tabular-nums ${
                    isActive ? "text-[var(--gold)]/70" : "text-[var(--muted)]/60"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {metaLoading && <ComedySkeleton />}

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
                      <Microphone
                        size={28}
                        weight="duotone"
                        style={{ color: "var(--gold)" }}
                        aria-hidden="true"
                      />
                    }
                    renderMeta={(show) => (
                      <FormatBadge show={venueShows.find((s) => s.event_id === show.event_id)!} />
                    )}
                  />
                );
              })}
            </div>
          )}

          {!loading && !isPending && filteredShows.length === 0 && (
            <div className="py-12 sm:py-16 text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--twilight)]/25 border border-[var(--twilight)]/50 mb-4">
                <Microphone
                  size={28}
                  weight="duotone"
                  style={{ color: "var(--gold)" }}
                  aria-hidden="true"
                />
              </div>
              <div className="text-[var(--muted)] font-mono text-sm">
                No comedy shows found for this date
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
