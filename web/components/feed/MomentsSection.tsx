"use client";

import { useState, useEffect } from "react";
import FeedSectionHeader from "@/components/feed/FeedSectionHeader";
import FeaturedFestivalCard from "@/components/feed/FeaturedFestivalCard";
import type { MomentsResponse } from "@/lib/moments-utils";

interface MomentsSectionProps {
  portalSlug: string;
  /** Pre-fetched moments data — skips internal fetch when provided. */
  prefetchedData?: MomentsResponse | null;
}

export default function MomentsSection({ portalSlug, prefetchedData }: MomentsSectionProps) {
  const [fetchedData, setFetchedData] = useState<MomentsResponse | null>(null);

  const hasPrefetched = prefetchedData !== undefined;
  useEffect(() => {
    if (hasPrefetched) return;

    async function fetchMoments() {
      try {
        const res = await fetch(`/api/moments?portal=${portalSlug}`);
        if (res.ok) {
          setFetchedData(await res.json());
        }
      } catch (error) {
        console.error("Failed to fetch moments:", error);
      }
    }
    fetchMoments();
  }, [portalSlug, hasPrefetched]);

  const data = hasPrefetched ? (prefetchedData ?? null) : fetchedData;

  if (!data) return null;

  const { takeover, imminent } = data;
  const hasContent = takeover || imminent.length > 0;
  if (!hasContent) return null;

  return (
    <section>
      {/* Takeover hero */}
      {takeover && (
        <div className="mb-4">
          <FeaturedFestivalCard
            moment={takeover}
            portalSlug={portalSlug}
            variant="hero"
          />
        </div>
      )}

      {/* Imminent festivals */}
      {imminent.length > 0 && (
        <div>
          <FeedSectionHeader
            title="Upcoming Festivals and Conventions"
            priority="tertiary"
            accentColor="var(--neon-cyan)"
            seeAllHref={`/${portalSlug}/festivals`}
          />
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
            {imminent.map((m) => (
              <FeaturedFestivalCard
                key={m.festival.id}
                moment={m}
                portalSlug={portalSlug}
                variant="card"
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
