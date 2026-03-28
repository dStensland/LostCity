"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { EventFilters } from "@/lib/hooks/useEventFilters";

interface SmartEmptyStateProps {
  filters: EventFilters;
  portalSlug?: string;
  totalEventsCount?: number;
}

interface Suggestion {
  type: "genre" | "neighborhood" | "category" | "date";
  label: string;
  action: () => void;
  count?: number;
}

/**
 * Smart empty state that suggests related filters when no events match
 */
export default function SmartEmptyState({ filters, portalSlug, totalEventsCount = 0 }: SmartEmptyStateProps) {
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);

  const buildFilterUrl = useCallback((updates: Partial<EventFilters>) => {
    const params = new URLSearchParams();

    // Merge current filters with updates
    const merged = { ...filters, ...updates };

    if (merged.categories?.length) params.set("categories", merged.categories.join(","));
    if (merged.genres?.length) params.set("genres", merged.genres.join(","));
    if (merged.neighborhoods?.length) params.set("neighborhoods", merged.neighborhoods.join(","));
    if (merged.date) params.set("date", merged.date);
    if (merged.price) params.set("price", merged.price);

    const base = portalSlug ? `/${portalSlug}` : "";
    return `${base}?view=events&${params.toString()}`;
  }, [filters, portalSlug]);

  // Fetch alternative suggestions when no results
  useEffect(() => {
    async function fetchSuggestions() {
      setLoading(true);
      const suggestions: Suggestion[] = [];

      try {
        // Suggest related genres if a category is selected
        if (filters.categories?.length === 1 && filters.genres?.length) {
          const category = filters.categories[0];
          const response = await fetch(`/api/genres?category=${category}`);
          const data = await response.json();
          const otherGenres = data.genres?.filter((g: { genre: string }) => !filters.genres?.includes(g.genre)).slice(0, 2);

          otherGenres?.forEach((g: { genre: string }) => {
            suggestions.push({
              type: "genre",
              label: `Try ${g.genre}`,
              action: () => router.push(buildFilterUrl({ genres: [g.genre] })),
            });
          });
        }

        // Suggest nearby neighborhoods if a neighborhood is selected
        if (filters.neighborhoods?.length === 1) {
          // For now, suggest removing the neighborhood filter to expand search
          suggestions.push({
            type: "neighborhood",
            label: "Expand to all neighborhoods",
            action: () => router.push(buildFilterUrl({ neighborhoods: undefined })),
          });
        }

        // Suggest removing date filter to expand search
        if (filters.date) {
          const dateLabels: Record<string, string> = {
            today: "this week",
            weekend: "all events",
            week: "all events",
          };
          suggestions.push({
            type: "date",
            label: `Expand to ${dateLabels[filters.date] || "all dates"}`,
            action: () => router.push(buildFilterUrl({ date: undefined })),
          });
        }

        // Suggest similar categories
        if (filters.categories?.length === 1) {
          const categoryMap: Record<string, string[]> = {
            music: ["comedy", "dance"],
            comedy: ["music", "theater"],
            theater: ["film", "art"],
            film: ["theater", "art"],
            art: ["film", "theater"],
            food_drink: ["music", "games"],
            games: ["music", "comedy"],
            dance: ["music", "fitness"],
            fitness: ["dance", "outdoors"],
            workshops: ["art", "education"],
            education: ["workshops", "words"],
            outdoors: ["fitness", "sports"],
            words: ["art", "education"],
          };

          const similar = categoryMap[filters.categories[0]]?.slice(0, 2);
          similar?.forEach((cat) => {
            suggestions.push({
              type: "category",
              label: `Try ${cat.replace("_", " ")}`,
              action: () => router.push(buildFilterUrl({ categories: [cat] })),
            });
          });
        }

        setSuggestions(suggestions.slice(0, 3)); // Max 3 suggestions
      } catch (error) {
        console.error("Failed to fetch suggestions:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchSuggestions();
  }, [filters, router, buildFilterUrl]);

  // Category-aware icon, color, and copy
  const activeCategory = filters.categories?.[0];

  const CATEGORY_EMPTY_STATES: Record<string, {
    color: string;
    icon: React.ReactNode;
    headline: string;
    subline: string;
  }> = {
    music: {
      color: "var(--cat-music, #E879F9)",
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />,
      headline: "No shows matching these filters",
      subline: "Try a different date or neighborhood — Atlanta always has a stage lit somewhere",
    },
    games: {
      color: "var(--cat-games, #4ADE80)",
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
      headline: "No game nights with these filters",
      subline: "Try a different date — trivia, bingo, and board game nights happen all week",
    },
    comedy: {
      color: "var(--cat-comedy, #FBBF24)",
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
      headline: "No laughs found",
      subline: "Expand your date range or try a different neighborhood",
    },
    food_drink: {
      color: "var(--cat-food_drink, #F97316)",
      icon: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-2.21 0-4 1.79-4 4h8c0-2.21-1.79-4-4-4z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 16h18M5 20h14" /></>,
      headline: "No food or drink events here",
      subline: "Try broadening your filters — Atlanta's food scene is always cooking",
    },
    art: {
      color: "var(--cat-art, #34D399)",
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />,
      headline: "No art events with these filters",
      subline: "Adjust your search — galleries and exhibitions rotate frequently",
    },
    sports: {
      color: "var(--cat-sports, #60A5FA)",
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />,
      headline: "No games or sports events found",
      subline: "Try expanding your date range or check back closer to game day",
    },
    civic: {
      color: "var(--cat-civic, #60A5FA)",
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />,
      headline: "No civic events match",
      subline: "Widen your filters to discover meetings, organizing, and public events nearby",
    },
    theater: {
      color: "var(--cat-theater, #FB7185)",
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />,
      headline: "No performances found",
      subline: "Expand your search — new shows are announced regularly",
    },
    family: {
      color: "var(--cat-family, #2DD4BF)",
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />,
      headline: "No family events with these filters",
      subline: "Try a different weekend or neighborhood for kid-friendly activities",
    },
  };

  const defaultState = {
    color: "var(--muted)",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />,
    headline: "No events found",
    subline: "Try adjusting your filters to see more events",
  };

  const state = (activeCategory && CATEGORY_EMPTY_STATES[activeCategory]) || defaultState;
  const categoryAccentColor = state.color;
  const categoryIcon = state.icon;
  const emptyHeadline = state.headline;
  const emptySubline = state.subline;

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block w-8 h-8 border-2 border-[var(--coral)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="text-center py-12 px-4">
      <div className="max-w-md mx-auto">
        {/* Category-aware icon */}
        <div className="mb-4 flex justify-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{
              backgroundColor: `color-mix(in srgb, ${categoryAccentColor} 15%, transparent)`,
              borderColor: `color-mix(in srgb, ${categoryAccentColor} 30%, transparent)`,
              borderWidth: 1,
            }}
          >
            <svg
              className="w-8 h-8"
              style={{ color: categoryAccentColor }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {categoryIcon}
            </svg>
          </div>
        </div>

        {/* Message */}
        <h3 className="text-lg font-semibold text-[var(--cream)] mb-2">
          {emptyHeadline}
        </h3>
        <p className="text-sm text-[var(--muted)] mb-6">
          {totalEventsCount > 0
            ? emptySubline
            : "Check back soon — new events are added daily"}
        </p>

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-mono text-[var(--muted)] uppercase tracking-wide mb-3">
              You might like
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {suggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={suggestion.action}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-sm text-[var(--cream)] hover:border-[var(--coral)] hover:text-[var(--coral)] transition-colors"
                >
                  {suggestion.type === "genre" && (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  )}
                  {suggestion.type === "neighborhood" && (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                  {suggestion.type === "category" && (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                  )}
                  {suggestion.type === "date" && (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  )}
                  {suggestion.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
