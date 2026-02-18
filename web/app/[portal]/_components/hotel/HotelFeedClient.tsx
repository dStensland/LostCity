"use client";

import { useEffect, useState } from "react";
import HotelFeed from "./HotelFeed";
import type { Portal } from "@/lib/portal-context";
import type { FeedSection, HotelFeedEvent } from "./HotelFeed";

interface HotelFeedClientProps {
  portal: Portal;
}

type ApiFeedEvent = HotelFeedEvent & {
  venue?: { name?: string | null } | null;
};

type ApiFeedSection = {
  title: string;
  description?: string;
  slug?: string;
  layout?: string;
  events?: ApiFeedEvent[];
};

type ApiFeedResponse = {
  sections?: ApiFeedSection[];
};

/**
 * Client-side wrapper for HotelFeed that fetches data from the portal feed API.
 * Normalizes the sections response (extracting venue_name from nested venue object).
 */
export default function HotelFeedClient({ portal }: HotelFeedClientProps) {
  const [sections, setSections] = useState<FeedSection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch(`/api/portals/${portal.slug}/feed`);
        const data = (await response.json()) as ApiFeedResponse;

        if (data.sections) {
          const normalized: FeedSection[] = data.sections
            .filter((section) => (section.events?.length || 0) > 0)
            .map((section) => ({
              title: section.title,
              description: section.description,
              slug: section.slug,
              layout: section.layout,
              events: (section.events || []).map((event) => ({
                ...event,
                venue_name: event.venue?.name || event.venue_name || null,
              })),
            }));
          setSections(normalized);
        }
      } catch (error) {
        console.error("Failed to fetch hotel feed data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [portal.slug]);

  if (loading) {
    return <LoadingSkeleton />;
  }

  return <HotelFeed portal={portal} sections={sections} />;
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--hotel-ivory)]">
      <div className="sticky top-0 z-50 bg-[var(--hotel-ivory)]/95 backdrop-blur-md border-b border-[var(--hotel-sand)] shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="h-8 w-32 bg-[var(--hotel-sand)] rounded animate-pulse" />
          <div className="flex gap-8">
            <div className="h-4 w-16 bg-[var(--hotel-sand)] rounded animate-pulse" />
            <div className="h-4 w-16 bg-[var(--hotel-sand)] rounded animate-pulse" />
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="mb-16">
          <div className="h-12 w-64 bg-[var(--hotel-sand)] rounded mb-3 animate-pulse" />
          <div className="h-6 w-48 bg-[var(--hotel-sand)] rounded animate-pulse" />
        </div>

        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-[var(--hotel-cream)] rounded-lg animate-pulse" />
          ))}
        </div>
      </main>
    </div>
  );
}
