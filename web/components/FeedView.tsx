"use client";

import { useState, useEffect, useCallback } from "react";
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

export default function FeedView() {
  const { portal } = usePortal();
  const searchParams = useSearchParams();
  const showFestivalDebug = searchParams?.get("debug") === "festivals";
  const INITIAL_VISIBLE_SECTIONS = 5;

  const [sections, setSections] = useState<FeedSectionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllSections, setShowAllSections] = useState(false);

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
    const controller = new AbortController();
    loadFeed(controller.signal);
    return () => controller.abort();
  }, [loadFeed]);

  // Reset progressive disclosure after data refresh.
  useEffect(() => {
    setShowAllSections(false);
  }, [sections.length]);

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

  // Separate holiday sections from regular sections
  // Exclude any holidays that have hero treatment in HolidayHero to avoid duplication
  const heroSlugs = getActiveHeroSlugs();
  const holidaySections = sections.filter(
    s => THEMED_SLUGS.includes(s.slug) && !heroSlugs.includes(s.slug)
  );
  const regularSections = sections.filter(s => !THEMED_SLUGS.includes(s.slug));
  const visibleRegularSections = showAllSections
    ? regularSections
    : regularSections.slice(0, INITIAL_VISIBLE_SECTIONS);
  const hiddenSectionCount = Math.max(regularSections.length - visibleRegularSections.length, 0);

  return (
    <div>
      {showFestivalDebug && <FestivalDebugPanel portalSlug={portal.slug} />}

      {/* Holiday cards - 2-column grid */}
      <HolidayGrid sections={holidaySections} portalSlug={portal.slug} />

      {/* Regular feed sections */}
      {visibleRegularSections.map((section, index) => (
        <div key={section.id}>
          <FeedSection section={section} isFirst={index === 0} />
        </div>
      ))}

      {hiddenSectionCount > 0 && (
        <div className="pt-3 pb-1">
          <button
            type="button"
            onClick={() => setShowAllSections(true)}
            className="w-full rounded-xl border border-[var(--twilight)]/50 bg-[var(--night)]/55 px-4 py-3 text-left transition-all duration-200 hover:border-[var(--coral)]/45 hover:bg-[var(--night)]/75 hover:shadow-[0_12px_32px_rgba(0,0,0,0.3)]"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-[var(--muted)]">
                  Continue Browsing
                </p>
                <p className="text-sm text-[var(--cream)] font-medium">
                  Show {hiddenSectionCount} more {hiddenSectionCount === 1 ? "section" : "sections"}
                </p>
              </div>
              <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-[var(--coral)]/40 px-2 font-mono text-xs text-[var(--coral)]">
                +{hiddenSectionCount}
              </span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
