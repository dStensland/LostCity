"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/Logo";
import UserMenu from "@/components/UserMenu";
import CategoryIcon from "@/components/CategoryIcon";
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

function PreferencesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isWelcome = searchParams.get("welcome") === "true";
  const { user, profile } = useAuth();
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

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="px-4 sm:px-6 py-4 flex justify-between items-center border-b border-[var(--twilight)]">
        <div className="flex items-baseline gap-3">
          <Logo />
          <span className="font-mono text-[0.65rem] font-medium text-[var(--muted)] uppercase tracking-widest hidden sm:inline">
            Atlanta
          </span>
        </div>
        <nav className="flex items-center gap-4 sm:gap-6">
          <Link href="/" className="font-mono text-[0.7rem] font-medium text-[var(--muted)] uppercase tracking-wide hover:text-[var(--cream)] transition-colors">
            Events
          </Link>
          <UserMenu />
        </nav>
      </header>

      {/* Main */}
      <main className="max-w-2xl mx-auto px-4 py-8">
        {isWelcome && (
          <div className="mb-8 p-4 rounded-lg bg-[var(--coral)]/10 border border-[var(--coral)]">
            <h2 className="font-serif text-xl text-[var(--coral)] italic">
              Welcome to Lost City!
            </h2>
            <p className="font-mono text-xs text-[var(--soft)] mt-2">
              Let&apos;s personalize your experience. Select your interests below to get tailored event recommendations.
            </p>
          </div>
        )}

        <h1 className="font-serif text-2xl text-[var(--cream)] italic mb-2">
          {isWelcome ? "What are you into?" : "Your Preferences"}
        </h1>
        <p className="font-mono text-xs text-[var(--muted)] mb-8">
          We&apos;ll use these to personalize your For You feed
        </p>

        {loading ? (
          <div className="py-12 text-center">
            <div className="w-8 h-8 border-2 border-[var(--coral)] border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : (
          <div className="space-y-8">
            {/* Categories */}
            <section>
              <h2 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-3">
                Categories
              </h2>
              <div className="flex flex-wrap gap-2">
                {PREFERENCE_CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => toggleCategory(cat.value)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-sm transition-colors ${
                      selectedCategories.includes(cat.value)
                        ? "bg-[var(--coral)] text-[var(--void)]"
                        : "bg-[var(--dusk)] text-[var(--muted)] hover:text-[var(--cream)] border border-[var(--twilight)]"
                    }`}
                  >
                    <CategoryIcon
                      type={cat.value}
                      size={16}
                      style={{
                        color: selectedCategories.includes(cat.value)
                          ? "var(--void)"
                          : undefined,
                      }}
                    />
                    {cat.label}
                  </button>
                ))}
              </div>
            </section>

            {/* Neighborhoods */}
            <section>
              <h2 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-3">
                Neighborhoods
              </h2>
              <div className="flex flex-wrap gap-2">
                {PREFERENCE_NEIGHBORHOODS.map((hood) => (
                  <button
                    key={hood}
                    onClick={() => toggleNeighborhood(hood)}
                    className={`px-3 py-2 rounded-lg font-mono text-sm transition-colors ${
                      selectedNeighborhoods.includes(hood)
                        ? "bg-[var(--gold)] text-[var(--void)]"
                        : "bg-[var(--dusk)] text-[var(--muted)] hover:text-[var(--cream)] border border-[var(--twilight)]"
                    }`}
                  >
                    {hood}
                  </button>
                ))}
              </div>
            </section>

            {/* Vibes */}
            <section>
              <h2 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-3">
                Vibes
              </h2>
              <div className="flex flex-wrap gap-2">
                {PREFERENCE_VIBES.map((vibe) => (
                  <button
                    key={vibe.value}
                    onClick={() => toggleVibe(vibe.value)}
                    className={`px-3 py-2 rounded-lg font-mono text-sm transition-colors ${
                      selectedVibes.includes(vibe.value)
                        ? "bg-[var(--lavender)] text-[var(--void)]"
                        : "bg-[var(--dusk)] text-[var(--muted)] hover:text-[var(--cream)] border border-[var(--twilight)]"
                    }`}
                  >
                    {vibe.label}
                  </button>
                ))}
              </div>
            </section>

            {/* Price Preference */}
            <section>
              <h2 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-3">
                Price Range
              </h2>
              <div className="flex flex-wrap gap-2">
                {PRICE_PREFERENCES.map((price) => (
                  <button
                    key={price.value}
                    onClick={() => setPricePreference(price.value)}
                    className={`px-3 py-2 rounded-lg font-mono text-sm transition-colors ${
                      pricePreference === price.value
                        ? "bg-[var(--rose)] text-[var(--void)]"
                        : "bg-[var(--dusk)] text-[var(--muted)] hover:text-[var(--cream)] border border-[var(--twilight)]"
                    }`}
                  >
                    {price.label}
                  </button>
                ))}
              </div>
            </section>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              {!isWelcome && (
                <Link
                  href="/settings"
                  className="px-4 py-2.5 rounded-lg font-mono text-sm text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
                >
                  Cancel
                </Link>
              )}
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 sm:flex-none px-6 py-2.5 rounded-lg bg-[var(--coral)] text-[var(--void)] font-mono text-sm font-medium hover:bg-[var(--rose)] transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : isWelcome ? "Continue to For You" : "Save Preferences"}
              </button>
              {isWelcome && (
                <Link
                  href="/"
                  className="px-4 py-2.5 rounded-lg font-mono text-sm text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
                >
                  Skip for now
                </Link>
              )}
            </div>
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
        <div className="animate-pulse text-[var(--muted)]">Loading...</div>
      </div>
    }>
      <PreferencesContent />
    </Suspense>
  );
}
