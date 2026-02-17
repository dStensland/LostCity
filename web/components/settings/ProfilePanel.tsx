"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import AvatarUpload from "@/components/AvatarUpload";

export default function ProfilePanel() {
  const { user, profile, refreshProfile } = useAuth();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [website, setWebsite] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || "");
      setBio(profile.bio || "");
      setLocation(profile.location || "");
      setWebsite(profile.website || "");
      setAvatarUrl(profile.avatar_url);
      setLoading(false);
    } else if (user) {
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
          avatar_url: string | null;
        };
        const p = data as ProfileData | null;
        if (p) {
          setDisplayName(p.display_name || "");
          setBio(p.bio || "");
          setLocation(p.location || "");
          setWebsite(p.website || "");
          setAvatarUrl(p.avatar_url);
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

    if (refreshProfile) {
      await refreshProfile();
    }

    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  if (!user) return null;

  if (loading) {
    return (
      <div className="py-12 text-center">
        <div className="w-8 h-8 border-2 border-[var(--coral)] border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-[var(--cream)]">Profile Details</h2>
        <p className="font-mono text-xs text-[var(--muted)] mt-1">
          Manage how your profile appears across Lost City.
        </p>
      </div>

      {/* Avatar Upload */}
      <div className="flex justify-center py-4">
        <AvatarUpload
          currentAvatarUrl={avatarUrl}
          displayName={displayName}
          username={profile?.username || ""}
          size="xl"
          onUploadComplete={(url) => {
            setAvatarUrl(url);
            refreshProfile?.();
          }}
          onRemove={() => {
            setAvatarUrl(null);
            refreshProfile?.();
          }}
        />
      </div>

      {success && (
        <div className="p-4 rounded-lg bg-green-500/10 border border-green-500 text-green-400 font-mono text-sm">
          Profile saved successfully!
        </div>
      )}

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

      {/* Save */}
      <div className="flex gap-3 pt-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 sm:flex-none px-6 py-2.5 rounded-lg bg-[var(--coral)] text-[var(--void)] font-mono text-sm font-medium hover:bg-[var(--rose)] transition-colors disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Profile"}
        </button>
      </div>
    </div>
  );
}
