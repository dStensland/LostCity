"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import CategoryIcon, { CATEGORY_CONFIG, type CategoryType } from "@/components/CategoryIcon";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  PREFERENCE_CATEGORIES,
  PREFERENCE_NEIGHBORHOODS,
  PREFERENCE_VIBES,
  PRICE_PREFERENCES,
} from "@/lib/preferences";
import type { Database } from "@/lib/types";

type UserPreferences = Database["public"]["Tables"]["user_preferences"]["Row"];

// Vibe emojis for visual interest
const VIBE_EMOJIS: Record<string, string> = {
  "late-night": "🌙",
  "date-spot": "💕",
  "divey": "🍺",
  "intimate": "🕯️",
  "upscale": "✨",
  "casual": "😎",
  "artsy": "🎨",
  "outdoor-seating": "🌳",
  "live-music": "🎸",
  "good-for-groups": "👥",
  "rooftop": "🏙️",
  "all-ages": "🎫",
  "family-friendly": "👨‍👩‍👧",
  "dog-friendly": "🐕",
};

function PreferencesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isWelcome = searchParams.get("welcome") === "true";
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedNeighborhoods, setSelectedNeighborhoods] = useState<string[]>([]);
  const [selectedVibes, setSelectedVibes] = useState<string[]>([]);
  const [pricePreference, setPricePreference] = useState<string>("any");

  // Load existing preferences
  useEffect(() => {
    async function loadPreferences() {
      if (!user) return;

      const { data: prefsData } = await supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", user.id)
        .single();

      const prefs = prefsData as UserPreferences | null;
      if (prefs) {
        setSelectedCategories(prefs.favorite_categories || []);
        setSelectedNeighborhoods(prefs.favorite_neighborhoods || []);
        setSelectedVibes(prefs.favorite_vibes || []);
        setPricePreference(prefs.price_preference || "any");
      }
      setLoading(false);
    }

    loadPreferences();
  }, [user, supabase]);

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
    if (!user) return;

    setSaving(true);

    const { error } = await supabase
      .from("user_preferences")
      .upsert({
        user_id: user.id,
        favorite_categories: selectedCategories,
        favorite_neighborhoods: selectedNeighborhoods,
        favorite_vibes: selectedVibes,
        price_preference: pricePreference,
      } as never);

    setSaving(false);

    if (error) {
      console.error("Error saving preferences:", error);
      return;
    }

    if (isWelcome) {
      router.push("/foryou");
    } else {
      router.push("/settings");
    }
  };

  // Show loading while auth is checking
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--coral)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    router.push("/login?redirect=/settings/preferences");
    return null;
  }

  const totalSelected = selectedCategories.length + selectedNeighborhoods.length + selectedVibes.length;

  return (
    <div className="min-h-screen">
      <PageHeader />

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
                <h2 className="font-serif text-xl text-[var(--cream)] italic mb-1">
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
            <h1 className="font-serif text-2xl sm:text-3xl text-[var(--cream)] italic">
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

        {loading ? (
          <div className="py-16 text-center">
            <div className="w-10 h-10 border-2 border-[var(--coral)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="font-mono text-sm text-[var(--muted)]">Loading your preferences...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Categories Section */}
            <section className="p-5 rounded-xl bg-[var(--dusk)]/50 border border-[var(--twilight)] backdrop-blur-sm">
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
                  const categoryColor = CATEGORY_CONFIG[cat.value as CategoryType]?.color || "var(--coral)";
                  return (
                    <button
                      key={cat.value}
                      onClick={() => toggleCategory(cat.value)}
                      className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-mono text-sm transition-all duration-200 ${
                        isActive
                          ? "text-[var(--void)] font-medium scale-[1.02]"
                          : "bg-[var(--night)] text-[var(--muted)] hover:text-[var(--cream)] border border-[var(--twilight)] hover:border-[var(--soft)]/30"
                      }`}
                      style={isActive ? {
                        backgroundColor: categoryColor,
                        boxShadow: `0 0 20px ${categoryColor}40, 0 4px 12px ${categoryColor}30`,
                        border: "1px solid transparent",
                      } : undefined}
                    >
                      <CategoryIcon
                        type={cat.value}
                        size={18}
                        style={{
                          color: isActive ? "var(--void)" : categoryColor,
                        }}
                      />
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Neighborhoods Section */}
            <section className="p-5 rounded-xl bg-[var(--dusk)]/50 border border-[var(--twilight)] backdrop-blur-sm">
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
                          ? "bg-[var(--gold)] text-[var(--void)] font-medium scale-[1.02]"
                          : "bg-[var(--night)] text-[var(--muted)] hover:text-[var(--cream)] border border-[var(--twilight)] hover:border-[var(--soft)]/30"
                      }`}
                      style={isActive ? {
                        boxShadow: "0 0 20px rgba(251, 191, 36, 0.35), 0 4px 12px rgba(251, 191, 36, 0.25)",
                        border: "1px solid transparent",
                      } : undefined}
                    >
                      {hood}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Vibes Section */}
            <section className="p-5 rounded-xl bg-[var(--dusk)]/50 border border-[var(--twilight)] backdrop-blur-sm">
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
                  const emoji = VIBE_EMOJIS[vibe.value];
                  return (
                    <button
                      key={vibe.value}
                      onClick={() => toggleVibe(vibe.value)}
                      className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl font-mono text-sm transition-all duration-200 ${
                        isActive
                          ? "bg-[var(--lavender)] text-[var(--void)] font-medium scale-[1.02]"
                          : "bg-[var(--night)] text-[var(--muted)] hover:text-[var(--cream)] border border-[var(--twilight)] hover:border-[var(--soft)]/30"
                      }`}
                      style={isActive ? {
                        boxShadow: "0 0 20px rgba(196, 181, 253, 0.35), 0 4px 12px rgba(196, 181, 253, 0.25)",
                        border: "1px solid transparent",
                      } : undefined}
                    >
                      {emoji && <span className="text-base">{emoji}</span>}
                      {vibe.label}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Price Section */}
            <section className="p-5 rounded-xl bg-[var(--dusk)]/50 border border-[var(--twilight)] backdrop-blur-sm">
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
                  const priceIcons: Record<string, string> = {
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
                          ? "bg-[var(--neon-green)] text-[var(--void)] font-medium scale-[1.02]"
                          : "bg-[var(--night)] text-[var(--muted)] hover:text-[var(--cream)] border border-[var(--twilight)] hover:border-[var(--soft)]/30"
                      }`}
                      style={isActive ? {
                        boxShadow: "0 0 20px rgba(52, 211, 153, 0.35), 0 4px 12px rgba(52, 211, 153, 0.25)",
                        border: "1px solid transparent",
                      } : undefined}
                    >
                      {priceIcons[price.value] || price.label}
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
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[var(--coral)] text-[var(--void)] font-mono text-sm font-medium hover:bg-[var(--rose)] transition-all disabled:opacity-50 shadow-lg shadow-[var(--coral)]/20"
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
                  href="/atlanta"
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
        )}
      </main>
    </div>
  );
}

export default function PreferencesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--coral)] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <PreferencesContent />
    </Suspense>
  );
}
