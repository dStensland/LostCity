"use client";

/**
 * FindView — the Explore launchpad content.
 *
 * Renders search bar, contextual lane teasers, and category spotlights.
 * When rendered inside the client shell (no serverFindData prop), fetches
 * data client-side from the find-data API route.
 */

import { useState, useEffect } from "react";
import FindSearchInput from "@/components/find/FindSearchInput";
import { RightNowSection } from "./RightNowSection";
import { FindSpotlight } from "./FindSpotlight";
import type { ServerFindData } from "@/lib/find-data";

interface FindViewProps {
  portalSlug: string;
  serverFindData?: ServerFindData | null;
}

export default function FindView({
  portalSlug,
  serverFindData,
}: FindViewProps) {
  const [findData, setFindData] = useState<ServerFindData | null>(serverFindData ?? null);
  const [loading, setLoading] = useState(!serverFindData);

  useEffect(() => {
    if (serverFindData) return;
    let cancelled = false;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    fetch(`/api/portals/${portalSlug}/find-data`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setFindData(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      })
      .finally(() => clearTimeout(timeoutId));

    return () => { cancelled = true; };
  }, [portalSlug, serverFindData]);

  return (
    <div className="pb-8">
      {/* Search bar */}
      <div className="px-4 pt-6 pb-1">
        <FindSearchInput portalSlug={portalSlug} placeholder="Search places, events, artists..." />
      </div>

      {/* Right Now — contextual lane teasers (always show — not dependent on data) */}
      <div className="px-4 pt-4">
        <RightNowSection portalSlug={portalSlug} pulse={findData?.pulse} />
      </div>

      {/* Loading shimmer for spotlights */}
      {loading && (
        <div className="px-4 pt-5 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-3">
              <div className="h-4 w-32 rounded skeleton-shimmer" style={{ animationDelay: `${i * 60}ms` }} />
              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="aspect-[4/3] rounded-lg skeleton-shimmer" style={{ animationDelay: `${(i * 3 + j) * 40}ms` }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Spotlight sections — category entry points */}
      {findData?.spotlights.map((spotlight) => (
        <div key={spotlight.category} className="px-4 pt-5">
          <div className="my-3 border-t border-[var(--twilight)] opacity-50" />
          <FindSpotlight spotlight={spotlight} portalSlug={portalSlug} />
        </div>
      ))}
    </div>
  );
}
