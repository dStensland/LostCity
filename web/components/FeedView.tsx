"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { usePortal } from "@/lib/portal-context";
import FeedSection, { type FeedSectionData, THEMED_SLUGS, HolidayGrid } from "./feed/FeedSection";
import { getActiveHeroSlugs } from "./feed/HolidayHero";
import FestivalDebugPanel from "@/components/FestivalDebugPanel";


// Reserved for future use
// type _FeedSettings = {
//   feed_type?: "default" | "sections" | "custom";
//   show_activity_tab?: boolean;
//   featured_section_ids?: string[];
//   items_per_section?: number;
//   default_layout?: string;
// };

interface FeedViewProps {
  /** Pre-fetched sections — skips internal fetch when provided. */
  prefetchedSections?: FeedSectionData[];
  /** Disable local index UI when a page-level index is rendered upstream. */
  enableSectionIndex?: boolean;
}

type FeedIndexEntry = {
  id: string;
  label: string;
  requiresExpansion: boolean;
};

const HOLIDAY_INDEX_ANCHOR_ID = "feed-section-holidays";

function sanitizeAnchorSegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "section";
}

function getSectionAnchorId(section: FeedSectionData, order: number): string {
  const base = sanitizeAnchorSegment(section.slug || section.title);
  return `feed-section-${order + 1}-${base}`;
}

export default function FeedView({ prefetchedSections, enableSectionIndex = true }: FeedViewProps = {}) {
  const { portal } = usePortal();
  const searchParams = useSearchParams();
  const showFestivalDebug = searchParams?.get("debug") === "festivals";
  const INITIAL_VISIBLE_SECTIONS = 5;

  const [sections, setSections] = useState<FeedSectionData[]>(prefetchedSections ?? []);
  const [loading, setLoading] = useState(!prefetchedSections);
  const [error, setError] = useState<string | null>(null);
  const [showAllSections, setShowAllSections] = useState(false);
  const [isIndexCollapsed, setIsIndexCollapsed] = useState(false);
  const [activeAnchorId, setActiveAnchorId] = useState<string | null>(null);
  const [isMobileIndexOpen, setIsMobileIndexOpen] = useState(false);

  const hasPrefetched = prefetchedSections !== undefined;

  const loadFeed = useCallback(async (signal: AbortSignal) => {
    try {
      setError(null);

      // Fetch from portal feed API
      const res = await fetch(`/api/portals/${portal.slug}/feed`, { signal });

      if (!res.ok) {
        throw new Error("Failed to load feed");
      }

      const data = await res.json();

      if (!signal.aborted) {
        setSections(data.sections || []);
        setLoading(false);
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      console.error("Failed to load feed:", err);
      if (!signal.aborted) {
        setError("Unable to load feed. Please try again.");
        setLoading(false);
      }
    }
  }, [portal.slug]);

  useEffect(() => {
    if (hasPrefetched) return;
    const controller = new AbortController();
    loadFeed(controller.signal);
    return () => controller.abort();
  }, [loadFeed, hasPrefetched]);

  // Sync state when prefetched data changes (e.g. parent reload)
  useEffect(() => {
    if (prefetchedSections !== undefined) {
      setSections(prefetchedSections);
      setLoading(false);
    }
  }, [prefetchedSections]);

  // Reset progressive disclosure after data refresh.
  useEffect(() => {
    setShowAllSections(false);
  }, [sections.length]);

  // Separate holiday sections from regular sections
  // Exclude any holidays that have hero treatment in HolidayHero to avoid duplication
  const heroSlugs = getActiveHeroSlugs();
  const holidaySections = sections.filter(
    s => THEMED_SLUGS.includes(s.slug) && !heroSlugs.includes(s.slug)
  );
  const regularSections = sections.filter(s => !THEMED_SLUGS.includes(s.slug));
  const regularSectionOrder = useMemo(
    () => new Map(regularSections.map((section, index) => [section.id, index])),
    [regularSections]
  );
  const visibleRegularSections = showAllSections
    ? regularSections
    : regularSections.slice(0, INITIAL_VISIBLE_SECTIONS);
  const hiddenSectionCount = Math.max(regularSections.length - visibleRegularSections.length, 0);
  const canToggleSectionDensity = regularSections.length > INITIAL_VISIBLE_SECTIONS;
  const sectionIndex = useMemo<FeedIndexEntry[]>(() => {
    if (!enableSectionIndex) return [];

    const entries: FeedIndexEntry[] = [];

    if (holidaySections.length > 0) {
      entries.push({
        id: HOLIDAY_INDEX_ANCHOR_ID,
        label: "Holidays & Special Times",
        requiresExpansion: false,
      });
    }

    regularSections.forEach((section, index) => {
      entries.push({
        id: getSectionAnchorId(section, index),
        label: section.title,
        requiresExpansion: !showAllSections && index >= INITIAL_VISIBLE_SECTIONS,
      });
    });

    return entries;
  }, [enableSectionIndex, holidaySections.length, regularSections, showAllSections]);
  const showIndexRail = enableSectionIndex && sectionIndex.length >= 4;

  const jumpToSection = useCallback((entry: FeedIndexEntry) => {
    const scrollToAnchor = () => {
      const target = document.getElementById(entry.id);
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveAnchorId(entry.id);
    };

    if (entry.requiresExpansion) {
      setShowAllSections(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(scrollToAnchor);
      });
      return;
    }

    scrollToAnchor();
  }, []);

  useEffect(() => {
    if (!enableSectionIndex) return;

    if (sectionIndex.length === 0) {
      setActiveAnchorId(null);
      return;
    }

    const anchors = sectionIndex
      .map((entry) => document.getElementById(entry.id))
      .filter((el): el is HTMLElement => !!el);

    if (anchors.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => Math.abs(a.boundingClientRect.top) - Math.abs(b.boundingClientRect.top));
        if (visible[0]?.target?.id) {
          setActiveAnchorId(visible[0].target.id);
        }
      },
      {
        rootMargin: "-20% 0px -65% 0px",
        threshold: [0, 0.15, 0.35, 0.6],
      }
    );

    anchors.forEach((anchor) => observer.observe(anchor));
    if (anchors[0]) {
      setActiveAnchorId((prev) => prev ?? anchors[0].id);
    }

    return () => observer.disconnect();
  }, [enableSectionIndex, sectionIndex, showAllSections]);

  useEffect(() => {
    if (!showIndexRail) {
      setIsMobileIndexOpen(false);
    }
  }, [showIndexRail]);

  // Loading state — matches actual feed layout (holiday grid + compact sections)
  if (loading) {
    return (
      <div>
        {/* Holiday grid skeleton */}
        <div className="mb-4 sm:mb-6">
          <div className="h-5 w-52 rounded skeleton-shimmer mb-3" />
          <div className="space-y-2">
            {[...Array(3)].map((_, j) => (
              <div key={j} className="rounded-2xl h-[60px] skeleton-shimmer" />
            ))}
          </div>
        </div>

        {/* Section skeleton (collapsible/list style) */}
        {[...Array(3)].map((_, i) => (
          <div key={i} className="mb-4 sm:mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="h-5 w-32 rounded skeleton-shimmer" />
              <div className="h-5 w-14 rounded-full skeleton-shimmer" />
            </div>
            <div className="space-y-2">
              {[...Array(3)].map((_, j) => (
                <div key={j} className="rounded-xl h-16 skeleton-shimmer" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Error state with enhanced styling
  if (error) {
    return (
      <div className="py-16 text-center">
        <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-[var(--coral)]/20 to-[var(--twilight)] flex items-center justify-center">
          <svg className="w-10 h-10 text-[var(--coral)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-[var(--cream)] text-lg font-medium mb-2">Something broke</h3>
        <p className="text-[var(--muted)] text-sm mb-6 max-w-xs mx-auto">{error}</p>
        <button
          onClick={() => {
            setLoading(true);
            const controller = new AbortController();
            loadFeed(controller.signal);
          }}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--coral)] text-[var(--void)] rounded-lg font-mono text-sm font-medium hover:bg-[var(--rose)] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Try Again
        </button>
      </div>
    );
  }

  // Empty state
  if (sections.length === 0) {
    return (
      <div className="py-16 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--twilight)]/50 flex items-center justify-center">
          <svg className="w-8 h-8 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <h2 className="text-lg text-[var(--cream)] mb-2">Nothing here yet</h2>
        <p className="text-[var(--muted)] text-sm max-w-xs mx-auto mb-4">
          Check back soon for curated events and recommendations.
        </p>
        <Link
          href={`/${portal.slug}?view=events`}
          className="inline-block px-4 py-2 bg-[var(--coral)] text-[var(--void)] rounded-lg font-mono text-sm font-medium hover:bg-[var(--rose)] transition-colors"
        >
          Browse All Events
        </Link>
      </div>
    );
  }

  return (
    <div className={showIndexRail ? "lg:grid lg:grid-cols-[minmax(0,1fr)_240px] lg:gap-6" : ""}>
      <div className="min-w-0">
        {showFestivalDebug && <FestivalDebugPanel portalSlug={portal.slug} />}

        {/* Holiday cards - 2-column grid */}
        <section
          id={HOLIDAY_INDEX_ANCHOR_ID}
          data-feed-anchor="true"
          data-index-label="Holidays & Special Times"
          className={holidaySections.length > 0 ? "scroll-mt-28" : ""}
        >
          <HolidayGrid sections={holidaySections} portalSlug={portal.slug} />
        </section>

        {/* Regular feed sections */}
        {visibleRegularSections.map((section, index) => {
          const sectionOrder = regularSectionOrder.get(section.id) ?? index;
          const anchorId = getSectionAnchorId(section, sectionOrder);
          return (
            <section
              key={section.id}
              id={anchorId}
              data-feed-anchor="true"
              data-index-label={section.title}
              className="scroll-mt-28"
            >
              <FeedSection section={section} isFirst={sectionOrder === 0} />
            </section>
          );
        })}

        {canToggleSectionDensity && (
          <div className="pt-3 pb-1">
            <button
              type="button"
              onClick={() => setShowAllSections((prev) => !prev)}
              className="w-full rounded-xl border border-[var(--twilight)]/50 bg-[var(--night)]/55 px-4 py-3 text-left transition-all duration-200 hover:border-[var(--coral)]/45 hover:bg-[var(--night)]/75 hover:shadow-[0_12px_32px_rgba(0,0,0,0.3)]"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-[var(--muted)]">
                    Continue Browsing
                  </p>
                  <p className="text-sm text-[var(--cream)] font-medium">
                    {showAllSections
                      ? "Show fewer sections"
                      : `Show ${hiddenSectionCount} more ${hiddenSectionCount === 1 ? "section" : "sections"}`}
                  </p>
                </div>
                <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-[var(--coral)]/40 px-2 font-mono text-xs text-[var(--coral)]">
                  {showAllSections ? "−" : `+${hiddenSectionCount}`}
                </span>
              </div>
            </button>
          </div>
        )}
      </div>

      {showIndexRail && (
        <aside className="hidden lg:block">
          <div className="sticky top-[7.25rem] rounded-xl border border-[var(--twilight)]/40 bg-[var(--night)]/75 backdrop-blur-sm">
            <button
              type="button"
              onClick={() => setIsIndexCollapsed((prev) => !prev)}
              className="w-full px-3 py-2.5 border-b border-[var(--twilight)]/35 flex items-center justify-between text-left hover:bg-[var(--twilight)]/15 transition-colors"
              aria-expanded={!isIndexCollapsed}
              aria-controls="feed-section-index"
            >
              <div>
                <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-[var(--muted)]">Section Index</p>
                <p className="text-xs text-[var(--cream)]">{sectionIndex.length} anchors</p>
              </div>
              <span className="text-[var(--muted)] text-sm">{isIndexCollapsed ? "+" : "−"}</span>
            </button>

            {!isIndexCollapsed && (
              <nav id="feed-section-index" className="max-h-[65vh] overflow-y-auto p-2">
                <ul className="space-y-1">
                  {sectionIndex.map((entry, index) => {
                    const isActive = activeAnchorId === entry.id;
                    return (
                      <li key={entry.id}>
                        <button
                          type="button"
                          onClick={() => jumpToSection(entry)}
                          className={`w-full px-2.5 py-2 rounded-lg text-left transition-colors flex items-center justify-between gap-2 ${
                            isActive
                              ? "bg-[var(--twilight)]/70 text-[var(--cream)] border border-[var(--coral)]/40"
                              : "text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/30 border border-transparent"
                          }`}
                        >
                          <span className="truncate text-[11px]">
                            {index + 1}. {entry.label}
                          </span>
                          {entry.requiresExpansion && (
                            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[var(--twilight)]/50 text-[var(--soft)]">
                              more
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            )}
          </div>
        </aside>
      )}

      {showIndexRail && (
        <>
          <button
            type="button"
            onClick={() => setIsMobileIndexOpen(true)}
            className="lg:hidden fixed bottom-20 right-4 z-40 rounded-full border border-[var(--coral)]/45 bg-[var(--night)]/90 backdrop-blur-sm px-3.5 py-2.5 text-xs font-mono text-[var(--cream)] shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
          >
            Index
          </button>

          {isMobileIndexOpen && (
            <div className="lg:hidden fixed inset-0 z-50">
              <button
                type="button"
                onClick={() => setIsMobileIndexOpen(false)}
                className="absolute inset-0 bg-black/55 backdrop-blur-[1px]"
                aria-label="Close section index"
              />
              <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-[var(--twilight)]/45 bg-[var(--night)] p-3 pb-5 max-h-[70vh] overflow-hidden">
                <div className="flex items-center justify-between px-1 pb-2">
                  <div>
                    <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-[var(--muted)]">Section Index</p>
                    <p className="text-xs text-[var(--cream)]">{sectionIndex.length} anchors</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMobileIndexOpen(false)}
                    className="h-8 w-8 rounded-full border border-[var(--twilight)]/45 text-[var(--muted)] hover:text-[var(--cream)]"
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>
                <nav className="overflow-y-auto max-h-[58vh] pr-1">
                  <ul className="space-y-1">
                    {sectionIndex.map((entry, index) => {
                      const isActive = activeAnchorId === entry.id;
                      return (
                        <li key={`mobile-${entry.id}`}>
                          <button
                            type="button"
                            onClick={() => {
                              jumpToSection(entry);
                              setIsMobileIndexOpen(false);
                            }}
                            className={`w-full px-2.5 py-2 rounded-lg text-left transition-colors flex items-center justify-between gap-2 ${
                              isActive
                                ? "bg-[var(--twilight)]/70 text-[var(--cream)] border border-[var(--coral)]/40"
                                : "text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/30 border border-transparent"
                            }`}
                          >
                            <span className="truncate text-[11px]">
                              {index + 1}. {entry.label}
                            </span>
                            {entry.requiresExpansion && (
                              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[var(--twilight)]/50 text-[var(--soft)]">
                                more
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </nav>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
