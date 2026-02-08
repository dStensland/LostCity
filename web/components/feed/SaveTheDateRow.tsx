"use client";

import { useState, useEffect } from "react";
import FeedSectionHeader from "@/components/feed/FeedSectionHeader";
import FeaturedFestivalCard from "@/components/feed/FeaturedFestivalCard";
import type { MomentsResponse } from "@/lib/moments-utils";

interface SaveTheDateRowProps {
  portalSlug: string;
}

export default function SaveTheDateRow({ portalSlug }: SaveTheDateRowProps) {
  const [data, setData] = useState<MomentsResponse | null>(null);

  useEffect(() => {
    async function fetchMoments() {
      try {
        const res = await fetch(`/api/moments?portal=${portalSlug}`);
        if (res.ok) {
          setData(await res.json());
        }
      } catch (error) {
        console.error("Failed to fetch moments:", error);
      }
    }
    fetchMoments();
  }, [portalSlug]);

  if (!data) return null;

  // Combine upcoming + saveTheDate for the scroll row
  const { upcoming, saveTheDate } = data;
  const hasContent = upcoming.length > 0 || saveTheDate.length > 0;
  if (!hasContent) return null;

  return (
    <section>
      <FeedSectionHeader
        title="Save the Date"
        priority="tertiary"
        seeAllHref={`/${portalSlug}/festivals`}
        seeAllLabel="All festivals"
      />

      {/* Upcoming festivals (within 90 days) */}
      {upcoming.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-hide -mx-1 px-1">
          {upcoming.map((m) => (
            <FeaturedFestivalCard
              key={m.festival.id}
              moment={m}
              portalSlug={portalSlug}
              variant="compact"
            />
          ))}
        </div>
      )}

      {/* Save-the-date by month (further out) */}
      {saveTheDate.map(({ month, festivals }) => (
        <div key={month} className="mt-3">
          <p className="text-[0.65rem] font-mono text-[var(--muted)] uppercase tracking-wider mb-2">
            {month}
          </p>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
            {festivals.map((m) => (
              <FeaturedFestivalCard
                key={m.festival.id}
                moment={m}
                portalSlug={portalSlug}
                variant="compact"
              />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
