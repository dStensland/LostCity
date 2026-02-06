"use client";

import { useState, useEffect } from "react";
import type { VenueTagSummary } from "@/lib/types";

interface VenueTagBadgesProps {
  venueId: number;
  maxTags?: number;
}

export default function VenueTagBadges({ venueId, maxTags = 3 }: VenueTagBadgesProps) {
  const [tags, setTags] = useState<VenueTagSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTags = async () => {
      try {
        const res = await fetch(`/api/venues/${venueId}/tags`);
        if (!res.ok) return;
        const data = await res.json();
        // Only show tags with decent score
        const goodTags = (data.tags || [])
          .filter((t: VenueTagSummary) => t.score >= 2)
          .slice(0, maxTags);
        setTags(goodTags);
      } catch {
        // Silently fail - tags are not critical
      } finally {
        setIsLoading(false);
      }
    };

    fetchTags();
  }, [venueId, maxTags]);

  if (isLoading || tags.length === 0) {
    return null;
  }

  const displayTags = tags.slice(0, maxTags);
  const extraCount = tags.length - displayTags.length;

  return (
    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
      {displayTags.map((tag) => {
        return (
          <span
            key={tag.tag_id}
            data-tag-group={tag.tag_group}
            className="inline-flex items-center px-1.5 py-0.5 rounded text-[0.55rem] font-mono venue-tag-badge"
          >
            {tag.tag_label}
          </span>
        );
      })}
      {extraCount > 0 && (
        <span className="text-[0.55rem] font-mono text-[var(--muted)]">
          +{extraCount}
        </span>
      )}
    </div>
  );
}
