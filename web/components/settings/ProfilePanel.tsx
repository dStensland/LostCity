"use client";

import { useState } from "react";
import { useAuth, type Profile } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import AvatarUpload from "@/components/AvatarUpload";

type EditableProfile = {
  displayName: string;
  bio: string;
  location: string;
  website: string;
  avatarUrl: string | null;
};

function getEditableProfile(profile: Profile | null): EditableProfile {
  return {
    displayName: profile?.display_name || "",
    bio: profile?.bio || "",
    location: profile?.location || "",
    website: profile?.website || "",
    avatarUrl: profile?.avatar_url || null,
  };
}

export default function ProfilePanel() {
  const { user, profile, profileLoading, refreshProfile } = useAuth();

  if (!user) return null;

  if (profileLoading && !profile) {
    return (
      <div className="py-12 text-center">
        <div className="w-8 h-8 border-2 border-[var(--coral)] border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  return (
    <ProfileForm
      key={profile?.updated_at || user.id}
      userId={user.id}
      username={profile?.username || ""}
      initialProfile={getEditableProfile(profile)}
      onRefreshProfile={refreshProfile}
    />
  );
}

function ProfileForm({
  userId,
  username,
  initialProfile,
  onRefreshProfile,
}: {
  userId: string;
  username: string;
  initialProfile: EditableProfile;
  onRefreshProfile: () => Promise<void>;
}) {
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState(initialProfile.displayName);
  const [bio, setBio] = useState(initialProfile.bio);
  const [location, setLocation] = useState(initialProfile.location);
  const [website, setWebsite] = useState(initialProfile.website);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialProfile.avatarUrl);

  const handleSave = async () => {
    setError(null);
    setSuccess(false);
    setSaving(true);

    if (website && !website.match(/^https?:\/\/.+/)) {
      setError("Website must be a valid URL starting with http:// or https://");
      setSaving(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        location: location.trim() || null,
        website: website.trim() || null,
      } as never)
      .eq("id", userId);

    setSaving(false);

    if (updateError) {
      console.error("Error saving profile:", updateError);
      setError("Failed to save profile. Please try again.");
      return;
    }

    await onRefreshProfile();
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-[var(--cream)]">Profile Details</h2>
        <p className="font-mono text-xs text-[var(--muted)] mt-1">
          Manage how your profile appears across Lost City.
        </p>
      </div>

      <div className="flex justify-center py-4">
        <AvatarUpload
          currentAvatarUrl={avatarUrl}
          displayName={displayName}
          username={username}
          size="xl"
          onUploadComplete={(url) => {
            setAvatarUrl(url);
            void onRefreshProfile();
          }}
          onRemove={() => {
            setAvatarUrl(null);
            void onRefreshProfile();
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
