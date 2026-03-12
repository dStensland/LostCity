"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import ToggleRow from "./ToggleRow";
import { PrivacyTierSelector } from "./PrivacyTierSelector";
import type { PrivacyMode } from "@/lib/types/profile";

type PrivacyPrefs = {
  cross_portal_recommendations: boolean | null;
  hide_adult_content: boolean | null;
};

export default function PrivacyPanel() {
  const { user, profile, loading: authLoading } = useAuth();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [crossPortalRecommendations, setCrossPortalRecommendations] = useState(true);
  const [hideAdultContent, setHideAdultContent] = useState(false);

  const initialPrivacyMode: PrivacyMode = profile?.privacy_mode ?? "social";

  useEffect(() => {
    async function loadPrivacySettings() {
      if (!user) return;

      setLoading(true);
      setError(null);

      try {
        const { data } = (await supabase
          .from("user_preferences")
          .select("cross_portal_recommendations, hide_adult_content")
          .eq("user_id", user.id)
          .maybeSingle()) as { data: PrivacyPrefs | null };

        if (data) {
          setCrossPortalRecommendations(data.cross_portal_recommendations ?? true);
          setHideAdultContent(data.hide_adult_content ?? false);
        }
      } catch (err) {
        console.error("Failed to load privacy settings:", err);
        setError("Could not load privacy settings.");
      } finally {
        setLoading(false);
      }
    }

    if (!authLoading) {
      loadPrivacySettings();
    }
  }, [user, authLoading, supabase]);

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    setSaved(false);
    setError(null);

    try {
      const prefsPayload = {
        cross_portal_recommendations: crossPortalRecommendations,
        hide_adult_content: hideAdultContent,
      };

      const { data: existingPrefs } = await supabase
        .from("user_preferences")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existingPrefs) {
        await (
          supabase.from("user_preferences") as ReturnType<typeof supabase.from>
        )
          .update(prefsPayload as never)
          .eq("user_id", user.id);
      } else {
        await (
          supabase.from("user_preferences") as ReturnType<typeof supabase.from>
        ).insert({
          user_id: user.id,
          ...prefsPayload,
        } as never);
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error("Failed to save privacy settings:", err);
      setError("Could not save privacy settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 rounded bg-[var(--twilight)]" />
        <div className="h-24 rounded-lg bg-[var(--twilight)]" />
        <div className="h-24 rounded-lg bg-[var(--twilight)]" />
        <div className="h-24 rounded-lg bg-[var(--twilight)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-[var(--cream)]">Privacy Controls</h2>
        <p className="font-mono text-xs text-[var(--muted)] mt-1">
          Control who can see your profile and how your activity is used.
        </p>
      </div>

      {/* Profile Visibility — 3-tier privacy mode */}
      <div className="space-y-3">
        <p className="font-mono text-xs font-bold tracking-[0.12em] uppercase text-[var(--muted)]">
          Profile Visibility
        </p>
        <PrivacyTierSelector initialMode={initialPrivacyMode} />
      </div>

      <div className="border-t border-[var(--twilight)]" />

      {/* Other preferences */}
      <div className="space-y-4">
        {(saved || saving) && (
          <span
            className={`inline-block px-2 py-1 text-xs font-mono rounded transition-colors ${
              saving
                ? "text-[var(--muted)] bg-[var(--twilight)]"
                : "text-[var(--neon-green)] bg-[var(--neon-green)]/10"
            }`}
          >
            {saving ? "Saving..." : "Saved"}
          </span>
        )}

        {error && (
          <div className="rounded-lg border border-[var(--coral)] bg-[var(--coral)]/10 px-4 py-3 text-[var(--coral)] font-mono text-xs">
            {error}
          </div>
        )}

        <ToggleRow
          label="Use Activity Across Portals"
          description="When enabled, your actions across all portals inform recommendations."
          value={crossPortalRecommendations}
          onToggle={() => setCrossPortalRecommendations(!crossPortalRecommendations)}
        />

        <ToggleRow
          label="Hide Mature Content"
          description="Filter out events marked as sensitive or adult-oriented where supported."
          value={hideAdultContent}
          onToggle={() => setHideAdultContent(!hideAdultContent)}
        />
      </div>

      <div className="pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 rounded-lg bg-[var(--coral)] text-[var(--void)] font-mono text-sm font-medium hover:bg-[var(--rose)] transition-colors disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Preferences"}
        </button>
      </div>
    </div>
  );
}
