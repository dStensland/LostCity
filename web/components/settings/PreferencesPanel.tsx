"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import dynamic from "next/dynamic";

// Dynamically import PreferencesClient to avoid bloating the settings bundle
const PreferencesClient = dynamic(
  () => import("@/app/settings/preferences/PreferencesClient"),
  {
    loading: () => (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 bg-[var(--twilight)] rounded" />
        <div className="h-40 bg-[var(--twilight)] rounded-lg" />
        <div className="h-40 bg-[var(--twilight)] rounded-lg" />
      </div>
    ),
  }
);

type PrefsData = {
  favorite_categories?: string[];
  favorite_neighborhoods?: string[];
  favorite_vibes?: string[];
  price_preference?: string;
  favorite_genres?: Record<string, string[]>;
  needs_accessibility?: string[];
  needs_dietary?: string[];
  needs_family?: string[];
  cross_portal_recommendations?: boolean;
};

export default function PreferencesPanel() {
  const { user, loading: authLoading } = useAuth();
  const [prefs, setPrefs] = useState<PrefsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPrefs() {
      if (!user) return;

      try {
        const res = await fetch("/api/preferences");
        if (res.ok) {
          const data = await res.json();
          setPrefs(data);
        }
      } catch (err) {
        console.error("Failed to load preferences:", err);
      } finally {
        setLoading(false);
      }
    }

    if (!authLoading) {
      loadPrefs();
    }
  }, [user, authLoading]);

  if (authLoading || loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 bg-[var(--twilight)] rounded" />
        <div className="h-40 bg-[var(--twilight)] rounded-lg" />
      </div>
    );
  }

  return (
    <PreferencesClient
      isWelcome={false}
      initialPreferences={{
        categories: prefs?.favorite_categories || [],
        neighborhoods: prefs?.favorite_neighborhoods || [],
        vibes: prefs?.favorite_vibes || [],
        pricePreference: prefs?.price_preference || "any",
        genres: prefs?.favorite_genres || {},
        needsAccessibility: prefs?.needs_accessibility || [],
        needsDietary: prefs?.needs_dietary || [],
        needsFamily: prefs?.needs_family || [],
        crossPortalRecommendations: prefs?.cross_portal_recommendations ?? true,
      }}
      portalActivity={[]}
      embedded
    />
  );
}
