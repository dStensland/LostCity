"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin } from "@phosphor-icons/react";
import FeedSectionHeader from "@/components/feed/FeedSectionHeader";
import FeedSectionReveal from "@/components/feed/FeedSectionReveal";
import FeedSectionSkeleton from "@/components/feed/FeedSectionSkeleton";
import { PlacesToGoCategoryTile } from "./PlacesToGoCategoryTile";
import type { PlacesToGoResponse } from "@/lib/places-to-go/types";
import { buildExploreUrl } from "@/lib/find-url";

interface PlacesToGoSectionProps {
  portalSlug: string;
}

export function PlacesToGoSection({ portalSlug }: PlacesToGoSectionProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery<PlacesToGoResponse>({
    queryKey: ["places-to-go", portalSlug],
    queryFn: async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);
      try {
        const res = await fetch(
          `/api/portals/${encodeURIComponent(portalSlug)}/city-pulse/places-to-go`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<PlacesToGoResponse>;
      } finally {
        clearTimeout(timeoutId);
      }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  const handleToggle = useCallback(
    (key: string) => {
      setExpandedKey((prev) => (prev === key ? null : key));
    },
    []
  );

  if (isLoading) {
    return (
      <FeedSectionSkeleton
        accentColor="var(--neon-green)"
        minHeight={200}
      />
    );
  }

  if (isError || !data || data.categories.length === 0) {
    return null;
  }

  return (
    <FeedSectionReveal className="pb-2">
      <FeedSectionHeader
        title="Places to Go"
        priority="secondary"
        variant="destinations"
        accentColor="var(--neon-green)"
        icon={<MapPin weight="duotone" className="w-5 h-5" />}
        seeAllHref={buildExploreUrl({ portalSlug, lane: "places" })}
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {data.categories.map((category) => (
          <PlacesToGoCategoryTile
            key={category.key}
            category={category}
            isExpanded={expandedKey === category.key}
            onToggle={() => handleToggle(category.key)}
          />
        ))}
      </div>
    </FeedSectionReveal>
  );
}

export type { PlacesToGoSectionProps };
