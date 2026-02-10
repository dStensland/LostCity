"use client";

import { useState, useEffect } from "react";
import { PREFERENCE_CATEGORIES, getGenreDisplayLabel } from "@/lib/preferences";

const DEFAULT_CATEGORIES = ["music", "food_drink", "nightlife", "comedy", "art"];
const MAX_GENRES_PER_CATEGORY = 8;

interface GenreOption {
  genre: string;
  display_order: number;
  is_format: boolean;
}

interface GenrePickerProps {
  onComplete: (genres: Record<string, string[]>) => void;
  onSkip: () => void;
  selectedCategories: string[];
}

export function GenrePicker({ onComplete, onSkip, selectedCategories }: GenrePickerProps) {
  const [selectedGenres, setSelectedGenres] = useState<Record<string, string[]>>({});
  const [genresByCategory, setGenresByCategory] = useState<Record<string, GenreOption[]>>({});
  const [loading, setLoading] = useState(true);

  const categoriesToFetch =
    selectedCategories.length > 0 ? selectedCategories : DEFAULT_CATEGORIES;

  useEffect(() => {
    async function fetchGenres() {
      try {
        const res = await fetch(`/api/genres?categories=${categoriesToFetch.join(",")}`);
        const data = await res.json();
        setGenresByCategory(data.genres || {});
      } catch (err) {
        console.error("Failed to fetch genres:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchGenres();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleGenre = (category: string, genre: string) => {
    setSelectedGenres((prev) => {
      const current = prev[category] || [];
      const updated = current.includes(genre)
        ? current.filter((g) => g !== genre)
        : [...current, genre];
      if (updated.length === 0) {
        const { [category]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [category]: updated };
    });
  };

  const totalSelected = Object.values(selectedGenres).reduce((sum, g) => sum + g.length, 0);

  const handleFinish = () => {
    onComplete(selectedGenres);
  };

  // Get category config (emoji, label) from PREFERENCE_CATEGORIES
  const getCategoryInfo = (value: string) =>
    PREFERENCE_CATEGORIES.find((c) => c.value === value);

  // Filter: remove is_format genres, cap at MAX_GENRES_PER_CATEGORY
  const getDisplayGenres = (category: string): GenreOption[] => {
    const genres = genresByCategory[category] || [];
    return genres
      .filter((g) => !g.is_format)
      .slice(0, MAX_GENRES_PER_CATEGORY);
  };

  // Categories that have genres to show (in original order)
  const visibleCategories = categoriesToFetch.filter(
    (cat) => getDisplayGenres(cat).length > 0
  );

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)] px-4 py-8">
      <div className="w-full max-w-lg animate-fadeIn">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--cream)] mb-2">
            Dial it in
          </h1>
          <p className="text-[var(--soft)] text-sm">
            Pick the stuff you love (or skip to see everything)
          </p>
        </div>

        {/* Genre sections */}
        <div className="max-h-[50vh] overflow-y-auto space-y-6 mb-8 pr-1">
          {loading ? (
            // Skeleton loading state
            <>
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-3">
                  <div className="h-5 w-24 bg-[var(--twilight)] rounded animate-pulse" />
                  <div className="flex flex-wrap gap-2">
                    {[1, 2, 3, 4, 5].map((j) => (
                      <div
                        key={j}
                        className="h-9 rounded-full bg-[var(--twilight)] animate-pulse"
                        style={{ width: `${60 + j * 12}px` }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </>
          ) : (
            visibleCategories.map((category) => {
              const info = getCategoryInfo(category);
              const genres = getDisplayGenres(category);
              if (genres.length === 0) return null;

              return (
                <div key={category}>
                  {/* Category header */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-base">{info?.emoji}</span>
                    <span className="font-mono text-xs text-[var(--soft)] uppercase tracking-wider">
                      {info?.label || category}
                    </span>
                  </div>

                  {/* Genre pills */}
                  <div className="flex flex-wrap gap-2">
                    {genres.map((g) => {
                      const isSelected = (selectedGenres[category] || []).includes(g.genre);
                      return (
                        <button
                          key={g.genre}
                          onClick={() => toggleGenre(category, g.genre)}
                          className={`px-4 py-2 rounded-full border-2 font-mono text-sm transition-all ${
                            isSelected
                              ? "border-[var(--coral)] bg-[var(--coral)]/10 text-[var(--cream)]"
                              : "border-[var(--twilight)] text-[var(--soft)] hover:border-[var(--coral)]/50 hover:text-[var(--cream)]"
                          }`}
                        >
                          {getGenreDisplayLabel(g.genre)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={handleFinish}
            className={`w-full py-3 px-6 rounded-xl font-mono text-sm transition-all ${
              totalSelected > 0
                ? "bg-[var(--coral)] text-[var(--void)] hover:bg-[var(--rose)]"
                : "bg-[var(--twilight)] text-[var(--cream)] hover:bg-[var(--twilight)]/80"
            }`}
          >
            {totalSelected > 0 ? `Finish (${totalSelected})` : "Finish without selecting"}
          </button>

          <button
            onClick={onSkip}
            className="w-full py-3 text-center font-mono text-sm text-[var(--soft)] hover:text-[var(--cream)] transition-colors"
          >
            Just show me everything
          </button>
        </div>
      </div>
    </div>
  );
}
