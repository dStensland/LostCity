"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import UnifiedHeader from "@/components/UnifiedHeader";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import PageFooter from "@/components/PageFooter";

export default function ProfileSettingsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [website, setWebsite] = useState("");

  // Load existing profile data
  useEffect(() => {
    if (profile) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Initialize form from props
      setDisplayName(profile.display_name || "");
      setBio(profile.bio || "");
      setLocation(profile.location || "");
      setWebsite(profile.website || "");
      setLoading(false);
    } else if (user) {
      // Profile might not be loaded yet, fetch directly
      const userId = user.id;
      async function loadProfile() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabase as any)
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .maybeSingle();

        type ProfileData = {
          display_name: string | null;
          bio: string | null;
          location: string | null;
          website: string | null;
        };
        const profile = data as ProfileData | null;
        if (profile) {
          setDisplayName(profile.display_name || "");
          setBio(profile.bio || "");
          setLocation(profile.location || "");
          setWebsite(profile.website || "");
        }
        setLoading(false);
      }
      loadProfile();
    }
  }, [user, profile, supabase]);

  const handleSave = async () => {
    if (!user) return;

    setError(null);
    setSuccess(false);
    setSaving(true);

    // Validate website URL if provided
    if (website && !website.match(/^https?:\/\/.+/)) {
      setError("Website must be a valid URL starting with http:// or https://");
      setSaving(false);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from("profiles")
      .update({
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        location: location.trim() || null,
        website: website.trim() || null,
      })
      .eq("id", user.id);

    setSaving(false);

    if (updateError) {
      console.error("Error saving profile:", updateError);
      setError("Failed to save profile. Please try again.");
      return;
    }

    // Refresh profile in auth context before showing success
    if (refreshProfile) {
      await refreshProfile();
    }

    setSuccess(true);

    // Clear success message after 3 seconds
    setTimeout(() => setSuccess(false), 3000);
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen">
      <UnifiedHeader />

      {/* Main */}
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
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
            Profile Details
          </h1>
        </div>
        <p className="font-mono text-xs text-[var(--muted)] -mt-5 mb-6">
          Manage how your profile appears across Lost City.
        </p>

        {loading ? (
          <div className="py-12 text-center">
            <div className="w-8 h-8 border-2 border-[var(--coral)] border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Success Message */}
            {success && (
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500 text-green-400 font-mono text-sm">
                Profile saved successfully!
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500 text-red-400 font-mono text-sm">
                {error}
              </div>
            )}

            {/* Display Name */}
            <div>
              <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={50}
                placeholder="Your display name"
                className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors"
              />
              <p className="font-mono text-xs text-[var(--muted)] mt-1">
                {displayName.length}/50 characters
              </p>
            </div>

            {/* Bio */}
            <div>
              <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
                Bio
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={500}
                rows={4}
                placeholder="Tell us about yourself"
                className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors resize-none"
              />
              <p className="font-mono text-xs text-[var(--muted)] mt-1">
                {bio.length}/500 characters
              </p>
            </div>

            {/* Location */}
            <div>
              <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
                Location
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                maxLength={100}
                placeholder="e.g., Midtown, Atlanta"
                className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors"
              />
            </div>

            {/* Website */}
            <div>
              <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
                Website
              </label>
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://yourwebsite.com"
                className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors"
              />
            </div>

            <div className="p-4 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)]">
              <h3 className="font-mono text-sm font-medium text-[var(--cream)]">
                Privacy
              </h3>
              <p className="font-mono text-xs text-[var(--muted)] mt-1">
                Profile visibility and recommendation privacy are now in Privacy
                Controls.
              </p>
              <Link
                href="/settings/privacy"
                className="inline-flex items-center gap-1 mt-3 font-mono text-xs text-[var(--coral)] hover:text-[var(--rose)] transition-colors"
              >
                Open Privacy Controls
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Link>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Link
                href="/settings"
                className="px-4 py-2.5 rounded-lg font-mono text-sm text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
              >
                Cancel
              </Link>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 sm:flex-none px-6 py-2.5 rounded-lg bg-[var(--coral)] text-[var(--void)] font-mono text-sm font-medium hover:bg-[var(--rose)] transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Profile"}
              </button>
            </div>
          </div>
        )}
      </main>

      <PageFooter />
    </div>
  );
}
