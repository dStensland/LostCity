"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { usePortal } from "@/lib/portal-context";
import FeedSection, { type FeedSectionData } from "./feed/FeedSection";

type FeedSettings = {
  feed_type?: "default" | "sections" | "custom";
  show_activity_tab?: boolean;
  featured_section_ids?: string[];
  items_per_section?: number;
  default_layout?: string;
};

export default function FeedView() {
  const { user, loading: authLoading } = useAuth();
  const { portal } = usePortal();

  const [sections, setSections] = useState<FeedSectionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get feed settings from portal
  const feedSettings = (portal.settings?.feed || {}) as FeedSettings;
  const feedType = feedSettings.feed_type || "sections";

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

  // Loading state - matches actual feed layout
  if (loading) {
    return (
      <div className="py-6 space-y-10">
        {/* Hero banner skeleton */}
        <div className="rounded-2xl bg-[var(--twilight)]/50 h-56 sm:h-64 animate-pulse" />

        {/* Carousel section skeleton */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="h-6 w-36 bg-[var(--twilight)]/50 rounded animate-pulse" />
            <div className="h-6 w-16 bg-[var(--twilight)]/50 rounded-full animate-pulse" />
          </div>
          <div className="flex gap-3 overflow-hidden -mx-4 px-4">
            {[...Array(4)].map((_, j) => (
              <div key={j} className="flex-shrink-0 w-72 rounded-xl bg-[var(--twilight)]/50 h-52 animate-pulse" />
            ))}
          </div>
        </div>

        {/* Grid section skeleton */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="h-6 w-32 bg-[var(--twilight)]/50 rounded animate-pulse" />
            <div className="h-6 w-16 bg-[var(--twilight)]/50 rounded-full animate-pulse" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, j) => (
              <div key={j} className="rounded-xl bg-[var(--twilight)]/50 h-52 animate-pulse" />
            ))}
          </div>
        </div>

        {/* List section skeleton */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="h-6 w-28 bg-[var(--twilight)]/50 rounded animate-pulse" />
            <div className="h-6 w-16 bg-[var(--twilight)]/50 rounded-full animate-pulse" />
          </div>
          <div className="space-y-2">
            {[...Array(5)].map((_, j) => (
              <div key={j} className="rounded-lg bg-[var(--twilight)]/50 h-16 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="py-16 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--twilight)]/50 flex items-center justify-center">
          <svg className="w-8 h-8 text-[var(--coral)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p className="text-[var(--muted)] mb-4">{error}</p>
        <button
          onClick={() => {
            setLoading(true);
            const controller = new AbortController();
            loadFeed(controller.signal);
          }}
          className="px-4 py-2 bg-[var(--coral)] text-[var(--void)] rounded-lg font-mono text-sm font-medium hover:bg-[var(--rose)] transition-colors"
        >
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

  // Render sections
  return (
    <div className="py-6">
      {sections.map((section) => (
        <FeedSection key={section.id} section={section} />
      ))}
    </div>
  );
}
