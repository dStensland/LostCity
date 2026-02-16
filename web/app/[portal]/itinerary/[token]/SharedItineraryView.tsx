"use client";

import Link from "next/link";
import type { ItineraryItem } from "@/lib/itinerary-utils";
import ItineraryTimeline from "@/components/itinerary/ItineraryTimeline";

interface SharedItineraryViewProps {
  itinerary: {
    id: string;
    title: string;
    date: string | null;
    description: string | null;
    items: ItineraryItem[];
  };
  portalName: string;
  portalSlug: string;
}

export default function SharedItineraryView({
  itinerary,
  portalName,
  portalSlug,
}: SharedItineraryViewProps) {
  return (
    <div className="min-h-screen bg-[var(--bg-primary,#0f0f23)] text-white">
      <div className="max-w-lg mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href={`/${portalSlug}`}
            className="text-xs uppercase tracking-wider text-white/40 hover:text-white/60 transition-colors"
          >
            {portalName}
          </Link>
          <h1 className="text-2xl font-bold mt-2">{itinerary.title}</h1>
          {itinerary.date && (
            <p className="text-sm text-white/50 mt-1">{itinerary.date}</p>
          )}
          {itinerary.description && (
            <p className="text-sm text-white/60 mt-2">
              {itinerary.description}
            </p>
          )}
        </div>

        {/* Timeline */}
        <ItineraryTimeline items={itinerary.items} compact />

        {/* CTA */}
        <div className="mt-8 text-center">
          <Link
            href={`/${portalSlug}`}
            className="inline-block px-6 py-3 rounded-lg bg-[var(--accent,#f97316)] text-white text-sm font-medium hover:brightness-110 transition-all"
          >
            Explore {portalName}
          </Link>
          <p className="text-xs text-white/30 mt-3">
            Powered by LostCity
          </p>
        </div>
      </div>
    </div>
  );
}
