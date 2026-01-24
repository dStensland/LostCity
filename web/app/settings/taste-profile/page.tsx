"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import CategoryIcon, { getCategoryColor, CATEGORY_CONFIG, type CategoryType } from "@/components/CategoryIcon";

type ProfileData = {
  explicit: {
    favorite_categories: string[];
    favorite_neighborhoods: string[];
    favorite_vibes: string[];
    price_preference: string | null;
  };
  inferred: Array<{
    signal_type: string;
    signal_value: string;
    score: number;
    interaction_count: number;
  }>;
  stats: {
    topCategories: Array<{ category: string; score: number; interactionCount: number }>;
    topVenues: Array<{ venueId: string; score: number; interactionCount: number }>;
    topNeighborhoods: Array<{ neighborhood: string; score: number; interactionCount: number }>;
    followedVenues: number;
    followedProducers: number;
    rsvps: {
      going: number;
      interested: number;
      went: number;
    };
  };
};

export default function TasteProfilePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/auth/login?redirect=/settings/taste-profile");
      return;
    }

    async function fetchProfile() {
      try {
        const res = await fetch("/api/preferences/profile");
        if (res.ok) {
          const data = await res.json();
          setProfile(data);
        }
      } catch (err) {
        console.error("Failed to fetch profile:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [user, authLoading, router]);

  const handleReset = async () => {
    setResetting(true);
    try {
      const res = await fetch("/api/preferences/profile", { method: "DELETE" });
      if (res.ok) {
        // Refresh the profile
        const refreshRes = await fetch("/api/preferences/profile");
        if (refreshRes.ok) {
          setProfile(await refreshRes.json());
        }
      }
    } catch (err) {
      console.error("Failed to reset:", err);
    } finally {
      setResetting(false);
      setShowResetConfirm(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[var(--void)]">
        <div className="max-w-2xl mx-auto px-4 py-12">
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-48 rounded skeleton-shimmer" />
            <div className="h-40 rounded-xl skeleton-shimmer" />
            <div className="h-40 rounded-xl skeleton-shimmer" />
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[var(--void)]">
        <div className="max-w-2xl mx-auto px-4 py-12 text-center">
          <p className="text-[var(--muted)]">Failed to load taste profile</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 rounded-lg bg-[var(--twilight)] text-[var(--cream)] font-mono text-sm"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  // Calculate max score for bar scaling
  const maxCategoryScore = Math.max(
    ...profile.stats.topCategories.map((c) => c.score),
    1
  );

  return (
    <div className="min-h-screen bg-[var(--void)]">
      {/* Header */}
      <header className="border-b border-[var(--twilight)] sticky top-0 bg-[var(--void)]/95 backdrop-blur-md z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link
            href="/settings"
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-lg font-semibold text-[var(--cream)]">Taste Profile</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        {/* Activity Summary */}
        <section className="grid grid-cols-3 gap-3">
          <div className="p-4 rounded-xl border border-[var(--twilight)] text-center" style={{ backgroundColor: "var(--card-bg)" }}>
            <div className="text-2xl font-semibold text-[var(--coral)]">
              {profile.stats.rsvps.going + profile.stats.rsvps.interested + profile.stats.rsvps.went}
            </div>
            <div className="text-xs text-[var(--muted)] font-mono mt-1">RSVPs</div>
          </div>
          <div className="p-4 rounded-xl border border-[var(--twilight)] text-center" style={{ backgroundColor: "var(--card-bg)" }}>
            <div className="text-2xl font-semibold text-[var(--neon-cyan)]">
              {profile.stats.followedVenues}
            </div>
            <div className="text-xs text-[var(--muted)] font-mono mt-1">Venues</div>
          </div>
          <div className="p-4 rounded-xl border border-[var(--twilight)] text-center" style={{ backgroundColor: "var(--card-bg)" }}>
            <div className="text-2xl font-semibold text-[var(--lavender)]">
              {profile.stats.followedProducers}
            </div>
            <div className="text-xs text-[var(--muted)] font-mono mt-1">Producers</div>
          </div>
        </section>

        {/* Explicit Preferences */}
        <section className="rounded-xl border border-[var(--twilight)] p-5" style={{ backgroundColor: "var(--card-bg)" }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-[var(--cream)]">Your Preferences</h2>
              <p className="text-xs text-[var(--muted)] mt-0.5">Categories and vibes you&apos;ve told us you like</p>
            </div>
            <Link
              href="/settings/preferences"
              className="text-xs text-[var(--coral)] font-mono hover:underline"
            >
              Edit
            </Link>
          </div>

          {profile.explicit.favorite_categories.length > 0 || profile.explicit.favorite_vibes.length > 0 ? (
            <div className="space-y-4">
              {profile.explicit.favorite_categories.length > 0 && (
                <div>
                  <h3 className="text-xs text-[var(--muted)] font-mono uppercase tracking-wider mb-2">Categories</h3>
                  <div className="flex flex-wrap gap-2">
                    {profile.explicit.favorite_categories.map((cat) => (
                      <span
                        key={cat}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono"
                        style={{
                          backgroundColor: `${getCategoryColor(cat)}15`,
                          color: getCategoryColor(cat),
                        }}
                      >
                        <CategoryIcon type={cat} size={14} />
                        {CATEGORY_CONFIG[cat as CategoryType]?.label || cat}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {profile.explicit.favorite_vibes.length > 0 && (
                <div>
                  <h3 className="text-xs text-[var(--muted)] font-mono uppercase tracking-wider mb-2">Vibes</h3>
                  <div className="flex flex-wrap gap-2">
                    {profile.explicit.favorite_vibes.map((vibe) => (
                      <span
                        key={vibe}
                        className="px-3 py-1.5 rounded-full text-xs font-mono bg-[var(--twilight)] text-[var(--soft)]"
                      >
                        {vibe}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)] text-center py-4">
              No preferences set yet.{" "}
              <Link href="/settings/preferences" className="text-[var(--coral)] hover:underline">
                Add some
              </Link>
            </p>
          )}
        </section>

        {/* Learned Preferences - Category Affinity */}
        <section className="rounded-xl border border-[var(--twilight)] p-5" style={{ backgroundColor: "var(--card-bg)" }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-[var(--cream)]">Category Affinity</h2>
              <p className="text-xs text-[var(--muted)] mt-0.5">Learned from your activity</p>
            </div>
          </div>

          {profile.stats.topCategories.length > 0 ? (
            <div className="space-y-3">
              {profile.stats.topCategories.map((cat) => {
                const percentage = (cat.score / maxCategoryScore) * 100;
                const color = getCategoryColor(cat.category);
                return (
                  <div key={cat.category}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <CategoryIcon type={cat.category} size={14} />
                        <span className="text-sm text-[var(--cream)]">
                          {CATEGORY_CONFIG[cat.category as CategoryType]?.label || cat.category}
                        </span>
                      </div>
                      <span className="text-xs text-[var(--muted)] font-mono">
                        {cat.interactionCount} interactions
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-[var(--twilight)] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)] text-center py-4">
              Start exploring events to see your category preferences
            </p>
          )}
        </section>

        {/* Neighborhood Preferences */}
        {profile.stats.topNeighborhoods.length > 0 && (
          <section className="rounded-xl border border-[var(--twilight)] p-5" style={{ backgroundColor: "var(--card-bg)" }}>
            <div className="mb-4">
              <h2 className="font-semibold text-[var(--cream)]">Favorite Neighborhoods</h2>
              <p className="text-xs text-[var(--muted)] mt-0.5">Where you like to go</p>
            </div>

            <div className="flex flex-wrap gap-2">
              {profile.stats.topNeighborhoods.map((n) => (
                <span
                  key={n.neighborhood}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono bg-[var(--gold)]/15 text-[var(--gold)]"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  </svg>
                  {n.neighborhood}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Reset Section */}
        <section className="rounded-xl border border-[var(--twilight)] p-5" style={{ backgroundColor: "var(--card-bg)" }}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-[var(--cream)]">Reset Learned Preferences</h2>
              <p className="text-xs text-[var(--muted)] mt-0.5">
                Clear activity-based preferences. Your explicit preferences will remain.
              </p>
            </div>
            <button
              onClick={() => setShowResetConfirm(true)}
              className="px-4 py-2 rounded-lg border border-[var(--coral)]/30 text-[var(--coral)] font-mono text-xs hover:bg-[var(--coral)]/10 transition-colors"
            >
              Reset
            </button>
          </div>

          {showResetConfirm && (
            <div className="mt-4 p-4 rounded-lg bg-[var(--coral)]/10 border border-[var(--coral)]/30">
              <p className="text-sm text-[var(--cream)] mb-3">
                Are you sure? This will clear all learned preferences based on your activity.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleReset}
                  disabled={resetting}
                  className="px-4 py-2 rounded-lg bg-[var(--coral)] text-[var(--void)] font-mono text-xs font-medium hover:bg-[var(--rose)] transition-colors disabled:opacity-50"
                >
                  {resetting ? "Resetting..." : "Yes, reset"}
                </button>
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="px-4 py-2 rounded-lg bg-[var(--twilight)] text-[var(--cream)] font-mono text-xs hover:bg-[var(--twilight)]/80 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
