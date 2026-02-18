"use client";

import { Suspense, useState, useEffect, useMemo, useCallback, type ReactNode } from "react";
import { createPortal } from "react-dom";
import FeedView from "@/components/FeedView";
import HighlightsPicks from "@/components/highlights/HighlightsPicks";
import TrendingNow from "@/components/TrendingNow";
import TonightsPicksSkeleton from "@/components/TonightsPicksSkeleton";
import TrendingNowSkeleton from "@/components/TrendingNowSkeleton";
import HappeningNowCTA from "./HappeningNowCTA";
import HolidayHero, { getActiveHeroSlugs } from "./HolidayHero";
import MomentsSection from "./MomentsSection";
import BrowseByActivity from "@/components/BrowseByActivity";
import SectionErrorBoundary from "./SectionErrorBoundary";
import { useCuratedFeedData } from "./useCuratedFeedData";
import { trackPortalAction } from "@/lib/analytics/portal-action-tracker";

const CURATED_HAPPENING_NOW_ID = "curated-happening-now";
const CURATED_SEASONAL_SPOTLIGHT_ID = "curated-seasonal-spotlight";
const CURATED_TONIGHT_PICKS_ID = "curated-tonight-picks";
const CURATED_FESTIVALS_ID = "curated-festivals";
const CURATED_SECOND_SPOTLIGHT_ID = "curated-second-spotlight";
const CURATED_TRENDING_ID = "curated-trending";
const CURATED_MAIN_FEED_ID = "curated-main-feed";
const CURATED_BROWSE_ACTIVITY_ID = "curated-browse-activity";

type CuratedIndexEntry = {
  id: string;
  label: string;
};

const CURATED_BASE_ENTRIES: CuratedIndexEntry[] = [
  { id: CURATED_HAPPENING_NOW_ID, label: "Happening Now" },
  { id: CURATED_SEASONAL_SPOTLIGHT_ID, label: "Seasonal Spotlight" },
  { id: CURATED_TONIGHT_PICKS_ID, label: "Highlights" },
  { id: CURATED_FESTIVALS_ID, label: "Festivals" },
  { id: CURATED_SECOND_SPOTLIGHT_ID, label: "Special Times" },
  { id: CURATED_TRENDING_ID, label: "Trending Now" },
  { id: CURATED_MAIN_FEED_ID, label: "Main Feed" },
  { id: CURATED_BROWSE_ACTIVITY_ID, label: "Browse by Activity" },
];

function CuratedPageIndex({ portalSlug, loading }: { portalSlug: string; loading: boolean }) {
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(CURATED_BASE_ENTRIES[0]?.id ?? null);
  const [feedEntries, setFeedEntries] = useState<CuratedIndexEntry[]>([]);

  const refreshFeedEntries = useCallback(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-feed-anchor="true"][id]'));
    const entries = nodes.map((node) => {
      const label = (node.dataset.indexLabel || "").trim();
      if (!label) return null;
      return { id: node.id, label };
    }).filter((entry): entry is CuratedIndexEntry => !!entry);
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

    const observer = new MutationObserver(() => {
      refreshFeedEntries();
    });
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

  const condensedEntries = useMemo<CuratedIndexEntry[]>(() => {
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
    ): CuratedIndexEntry => {
      const fromKeywords = pickByKeywords(keywords);
      if (fromKeywords) return { id: fromKeywords, label };

      const fromCandidates = pickFromCandidates([preferredId, ...fallbackIds]);
      if (fromCandidates) return { id: fromCandidates, label };

      const fromAnyUnused = pickAnyUnused();
      return { id: fromAnyUnused ?? preferredId, label };
    };
    const pinEntry = (label: string, id: string): CuratedIndexEntry => {
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

  const allEntries = useMemo(() => {
    const map = new Map<string, CuratedIndexEntry>();
    CURATED_BASE_ENTRIES.forEach((entry) => map.set(entry.id, entry));
    feedEntries.forEach((entry) => {
      if (!map.has(entry.id)) {
        map.set(entry.id, entry);
      }
    });
    condensedEntries.forEach((entry) => {
      if (!map.has(entry.id)) {
        map.set(entry.id, entry);
      }
    });
    return Array.from(map.values());
  }, [condensedEntries, feedEntries]);

  const activeEntries = condensedEntries;

  useEffect(() => {
    if (allEntries.length === 0) return;
    const elements = allEntries
      .map((entry) => document.getElementById(entry.id))
      .filter((el): el is HTMLElement => !!el);
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (intersectionEntries) => {
        const visible = intersectionEntries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => Math.abs(a.boundingClientRect.top) - Math.abs(b.boundingClientRect.top));
        if (visible[0]?.target?.id) {
          setActiveId(visible[0].target.id);
        }
      },
      {
        rootMargin: "-18% 0px -64% 0px",
        threshold: [0.1, 0.3, 0.5],
      }
    );

    elements.forEach((el) => observer.observe(el));
    const initialActiveFrame = requestAnimationFrame(() => {
      if (elements[0]) {
        setActiveId((prev) => prev ?? elements[0].id);
      }
    });
    return () => {
      cancelAnimationFrame(initialActiveFrame);
      observer.disconnect();
    };
  }, [allEntries]);

  const scrollToEntry = useCallback((entry: CuratedIndexEntry) => {
    const target = document.getElementById(entry.id);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveId(entry.id);
  }, []);

  const jumpTo = useCallback((entry: CuratedIndexEntry, index: number, source: "desktop" | "mobile") => {
    scrollToEntry(entry);
    trackPortalAction(portalSlug, {
      action_type: "resource_clicked",
      page_type: "feed",
      section_key: "curated_index",
      target_kind: "section_index",
      target_id: entry.id,
      target_label: entry.label,
      target_url: `#${entry.id}`,
      metadata: { position: index + 1, source },
    });
  }, [portalSlug, scrollToEntry]);

  const handleProgressJump = useCallback((entry: CuratedIndexEntry, index: number, source: "desktop" | "mobile") => {
    scrollToEntry(entry);
    trackPortalAction(portalSlug, {
      action_type: "resource_clicked",
      page_type: "feed",
      section_key: "curated_index",
      target_kind: "index_progress",
      target_id: entry.id,
      target_label: entry.label,
      target_url: `#${entry.id}`,
      metadata: { position: index + 1, source },
    });
  }, [portalSlug, scrollToEntry]);

  if (allEntries.length === 0) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      <aside className="pointer-events-none fixed right-5 top-[7rem] z-[120] hidden sm:block">
        <div className="pointer-events-auto">
          {isDesktopCollapsed ? (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsDesktopCollapsed(false);
                  trackPortalAction(portalSlug, {
                    action_type: "resource_clicked",
                    page_type: "feed",
                    section_key: "curated_index",
                    target_kind: "index_toggle",
                    target_id: "expanded",
                    target_label: "Expand index",
                    metadata: { source: "desktop_collapsed_button" },
                  });
                }}
                className="group flex h-11 w-11 items-center justify-center rounded-full border border-[var(--coral)]/45 bg-[linear-gradient(145deg,rgba(16,20,36,0.96),rgba(11,14,26,0.96))] text-[var(--cream)] shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_0_18px_rgba(255,107,122,0.24),0_10px_20px_rgba(0,0,0,0.5)] transition-all hover:border-[var(--neon-cyan)]/60 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_0_20px_rgba(37,205,255,0.26),0_12px_22px_rgba(0,0,0,0.55)]"
                aria-label="Expand page index"
              >
                <span className="sr-only">Expand page index</span>
                <span className="inline-flex flex-col items-center justify-center gap-[3px] leading-none">
                  <span className="h-[2px] w-4 rounded-full bg-current" />
                  <span className="h-[2px] w-4 rounded-full bg-current/80" />
                  <span className="h-[2px] w-4 rounded-full bg-current/60" />
                </span>
              </button>
            </div>
          ) : (
            <div className="relative w-[280px] overflow-hidden rounded-[18px] border-2 border-[var(--twilight)]/70 bg-[linear-gradient(164deg,rgba(13,16,29,0.97),rgba(10,12,21,0.97))] shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_0_22px_rgba(37,205,255,0.18),0_0_26px_rgba(255,107,122,0.14),0_20px_44px_rgba(0,0,0,0.55)] backdrop-blur-sm">
              <div className="pointer-events-none absolute inset-0 opacity-75 [background:repeating-linear-gradient(125deg,rgba(255,255,255,0.025)_0,rgba(255,255,255,0.025)_2px,transparent_2px,transparent_9px)]" />
              <div className="relative h-[3px] w-full bg-[linear-gradient(90deg,var(--coral),var(--neon-cyan),var(--neon-amber),var(--coral))]" />
              <div className="relative flex items-start justify-between gap-2 border-b border-[var(--twilight)]/45 px-3 py-2.5">
                <div className="space-y-0.5">
                  <p className="font-mono text-[0.6rem] uppercase tracking-[0.22em] text-[var(--soft)]">City Field Guide</p>
                  <p className="text-xs text-[var(--cream)]">{activeEntries.length} quick jumps</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsDesktopCollapsed(true);
                    trackPortalAction(portalSlug, {
                      action_type: "resource_clicked",
                      page_type: "feed",
                      section_key: "curated_index",
                      target_kind: "index_toggle",
                      target_id: "collapsed",
                      target_label: "Collapse index",
                      metadata: { source: "desktop_panel_button" },
                    });
                  }}
                  className="h-8 w-8 rounded-full border border-[var(--twilight)]/65 bg-[var(--night)]/70 text-[var(--muted)] transition-colors hover:border-[var(--coral)]/60 hover:text-[var(--cream)]"
                  aria-label="Collapse page index"
                >
                  −
                </button>
              </div>

              <div className="relative flex gap-2 p-2">
                <nav id="curated-page-index-list" className="max-h-[calc(100vh-11rem)] flex-1 overflow-y-auto">
                  <ul className="space-y-1">
                    {activeEntries.map((entry, index) => {
                      const isActive = activeId === entry.id;
                      return (
                        <li key={`desktop-${entry.id}`}>
                          <button
                            type="button"
                            onClick={() => jumpTo(entry, index, "desktop")}
                            className={`w-full px-2.5 py-2 rounded-lg text-left transition-colors ${
                              isActive
                                ? "border border-[var(--coral)]/55 bg-[linear-gradient(90deg,rgba(255,107,122,0.2),rgba(28,37,66,0.8))] text-[var(--cream)] shadow-[0_0_14px_rgba(255,107,122,0.24)]"
                                : "border border-transparent text-[var(--muted)] hover:border-[var(--twilight)]/40 hover:bg-[var(--twilight)]/30 hover:text-[var(--cream)]"
                            }`}
                          >
                            <span className="block truncate text-[11px]">
                              {index + 1}. {entry.label}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </nav>
                <div className="w-5 flex-shrink-0">
                  <div className="flex max-h-[calc(100vh-11rem)] flex-col items-center gap-1.5 overflow-y-auto rounded-full border border-[var(--twilight)]/50 bg-[var(--night)]/80 px-1 py-2">
                    {activeEntries.map((entry, index) => {
                      const isActive = activeId === entry.id;
                      return (
                        <button
                          key={`desktop-progress-${entry.id}`}
                          type="button"
                          title={entry.label}
                          onClick={() => handleProgressJump(entry, index, "desktop")}
                          className={`rounded-full transition-all ${
                            isActive
                              ? "h-3.5 w-3.5 bg-[var(--neon-cyan)] shadow-[0_0_12px_rgba(37,205,255,0.7)]"
                              : "h-2.5 w-2.5 bg-[var(--twilight)] hover:bg-[var(--coral)]"
                          }`}
                          aria-label={`Jump to ${entry.label}`}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>

      <button
        type="button"
        onClick={() => {
          setIsMobileOpen(true);
          trackPortalAction(portalSlug, {
            action_type: "resource_clicked",
            page_type: "feed",
            section_key: "curated_index",
            target_kind: "index_open",
            target_id: "mobile",
            target_label: "Open page index",
          });
        }}
        className="sm:hidden fixed bottom-20 right-4 z-[10000] flex h-11 w-11 items-center justify-center rounded-full border border-[var(--coral)]/45 bg-[linear-gradient(145deg,rgba(16,20,36,0.96),rgba(11,14,26,0.96))] text-[var(--cream)] shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_0_16px_rgba(255,107,122,0.22),0_10px_20px_rgba(0,0,0,0.48)] transition-all hover:border-[var(--neon-cyan)]/60 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_0_20px_rgba(37,205,255,0.24),0_12px_22px_rgba(0,0,0,0.52)]"
        aria-label="Open page index"
      >
        <span className="sr-only">Open page index</span>
        <span className="inline-flex flex-col items-center justify-center gap-[3px] leading-none">
          <span className="h-[2px] w-4 rounded-full bg-current" />
          <span className="h-[2px] w-4 rounded-full bg-current/80" />
          <span className="h-[2px] w-4 rounded-full bg-current/60" />
        </span>
      </button>

      {isMobileOpen && (
        <div className="sm:hidden fixed inset-0 z-[10010]">
          <button
            type="button"
            onClick={() => setIsMobileOpen(false)}
            className="absolute inset-0 bg-black/55 backdrop-blur-[1px]"
            aria-label="Close page index"
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-[var(--twilight)]/45 bg-[var(--night)] p-3 pb-5 max-h-[70vh] overflow-hidden">
            <div className="flex items-center justify-between px-1 pb-2">
              <div>
                <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-[var(--muted)]">City Field Guide</p>
                <p className="text-xs text-[var(--cream)]">{activeEntries.length} quick jumps</p>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileOpen(false)}
                className="h-8 w-8 rounded-full border border-[var(--twilight)]/45 text-[var(--muted)] hover:text-[var(--cream)]"
                aria-label="Close"
                >
                  ×
                </button>
              </div>
            <div className="flex gap-2">
              <nav className="overflow-y-auto max-h-[53vh] pr-1 flex-1">
                <ul className="space-y-1">
                  {activeEntries.map((entry, index) => {
                    const isActive = activeId === entry.id;
                    return (
                      <li key={`mobile-${entry.id}`}>
                        <button
                          type="button"
                          onClick={() => {
                            jumpTo(entry, index, "mobile");
                            setIsMobileOpen(false);
                          }}
                          className={`w-full px-2.5 py-2 rounded-lg text-left transition-colors ${
                            isActive
                              ? "bg-[var(--twilight)]/70 text-[var(--cream)] border border-[var(--coral)]/40"
                              : "text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/30 border border-transparent"
                          }`}
                        >
                          <span className="truncate text-[11px] block">
                            {index + 1}. {entry.label}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </nav>
              <div className="w-5 flex-shrink-0">
                <div className="max-h-[53vh] overflow-y-auto rounded-full border border-[var(--twilight)]/35 bg-[var(--night)]/65 px-1 py-2 flex flex-col items-center gap-1.5">
                  {activeEntries.map((entry, index) => {
                    const isActive = activeId === entry.id;
                    return (
                      <button
                        key={`mobile-progress-${entry.id}`}
                        type="button"
                        title={entry.label}
                        onClick={() => {
                          handleProgressJump(entry, index, "mobile");
                          setIsMobileOpen(false);
                        }}
                        className={`rounded-full transition-all ${
                          isActive
                            ? "h-3.5 w-3.5 bg-[var(--coral)] shadow-[0_0_10px_rgba(255,107,122,0.55)]"
                            : "h-2.5 w-2.5 bg-[var(--twilight)] hover:bg-[var(--soft)]"
                        }`}
                        aria-label={`Jump to ${entry.label}`}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body
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
        <section id={CURATED_HAPPENING_NOW_ID} data-index-label="Happening Now" className="scroll-mt-28 min-h-[96px]">
          <SectionErrorBoundary>
            <Suspense fallback={<HappeningNowCtaSkeleton />}>
              <HappeningNowCTA portalSlug={portalSlug} />
            </Suspense>
          </SectionErrorBoundary>
        </section>

        {/* Holiday hero: nearest event date gets top position */}
        <section id={CURATED_SEASONAL_SPOTLIGHT_ID} data-index-label="Seasonal Spotlight" className="scroll-mt-28 min-h-[320px]">
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
        <section id={CURATED_FESTIVALS_ID} data-index-label="Festivals" className="scroll-mt-28 min-h-[260px]">
          <SectionErrorBoundary>
            <Suspense fallback={<MomentsSectionSkeleton />}>
              <MomentsSection portalSlug={portalSlug} prefetchedData={moments} />
            </Suspense>
          </SectionErrorBoundary>
        </section>

        {/* Second holiday hero (below festivals) */}
        <section id={CURATED_SECOND_SPOTLIGHT_ID} data-index-label="Special Times" className="scroll-mt-28 min-h-[280px]">
          <SectionErrorBoundary>
            <Suspense fallback={<DelayedFallback><HolidayHeroSkeleton /></DelayedFallback>}>
              <HolidayHero portalSlug={portalSlug} position={2} eventCount={getEventCount(2)} />
            </Suspense>
          </SectionErrorBoundary>
        </section>

        {/* Above-fold: Trending Now - High priority */}
        <section id={CURATED_TRENDING_ID} data-index-label="Trending Now" className="scroll-mt-28 min-h-[170px]">
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
