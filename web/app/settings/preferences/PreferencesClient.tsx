"use client";

import { useState } from "react";
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
} from "@/lib/preferences";
import { DEFAULT_PORTAL_SLUG } from "@/lib/constants";
import PageFooter from "@/components/PageFooter";

type PreferencesClientProps = {
  isWelcome: boolean;
  initialPreferences: {
    categories: string[];
    neighborhoods: string[];
    vibes: string[];
    pricePreference: string;
  };
};

export default function PreferencesClient({
  isWelcome,
  initialPreferences,
}: PreferencesClientProps) {
  const router = useRouter();

  const [saving, setSaving] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(initialPreferences.categories);
  const [selectedNeighborhoods, setSelectedNeighborhoods] = useState<string[]>(initialPreferences.neighborhoods);
  const [selectedVibes, setSelectedVibes] = useState<string[]>(initialPreferences.vibes);
  const [pricePreference, setPricePreference] = useState<string>(initialPreferences.pricePreference);

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
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        console.error("Error saving preferences:", data.error);
        setSaving(false);
        return;
      }

      // Navigate after successful save
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

  return (
    <div className="min-h-screen">
      <ScopedStyles css={scopedCss} />
      <UnifiedHeader />

      <main className="max-w-2xl mx-auto px-4 py-8">
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
            {totalSelected > 0 && (
              <span className="px-3 py-1 rounded-full bg-[var(--coral)]/20 text-[var(--coral)] font-mono text-xs">
                {totalSelected} selected
              </span>
            )}
          </div>
          <p className="font-mono text-sm text-[var(--muted)] mt-2">
            We&apos;ll use these to personalize your For You feed
          </p>
        </div>

        <div className="space-y-6">
          {/* Categories Section */}
          <section className="p-5 rounded-xl bg-[var(--dusk)]/50 border border-[var(--twilight)]">
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
            <div className="flex flex-wrap gap-2">
              {PREFERENCE_CATEGORIES.map((cat) => {
                const isActive = selectedCategories.includes(cat.value);
                const accentClass = categoryAccentClasses[cat.value];
                return (
                  <button
                    key={cat.value}
                    onClick={() => toggleCategory(cat.value)}
                    className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-mono text-sm transition-all duration-200 ${accentClass?.className ?? ""} ${
                      isActive
                        ? "bg-accent text-[var(--void)] font-medium border border-transparent"
                        : "bg-[var(--night)] text-[var(--muted)] hover:text-[var(--cream)] border border-[var(--twilight)] hover:border-[var(--soft)]/30"
                    }`}
                  >
                    <CategoryIcon
                      type={cat.value}
                      size={18}
                      glow="none"
                      className={isActive ? "!text-[var(--void)]" : ""}
                    />
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </section>

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
            <div className="flex flex-wrap gap-2">
              {PREFERENCE_NEIGHBORHOODS.map((hood) => {
                const isActive = selectedNeighborhoods.includes(hood);
                return (
                  <button
                    key={hood}
                    onClick={() => toggleNeighborhood(hood)}
                    className={`px-3.5 py-2.5 rounded-xl font-mono text-sm transition-all duration-200 ${
                      isActive
                        ? "bg-[var(--gold)] text-[var(--void)] font-medium border border-transparent"
                        : "bg-[var(--night)] text-[var(--muted)] hover:text-[var(--cream)] border border-[var(--twilight)] hover:border-[var(--soft)]/30"
                    }`}
                  >
                    {hood}
                  </button>
                );
              })}
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

      <PageFooter />
    </div>
  );
}
