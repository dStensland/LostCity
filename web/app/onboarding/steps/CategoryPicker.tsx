"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import CategoryIcon, { getCategoryColor } from "@/components/CategoryIcon";
import { PREFERENCE_CATEGORIES } from "@/lib/preferences";

interface CategoryPickerProps {
  onComplete: (categories: string[]) => void;
  onSkip: () => void;
  portalCategoryFilter?: string[];
}

type AvailableFilterCategory = {
  value: string;
  label: string;
  count: number;
};

export function CategoryPicker({
  onComplete,
  onSkip,
  portalCategoryFilter,
}: CategoryPickerProps) {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [availableCategories, setAvailableCategories] = useState<AvailableFilterCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  const toggleCategory = (value: string) => {
    setSelectedCategories((prev) =>
      prev.includes(value)
        ? prev.filter((c) => c !== value)
        : [...prev, value]
    );
  };

  const handleContinue = () => {
    onComplete(selectedCategories);
  };

  // First selection celebration
  const [showCelebration, setShowCelebration] = useState(false);
  const [hasShownCelebration, setHasShownCelebration] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadFilters() {
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
                typeof (category as AvailableFilterCategory).label === "string" &&
                typeof (category as AvailableFilterCategory).count === "number"
            )
          : [];
        setAvailableCategories(categories);
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load onboarding categories", error);
        }
      } finally {
        if (!cancelled) {
          setLoadingCategories(false);
        }
      }
    }

    loadFilters();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (selectedCategories.length === 1 && !hasShownCelebration) {
      setHasShownCelebration(true);
      setShowCelebration(true);
      const timer = setTimeout(() => setShowCelebration(false), 1200);
      return () => clearTimeout(timer);
    }
    return;
  }, [hasShownCelebration, selectedCategories.length]);

  const preferenceCategoryMap = useMemo(() => {
    return new Map<string, (typeof PREFERENCE_CATEGORIES)[number]>(
      PREFERENCE_CATEGORIES.map((category) => [category.value, category])
    );
  }, []);

  const displayCategories = useMemo(() => {
    const source =
      availableCategories.length > 0
        ? availableCategories
        : PREFERENCE_CATEGORIES.map((category) => ({
            value: category.value,
            label: category.label,
            count: 0,
          }));

    const filtered = portalCategoryFilter?.length
      ? source.filter((category) => portalCategoryFilter.includes(category.value))
      : source;

    return filtered
      .slice()
      .sort((a, b) => b.count - a.count)
      .map((category) => {
        const known = preferenceCategoryMap.get(category.value);
        const iconType = category.value === "museums" ? "museum" : category.value;
        return {
          value: category.value,
          label: known?.label || category.label,
          count: category.count,
          iconType,
          accentColor: getCategoryColor(iconType),
        };
      })
      .slice(0, 16);
  }, [availableCategories, portalCategoryFilter, preferenceCategoryMap]);

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

  return (
    <div className="px-4 py-8 sm:px-6">
      <div className="mx-auto w-full max-w-4xl animate-fadeIn">
        {/* Header */}
        <div className="mb-8 text-center">
          <p className="mb-2 font-mono text-[0.65rem] uppercase tracking-[0.24em] text-[var(--soft)]">
            Step 1 · Signal Your Taste
          </p>
          <h1 className="mb-2 text-2xl font-semibold text-[var(--cream)] sm:text-3xl">
            What are you into?
          </h1>
          <p className="text-sm text-[var(--soft)]">
            We’re pulling from live category data so your feed starts with what’s active now.
          </p>

          {/* First selection celebration */}
          {showCelebration && (
            <p className="text-[var(--coral)] text-lg font-mono mt-4 animate-celebration-pulse">
              Nice! 🎉
            </p>
          )}
        </div>

        {/* Category grid */}
        <div className="relative mb-8 overflow-hidden rounded-2xl border border-[var(--twilight)]/45 bg-[linear-gradient(155deg,rgba(14,18,31,0.9),rgba(8,11,20,0.95))] p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-[var(--muted)]">
              {loadingCategories ? "Loading live categories..." : `${displayCategories.length} categories available`}
            </p>
            <p className="font-mono text-[0.7rem] text-[var(--soft)]">
              {selectedCategories.length} selected
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {displayCategories.map((category) => {
              const isSelected = selectedCategories.includes(category.value);
              const selectedStyle: CSSProperties | undefined = isSelected
                ? {
                    borderColor: category.accentColor,
                    background: `linear-gradient(145deg, ${hexToRgba(category.accentColor, 0.18)}, rgba(22,30,48,0.85))`,
                    boxShadow: `0 0 16px ${hexToRgba(category.accentColor, 0.24)}`,
                    "--category-accent": category.accentColor,
                  } as CSSProperties
                : {
                    "--category-accent": category.accentColor,
                  } as CSSProperties;

              return (
                <button
                  key={category.value}
                  onClick={() => toggleCategory(category.value)}
                  className={`group relative rounded-xl border p-3 text-left transition-all duration-200 ${
                    isSelected
                      ? ""
                      : "border-[var(--twilight)]/60 bg-[var(--dusk)]/55 hover:border-[var(--neon-cyan)]/45 hover:bg-[var(--dusk)]/85"
                  }`}
                  style={selectedStyle}
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <CategoryIcon
                      type={category.iconType}
                      size={20}
                      glow={isSelected ? "default" : "subtle"}
                      className={isSelected ? "text-[var(--category-accent)]" : "text-[var(--soft)]"}
                    />
                  </div>

                  <h3 className="font-mono text-xs uppercase tracking-[0.08em] text-[var(--cream)]">
                    {category.label}
                  </h3>
                  <p className="mt-1 text-[11px] text-[var(--muted)]">
                    {category.count > 0 ? `${category.count.toLocaleString()} events` : "Fresh picks"}
                  </p>

                  {/* Check indicator */}
                  <div
                    className={`absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full border transition-all ${
                      isSelected
                        ? "text-[var(--void)]"
                        : "border-[var(--twilight)] text-transparent"
                    }`}
                    style={
                      isSelected
                        ? {
                            borderColor: category.accentColor,
                            backgroundColor: category.accentColor,
                          }
                        : undefined
                    }
                  >
                    <svg
                      className="h-3 w-3"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={handleContinue}
            disabled={selectedCategories.length === 0}
            className={`w-full rounded-xl px-6 py-3 font-mono text-sm transition-all ${
              selectedCategories.length > 0
                ? "bg-[var(--coral)] text-[var(--void)] hover:bg-[var(--rose)]"
                : "cursor-not-allowed bg-[var(--twilight)] text-[var(--muted)]"
            }`}
          >
            Continue{selectedCategories.length > 0 ? ` (${selectedCategories.length})` : ""}
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
