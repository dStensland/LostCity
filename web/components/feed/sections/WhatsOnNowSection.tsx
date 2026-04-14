"use client";

/**
 * WhatsOnNowSection — feed section for current exhibitions on non-arts portals.
 *
 * Fetches from /api/exhibitions?portal=...&showing=current and filters
 * client-side by exhibitionTypes (API also supports ?type= for single type).
 *
 * Usage:
 *   Atlanta: title="What's On Now", exhibitionTypes=[] (all types)
 *   Family:  title="On Now for Kids", exhibitionTypes=["seasonal","special-exhibit","attraction"]
 *   FORTH:   title="Special Exhibits & Seasonal Experiences", exhibitionTypes=[] (all types)
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import FeedSectionHeader from "@/components/feed/FeedSectionHeader";
import { ExhibitionRowCard } from "@/components/feed/ExhibitionRowCard";
import type { ExhibitionRowData } from "@/components/feed/ExhibitionRowCard";

interface WhatsOnNowSectionProps {
  portalSlug: string;
  /** Section title — bespoke per portal */
  title: string;
  /** Exhibition types to include. Empty array = all types. */
  exhibitionTypes?: string[];
  /** Max items to display (default 6) */
  limit?: number;
}

type FetchState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "done"; exhibitions: ExhibitionRowData[] };

export function WhatsOnNowSection({
  portalSlug,
  title,
  exhibitionTypes = [],
  limit = 6,
}: WhatsOnNowSectionProps) {
  const [state, setState] = useState<FetchState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const params = new URLSearchParams({
      portal: portalSlug,
      showing: "current",
      limit: String(Math.min(limit * 3, 30)), // fetch extra for client-side type filter
    });

    fetch(`/api/exhibitions?${params}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Exhibitions fetch failed: ${res.status}`);
        return res.json();
      })
      .then((data: { exhibitions: ExhibitionRowData[] }) => {
        if (cancelled) return;
        let items = data.exhibitions ?? [];

        // Client-side type filter when specific types are requested
        if (exhibitionTypes.length > 0) {
          const typeSet = new Set(exhibitionTypes);
          items = items.filter(
            (ex) => ex.exhibition_type && typeSet.has(ex.exhibition_type),
          );
        }

        setState({ status: "done", exhibitions: items.slice(0, limit) });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof Error && err.name === "AbortError") {
          setState({ status: "error", message: "Request timed out" });
        } else {
          setState({
            status: "error",
            message: err instanceof Error ? err.message : "Failed to load exhibitions",
          });
        }
      })
      .finally(() => clearTimeout(timeoutId));

    return () => {
      cancelled = true;
      controller.abort();
    };
  // exhibitionTypes array identity would cause re-renders — JSON stringify for stable comparison
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portalSlug, limit, JSON.stringify(exhibitionTypes)]);

  // Don't render if loading completed with no results
  if (state.status === "done" && state.exhibitions.length === 0) return null;

  // Don't render on error — section is non-critical
  if (state.status === "error") return null;

  const seeAllHref = `/${portalSlug}/exhibitions`;

  return (
    <div className="mt-8">
      <div className="h-px bg-[var(--twilight)]" />
      <div className="pt-6">
        <FeedSectionHeader
          title={title}
          priority="secondary"
          variant="cinema"
          seeAllHref={seeAllHref}
          seeAllLabel="See all"
        />

        {state.status === "loading" ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 py-2.5"
                style={{ opacity: 1 - i * 0.2 }}
              >
                <div className="w-20 h-20 flex-shrink-0 rounded-lg skeleton-shimmer opacity-20" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 skeleton-shimmer opacity-20 rounded" style={{ width: "70%" }} />
                  <div className="h-2.5 skeleton-shimmer opacity-15 rounded" style={{ width: "50%" }} />
                  <div className="h-2.5 skeleton-shimmer opacity-10 rounded" style={{ width: "35%" }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="divide-y divide-[var(--twilight)]/40">
              {state.exhibitions.map((ex) => (
                <ExhibitionRowCard key={ex.id} exhibition={ex} portalSlug={portalSlug} />
              ))}
            </div>

            <div className="mt-3">
              <Link
                href={seeAllHref}
                className="text-xs font-mono text-[var(--action-primary)] hover:opacity-80 transition-opacity"
              >
                All exhibitions →
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export type { WhatsOnNowSectionProps };
