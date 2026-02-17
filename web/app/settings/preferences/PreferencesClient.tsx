"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import UnifiedHeader from "@/components/UnifiedHeader";
import CategoryIcon, { CATEGORY_CONFIG, type CategoryType } from "@/components/CategoryIcon";
import VibeIcon, { getVibeColor } from "@/components/VibeIcon";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass } from "@/lib/css-utils";
import {
  PREFERENCE_CATEGORIES,
  PREFERENCE_NEIGHBORHOODS,
  PREFERENCE_VIBES,
  PRICE_PREFERENCES,
  PREFERENCE_NEEDS_ACCESSIBILITY,
  PREFERENCE_NEEDS_DIETARY,
  PREFERENCE_NEEDS_FAMILY,
  getGenreDisplayLabel,
} from "@/lib/preferences";
import { getNeighborhoodsByTier } from "@/config/neighborhoods";
import { DEFAULT_PORTAL_SLUG } from "@/lib/constants";
import PageFooter from "@/components/PageFooter";

const neighborhoodsTier1 = getNeighborhoodsByTier(1);
const neighborhoodsTier2 = getNeighborhoodsByTier(2);

type PreferencesClientProps = {
  isWelcome: boolean;
  initialPreferences: {
    categories: string[];
    neighborhoods: string[];
    vibes: string[];
    pricePreference: string;
    genres: Record<string, string[]>;
    needsAccessibility: string[];
    needsDietary: string[];
    needsFamily: string[];
    crossPortalRecommendations: boolean;
  };
  portalActivity?: {
    portalSlug: string;
    portalName: string;
    viewCount: number;
  }[];
  /** When true, skip UnifiedHeader/PageFooter wrapping (for embedding in settings shell) */
  embedded?: boolean;
};

interface GenreOption {
  genre: string;
  display_order: number;
  is_format: boolean;
}

const MAX_GENRES_PER_CATEGORY = 10;

export default function PreferencesClient({
  isWelcome,
  initialPreferences,
  portalActivity = [],
  embedded = false,
}: PreferencesClientProps) {
  const router = useRouter();

  const [saving, setSaving] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(initialPreferences.categories);
  const [selectedNeighborhoods, setSelectedNeighborhoods] = useState<string[]>(initialPreferences.neighborhoods);
  const [selectedVibes, setSelectedVibes] = useState<string[]>(initialPreferences.vibes);
  const [pricePreference, setPricePreference] = useState<string>(initialPreferences.pricePreference);
  const [selectedGenres, setSelectedGenres] = useState<Record<string, string[]>>(initialPreferences.genres);
  const [needsAccessibility, setNeedsAccessibility] = useState<string[]>(initialPreferences.needsAccessibility);
  const [needsDietary, setNeedsDietary] = useState<string[]>(initialPreferences.needsDietary);
  const [needsFamily, setNeedsFamily] = useState<string[]>(initialPreferences.needsFamily);
  const [crossPortalRecommendations, setCrossPortalRecommendations] = useState<boolean>(initialPreferences.crossPortalRecommendations);

  const [needsExpanded, setNeedsExpanded] = useState(
    initialPreferences.needsAccessibility.length > 0 ||
    initialPreferences.needsDietary.length > 0 ||
    initialPreferences.needsFamily.length > 0
  );

  // Genre options fetched from API
  const [genresByCategory, setGenresByCategory] = useState<Record<string, GenreOption[]>>({});
  const [genresLoading, setGenresLoading] = useState(false);

  // Fetch genres when categories change
  const fetchGenres = useCallback(async (categories: string[]) => {
    if (categories.length === 0) {
      setGenresByCategory({});
      return;
    }
    setGenresLoading(true);
    try {
      const res = await fetch(`/api/genres?categories=${categories.join(",")}`);
      const data = await res.json();
      setGenresByCategory(data.genres || {});
    } catch (err) {
      console.error("Failed to fetch genres:", err);
    } finally {
      setGenresLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGenres(selectedCategories);
  }, [selectedCategories, fetchGenres]);

  const categoryAccentClasses = Object.fromEntries(
    PREFERENCE_CATEGORIES.map((cat) => [
      cat.value,
      createCssVarClass(
        "--accent-color",
        CATEGORY_CONFIG[cat.value as CategoryType]?.color || "var(--coral)",
        "pref-cat"
      ),
    ])
  ) as Record<string, ReturnType<typeof createCssVarClass> | null>;

  const vibeAccentClasses = Object.fromEntries(
    PREFERENCE_VIBES.map((vibe) => [
      vibe.value,
      createCssVarClass("--accent-color", getVibeColor(vibe.value), "pref-vibe"),
    ])
  ) as Record<string, ReturnType<typeof createCssVarClass> | null>;

  const scopedCss = [
    ...Object.values(categoryAccentClasses).map((entry) => entry?.css),
    ...Object.values(vibeAccentClasses).map((entry) => entry?.css),
  ]
    .filter(Boolean)
    .join("\n");

  const toggleCategory = (value: string) => {
    setSelectedCategories((prev) =>
      prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value]
    );
  };

  const toggleNeighborhood = (value: string) => {
    setSelectedNeighborhoods((prev) =>
      prev.includes(value) ? prev.filter((n) => n !== value) : [...prev, value]
    );
  };

  const toggleVibe = (value: string) => {
    setSelectedVibes((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

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

  const toggleNeed = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    value: string
  ) => {
    setter((prev) =>
      prev.includes(value) ? prev.filter((n) => n !== value) : [...prev, value]
    );
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      const res = await fetch("/api/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          favorite_categories: selectedCategories,
          favorite_neighborhoods: selectedNeighborhoods,
          favorite_vibes: selectedVibes,
          price_preference: pricePreference,
          favorite_genres: Object.keys(selectedGenres).length > 0 ? selectedGenres : null,
          needs_accessibility: needsAccessibility,
          needs_dietary: needsDietary,
          needs_family: needsFamily,
          cross_portal_recommendations: crossPortalRecommendations,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        console.error("Error saving preferences:", data.error);
        setSaving(false);
        return;
      }

      if (isWelcome) {
        router.push("/foryou");
      } else {
        router.back();
      }
    } catch (err) {
      console.error("Error saving preferences:", err);
      setSaving(false);
    }
  };

  const totalSelected = selectedCategories.length + selectedNeighborhoods.length + selectedVibes.length;
  const totalGenres = Object.values(selectedGenres).reduce((sum, g) => sum + g.length, 0);
  const totalNeeds = needsAccessibility.length + needsDietary.length + needsFamily.length;

  // Get category info for genre section headers
  const getCategoryInfo = (value: string) =>
    PREFERENCE_CATEGORIES.find((c) => c.value === value);

  // Filter genres: remove formats, cap count
  const getDisplayGenres = (category: string): GenreOption[] => {
    const genres = genresByCategory[category] || [];
    return genres.filter((g) => !g.is_format).slice(0, MAX_GENRES_PER_CATEGORY);
  };

  const hasNeeds = totalNeeds > 0;

  return (
    <div className={embedded ? "" : "min-h-screen"}>
      <ScopedStyles css={scopedCss} />
      {!embedded && <UnifiedHeader />}

      <main className={embedded ? "" : "max-w-2xl mx-auto px-4 py-8"}>
        {/* Welcome banner */}
        {isWelcome && (
          <div className="mb-8 p-5 rounded-xl bg-gradient-to-br from-[var(--coral)]/15 to-[var(--rose)]/10 border border-[var(--coral)]/30 backdrop-blur-sm">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-[var(--coral)]/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-[var(--coral)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-[var(--cream)] mb-1">
                  Welcome to Lost City!
                </h2>
                <p className="font-mono text-sm text-[var(--soft)] leading-relaxed">
                  Let&apos;s personalize your experience. Select your interests below to get tailored event recommendations.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Page header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--cream)]">
              {isWelcome ? "What are you into?" : "Your Preferences"}
            </h1>
            {(totalSelected + totalGenres) > 0 && (
              <span className="px-3 py-1 rounded-full bg-[var(--coral)]/20 text-[var(--coral)] font-mono text-xs">
                {totalSelected + totalGenres} selected
              </span>
            )}
          </div>
          <p className="font-mono text-sm text-[var(--muted)] mt-2">
            We&apos;ll use these to personalize your For You feed
          </p>
        </div>

        <div className="space-y-6">
          {/* Categories Section */}
          <section className="p-5 rounded-xl bg-gradient-to-br from-[var(--dusk)]/70 to-[var(--night)]/50 border border-[var(--coral)]/20">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-sans text-base font-medium text-[var(--cream)] flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-[var(--coral)]/20 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-[var(--coral)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                  </span>
                  Categories
                </h2>
                <p className="font-mono text-xs text-[var(--muted)] mt-1">
                  What types of events do you enjoy?
                </p>
              </div>
              {selectedCategories.length > 0 && (
                <span className="font-mono text-xs text-[var(--soft)]">
                  {selectedCategories.length} selected
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {PREFERENCE_CATEGORIES.map((cat) => {
                const isActive = selectedCategories.includes(cat.value);
                const accentClass = categoryAccentClasses[cat.value];
                return (
                  <button
                    key={cat.value}
                    onClick={() => toggleCategory(cat.value)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl font-mono text-sm transition-all duration-200 ${accentClass?.className ?? ""} ${
                      isActive
                        ? "bg-accent text-[var(--void)] font-medium border border-transparent scale-[1.02]"
                        : "bg-[var(--night)] text-[var(--muted)] hover:text-[var(--cream)] border border-[var(--twilight)] hover:border-[var(--soft)]/30"
                    }`}
                  >
                    <CategoryIcon
                      type={cat.value}
                      size={28}
                      glow="none"
                      className={isActive ? "!text-[var(--void)]" : ""}
                    />
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Genres Section — only show when categories selected */}
          {selectedCategories.length > 0 && (
            <section className="p-5 rounded-xl bg-[var(--dusk)]/50 border border-[var(--twilight)]">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-sans text-base font-medium text-[var(--cream)] flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-[var(--coral)]/20 flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-[var(--coral)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                    </span>
                    Genres
                  </h2>
                  <p className="font-mono text-xs text-[var(--muted)] mt-1">
                    Dial in your taste
                  </p>
                </div>
                {totalGenres > 0 && (
                  <span className="font-mono text-xs text-[var(--soft)]">
                    {totalGenres} selected
                  </span>
                )}
              </div>

              {genresLoading ? (
                <div className="space-y-4">
                  {[1, 2].map((i) => (
                    <div key={i} className="space-y-2">
                      <div className="h-4 w-20 bg-[var(--twilight)] rounded animate-pulse" />
                      <div className="flex flex-wrap gap-2">
                        {[1, 2, 3, 4].map((j) => (
                          <div
                            key={j}
                            className="h-9 rounded-full bg-[var(--twilight)] animate-pulse"
                            style={{ width: `${55 + j * 10}px` }}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedCategories.map((category) => {
                    const genres = getDisplayGenres(category);
                    if (genres.length === 0) return null;
                    const info = getCategoryInfo(category);
                    return (
                      <div key={category}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm">{info?.emoji}</span>
                          <span className="font-mono text-xs text-[var(--soft)] uppercase tracking-wider">
                            {info?.label || category}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {genres.map((g) => {
                            const isActive = (selectedGenres[category] || []).includes(g.genre);
                            return (
                              <button
                                key={g.genre}
                                onClick={() => toggleGenre(category, g.genre)}
                                className={`px-3.5 py-2 rounded-full font-mono text-sm transition-all duration-200 ${
                                  isActive
                                    ? "border-2 border-[var(--coral)] bg-[var(--coral)]/10 text-[var(--cream)] font-medium"
                                    : "border-2 border-[var(--twilight)] text-[var(--muted)] hover:border-[var(--coral)]/50 hover:text-[var(--cream)]"
                                }`}
                              >
                                {getGenreDisplayLabel(g.genre)}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* Neighborhoods Section */}
          <section className="p-5 rounded-xl bg-[var(--dusk)]/50 border border-[var(--twilight)]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-sans text-base font-medium text-[var(--cream)] flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-[var(--gold)]/20 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-[var(--gold)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </span>
                  Neighborhoods
                </h2>
                <p className="font-mono text-xs text-[var(--muted)] mt-1">
                  Where do you like to explore?
                </p>
              </div>
              {selectedNeighborhoods.length > 0 && (
                <span className="font-mono text-xs text-[var(--soft)]">
                  {selectedNeighborhoods.length} selected
                </span>
              )}
            </div>
            <div className="space-y-4">
              {/* Tier 1 — Popular Areas */}
              <div>
                <span className="font-mono text-xs text-[var(--soft)] uppercase tracking-wider mb-2 block">
                  Popular Areas
                </span>
                <div className="flex flex-wrap gap-2">
                  {neighborhoodsTier1.map((hood) => {
                    const isActive = selectedNeighborhoods.includes(hood.name);
                    return (
                      <button
                        key={hood.id}
                        onClick={() => toggleNeighborhood(hood.name)}
                        className={`px-3.5 py-2.5 rounded-xl font-mono text-sm transition-all duration-200 ${
                          isActive
                            ? "bg-[var(--gold)] text-[var(--void)] font-medium border border-transparent"
                            : "bg-[var(--night)] text-[var(--muted)] hover:text-[var(--cream)] border border-[var(--twilight)] hover:border-[var(--soft)]/30"
                        }`}
                      >
                        {hood.name}
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* Tier 2 — More Neighborhoods */}
              <div>
                <span className="font-mono text-xs text-[var(--soft)] uppercase tracking-wider mb-2 block">
                  More Neighborhoods
                </span>
                <div className="flex flex-wrap gap-2">
                  {neighborhoodsTier2.map((hood) => {
                    const isActive = selectedNeighborhoods.includes(hood.name);
                    return (
                      <button
                        key={hood.id}
                        onClick={() => toggleNeighborhood(hood.name)}
                        className={`px-3.5 py-2.5 rounded-xl font-mono text-sm transition-all duration-200 ${
                          isActive
                            ? "bg-[var(--gold)] text-[var(--void)] font-medium border border-transparent"
                            : "bg-[var(--night)] text-[var(--muted)] hover:text-[var(--cream)] border border-[var(--twilight)] hover:border-[var(--soft)]/30"
                        }`}
                      >
                        {hood.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* Vibes Section */}
          <section className="p-5 rounded-xl bg-[var(--dusk)]/50 border border-[var(--twilight)]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-sans text-base font-medium text-[var(--cream)] flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-[var(--lavender)]/20 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-[var(--lavender)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </span>
                  Vibes
                </h2>
                <p className="font-mono text-xs text-[var(--muted)] mt-1">
                  What atmosphere are you looking for?
                </p>
              </div>
              {selectedVibes.length > 0 && (
                <span className="font-mono text-xs text-[var(--soft)]">
                  {selectedVibes.length} selected
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {PREFERENCE_VIBES.map((vibe) => {
                const isActive = selectedVibes.includes(vibe.value);
                const accentClass = vibeAccentClasses[vibe.value];
                return (
                  <button
                    key={vibe.value}
                    onClick={() => toggleVibe(vibe.value)}
                    className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-mono text-sm transition-all duration-200 ${accentClass?.className ?? ""} ${
                      isActive
                        ? "bg-accent text-[var(--void)] font-medium border border-transparent"
                        : "bg-[var(--night)] text-[var(--muted)] hover:text-[var(--cream)] border border-[var(--twilight)] hover:border-[var(--soft)]/30"
                    }`}
                  >
                    <VibeIcon
                      type={vibe.value}
                      size={18}
                      className={isActive ? "!text-[var(--void)]" : "text-accent"}
                    />
                    {vibe.label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Price Section */}
          <section className="p-5 rounded-xl bg-[var(--dusk)]/50 border border-[var(--twilight)]">
            <div className="mb-4">
              <h2 className="font-sans text-base font-medium text-[var(--cream)] flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-[var(--neon-green)]/20 flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-[var(--neon-green)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>
                Price Range
              </h2>
              <p className="font-mono text-xs text-[var(--muted)] mt-1">
                What&apos;s your budget for events?
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {PRICE_PREFERENCES.map((price) => {
                const isActive = pricePreference === price.value;
                const priceLabels: Record<string, string> = {
                  free: "Free",
                  budget: "$ Budget",
                  any: "$$$ Any",
                };
                return (
                  <button
                    key={price.value}
                    onClick={() => setPricePreference(price.value)}
                    className={`px-4 py-2.5 rounded-xl font-mono text-sm transition-all duration-200 ${
                      isActive
                        ? "bg-[var(--neon-green)] text-[var(--void)] font-medium border border-transparent"
                        : "bg-[var(--night)] text-[var(--muted)] hover:text-[var(--cream)] border border-[var(--twilight)] hover:border-[var(--soft)]/30"
                    }`}
                  >
                    {priceLabels[price.value] || price.label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Needs Section — Collapsible */}
          <section className="p-5 rounded-xl bg-[var(--dusk)]/50 border border-[var(--twilight)]">
            <button
              type="button"
              onClick={() => setNeedsExpanded((prev) => !prev)}
              className="flex items-center justify-between w-full text-left"
            >
              <div>
                <h2 className="font-sans text-base font-medium text-[var(--cream)] flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-[var(--neon-cyan)]/20 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-[var(--neon-cyan)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  </span>
                  Anything We Should Know?
                </h2>
                <p className="font-mono text-xs text-[var(--muted)] mt-1">
                  Applied everywhere — every portal, every city
                </p>
              </div>
              <div className="flex items-center gap-2">
                {hasNeeds && (
                  <span className="font-mono text-xs text-[var(--soft)]">
                    {totalNeeds} selected
                  </span>
                )}
                <svg
                  className={`w-5 h-5 text-[var(--muted)] transition-transform duration-200 ${needsExpanded ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {needsExpanded && (
              <div className="space-y-4 mt-4">
                {/* Accessibility */}
                <div>
                  <span className="font-mono text-xs text-[var(--soft)] uppercase tracking-wider mb-2 block">
                    Accessibility
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {PREFERENCE_NEEDS_ACCESSIBILITY.map((need) => {
                      const isActive = needsAccessibility.includes(need.value);
                      return (
                        <button
                          key={need.value}
                          onClick={() => toggleNeed(setNeedsAccessibility, need.value)}
                          className={`px-3.5 py-2 rounded-full font-mono text-sm transition-all duration-200 ${
                            isActive
                              ? "border-2 border-[var(--neon-cyan)] bg-[var(--neon-cyan)]/10 text-[var(--cream)] font-medium"
                              : "border-2 border-[var(--twilight)] text-[var(--muted)] hover:border-[var(--neon-cyan)]/50 hover:text-[var(--cream)]"
                          }`}
                        >
                          {need.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Dietary */}
                <div>
                  <span className="font-mono text-xs text-[var(--soft)] uppercase tracking-wider mb-2 block">
                    Dietary
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {PREFERENCE_NEEDS_DIETARY.map((need) => {
                      const isActive = needsDietary.includes(need.value);
                      return (
                        <button
                          key={need.value}
                          onClick={() => toggleNeed(setNeedsDietary, need.value)}
                          className={`px-3.5 py-2 rounded-full font-mono text-sm transition-all duration-200 ${
                            isActive
                              ? "border-2 border-[var(--neon-cyan)] bg-[var(--neon-cyan)]/10 text-[var(--cream)] font-medium"
                              : "border-2 border-[var(--twilight)] text-[var(--muted)] hover:border-[var(--neon-cyan)]/50 hover:text-[var(--cream)]"
                          }`}
                        >
                          {need.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Family */}
                <div>
                  <span className="font-mono text-xs text-[var(--soft)] uppercase tracking-wider mb-2 block">
                    Family
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {PREFERENCE_NEEDS_FAMILY.map((need) => {
                      const isActive = needsFamily.includes(need.value);
                      return (
                        <button
                          key={need.value}
                          onClick={() => toggleNeed(setNeedsFamily, need.value)}
                          className={`px-3.5 py-2 rounded-full font-mono text-sm transition-all duration-200 ${
                            isActive
                              ? "border-2 border-[var(--neon-cyan)] bg-[var(--neon-cyan)]/10 text-[var(--cream)] font-medium"
                              : "border-2 border-[var(--twilight)] text-[var(--muted)] hover:border-[var(--neon-cyan)]/50 hover:text-[var(--cream)]"
                          }`}
                        >
                          {need.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Cross-Portal Activity & Privacy */}
          {!isWelcome && (
            <section className="p-5 rounded-xl bg-[var(--dusk)]/50 border border-[var(--twilight)]">
              <div className="mb-4">
                <h2 className="font-sans text-base font-medium text-[var(--cream)] flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-[var(--lavender)]/20 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-[var(--lavender)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                    </svg>
                  </span>
                  Your Activity Across Portals
                </h2>
                <p className="font-mono text-xs text-[var(--muted)] mt-1">
                  Your taste profile follows you everywhere
                </p>
              </div>

              <div className="space-y-4">
                {/* Portal Activity Summary */}
                {portalActivity.length > 0 ? (
                  <div className="space-y-2">
                    <p className="font-mono text-xs text-[var(--soft)] mb-3">
                      Your preferences work across all portals, including:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {portalActivity.slice(0, 4).map((portal) => (
                        <div
                          key={portal.portalSlug}
                          className="px-3 py-2 rounded-lg bg-[var(--night)] border border-[var(--twilight)] flex items-center gap-2"
                        >
                          <svg className="w-3.5 h-3.5 text-[var(--coral)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="font-mono text-xs text-[var(--cream)]">
                            {portal.portalName}
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="font-mono text-xs text-[var(--muted)] text-center pt-2">
                      ...and everywhere else on Lost City
                    </p>
                  </div>
                ) : (
                  <div className="px-4 py-3 rounded-lg bg-[var(--night)]/50 border border-[var(--twilight)]/50">
                    <p className="font-mono text-xs text-[var(--muted)] text-center">
                      Set your preferences above to get personalized recommendations across all portals
                    </p>
                  </div>
                )}

                {/* Privacy Toggle */}
                <div className="pt-2 border-t border-[var(--twilight)]">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={crossPortalRecommendations}
                        onChange={(e) => setCrossPortalRecommendations(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-[var(--twilight)] rounded-full peer-checked:bg-[var(--coral)] transition-colors" />
                      <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5" />
                    </div>
                    <div className="flex-1">
                      <span className="font-mono text-sm text-[var(--cream)] group-hover:text-[var(--coral)] transition-colors">
                        Use activity across all portals for recommendations
                      </span>
                      <p className="font-mono text-xs text-[var(--muted)] mt-0.5">
                        When off, only activity from the current portal is used
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </section>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4">
            {!isWelcome && (
              <Link
                href="/settings"
                className="px-5 py-3 rounded-xl font-mono text-sm text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/50 transition-all"
              >
                Cancel
              </Link>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[var(--coral)] text-[var(--void)] font-mono text-sm font-medium hover:bg-[var(--rose)] transition-all disabled:opacity-50"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-[var(--void)] border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {isWelcome ? "Continue to For You" : "Save Preferences"}
                </>
              )}
            </button>
            {isWelcome && (
              <Link
                href={`/${DEFAULT_PORTAL_SLUG}`}
                className="px-5 py-3 rounded-xl font-mono text-sm text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/50 transition-all"
              >
                Skip
              </Link>
            )}
          </div>

          {/* Tip */}
          <p className="text-center font-mono text-xs text-[var(--muted)] pt-2">
            You can always update these later in settings
          </p>
        </div>
      </main>

      {!embedded && <PageFooter />}
    </div>
  );
}
