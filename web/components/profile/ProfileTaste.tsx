"use client";

import { useState, useEffect } from "react";

type TasteData = {
  topCategories: Array<{ category: string; score: number }>;
  topNeighborhoods: Array<{ neighborhood: string; score: number }>;
  totalEvents: number;
  totalVenues: number;
};

export default function ProfileTaste({ username }: { username: string }) {
  const [taste, setTaste] = useState<TasteData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTaste() {
      try {
        const res = await fetch(`/api/profile/${username}?section=taste`);
        if (res.ok) {
          const data = await res.json();
          setTaste(data);
        }
      } catch (err) {
        console.error("Failed to fetch taste:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchTaste();
  }, [username]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-20 rounded-lg bg-[var(--twilight)]" />
        <div className="h-20 rounded-lg bg-[var(--twilight)]" />
      </div>
    );
  }

  if (!taste) {
    return (
      <div className="py-12 text-center">
        <p className="font-mono text-sm text-[var(--muted)]">Taste data unavailable</p>
      </div>
    );
  }

  const hasData = taste.topCategories.length > 0 || taste.topNeighborhoods.length > 0;

  if (!hasData) {
    return (
      <div className="py-12 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--twilight)]/30 flex items-center justify-center">
          <svg className="w-8 h-8 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <p className="font-mono text-sm text-[var(--muted)]">Not enough activity for taste data</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 rounded-xl border border-[var(--twilight)] text-center bg-[var(--card-bg)]">
          <div className="text-2xl font-semibold text-[var(--coral)]">{taste.totalEvents}</div>
          <div className="text-xs text-[var(--muted)] font-mono mt-1">Events</div>
        </div>
        <div className="p-4 rounded-xl border border-[var(--twilight)] text-center bg-[var(--card-bg)]">
          <div className="text-2xl font-semibold text-[var(--neon-cyan)]">{taste.totalVenues}</div>
          <div className="text-xs text-[var(--muted)] font-mono mt-1">Venues</div>
        </div>
      </div>

      {/* Top Categories */}
      {taste.topCategories.length > 0 && (
        <div>
          <h3 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-3">
            Top Categories
          </h3>
          <div className="flex flex-wrap gap-2">
            {taste.topCategories.map((cat) => (
              <span
                key={cat.category}
                className="px-3 py-1.5 rounded-full text-xs font-mono bg-[var(--coral)]/15 text-[var(--coral)]"
              >
                {cat.category.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Top Neighborhoods */}
      {taste.topNeighborhoods.length > 0 && (
        <div>
          <h3 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-3">
            Favorite Neighborhoods
          </h3>
          <div className="flex flex-wrap gap-2">
            {taste.topNeighborhoods.map((n) => (
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
        </div>
      )}
    </div>
  );
}
