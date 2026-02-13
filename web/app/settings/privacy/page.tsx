"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import UnifiedHeader from "@/components/UnifiedHeader";
import PageFooter from "@/components/PageFooter";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";

type PrivacyPrefs = {
  cross_portal_recommendations: boolean | null;
  hide_adult_content: boolean | null;
};

function ToggleRow({
  label,
  description,
  value,
  onToggle,
}: {
  label: string;
  description: string;
  value: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between p-4 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)]">
      <div className="pr-4">
        <h3 className="font-mono text-sm font-medium text-[var(--cream)]">
          {label}
        </h3>
        <p className="font-mono text-xs text-[var(--muted)] mt-1">
          {description}
        </p>
      </div>
      <button
        onClick={onToggle}
        className={`relative w-12 h-7 rounded-full transition-colors ${
          value ? "bg-[var(--coral)]" : "bg-[var(--twilight)]"
        }`}
        aria-label={`${label} ${value ? "enabled" : "disabled"}`}
      >
        <span
          className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
            value ? "left-6" : "left-1"
          }`}
        />
      </button>
    </div>
  );
}

export default function PrivacySettingsPage() {
  const { user, profile, refreshProfile, loading: authLoading } = useAuth();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isPublic, setIsPublic] = useState(true);
  const [crossPortalRecommendations, setCrossPortalRecommendations] =
    useState(true);
  const [hideAdultContent, setHideAdultContent] = useState(false);

  useEffect(() => {
    if (profile) {
      setIsPublic(profile.is_public ?? true);
    }
  }, [profile]);

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
          setCrossPortalRecommendations(
            data.cross_portal_recommendations ?? true,
          );
          setHideAdultContent(data.hide_adult_content ?? false);
        } else {
          setCrossPortalRecommendations(true);
          setHideAdultContent(false);
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
      const { error: profileError } = await (
        supabase.from("profiles") as ReturnType<typeof supabase.from>
      )
        .update({ is_public: isPublic } as never)
        .eq("id", user.id);

      if (profileError) throw profileError;

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

      if (refreshProfile) {
        await refreshProfile();
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
      <div className="min-h-screen">
        <UnifiedHeader />
        <main className="max-w-2xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-48 rounded bg-[var(--twilight)]" />
            <div className="h-24 rounded-lg bg-[var(--twilight)]" />
            <div className="h-24 rounded-lg bg-[var(--twilight)]" />
            <div className="h-24 rounded-lg bg-[var(--twilight)]" />
          </div>
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen">
        <UnifiedHeader />
        <main className="max-w-2xl mx-auto px-4 py-8 text-center">
          <p className="text-[var(--muted)]">
            Please sign in to manage privacy settings.
          </p>
          <Link
            href="/auth/login?redirect=/settings/privacy"
            className="mt-4 inline-block text-[var(--coral)]"
          >
            Sign in
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <UnifiedHeader />

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-2">
          <Link
            href="/settings"
            className="text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </Link>
          <h1 className="text-2xl font-semibold text-[var(--cream)]">
            Privacy Controls
          </h1>
        </div>

        <p className="font-mono text-xs text-[var(--muted)] mb-6">
          Control who can see your profile and how your activity is used for
          personalization.
        </p>

        {(saved || saving) && (
          <div className="mb-4">
            <span
              className={`px-2 py-1 text-xs font-mono rounded transition-colors ${
                saving
                  ? "text-[var(--muted)] bg-[var(--twilight)]"
                  : "text-[var(--neon-green)] bg-[var(--neon-green)]/10"
              }`}
            >
              {saving ? "Saving..." : "Saved"}
            </span>
          </div>
        )}

        {error && (
          <div className="mb-4 p-4 rounded-lg bg-red-500/10 border border-red-500 text-red-400 font-mono text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <ToggleRow
            label="Public Profile"
            description="Allow others to discover your profile and social activity."
            value={isPublic}
            onToggle={() => setIsPublic(!isPublic)}
          />

          <ToggleRow
            label="Use Activity Across Portals"
            description="When enabled, your actions across all portals inform recommendations."
            value={crossPortalRecommendations}
            onToggle={() =>
              setCrossPortalRecommendations(!crossPortalRecommendations)
            }
          />

          <ToggleRow
            label="Hide Mature Content"
            description="Filter out events marked as sensitive or adult-oriented where supported."
            value={hideAdultContent}
            onToggle={() => setHideAdultContent(!hideAdultContent)}
          />
        </div>

        <div className="flex items-center gap-3 pt-8">
          <Link
            href="/settings"
            className="px-5 py-3 rounded-xl font-mono text-sm text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/50 transition-all"
          >
            Cancel
          </Link>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 sm:flex-none px-6 py-3 rounded-xl bg-[var(--coral)] text-[var(--void)] font-mono text-sm font-medium hover:bg-[var(--rose)] transition-all disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Privacy Settings"}
          </button>
        </div>
      </main>

      <PageFooter />
    </div>
  );
}
