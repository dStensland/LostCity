"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePortal } from "@/lib/portal-context";
import FeedSection, { type FeedSectionData } from "./feed/FeedSection";
import SerendipityFeed from "./SerendipityFeed";

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

  const [sections, setSections] = useState<FeedSectionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  // Loading state - matches actual feed layout with shimmer
  if (loading) {
    return (
      <div className="py-6 space-y-10">
        {/* Hero banner skeleton */}
        <div className="rounded-2xl h-56 sm:h-64 skeleton-shimmer" />

        {/* Carousel section skeleton */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="h-6 w-36 rounded skeleton-shimmer" />
            <div className="h-6 w-16 rounded-full skeleton-shimmer" style={{ animationDelay: "0.1s" }} />
          </div>
          <div className="flex gap-3 overflow-hidden -mx-4 px-4">
            {[...Array(4)].map((_, j) => (
              <div key={j} className="flex-shrink-0 w-72 rounded-xl h-52 skeleton-shimmer" style={{ animationDelay: `${j * 0.1}s` }} />
            ))}
          </div>
        </div>

        {/* Grid section skeleton */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="h-6 w-32 rounded skeleton-shimmer" />
            <div className="h-6 w-16 rounded-full skeleton-shimmer" style={{ animationDelay: "0.1s" }} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, j) => (
              <div key={j} className="rounded-xl h-52 skeleton-shimmer" style={{ animationDelay: `${j * 0.1 + 0.2}s` }} />
            ))}
          </div>
        </div>

        {/* List section skeleton */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="h-6 w-28 rounded skeleton-shimmer" />
            <div className="h-6 w-16 rounded-full skeleton-shimmer" style={{ animationDelay: "0.1s" }} />
          </div>
          <div className="space-y-2">
            {[...Array(5)].map((_, j) => (
              <div key={j} className="rounded-lg h-16 skeleton-shimmer" style={{ animationDelay: `${j * 0.08 + 0.3}s` }} />
            ))}
          </div>
        </div>
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

  // Render sections with serendipity moments interspersed
  return (
    <div className="py-6">
      {sections.map((section, index) => (
        <div key={section.id}>
          <FeedSection section={section} isFirst={index === 0} />
          {/* Insert serendipity moment after every 2nd section */}
          {index > 0 && index % 2 === 1 && index < sections.length - 1 && (
            <SerendipityFeed portalSlug={portal.slug} position={index} />
          )}
        </div>
      ))}
    </div>
  );
}
