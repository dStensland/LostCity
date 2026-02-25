"use client";

/**
 * NetworkFeedPage — full-page network feed with filters, load more,
 * and a source directory. Used by /[portal]/network route.
 */

import { useState, useEffect, useCallback } from "react";
import {
  Broadcast,
  ArrowSquareOut,
  Newspaper,
  SpinnerGap,
} from "@phosphor-icons/react";
import {
  type NetworkPost,
  NetworkPostCard,
  PostSkeleton,
  FILTER_CATEGORIES,
  CATEGORY_COLORS,
  getCategoryColor,
} from "./NetworkFeedSection";

// ── Types ───────────────────────────────────────────────────────────

interface NetworkSource {
  name: string;
  slug: string;
  website_url: string | null;
  description: string | null;
  categories: string[];
}

interface NetworkFeedPageProps {
  portalSlug: string;
}

const PAGE_SIZE = 20;

// ── Main component ──────────────────────────────────────────────────

export default function NetworkFeedPage({ portalSlug }: NetworkFeedPageProps) {
  const [posts, setPosts] = useState<NetworkPost[]>([]);
  const [sources, setSources] = useState<NetworkSource[]>([]);
  const [filter, setFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);

  // Fetch posts (initial or paginated)
  const fetchPosts = useCallback(
    async (newOffset: number, category: string, append: boolean) => {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(newOffset),
      });
      if (category !== "all") params.set("category", category);
      // Include sources only on the initial load
      if (newOffset === 0) params.set("include_sources", "true");

      const res = await fetch(
        `/api/portals/${portalSlug}/network-feed?${params}`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      setPosts((prev) => (append ? [...prev, ...data.posts] : data.posts));
      setHasMore(data.has_more ?? false);
      setOffset(newOffset + (data.posts?.length ?? 0));

      if (data.sources) {
        setSources(data.sources);
      }
    },
    [portalSlug],
  );

  // Initial fetch
  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    fetchPosts(0, filter, false)
      .catch(() => {
        if (!cancelled) {
          setPosts([]);
          setHasMore(false);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter change — reset and re-fetch
  const handleFilterChange = (category: string) => {
    if (category === filter) return;
    setFilter(category);
    setIsLoading(true);
    setPosts([]);
    setOffset(0);
    fetchPosts(0, category, false)
      .catch(() => {
        setPosts([]);
        setHasMore(false);
      })
      .finally(() => setIsLoading(false));
  };

  // Load more
  const handleLoadMore = async () => {
    setIsLoadingMore(true);
    try {
      await fetchPosts(offset, filter, true);
    } catch {
      // silently fail
    } finally {
      setIsLoadingMore(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2.5 mb-2">
          <div className="relative">
            <Broadcast
              weight="bold"
              className="w-5 h-5 text-[var(--neon-cyan)]"
            />
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[var(--neon-cyan)] animate-ping opacity-75" />
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[var(--neon-cyan)]" />
          </div>
          <h1 className="font-mono text-sm font-bold tracking-[0.1em] uppercase text-[var(--neon-cyan)]">
            The Network
          </h1>
        </div>
        <p className="text-sm text-[var(--muted)] leading-relaxed">
          Independent Atlanta — curated from the city&apos;s indie publications
          and voices.
        </p>
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none -mx-1 px-1">
        {FILTER_CATEGORIES.map((cat) => {
          const isActive = filter === cat.id;
          const color =
            cat.id === "all" ? "#00D4E8" : CATEGORY_COLORS[cat.id] || "#00D4E8";
          return (
            <button
              key={cat.id}
              onClick={() => handleFilterChange(cat.id)}
              className={[
                "shrink-0 px-3 py-1.5 rounded-full font-mono text-2xs font-medium tracking-wide transition-all whitespace-nowrap",
                isActive
                  ? "border"
                  : "text-[var(--muted)] hover:text-[var(--soft)] border border-transparent hover:border-[var(--twilight)]/40",
              ]
                .filter(Boolean)
                .join(" ")}
              style={
                isActive
                  ? {
                      color: color,
                      backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
                      borderColor: `color-mix(in srgb, ${color} 30%, transparent)`,
                    }
                  : undefined
              }
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Posts list */}
      <div className="rounded-xl overflow-hidden border border-[var(--twilight)]/40 bg-[var(--night)]">
        {isLoading ? (
          <>
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className={i > 0 ? "border-t border-[var(--twilight)]/30" : ""}
              >
                <PostSkeleton />
              </div>
            ))}
          </>
        ) : posts.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <Newspaper
              weight="light"
              className="w-8 h-8 mx-auto mb-3 text-[var(--muted)]"
            />
            <p className="text-sm text-[var(--muted)]">
              No posts found{filter !== "all" ? ` in "${filter}"` : ""}
            </p>
          </div>
        ) : (
          posts.map((post, index) => (
            <NetworkPostCard
              key={post.id}
              post={post}
              isLast={index === posts.length - 1 && !hasMore}
            />
          ))
        )}
      </div>

      {/* Load more */}
      {hasMore && !isLoading && (
        <div className="flex justify-center">
          <button
            onClick={handleLoadMore}
            disabled={isLoadingMore}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[var(--twilight)]/40 bg-[var(--night)]/50 font-mono text-xs font-medium tracking-wide text-[var(--soft)] transition-all hover:border-[var(--neon-cyan)]/20 hover:text-[var(--neon-cyan)] hover:bg-[var(--neon-cyan)]/[0.03] disabled:opacity-50"
          >
            {isLoadingMore ? (
              <>
                <SpinnerGap
                  weight="bold"
                  className="w-3.5 h-3.5 animate-spin"
                />
                Loading…
              </>
            ) : (
              "Load more"
            )}
          </button>
        </div>
      )}

      {/* Source directory */}
      {sources.length > 0 && (
        <div>
          <h2 className="font-mono text-xs font-bold tracking-[0.12em] uppercase text-[var(--soft)] mb-4">
            Source Directory
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {sources.map((source) => {
              const color = getCategoryColor(source.categories);
              return (
                <a
                  key={source.slug}
                  href={source.website_url || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex flex-col gap-2 p-4 rounded-xl border border-[var(--twilight)]/40 bg-[var(--night)] transition-all hover:border-[var(--twilight)]/60 hover:bg-white/[0.015]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3
                      className="font-mono text-xs font-semibold tracking-wide truncate"
                      style={{ color }}
                    >
                      {source.name}
                    </h3>
                    <ArrowSquareOut
                      weight="bold"
                      className="w-3 h-3 shrink-0 text-[var(--muted)] opacity-0 group-hover:opacity-60 transition-opacity"
                    />
                  </div>
                  {source.description && (
                    <p className="text-xs leading-relaxed text-[var(--muted)] line-clamp-2">
                      {source.description}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1 mt-auto">
                    {source.categories.map((cat) => (
                      <span
                        key={cat}
                        className="px-1.5 py-0.5 rounded font-mono text-2xs tracking-wide uppercase"
                        style={{
                          color: CATEGORY_COLORS[cat] || "#00D4E8",
                          backgroundColor: `color-mix(in srgb, ${CATEGORY_COLORS[cat] || "#00D4E8"} 10%, transparent)`,
                        }}
                      >
                        {cat}
                      </span>
                    ))}
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
