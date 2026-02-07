"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import ListCard from "./ListCard";
import ListCreateModal from "./ListCreateModal";

export type List = {
  id: string;
  portal_id: string | null;
  creator_id: string;
  title: string;
  slug: string;
  description: string | null;
  category: string | null;
  is_public: boolean;
  status: string;
  created_at: string;
  item_count: number;
  vote_count: number;
  thumbnails?: string[];
  creator?: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
};

interface ListsViewProps {
  portalId: string;
  portalSlug: string;
}

const CATEGORIES = [
  { value: "all", label: "All" },
  { value: "best_of", label: "Best Of" },
  { value: "hidden_gems", label: "Hidden Gems" },
  { value: "date_night", label: "Date Night" },
  { value: "with_friends", label: "With Friends" },
  { value: "solo", label: "Solo" },
  { value: "budget", label: "Budget-Friendly" },
  { value: "special_occasion", label: "Special Occasion" },
];

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  best_of: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  ),
  hidden_gems: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  ),
  date_night: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  ),
  with_friends: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  solo: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  budget: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  special_occasion: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.701 2.701 0 00-1.5-.454M9 6v2m3-2v2m3-2v2M9 3h.01M12 3h.01M15 3h.01M21 21v-7a2 2 0 00-2-2H5a2 2 0 00-2 2v7h18zm-3-9v-2a2 2 0 00-2-2H8a2 2 0 00-2 2v2h12z" />
    </svg>
  ),
};

export default function ListsView({ portalId, portalSlug }: ListsViewProps) {
  const { user } = useAuth();
  const [lists, setLists] = useState<List[]>([]);
  const [trendingLists, setTrendingLists] = useState<List[]>([]);
  const [loading, setLoading] = useState(true);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Fetch trending lists
  useEffect(() => {
    async function fetchTrending() {
      try {
        setTrendingLoading(true);
        const res = await fetch(`/api/lists?portal_id=${portalId}&sort=trending&limit=6`);
        if (!res.ok) throw new Error("Failed to load trending lists");
        const data = await res.json();
        // Only show lists with at least 1 vote or 3+ items
        setTrendingLists(
          (data.lists || []).filter(
            (l: List) => l.vote_count > 0 || l.item_count >= 3
          ).slice(0, 6)
        );
      } catch {
        // Silently fail for trending - not critical
      } finally {
        setTrendingLoading(false);
      }
    }
    fetchTrending();
  }, [portalId]);

  // Fetch all lists
  useEffect(() => {
    async function fetchLists() {
      try {
        setLoading(true);
        const params = new URLSearchParams({ portal_id: portalId });
        if (selectedCategory !== "all") {
          params.set("category", selectedCategory);
        }

        const res = await fetch(`/api/lists?${params}`);
        if (!res.ok) throw new Error("Failed to load lists");

        const data = await res.json();
        setLists(data.lists || []);
      } catch {
        setError("Unable to load lists");
      } finally {
        setLoading(false);
      }
    }

    fetchLists();
  }, [portalId, selectedCategory]);

  const handleListCreated = (newList: List) => {
    setLists((prev) => [newList, ...prev]);
    setShowCreateModal(false);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-4 rounded-xl border border-[var(--twilight)] bg-[var(--card-bg)]">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg skeleton-shimmer" />
              <div className="flex-1 space-y-2">
                <div className="h-5 w-2/3 skeleton-shimmer rounded" />
                <div className="h-4 w-1/2 skeleton-shimmer rounded" />
                <div className="h-3 w-1/4 skeleton-shimmer rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-16 text-center">
        <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-[var(--twilight)] to-[var(--dusk)] border border-[var(--twilight)] flex items-center justify-center">
          <svg className="w-8 h-8 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="font-serif text-lg text-[var(--cream)] mb-2">
          Couldn&apos;t load lists
        </h3>
        <p className="text-sm text-[var(--muted)] mb-6 max-w-xs mx-auto">
          Something went wrong loading community lists. This might be a temporary issue.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => {
              setError(null);
              setLoading(true);
              // Trigger re-fetch by toggling category
              const current = selectedCategory;
              setSelectedCategory("__refresh__");
              setTimeout(() => setSelectedCategory(current), 0);
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--coral)] text-[var(--void)] rounded-lg font-mono text-sm font-medium hover:bg-[var(--rose)] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Try Again
          </button>
          <Link
            href={`/${portalSlug}?view=find`}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-[var(--soft)] rounded-lg font-mono text-sm hover:text-[var(--cream)] transition-colors"
          >
            Browse Events Instead
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header with create button */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-[var(--cream)]">Lists</h2>
          <p className="text-sm text-[var(--muted)] mt-1">
            The best of Atlanta, ranked by locals
          </p>
        </div>

        {user ? (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--coral)] text-[var(--void)] rounded-lg font-mono text-xs font-medium hover:bg-[var(--rose)] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create List
          </button>
        ) : (
          <Link
            href={`/auth/login?redirect=/${portalSlug}?view=community`}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--twilight)] text-[var(--cream)] rounded-lg font-mono text-xs font-medium hover:bg-[var(--twilight)]/80 transition-colors"
          >
            Sign in to create
          </Link>
        )}
      </div>

      {/* Trending section */}
      {!trendingLoading && trendingLists.length > 0 && selectedCategory === "all" && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 text-[var(--coral)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
            </svg>
            <h3 className="font-mono text-sm font-medium text-[var(--coral)] uppercase tracking-wider">
              Popular right now
            </h3>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-hide -mx-4 px-4">
            {trendingLists.map((list) => (
              <Link
                key={list.id}
                href={`/${portalSlug}/lists/${list.slug}`}
                className="flex-shrink-0 w-64 p-4 rounded-xl border border-[var(--twilight)] bg-gradient-to-br from-[var(--card-bg)] to-[var(--dusk)]/50 hover:border-[var(--coral)]/50 transition-all group"
                data-list-category={list.category || "other"}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 list-category-icon"
                  >
                    {list.category && CATEGORY_ICONS[list.category] ? (
                      <span className="text-[var(--list-category-color)]">
                        {CATEGORY_ICONS[list.category]}
                      </span>
                    ) : (
                      <svg className="w-5 h-5 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm text-[var(--cream)] line-clamp-1 group-hover:text-[var(--coral)] transition-colors">
                      {list.title}
                    </h4>
                    {list.creator && (
                      <p className="text-xs text-[var(--muted)] line-clamp-1 mt-0.5">
                        by {list.creator.display_name || `@${list.creator.username}`}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
                  {list.vote_count > 0 ? (
                    <span className="flex items-center gap-1 text-[var(--coral)]">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                      {list.vote_count}
                    </span>
                  ) : null}
                  <span>{list.item_count} spots</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Category filter */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setSelectedCategory(cat.value)}
            className={`px-3 py-1.5 rounded-full font-mono text-xs whitespace-nowrap transition-all ${
              selectedCategory === cat.value
                ? "bg-[var(--coral)] text-[var(--void)] font-medium"
                : "bg-[var(--twilight)]/50 text-[var(--muted)] hover:text-[var(--cream)]"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* All Lists */}
      {lists.length === 0 ? (
        <div className="py-12 px-6 rounded-xl bg-gradient-to-br from-[var(--dusk)] to-[var(--night)] border border-[var(--twilight)] text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[var(--coral)]/20 to-[var(--neon-magenta)]/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-[var(--coral)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h3 className="font-serif text-xl text-[var(--cream)] mb-2">
            {selectedCategory !== "all" ? "Nothing here yet" : "Know something we don't?"}
          </h3>
          <p className="text-sm text-[var(--soft)] mb-3 max-w-md mx-auto">
            {selectedCategory !== "all"
              ? "Be the first to drop a list in this category."
              : "Make a list of your favorite spots. The places you'd actually send a friend."}
          </p>

          {/* Example categories for inspiration */}
          {selectedCategory === "all" && (
            <div className="mb-6 max-w-lg mx-auto">
              <p className="text-xs font-mono text-[var(--muted)] uppercase tracking-wider mb-3">
                Ideas to get you started
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {[
                  { label: "Date Night Spots", icon: "💕", tone: "date-night" },
                  { label: "Hidden Gems", icon: "💎", tone: "hidden-gems" },
                  { label: "Best Coffee", icon: "☕", tone: "best-coffee" },
                  { label: "Budget-Friendly", icon: "💰", tone: "budget" },
                  { label: "Late Night Eats", icon: "🌙", tone: "late-night" },
                  { label: "Family Fun", icon: "👨‍👩‍👧", tone: "family-fun" },
                ].map((example) => (
                  <span
                    key={example.label}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-[var(--twilight)] bg-[var(--void)]/50 list-example-chip"
                    data-list-tone={example.tone}
                  >
                    <span>{example.icon}</span>
                    <span>{example.label}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {user ? (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[var(--coral)] to-[var(--neon-magenta)] text-[var(--void)] rounded-lg font-mono text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Your First List
            </button>
          ) : (
            <Link
              href={`/auth/login?redirect=/${portalSlug}?view=community`}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--coral)] text-[var(--void)] rounded-lg font-mono text-sm font-medium hover:bg-[var(--rose)] transition-colors"
            >
              Sign In to Create Lists
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {lists.map((list, index) => (
            <div
              key={list.id}
              style={{
                animation: `stagger-fade-in 0.4s ease-out ${Math.min(index * 0.06, 0.6)}s backwards`,
              }}
            >
              <ListCard list={list} portalSlug={portalSlug} />
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreateModal && (
        <ListCreateModal
          portalId={portalId}
          portalSlug={portalSlug}
          onClose={() => setShowCreateModal(false)}
          onCreated={handleListCreated}
        />
      )}
    </div>
  );
}
