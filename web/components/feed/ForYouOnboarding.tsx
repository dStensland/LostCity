"use client";

import { useState } from "react";
import CategoryIcon, {
  CATEGORY_CONFIG,
  type CategoryType,
} from "@/components/CategoryIcon";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass } from "@/lib/css-utils";
import { PREFERENCE_CATEGORIES } from "@/lib/preferences";
import { getNeighborhoodsByTier } from "@/config/neighborhoods";

interface ForYouOnboardingProps {
  onComplete: () => void;
}

const tier1 = getNeighborhoodsByTier(1);
const tier2 = getNeighborhoodsByTier(2);

export default function ForYouOnboarding({
  onComplete,
}: ForYouOnboardingProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedNeighborhoods, setSelectedNeighborhoods] = useState<string[]>(
    [],
  );
  const [saving, setSaving] = useState(false);

  const toggleCategory = (value: string) => {
    setSelectedCategories((prev) =>
      prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value],
    );
  };

  const toggleNeighborhood = (name: string) => {
    setSelectedNeighborhoods((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
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
        }),
      });
      if (res.ok) {
        onComplete();
      }
    } catch (err) {
      console.error("Failed to save preferences:", err);
    } finally {
      setSaving(false);
    }
  };

  const totalSelected = selectedCategories.length + selectedNeighborhoods.length;

  // Build scoped CSS for category accent colors
  const categoryAccentClasses = Object.fromEntries(
    PREFERENCE_CATEGORIES.map((cat) => [
      cat.value,
      createCssVarClass(
        "--accent-color",
        CATEGORY_CONFIG[cat.value as CategoryType]?.color || "var(--coral)",
        "ob-cat",
      ),
    ]),
  ) as Record<string, ReturnType<typeof createCssVarClass> | null>;

  const scopedCss = Object.values(categoryAccentClasses)
    .map((entry) => entry?.css)
    .filter(Boolean)
    .join("\n");

  return (
    <div className="space-y-6">
      <ScopedStyles css={scopedCss} />

      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2">
        <div
          className={`w-2 h-2 rounded-full transition-colors ${step === 1 ? "bg-[var(--coral)]" : "bg-[var(--twilight)]"}`}
        />
        <div
          className={`w-2 h-2 rounded-full transition-colors ${step === 2 ? "bg-[var(--coral)]" : "bg-[var(--twilight)]"}`}
        />
      </div>

      {step === 1 && (
        <div className="space-y-5">
          <div className="text-center">
            <h3 className="text-xl font-semibold text-[var(--cream)]">
              What are you into?
            </h3>
            <p className="font-mono text-sm text-[var(--muted)] mt-1">
              Pick at least 3 to get started
            </p>
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
                      : "bg-[var(--dusk)]/50 text-[var(--muted)] hover:text-[var(--cream)] border border-[var(--twilight)] hover:border-[var(--soft)]/30"
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

          <button
            onClick={() => setStep(2)}
            disabled={selectedCategories.length < 3}
            className="w-full py-3 rounded-xl bg-[var(--coral)] text-[var(--void)] font-mono text-sm font-medium hover:bg-[var(--rose)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <div className="text-center">
            <h3 className="text-xl font-semibold text-[var(--cream)]">
              Where do you hang?
            </h3>
            <p className="font-mono text-sm text-[var(--muted)] mt-1">
              Pick your favorite neighborhoods
            </p>
          </div>

          {/* Tier 1 — Popular */}
          <div>
            <span className="font-mono text-xs text-[var(--soft)] uppercase tracking-wider mb-2 block">
              Popular Areas
            </span>
            <div className="flex flex-wrap gap-2">
              {tier1.map((hood) => {
                const isActive = selectedNeighborhoods.includes(hood.name);
                return (
                  <button
                    key={hood.id}
                    onClick={() => toggleNeighborhood(hood.name)}
                    className={`px-3.5 py-2.5 rounded-xl font-mono text-sm transition-all duration-200 ${
                      isActive
                        ? "bg-[var(--gold)] text-[var(--void)] font-medium border border-transparent"
                        : "bg-[var(--dusk)]/50 text-[var(--muted)] hover:text-[var(--cream)] border border-[var(--twilight)] hover:border-[var(--soft)]/30"
                    }`}
                  >
                    {hood.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tier 2 — More */}
          <div>
            <span className="font-mono text-xs text-[var(--soft)] uppercase tracking-wider mb-2 block">
              More Neighborhoods
            </span>
            <div className="flex flex-wrap gap-2">
              {tier2.map((hood) => {
                const isActive = selectedNeighborhoods.includes(hood.name);
                return (
                  <button
                    key={hood.id}
                    onClick={() => toggleNeighborhood(hood.name)}
                    className={`px-3.5 py-2.5 rounded-xl font-mono text-sm transition-all duration-200 ${
                      isActive
                        ? "bg-[var(--gold)] text-[var(--void)] font-medium border border-transparent"
                        : "bg-[var(--dusk)]/50 text-[var(--muted)] hover:text-[var(--cream)] border border-[var(--twilight)] hover:border-[var(--soft)]/30"
                    }`}
                  >
                    {hood.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setStep(1)}
              className="font-mono text-sm text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleSave}
              disabled={totalSelected < 3 || saving}
              className="flex-1 py-3 rounded-xl bg-[var(--coral)] text-[var(--void)] font-mono text-sm font-medium hover:bg-[var(--rose)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-[var(--void)] border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                "See your feed"
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
