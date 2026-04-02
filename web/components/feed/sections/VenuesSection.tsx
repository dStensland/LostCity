"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MapPin } from "@phosphor-icons/react";
import FeedSectionHeader from "@/components/feed/FeedSectionHeader";
import NowShowingSection from "./NowShowingSection";
import { VenueShowCard } from "@/components/feed/venues/VenueShowCard";
import { VenueExhibitionCard } from "@/components/feed/venues/VenueExhibitionCard";
import {
  useVenueExhibitions,
  useVenueAttractionShows,
  type ShowVenueData,
} from "@/components/feed/venues/useVenueExhibitions";

// ── Types ──────────────────────────────────────────────────────────────────────

type VenueTab =
  | "film"
  | "music"
  | "comedy"
  | "theater"
  | "nightlife"
  | "arts"
  | "attractions";

interface ShowsApiResponse {
  venues: ShowVenueData[];
}

// ── Constants ──────────────────────────────────────────────────────────────────

const TABS: { id: VenueTab; label: string; accent: string }[] = [
  { id: "film", label: "Film", accent: "var(--vibe)" },
  { id: "music", label: "Music", accent: "#E855A0" },
  { id: "comedy", label: "Comedy", accent: "var(--gold)" },
  { id: "theater", label: "Theater", accent: "var(--neon-cyan)" },
  { id: "nightlife", label: "Nightlife", accent: "var(--neon-magenta)" },
  { id: "arts", label: "Arts", accent: "var(--coral)" },
  { id: "attractions", label: "Attractions", accent: "var(--neon-green)" },
];

const FETCH_TIMEOUT_MS = 10_000;

const TAB_SEE_ALL: Record<VenueTab, { href: string; label: string }> = {
  film: { href: "?view=find&lane=shows&tab=film", label: "All showtimes" },
  music: { href: "?view=find&lane=shows&tab=music", label: "All shows" },
  comedy: { href: "?view=find&lane=shows&tab=comedy", label: "All shows" },
  theater: { href: "?view=find&lane=shows&tab=theater", label: "All shows" },
  nightlife: { href: "?view=find&lane=places&venue_type=bar,nightclub,lounge", label: "All venues" },
  arts: { href: "?view=find&lane=places&venue_type=museum,gallery,arts_center", label: "All venues" },
  attractions: { href: "?view=find&lane=places&venue_type=arcade,attraction,entertainment,escape_room,bowling,zoo,aquarium", label: "All venues" },
};

// ── ProgrammingTabContent ──────────────────────────────────────────────────────

/**
 * Fetches shows from /api/portals/[slug]/shows for a given category list
 * and renders a 2-col grid of VenueShowCard.
 */
function ProgrammingTabContent({
  portalSlug,
  categories,
  accentColor,
  label,
}: {
  portalSlug: string;
  categories: string;
  accentColor: string;
  label: string;
}) {
  const [venues, setVenues] = useState<ShowVenueData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const url = `/api/portals/${encodeURIComponent(portalSlug)}/shows?categories=${encodeURIComponent(categories)}`;

    fetch(url, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<ShowsApiResponse>;
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        setVenues(data.venues ?? []);
        setLoading(false);
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return;
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [portalSlug, categories]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="rounded-lg bg-[var(--night)] border border-[var(--twilight)]/30 animate-pulse"
          >
            <div className="flex items-center gap-3 px-3 pt-3 pb-2.5">
              <div className="w-12 h-12 rounded-lg bg-[var(--twilight)]/40 flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 bg-[var(--twilight)]/40 rounded w-3/4" />
                <div className="h-3 bg-[var(--twilight)]/25 rounded w-1/2" />
              </div>
            </div>
            <div className="border-t border-[var(--twilight)]/30 mx-3" />
            <div className="px-3 pt-2 pb-2.5 space-y-1.5">
              <div className="h-3 bg-[var(--twilight)]/25 rounded w-full" />
              <div className="h-3 bg-[var(--twilight)]/20 rounded w-5/6" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (venues.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-[var(--muted)]">
        No {label} today
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
      {venues.map((item) => (
        <VenueShowCard
          key={item.venue.id}
          venue={item.venue}
          shows={item.shows}
          totalCount={item.shows.length}
          portalSlug={portalSlug}
          accentColor={accentColor}
        />
      ))}
    </div>
  );
}

// ── ArtsTabContent ─────────────────────────────────────────────────────────────

function ArtsTabContent({
  portalSlug,
  accentColor,
}: {
  portalSlug: string;
  accentColor: string;
}) {
  const { venues, loading } = useVenueExhibitions(portalSlug);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="rounded-lg bg-[var(--night)] border border-[var(--twilight)]/30 animate-pulse"
          >
            <div className="flex items-center gap-3 p-3 pb-2.5">
              <div className="w-12 h-12 rounded-md bg-[var(--twilight)]/40 flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 bg-[var(--twilight)]/40 rounded w-3/4" />
                <div className="h-3 bg-[var(--twilight)]/25 rounded w-1/2" />
              </div>
            </div>
            <div className="border-t border-[var(--twilight)]/30 mx-3" />
            <div className="px-3 pt-2 pb-3 space-y-2">
              <div className="h-3 bg-[var(--twilight)]/25 rounded w-full" />
              <div className="h-2.5 bg-[var(--twilight)]/20 rounded w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (venues.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-[var(--muted)]">
        No arts today
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
      {venues.map((item) => (
        <VenueExhibitionCard
          key={item.venue.id}
          venue={item.venue}
          exhibitions={item.exhibitions.map((ex, idx) => ({
            ...ex,
            // VenueExhibitionCard uses id only as a React list key.
            // useVenueExhibitions returns UUID strings; we use a stable
            // numeric fallback (index within this venue's list) since
            // parseInt("uuid") → NaN. Cross-venue uniqueness is handled
            // by the outer key={item.venue.id}.
            id: idx,
          }))}
          portalSlug={portalSlug}
          accentColor={accentColor}
        />
      ))}
    </div>
  );
}

// ── AttractionsTabContent ──────────────────────────────────────────────────────

function AttractionsTabContent({
  portalSlug,
  accentColor,
}: {
  portalSlug: string;
  accentColor: string;
}) {
  const { venues, loading } = useVenueAttractionShows(portalSlug);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="rounded-lg bg-[var(--night)] border border-[var(--twilight)]/30 animate-pulse"
          >
            <div className="flex items-center gap-3 px-3 pt-3 pb-2.5">
              <div className="w-12 h-12 rounded-lg bg-[var(--twilight)]/40 flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 bg-[var(--twilight)]/40 rounded w-3/4" />
                <div className="h-3 bg-[var(--twilight)]/25 rounded w-1/2" />
              </div>
            </div>
            <div className="border-t border-[var(--twilight)]/30 mx-3" />
            <div className="px-3 pt-2 pb-2.5 space-y-1.5">
              <div className="h-3 bg-[var(--twilight)]/25 rounded w-full" />
              <div className="h-3 bg-[var(--twilight)]/20 rounded w-5/6" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (venues.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-[var(--muted)]">
        No attractions today
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
      {venues.map((item) => (
        <VenueShowCard
          key={item.venue.id}
          venue={item.venue}
          shows={item.shows}
          totalCount={item.shows.length}
          portalSlug={portalSlug}
          accentColor={accentColor}
        />
      ))}
    </div>
  );
}

// ── VenuesSection ──────────────────────────────────────────────────────────────

export default function VenuesSection({ portalSlug }: { portalSlug: string }) {
  const [activeTab, setActiveTab] = useState<VenueTab>("film");
  const [visited, setVisited] = useState<Set<VenueTab>>(new Set(["film"]));

  function handleTabClick(tab: VenueTab) {
    setActiveTab(tab);
    setVisited((prev) => {
      if (prev.has(tab)) return prev;
      const next = new Set(prev);
      next.add(tab);
      return next;
    });
  }

  return (
    <section className="pb-2">
      {/* Section header */}
      <FeedSectionHeader
        title="Venues"
        priority="secondary"
        accentColor="var(--vibe)"
        icon={<MapPin weight="duotone" className="w-5 h-5" />}
        seeAllHref={`/${portalSlug}?view=find&lane=shows`}
      />

      {/* Tab bar — horizontal scroll for 7 tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto scrollbar-hide -mx-1 px-1">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              style={{ "--tab-accent": tab.accent } as React.CSSProperties}
              className={`shrink-0 px-3 py-1.5 rounded-lg font-mono text-xs font-medium transition-colors ${
                isActive
                  ? "bg-[var(--tab-accent)]/15 text-[var(--tab-accent)] border border-[var(--tab-accent)]/30"
                  : "text-[var(--muted)] hover:text-[var(--soft)] hover:bg-[var(--twilight)]/40 border border-transparent"
              }`}
              aria-pressed={isActive}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab panels — Film always renders; others lazy via visited set */}

      {/* Film */}
      <div className={activeTab === "film" ? "block" : "hidden"}>
        <NowShowingSection portalSlug={portalSlug} embedded />
      </div>

      {/* Music */}
      <div className={activeTab === "music" ? "block" : "hidden"}>
        {visited.has("music") && (
          <ProgrammingTabContent
            portalSlug={portalSlug}
            categories="music"
            accentColor="#E855A0"
            label="music"
          />
        )}
      </div>

      {/* Comedy */}
      <div className={activeTab === "comedy" ? "block" : "hidden"}>
        {visited.has("comedy") && (
          <ProgrammingTabContent
            portalSlug={portalSlug}
            categories="comedy"
            accentColor="var(--gold)"
            label="comedy"
          />
        )}
      </div>

      {/* Theater */}
      <div className={activeTab === "theater" ? "block" : "hidden"}>
        {visited.has("theater") && (
          <ProgrammingTabContent
            portalSlug={portalSlug}
            categories="theater,dance"
            accentColor="var(--neon-cyan)"
            label="theater"
          />
        )}
      </div>

      {/* Nightlife */}
      <div className={activeTab === "nightlife" ? "block" : "hidden"}>
        {visited.has("nightlife") && (
          <ProgrammingTabContent
            portalSlug={portalSlug}
            categories="nightlife"
            accentColor="var(--neon-magenta)"
            label="nightlife"
          />
        )}
      </div>

      {/* Arts */}
      <div className={activeTab === "arts" ? "block" : "hidden"}>
        {visited.has("arts") && (
          <ArtsTabContent portalSlug={portalSlug} accentColor="var(--coral)" />
        )}
      </div>

      {/* Attractions */}
      <div className={activeTab === "attractions" ? "block" : "hidden"}>
        {visited.has("attractions") && (
          <AttractionsTabContent
            portalSlug={portalSlug}
            accentColor="var(--neon-green)"
          />
        )}
      </div>

      {/* Per-tab "See all" footer link */}
      <div className="flex justify-end px-4 pt-2 pb-1">
        <Link
          href={`/${portalSlug}${TAB_SEE_ALL[activeTab].href}`}
          className="flex items-center gap-1 text-xs font-mono hover:opacity-80 transition-opacity"
          style={{ color: "var(--coral)" }}
        >
          {TAB_SEE_ALL[activeTab].label} →
        </Link>
      </div>
    </section>
  );
}
