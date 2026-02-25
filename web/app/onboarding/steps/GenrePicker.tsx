"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import CategoryIcon, { getCategoryColor } from "@/components/CategoryIcon";
import {
  PREFERENCE_CATEGORIES,
  PREFERENCE_NEEDS_ACCESSIBILITY,
  PREFERENCE_NEEDS_DIETARY,
  PREFERENCE_NEEDS_FAMILY,
  getGenreDisplayLabel,
} from "@/lib/preferences";

const DEFAULT_CATEGORIES = ["music", "food_drink", "nightlife", "comedy", "art"];
const MAX_GENRES_PER_CATEGORY = 8;

interface GenreOption {
  genre: string;
  display_order: number;
  is_format: boolean;
}

interface GenrePickerProps {
  onComplete: (genres: Record<string, string[]>, needs: { accessibility: string[]; dietary: string[]; family: string[] }) => void;
  onSkip: () => void;
  selectedCategories: string[];
  portalCategoryFilter?: string[];
}

type AvailableFilterCategory = {
  value: string;
  label: string;
  count: number;
};

export function GenrePicker({
  onComplete,
  onSkip,
  selectedCategories,
  portalCategoryFilter,
}: GenrePickerProps) {
  const [selectedGenres, setSelectedGenres] = useState<Record<string, string[]>>({});
  const [genresByCategory, setGenresByCategory] = useState<Record<string, GenreOption[]>>({});
  const [loading, setLoading] = useState(true);
  const [fallbackCategories, setFallbackCategories] = useState<string[]>([]);
  const [selectedNeeds, setSelectedNeeds] = useState<{
    accessibility: string[];
    dietary: string[];
    family: string[];
  }>({ accessibility: [], dietary: [], family: [] });

  const categoriesToFetch = useMemo(() => {
    if (selectedCategories.length > 0) return selectedCategories;
    if (fallbackCategories.length > 0) return fallbackCategories;
    return DEFAULT_CATEGORIES;
  }, [fallbackCategories, selectedCategories]);

  useEffect(() => {
    let cancelled = false;
    if (selectedCategories.length > 0) return;

    async function loadFallbackCategories() {
      try {
        const res = await fetch("/api/filters");
        if (!res.ok) throw new Error("Failed to fetch filters");
        const data = await res.json();
        if (cancelled) return;

        const categories = Array.isArray(data?.categories)
          ? data.categories.filter(
              (category: unknown): category is AvailableFilterCategory =>
                !!category &&
                typeof category === "object" &&
                typeof (category as AvailableFilterCategory).value === "string" &&
                typeof (category as AvailableFilterCategory).count === "number"
            )
          : [];

        const ordered = categories
          .slice()
          .sort(
            (a: AvailableFilterCategory, b: AvailableFilterCategory) =>
              b.count - a.count
          )
          .map((category: AvailableFilterCategory) => category.value);

        const limited = (portalCategoryFilter?.length
          ? ordered.filter((category: string) =>
              portalCategoryFilter.includes(category)
            )
          : ordered).slice(0, 8);

        setFallbackCategories(limited.length > 0 ? limited : DEFAULT_CATEGORIES);
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load fallback categories for onboarding", error);
          setFallbackCategories(
            portalCategoryFilter?.length
              ? portalCategoryFilter.slice(0, 8)
              : DEFAULT_CATEGORIES
          );
        }
      }
    }

    loadFallbackCategories();
    return () => {
      cancelled = true;
    };
  }, [portalCategoryFilter, selectedCategories.length]);

  useEffect(() => {
    let cancelled = false;
    async function fetchGenres() {
      setLoading(true);
      try {
        const res = await fetch(`/api/genres?categories=${categoriesToFetch.join(",")}`);
        const data = await res.json();
        if (!cancelled) {
          setGenresByCategory(data.genres || {});
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to fetch genres:", err);
          setGenresByCategory({});
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    fetchGenres();
    return () => {
      cancelled = true;
    };
  }, [categoriesToFetch]);

  const toggleGenre = (category: string, genre: string) => {
    setSelectedGenres((prev) => {
      const current = prev[category] || [];
      const updated = current.includes(genre)
        ? current.filter((g) => g !== genre)
        : [...current, genre];
      if (updated.length === 0) {
        const next = { ...prev };
        delete next[category];
        return next;
      }
      return { ...prev, [category]: updated };
    });
  };

  const toggleNeed = (group: keyof typeof selectedNeeds, value: string) => {
    setSelectedNeeds((prev) => {
      const current = prev[group];
      const updated = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...prev, [group]: updated };
    });
  };

  const totalSelected = Object.values(selectedGenres).reduce((sum, g) => sum + g.length, 0);
  const totalNeedsSelected =
    selectedNeeds.accessibility.length +
    selectedNeeds.dietary.length +
    selectedNeeds.family.length;

  const handleFinish = () => {
    onComplete(selectedGenres, selectedNeeds);
  };

  const getCategoryAccent = (category: string) =>
    getCategoryColor(category === "museums" ? "museum" : category);

  const hexToRgba = (hex: string, alpha: number) => {
    const cleaned = hex.replace("#", "").trim();
    const normalized =
      cleaned.length === 3
        ? cleaned
            .split("")
            .map((char) => char + char)
            .join("")
        : cleaned;
    const int = Number.parseInt(normalized, 16);
    if (!Number.isFinite(int) || normalized.length !== 6) {
      return `rgba(255,107,122,${alpha})`;
    }
    const r = (int >> 16) & 255;
    const g = (int >> 8) & 255;
    const b = int & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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
    <div className="px-4 py-8 sm:px-6">
      <div className="mx-auto w-full max-w-4xl animate-fadeIn">
        {/* Header */}
        <div className="mb-8 text-center">
          <p className="mb-2 font-mono text-[0.65rem] uppercase tracking-[0.24em] text-[var(--soft)]">
            Step 2 · Refine The Signal
          </p>
          <h1 className="mb-2 text-2xl font-semibold text-[var(--cream)] sm:text-3xl">
            Dial it in
          </h1>
          <p className="text-sm text-[var(--soft)]">
            Select sub-genres and needs to make recommendations sharper.
          </p>
        </div>

        {/* Genre sections */}
        <div className="mb-8 max-h-[50vh] space-y-4 overflow-y-auto pr-1">
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
              const accentColor = getCategoryAccent(category);
              if (genres.length === 0) return null;

              return (
                <div key={category}>
                  {/* Category header */}
                  <div className="mb-3 flex items-center gap-2">
                    <CategoryIcon type={category} size={15} glow="subtle" />
                    <span className="font-mono text-xs uppercase tracking-wider text-[var(--soft)]">
                      {info?.label || category}
                    </span>
                  </div>

                  {/* Genre pills */}
                  <div className="flex flex-wrap gap-2">
                    {genres.map((g) => {
                      const isSelected = (selectedGenres[category] || []).includes(g.genre);
                      const selectedStyle: CSSProperties = isSelected
                        ? {
                            borderColor: accentColor,
                            background: `linear-gradient(145deg, ${hexToRgba(accentColor, 0.2)}, rgba(21,28,44,0.78))`,
                            boxShadow: `0 0 12px ${hexToRgba(accentColor, 0.22)}`,
                            "--genre-accent": accentColor,
                          } as CSSProperties
                        : ({
                            "--genre-accent": accentColor,
                          } as CSSProperties);
                      return (
                        <button
                          key={g.genre}
                          onClick={() => toggleGenre(category, g.genre)}
                          className={`rounded-full border px-3 py-1.5 font-mono text-xs transition-all sm:text-sm ${
                            isSelected
                              ? "text-[var(--cream)]"
                              : "border-[var(--twilight)] text-[var(--soft)] hover:border-[var(--genre-accent)] hover:text-[var(--cream)]"
                          }`}
                          style={selectedStyle}
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

        {/* Needs section - compact toggles at bottom */}
        {!loading && (
          <div className="mb-8 rounded-2xl border border-[var(--twilight)]/45 bg-[var(--night)]/55 p-4 sm:p-5">
            <div className="mb-4">
              <p className="font-mono text-xs uppercase tracking-wider text-[var(--soft)]">
                Anything we should know?
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Help us show you accessible, inclusive spots
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
                  Accessibility
                </p>
                <div className="flex flex-wrap gap-2">
                  {PREFERENCE_NEEDS_ACCESSIBILITY.map((need) => {
                    const isSelected = selectedNeeds.accessibility.includes(need.value);
                    return (
                      <button
                        key={need.value}
                        onClick={() => toggleNeed("accessibility", need.value)}
                        className={`rounded-full border px-3 py-1.5 font-mono text-xs transition-all ${
                          isSelected
                            ? "border-[var(--neon-cyan)] bg-[var(--neon-cyan)]/10 text-[var(--cream)]"
                            : "border-[var(--twilight)] text-[var(--soft)] hover:border-[var(--neon-cyan)]/45"
                        }`}
                      >
                        {need.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
                  Dietary
                </p>
                <div className="flex flex-wrap gap-2">
                  {PREFERENCE_NEEDS_DIETARY.map((need) => {
                    const isSelected = selectedNeeds.dietary.includes(need.value);
                    return (
                      <button
                        key={need.value}
                        onClick={() => toggleNeed("dietary", need.value)}
                        className={`rounded-full border px-3 py-1.5 font-mono text-xs transition-all ${
                          isSelected
                            ? "border-[var(--neon-cyan)] bg-[var(--neon-cyan)]/10 text-[var(--cream)]"
                            : "border-[var(--twilight)] text-[var(--soft)] hover:border-[var(--neon-cyan)]/45"
                        }`}
                      >
                        {need.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
                  Family
                </p>
                <div className="flex flex-wrap gap-2">
                  {PREFERENCE_NEEDS_FAMILY.map((need) => {
                    const isSelected = selectedNeeds.family.includes(need.value);
                    return (
                      <button
                        key={need.value}
                        onClick={() => toggleNeed("family", need.value)}
                        className={`rounded-full border px-3 py-1.5 font-mono text-xs transition-all ${
                          isSelected
                            ? "border-[var(--neon-cyan)] bg-[var(--neon-cyan)]/10 text-[var(--cream)]"
                            : "border-[var(--twilight)] text-[var(--soft)] hover:border-[var(--neon-cyan)]/45"
                        }`}
                      >
                        {need.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={handleFinish}
            className={`w-full rounded-xl px-6 py-3 font-mono text-sm transition-all ${
              totalSelected > 0 || totalNeedsSelected > 0
                ? "bg-[var(--coral)] text-[var(--void)] hover:bg-[var(--rose)] hover:scale-105"
                : "bg-[var(--twilight)] text-[var(--cream)] hover:bg-[var(--twilight)]/80"
            }`}
          >
            {totalSelected > 0
              ? `Let’s go (${totalSelected} picks)`
              : totalNeedsSelected > 0
              ? `Let’s go (${totalNeedsSelected} needs)`
              : "Let’s go"}
          </button>

          <button
            onClick={onSkip}
            className="w-full py-3 text-center font-mono text-sm text-[var(--soft)] transition-colors hover:text-[var(--cream)]"
          >
            Skip and show everything
          </button>
        </div>
      </div>
    </div>
  );
}
