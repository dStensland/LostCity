"use client";

import { useState } from "react";
import type { CityPulseSection, HorizonBucket } from "@/lib/city-pulse/types";
import { Binoculars } from "@phosphor-icons/react";
import FeedSectionHeader from "@/components/feed/FeedSectionHeader";
import { HorizonBucketComponent } from "@/components/feed/HorizonBucket";

const DEFAULT_VISIBLE_BUCKETS = 3;

interface Props {
  section: CityPulseSection;
  portalSlug: string;
}

export default function PlanningHorizonSection({ section, portalSlug }: Props) {
  const buckets = (section.meta?.buckets ?? []) as HorizonBucket[];
  const [showAllBuckets, setShowAllBuckets] = useState(false);

  if (buckets.length === 0) return null;

  const visibleBuckets = showAllBuckets
    ? buckets
    : buckets.slice(0, DEFAULT_VISIBLE_BUCKETS);
  const hiddenBucketCount = buckets.length - DEFAULT_VISIBLE_BUCKETS;

  return (
    <div>
      <FeedSectionHeader
        title={section.title}
        priority={section.priority}
        accentColor="var(--gold)"
        icon={<Binoculars weight="duotone" className="w-3.5 h-3.5" />}
      />

      {section.subtitle && (
        <p className="mt-1 mb-4 text-sm text-[var(--soft)]">
          {section.subtitle}
        </p>
      )}

      {/* Bucket stack */}
      <div className="space-y-6">
        {visibleBuckets.map((bucket) => (
          <HorizonBucketComponent
            key={bucket.key}
            bucket={bucket}
            portalSlug={portalSlug}
          />
        ))}
      </div>

      {/* "See N more months" expansion */}
      {hiddenBucketCount > 0 && !showAllBuckets && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={() => setShowAllBuckets(true)}
            className="min-h-[44px] w-full max-w-sm rounded-full border border-[var(--twilight)] bg-[var(--twilight)]/30 px-6 py-2.5 font-mono text-xs text-[var(--soft)] transition-colors hover:bg-[var(--twilight)]/50"
          >
            {hiddenBucketCount} more month{hiddenBucketCount !== 1 ? "s" : ""}
          </button>
        </div>
      )}
    </div>
  );
}
