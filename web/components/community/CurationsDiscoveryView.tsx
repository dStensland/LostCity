"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import ListCard from "./ListCard";
import ListCreateModal from "./ListCreateModal";
import type { Curation } from "@/lib/curation-utils";

interface CurationsDiscoveryViewProps {
  portalId: string;
  portalSlug: string;
}

type SortOption = "trending" | "newest" | "popular";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "trending", label: "Trending" },
  { value: "newest", label: "Newest" },
  { value: "popular", label: "Most Followed" },
];

export default function CurationsDiscoveryView({ portalId, portalSlug }: CurationsDiscoveryViewProps) {
  const { user } = useAuth();
  const [curations, setCurations] = useState<Curation[]>([]);
  const [featured, setFeatured] = useState<Curation[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortOption>("trending");
  const [activeVibeTag, setActiveVibeTag] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Collect all vibe tags from curations for filter bar
  const allVibeTags = [...new Set(curations.flatMap((c) => c.vibe_tags || []))].sort();

  useEffect(() => {
    async function fetchCurations() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          portal_slug: portalSlug,
          sort,
          limit: "30",
        });
        if (activeVibeTag) {
          params.set("vibe_tags", activeVibeTag);
        }

        const res = await fetch(`/api/curations/discover?${params}`);
        if (!res.ok) throw new Error("Failed to fetch");

        const data = await res.json();
        setCurations(data.curations || []);
        if (data.sections?.featured) {
          setFeatured(data.sections.featured);
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    }

    fetchCurations();
  }, [portalSlug, sort, activeVibeTag]);

  const handleListCreated = (newList: Curation) => {
    setCurations((prev) => [newList, ...prev]);
    setShowCreateModal(false);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif font-bold text-[var(--cream)]">Curations</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Thematic guides by locals who know the city
          </p>
        </div>
        {user ? (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--coral)] text-[var(--void)] rounded-lg font-mono text-xs font-medium hover:bg-[var(--rose)] transition-colors"
            aria-label="Create a new curation"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create
          </button>
        ) : (
          <Link
            href={`/auth/login?redirect=/${portalSlug}/curations`}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--twilight)] text-[var(--cream)] rounded-lg font-mono text-xs font-medium hover:bg-[var(--twilight)]/80 transition-colors"
          >
            Sign in to create
          </Link>
        )}
      </div>

      {/* Sort & Filter bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        {/* Sort tabs */}
        <div className="flex gap-1 bg-[var(--twilight)]/40 rounded-lg p-0.5" role="tablist" aria-label="Sort curations">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSort(opt.value)}
              role="tab"
              aria-selected={sort === opt.value}
              className={`px-3 py-1.5 rounded-md text-xs font-mono transition-colors ${
                sort === opt.value
                  ? "bg-[var(--coral)] text-[var(--void)]"
                  : "text-[var(--muted)] hover:text-[var(--cream)]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Vibe tag filter pills */}
        {allVibeTags.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide" role="group" aria-label="Filter by vibe">
            <button
              onClick={() => setActiveVibeTag(null)}
              aria-pressed={!activeVibeTag}
              className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-mono transition-colors ${
                !activeVibeTag
                  ? "bg-[var(--cream)] text-[var(--void)]"
                  : "bg-[var(--twilight)]/50 text-[var(--muted)] hover:text-[var(--cream)]"
              }`}
            >
              All
            </button>
            {allVibeTags.slice(0, 8).map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveVibeTag(activeVibeTag === tag ? null : tag)}
                aria-pressed={activeVibeTag === tag}
                className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-mono transition-colors ${
                  activeVibeTag === tag
                    ? "bg-[var(--coral)] text-[var(--void)]"
                    : "bg-[var(--twilight)]/50 text-[var(--muted)] hover:text-[var(--cream)]"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Featured editorial curations */}
      {featured.length > 0 && sort === "trending" && !activeVibeTag && (
        <div className="mb-10">
          {/* Section header with decorative line */}
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-lg bg-[var(--coral)]/15 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-[var(--coral)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-mono text-sm font-medium text-[var(--coral)] uppercase tracking-wider">
                Staff Picks
              </h3>
              <p className="text-xs text-[var(--muted)] mt-0.5">
                Curated by the team — open for your suggestions
              </p>
            </div>
            <div className="hidden sm:block flex-1 h-px bg-gradient-to-r from-[var(--coral)]/20 to-transparent" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {featured.map((list, index) => (
              <div
                key={list.id}
                style={{
                  animation: `stagger-fade-in 0.4s ease-out ${index * 0.1}s backwards`,
                }}
              >
                <ListCard list={list} portalSlug={portalSlug} featured />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section divider between featured and community */}
      {featured.length > 0 && sort === "trending" && !activeVibeTag && curations.length > 0 && !loading && (
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-[var(--twilight)]/50 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-mono text-sm font-medium text-[var(--muted)] uppercase tracking-wider">
              Community
            </h3>
          </div>
          <div className="hidden sm:block flex-1 h-px bg-gradient-to-r from-[var(--twilight)]/40 to-transparent" />
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-4">
          {/* Featured skeleton when on trending */}
          {sort === "trending" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              {[1, 2].map((i) => (
                <div key={`feat-${i}`} className="rounded-xl border border-[var(--twilight)] bg-[var(--card-bg)] overflow-hidden">
                  <div className="h-36 skeleton-shimmer" />
                  <div className="p-4 space-y-2">
                    <div className="h-5 w-2/3 skeleton-shimmer rounded" />
                    <div className="h-4 w-full skeleton-shimmer rounded" />
                    <div className="h-4 w-1/3 skeleton-shimmer rounded" />
                  </div>
                </div>
              ))}
            </div>
          )}
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-4 rounded-xl border border-[var(--twilight)] bg-[var(--card-bg)]">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg skeleton-shimmer" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 w-2/3 skeleton-shimmer rounded" />
                  <div className="h-4 w-1/2 skeleton-shimmer rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Curations list */}
      {!loading && curations.length > 0 && (
        <div className="space-y-3">
          {curations.map((list, index) => (
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

      {/* Empty state */}
      {!loading && curations.length === 0 && featured.length === 0 && (
        <div className="py-16 text-center">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-[var(--coral)]/20 to-[var(--neon-magenta)]/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-[var(--coral)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h3 className="font-serif text-xl text-[var(--cream)] mb-2">
            No curations yet
          </h3>
          <p className="text-sm text-[var(--soft)] mb-6 max-w-xs mx-auto">
            Be the first to create a curation for your community.
          </p>
          {user && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--coral)] text-[var(--void)] rounded-lg font-mono text-sm font-medium hover:bg-[var(--rose)] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create First Curation
            </button>
          )}
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
