"use client";

import { Suspense, useState, useEffect, useMemo, useCallback, type ReactNode } from "react";
import FeedView from "@/components/FeedView";
import HighlightsPicks from "@/components/highlights/HighlightsPicks";
import TrendingNow from "@/components/TrendingNow";
import TonightsPicksSkeleton from "@/components/TonightsPicksSkeleton";
import TrendingNowSkeleton from "@/components/TrendingNowSkeleton";
import HappeningNowCTA from "./HappeningNowCTA";
import HolidayHero from "./HolidayHero";
import { getActiveHeroSlugs } from "@/config/holidays";
import MomentsSection from "./MomentsSection";
import BrowseByActivity from "@/components/BrowseByActivity";
import SectionErrorBoundary from "./SectionErrorBoundary";
import { useCuratedFeedData } from "./useCuratedFeedData";
import FeedPageIndex from "./FeedPageIndex";
import type { IndexEntry } from "./FeedPageIndex";

const CURATED_HAPPENING_NOW_ID = "curated-happening-now";
const CURATED_SEASONAL_SPOTLIGHT_ID = "curated-seasonal-spotlight";
const CURATED_TONIGHT_PICKS_ID = "curated-tonight-picks";
const CURATED_FESTIVALS_ID = "curated-festivals";
const CURATED_SECOND_SPOTLIGHT_ID = "curated-second-spotlight";
const CURATED_TRENDING_ID = "curated-trending";
const CURATED_MAIN_FEED_ID = "curated-main-feed";
const CURATED_BROWSE_ACTIVITY_ID = "curated-browse-activity";

const CURATED_BASE_ENTRIES: IndexEntry[] = [
  { id: CURATED_HAPPENING_NOW_ID, label: "Happening Now" },
  { id: CURATED_SEASONAL_SPOTLIGHT_ID, label: "Seasonal Spotlight" },
  { id: CURATED_TONIGHT_PICKS_ID, label: "Highlights" },
  { id: CURATED_FESTIVALS_ID, label: "Festivals" },
  { id: CURATED_SECOND_SPOTLIGHT_ID, label: "Special Times" },
  { id: CURATED_TRENDING_ID, label: "Trending Now" },
  { id: CURATED_MAIN_FEED_ID, label: "Main Feed" },
  { id: CURATED_BROWSE_ACTIVITY_ID, label: "Browse by Activity" },
];

/**
 * CuratedPageIndex — thin wrapper around FeedPageIndex for the hospital
 * portal template. Keeps the curated-specific DOM scanning and keyword-
 * matching logic that maps dynamic feed sub-sections to friendly ToC labels.
 */
function CuratedPageIndex({ portalSlug, loading }: { portalSlug: string; loading: boolean }) {
  const [feedEntries, setFeedEntries] = useState<IndexEntry[]>([]);

  const refreshFeedEntries = useCallback(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-feed-anchor="true"][id]'));
    const entries = nodes.map((node) => {
      const label = (node.dataset.indexLabel || "").trim();
      if (!label) return null;
      return { id: node.id, label };
    }).filter((entry): entry is IndexEntry => !!entry);
    setFeedEntries(entries);
  }, []);

  useEffect(() => {
    if (loading) return;
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(refreshFeedEntries);
    });
    const root = document.getElementById(CURATED_MAIN_FEED_ID);
    if (!root) {
      return () => cancelAnimationFrame(raf);
    }
    const observer = new MutationObserver(refreshFeedEntries);
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-index-label", "id"],
    });
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [loading, refreshFeedEntries]);

  const condensedEntries = useMemo<IndexEntry[]>(() => {
    const used = new Set<string>();
    const curatedIds = CURATED_BASE_ENTRIES.map((entry) => entry.id);

    const pickByKeywords = (keywords: string[]) => {
      const match = feedEntries.find((entry) => {
        if (used.has(entry.id)) return false;
        const normalized = entry.label.toLowerCase();
        return keywords.some((keyword) => normalized.includes(keyword));
      });
      if (!match) return null;
      used.add(match.id);
      return match.id;
    };

    const pickFromCandidates = (candidates: string[]) => {
      const candidate = candidates.find((id) => !used.has(id));
      if (!candidate) return null;
      used.add(candidate);
      return candidate;
    };

    const pickAnyUnused = () => {
      const fromFeed = feedEntries.find((entry) => !used.has(entry.id));
      if (fromFeed) {
        used.add(fromFeed.id);
        return fromFeed.id;
      }
      const fromCurated = curatedIds.find((id) => !used.has(id));
      if (fromCurated) {
        used.add(fromCurated);
        return fromCurated;
      }
      return null;
    };

    const pickEntry = (
      label: string,
      preferredId: string,
      keywords: string[],
      fallbackIds: string[]
    ): IndexEntry => {
      const fromKeywords = pickByKeywords(keywords);
      if (fromKeywords) return { id: fromKeywords, label };
      const fromCandidates = pickFromCandidates([preferredId, ...fallbackIds]);
      if (fromCandidates) return { id: fromCandidates, label };
      const fromAnyUnused = pickAnyUnused();
      return { id: fromAnyUnused ?? preferredId, label };
    };

    const pinEntry = (label: string, id: string): IndexEntry => {
      used.add(id);
      return { id, label };
    };

    return [
      pinEntry("Highlights", CURATED_TONIGHT_PICKS_ID),
      pinEntry("Festivals", CURATED_FESTIVALS_ID),
      pickEntry(
        "Holidays",
        CURATED_SEASONAL_SPOTLIGHT_ID,
        ["holiday", "season", "special", "festival", "mardi", "lunar"],
        [CURATED_SECOND_SPOTLIGHT_ID, CURATED_FESTIVALS_ID]
      ),
      pickEntry(
        "Nightlife",
        CURATED_TRENDING_ID,
        ["nightlife", "going out", "club", "bar", "dj", "dance", "music", "late night"],
        [CURATED_MAIN_FEED_ID]
      ),
      pickEntry(
        "Movie Times",
        CURATED_MAIN_FEED_ID,
        ["movie", "film", "cinema", "theater", "screening"],
        [CURATED_TRENDING_ID]
      ),
      pickEntry(
        "Help People Out",
        CURATED_MAIN_FEED_ID,
        ["volunteer", "activism", "community", "mutual aid", "civic", "organize"],
        [CURATED_FESTIVALS_ID]
      ),
      pickEntry(
        "Free Stuff",
        CURATED_MAIN_FEED_ID,
        ["free", "$0", "no cost", "budget", "cheap"],
        [CURATED_TONIGHT_PICKS_ID]
      ),
      pickEntry(
        "Get Involved",
        CURATED_MAIN_FEED_ID,
        ["volunteer", "activism", "community", "mutual aid", "civic", "organize"],
        [CURATED_FESTIVALS_ID]
      ),
      pickEntry(
        "More Categories",
        CURATED_BROWSE_ACTIVITY_ID,
        ["browse", "category", "discover", "interests", "activities"],
        [CURATED_MAIN_FEED_ID]
      ),
    ];
  }, [feedEntries]);

  return (
    <FeedPageIndex
      portalSlug={portalSlug}
      entries={condensedEntries}
      loading={loading}
      sectionKey="curated_index"
    />
  );
}

/** Delays showing skeleton by `delay` ms so fast loads don't flash placeholders */
function DelayedFallback({ children, delay = 150 }: { children: ReactNode; delay?: number }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);
  return show ? <>{children}</> : null;
}

interface CuratedContentProps {
  portalSlug: string;
}

export default function CuratedContent({ portalSlug }: CuratedContentProps) {
  const { sections, moments, loading } = useCuratedFeedData(portalSlug);

  // Extract event counts for each HolidayHero from shared feed data
  const heroSlugs = getActiveHeroSlugs();
  function getEventCount(position: number): number | null {
    if (loading) return null;
    const slug = heroSlugs[position - 1];
    if (!slug) return null;
    const section = sections.find(s => s.slug === slug);
    return section?.events ? section.events.length : null;
  }

  return (
    <>
      <div className="space-y-6">
        {/* Above-fold: Happening Now CTA - Priority load */}
        <section
          id={CURATED_HAPPENING_NOW_ID}
          data-index-label="Happening Now"
          className="scroll-mt-28"
        >
          <SectionErrorBoundary>
            <Suspense fallback={<HappeningNowCtaSkeleton />}>
              <HappeningNowCTA portalSlug={portalSlug} />
            </Suspense>
          </SectionErrorBoundary>
        </section>

        {/* Holiday hero: nearest event date gets top position */}
        <section
          id={CURATED_SEASONAL_SPOTLIGHT_ID}
          data-index-label="Seasonal Spotlight"
          className="scroll-mt-28"
        >
          <SectionErrorBoundary>
            <Suspense fallback={<HolidayHeroSkeleton />}>
              <HolidayHero portalSlug={portalSlug} eventCount={getEventCount(1)} />
            </Suspense>
          </SectionErrorBoundary>
        </section>

        {/* Above-fold: Highlights carousel (today / week / month) */}
        <section id={CURATED_TONIGHT_PICKS_ID} data-index-label="Highlights" className="scroll-mt-28">
          <SectionErrorBoundary>
            <Suspense fallback={<TonightsPicksSkeleton />}>
              <HighlightsPicks portalSlug={portalSlug} />
            </Suspense>
          </SectionErrorBoundary>
        </section>

        <div className="pt-4 border-t border-[var(--twilight)]/40" />

        {/* Festival moments: takeover hero + imminent festivals */}
        <section
          id={CURATED_FESTIVALS_ID}
          data-index-label="Festivals"
          className="scroll-mt-28"
        >
          <SectionErrorBoundary>
            <Suspense fallback={<MomentsSectionSkeleton />}>
              <MomentsSection portalSlug={portalSlug} prefetchedData={moments} />
            </Suspense>
          </SectionErrorBoundary>
        </section>

        {/* Second holiday hero (below festivals) */}
        <section
          id={CURATED_SECOND_SPOTLIGHT_ID}
          data-index-label="Special Times"
          className="scroll-mt-28"
        >
          <SectionErrorBoundary>
            <Suspense fallback={<DelayedFallback><HolidayHeroSkeleton /></DelayedFallback>}>
              <HolidayHero portalSlug={portalSlug} position={2} eventCount={getEventCount(2)} />
            </Suspense>
          </SectionErrorBoundary>
        </section>

        {/* Above-fold: Trending Now - High priority */}
        <section
          id={CURATED_TRENDING_ID}
          data-index-label="Trending Now"
          className="scroll-mt-28"
        >
          <SectionErrorBoundary>
            <Suspense fallback={<DelayedFallback><TrendingNowSkeleton /></DelayedFallback>}>
              <TrendingNow portalSlug={portalSlug} />
            </Suspense>
          </SectionErrorBoundary>
        </section>

        <div className="pt-4 border-t border-[var(--twilight)]/40" />

        {/* Below-fold: Main Feed - Deferred load */}
        <section id={CURATED_MAIN_FEED_ID} data-index-label="Main Feed" className="scroll-mt-28">
          <SectionErrorBoundary>
            {loading ? (
              <DelayedFallback><FeedViewSkeleton /></DelayedFallback>
            ) : (
              <FeedView prefetchedSections={sections} enableSectionIndex={false} />
            )}
          </SectionErrorBoundary>
        </section>

        {/* Below-fold: Browse by Activity - Lazy loaded */}
        <section id={CURATED_BROWSE_ACTIVITY_ID} data-index-label="Browse by Activity" className="scroll-mt-28">
          <SectionErrorBoundary>
            <Suspense fallback={<DelayedFallback><BrowseByActivitySkeleton /></DelayedFallback>}>
              <BrowseByActivity portalSlug={portalSlug} />
            </Suspense>
          </SectionErrorBoundary>
        </section>
      </div>
      <CuratedPageIndex portalSlug={portalSlug} loading={loading} />
    </>
  );
}

// Skeleton loaders for better perceived performance
function BrowseByActivitySkeleton() {
  return (
    <section>
      <div className="h-6 w-64 skeleton-shimmer rounded mb-4" />
      <div className="flex gap-2 mb-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-8 w-24 skeleton-shimmer rounded-full" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-14 skeleton-shimmer rounded-xl" />
        ))}
      </div>
    </section>
  );
}

function HappeningNowCtaSkeleton() {
  return (
    <div className="rounded-2xl border border-[var(--twilight)]/35 bg-[var(--night)]/55 p-4">
      <div className="h-4 w-40 rounded skeleton-shimmer mb-3" />
      <div className="h-12 rounded-xl skeleton-shimmer" />
    </div>
  );
}

function HolidayHeroSkeleton() {
  return (
    <div className="rounded-3xl border border-[var(--twilight)]/35 bg-[var(--night)]/55 p-4 sm:p-5">
      <div className="h-5 w-36 rounded skeleton-shimmer mb-3" />
      <div className="h-48 sm:h-56 rounded-2xl skeleton-shimmer" />
    </div>
  );
}

function MomentsSectionSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-6 w-56 rounded skeleton-shimmer" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 rounded-xl skeleton-shimmer" style={{ animationDelay: `${i * 60}ms` }} />
        ))}
      </div>
    </div>
  );
}

function FeedViewSkeleton() {
  return (
    <div>
      {/* Matches actual FeedView: compact holiday rows + section headers */}
      <div className="mb-4">
        <div className="h-5 w-52 rounded skeleton-shimmer mb-3" />
        <div className="space-y-2">
          <div className="rounded-2xl h-[60px] skeleton-shimmer" />
          <div className="rounded-2xl h-[60px] skeleton-shimmer" />
        </div>
      </div>
      <div className="mb-4">
        <div className="h-5 w-32 rounded skeleton-shimmer mb-3" />
        <div className="space-y-2">
          <div className="rounded-xl h-16 skeleton-shimmer" />
          <div className="rounded-xl h-16 skeleton-shimmer" />
          <div className="rounded-xl h-16 skeleton-shimmer" />
        </div>
      </div>
    </div>
  );
}
