"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import type { Destination } from "@/lib/forth-types";

interface DiscoverNeighborhoodSectionProps {
  destinations: Destination[];
  onDestinationClick?: (dest: Destination) => void;
}

const CATEGORIES = [
  { id: "all", label: "All", types: [] as string[] },
  {
    id: "food",
    label: "Food & Drink",
    types: ["restaurant", "cafe", "bakery", "food_hall", "diner", "pizzeria", "coffee_shop"],
  },
  {
    id: "bars",
    label: "Bars",
    types: ["bar", "brewery", "cocktail_bar", "pub", "taproom", "wine_bar", "lounge", "rooftop", "distillery", "sports_bar"],
  },
  {
    id: "arts",
    label: "Arts",
    types: ["museum", "gallery", "theater", "cinema"],
  },
  {
    id: "outdoors",
    label: "Outdoors",
    types: ["park"],
  },
] as const;

type CategoryId = (typeof CATEGORIES)[number]["id"];

function formatTime(time: string | null | undefined): string {
  if (!time) return "TBA";
  const [h, m] = time.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return "TBA";
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${m.toString().padStart(2, "0")} ${period}`;
}

export default function DiscoverNeighborhoodSection({ destinations, onDestinationClick }: DiscoverNeighborhoodSectionProps) {
  const [activeCategory, setActiveCategory] = useState<CategoryId>("all");

  if (destinations.length === 0) return null;

  const filtered = destinations
    .filter((dest) => {
      if (activeCategory === "all") return true;
      const category = CATEGORIES.find((c) => c.id === activeCategory);
      if (!category || category.types.length === 0) return true;
      return category.types.includes((dest.venue.venue_type ?? "") as never);
    })
    .slice(0, 12);

  return (
    <section id="nearby" className="space-y-4">
      <div>
        <h2 className="font-display text-2xl text-[var(--hotel-charcoal)]">Steps Away</h2>
        <p className="text-sm font-body text-[var(--hotel-stone)] mt-0.5">
          Walkable dining, drinks, and culture
        </p>
      </div>

      {/* Category filter pills */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {CATEGORIES.map((category) => {
          const isActive = activeCategory === category.id;
          return (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              className={
                isActive
                  ? "flex-shrink-0 px-4 py-2 rounded-full border border-[var(--hotel-champagne)] bg-[var(--hotel-champagne)] text-sm font-body text-[var(--hotel-charcoal)] font-medium transition-colors"
                  : "flex-shrink-0 px-4 py-2 rounded-full border border-[var(--hotel-sand)] text-sm font-body text-[var(--hotel-stone)] hover:bg-[var(--hotel-cream)] transition-colors"
              }
            >
              {category.label}
            </button>
          );
        })}
      </div>

      {/* Destination grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filtered.map((dest) => (
          <button
            key={dest.venue.id}
            onClick={() => onDestinationClick?.(dest)}
            className="rounded-xl border border-[var(--hotel-sand)] bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow text-left"
          >
            {dest.venue.image_url && (
              <div className="h-32 relative overflow-hidden">
                <img
                  src={dest.venue.image_url}
                  alt={dest.venue.name}
                  className="absolute inset-0 w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            )}
            <div className="p-3 space-y-1.5">
              <p className="text-base font-body font-medium text-[var(--hotel-charcoal)]">
                {dest.venue.name}
              </p>
              <p className="text-xs font-body text-[var(--hotel-stone)]">
                {[dest.venue.neighborhood, dest.proximity_label].filter(Boolean).join(" · ")}
              </p>
              {dest.special_state === "active_now" && dest.top_special && (
                <p className="text-xs font-body font-medium text-green-700">
                  {dest.top_special.title}
                </p>
              )}
              {dest.special_state === "starting_soon" && dest.top_special && (
                <p className="text-xs font-body text-amber-600">
                  {dest.top_special.title}
                </p>
              )}
              {dest.next_event && (
                <p className="text-xs font-body text-[var(--hotel-stone)]">
                  {[dest.next_event.title, formatTime(dest.next_event.start_time)]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
