"use client";

/**
 * TodayInAtlantaSection — standalone news module, self-fetching.
 *
 * Extracted from CityBriefing so it renders BELOW The Lineup rather than
 * inside the hero area. Default category is "culture" (not "all") so the
 * first thing users see is arts/culture/food, not crime.
 *
 * Fetch: /api/portals/[slug]/network-feed?limit=20
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Broadcast,
} from "@phosphor-icons/react";
import Dot from "@/components/ui/Dot";
import type { NetworkPost } from "./NetworkFeedSection";
import {
  getCategoryColor,
  CATEGORY_COLORS,
  CATEGORY_ICONS,
} from "./NetworkFeedSection";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TodayInAtlantaSectionProps {
  portalSlug: string;
  portalId?: string;
}

// ── Category tab config — culture-first order ─────────────────────────────────

const FILTER_CATEGORIES = [
  { id: "culture",   label: "Culture" },
  { id: "arts",      label: "Arts" },
  { id: "food",      label: "Food" },
  { id: "music",     label: "Music" },
  { id: "community", label: "Community" },
  { id: "all",       label: "All" },
];

// ── Utilities ─────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

// ── NewsRow — single post row ─────────────────────────────────────────────────

function NewsRow({ post, isLast }: { post: NetworkPost; isLast: boolean }) {
  const cats = post.categories ?? post.source?.categories ?? [];
  const catColor = getCategoryColor(cats);
  const CatIcon = CATEGORY_ICONS[cats[0] || "news"] || CATEGORY_ICONS.news;
  const catLabel = (cats[0] || "news").replace(/_/g, " ");

  return (
    <a
      href={post.url}
      target="_blank"
      rel="noopener noreferrer"
      className={[
        "flex items-start gap-3 py-3 px-2 transition-colors group",
        "hover:bg-[var(--dusk)]/40 rounded-lg",
        !isLast && "border-b border-[var(--twilight)]/20",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Category icon */}
      <div
        className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-0.5"
        style={{ backgroundColor: `${catColor}18` }}
      >
        <CatIcon weight="duotone" className="w-3.5 h-3.5" style={{ color: catColor }} />
      </div>

      {/* Headline + source */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--cream)] leading-snug line-clamp-2 group-hover:underline underline-offset-2">
          {post.title}
        </p>
        <div className="flex items-center gap-1.5 mt-1">
          {post.source?.name && (
            <span className="text-2xs text-[var(--soft)] font-medium truncate">{post.source.name}</span>
          )}
          {post.source?.name && <Dot className="text-[var(--muted)]" />}
          <span className="text-2xs text-[var(--muted)] flex-shrink-0">{timeAgo(post.published_at)}</span>
          {catLabel !== "news" && (
            <>
              <Dot className="text-[var(--muted)]" />
              <span
                className="text-2xs font-mono uppercase tracking-wider"
                style={{ color: catColor }}
              >
                {catLabel}
              </span>
            </>
          )}
        </div>
      </div>
    </a>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function TodayInAtlantaSection({ portalSlug }: TodayInAtlantaSectionProps) {
  const [posts, setPosts] = useState<NetworkPost[]>([]);
  const [loading, setLoading] = useState(true);

  // Default to "culture" — positive/aspirational first, "All" (crime-inclusive) last
  const [activeCategory, setActiveCategory] = useState("culture");

  // ── Fetch ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/portals/${portalSlug}/network-feed?limit=20`, {
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        if (controller.signal.aborted) return;
        // Deduplicate by title
        const seenTitles = new Set<string>();
        const deduped = ((data.posts || []) as NetworkPost[]).filter((p) => {
          const norm = p.title.toLowerCase().trim();
          if (seenTitles.has(norm)) return false;
          seenTitles.add(norm);
          return true;
        });
        setPosts(deduped);
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [portalSlug]);

  // ── Derived state ─────────────────────────────────────────────────────────

  // Which categories actually have posts in this batch?
  const availableCategories = useMemo(() => {
    const catSet = new Set<string>();
    for (const post of posts) {
      const cats = post.categories ?? post.source?.categories ?? [];
      for (const c of cats) catSet.add(c);
    }
    // "all" is always available; other tabs only if they have content
    return FILTER_CATEGORIES.filter(
      (cat) => cat.id === "all" || catSet.has(cat.id),
    );
  }, [posts]);

  const filteredPosts = useMemo(() => {
    if (activeCategory === "all") return posts;
    return posts.filter((p) => {
      const cats = p.categories ?? p.source?.categories ?? [];
      return cats.includes(activeCategory);
    });
  }, [posts, activeCategory]);

  const displayPosts = filteredPosts.slice(0, 3);

  // ── Loading / empty guards ────────────────────────────────────────────────

  // While loading, return null — LazySection holds space with minHeight
  if (loading) return null;
  if (posts.length === 0) return null;

  return (
    <div className="mt-4 feed-section-enter">
      {/* Section header */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5">
          <Broadcast weight="duotone" className="w-3.5 h-3.5 text-[var(--neon-cyan)]" />
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--neon-cyan)]">
            Today in Atlanta
          </span>
        </div>
        <Link
          href={`/${portalSlug}/network`}
          className="flex items-center gap-0.5 text-xs font-mono text-[var(--neon-cyan)] opacity-70 hover:opacity-100 transition-opacity"
        >
          All local news
          <ArrowRight weight="bold" className="w-2.5 h-2.5" />
        </Link>
      </div>

      {/* Category filter pills — only render when there are enough tabs */}
      {availableCategories.length > 1 && (
        <div className="flex items-center gap-1.5 mb-3 overflow-x-auto scrollbar-none -mx-1 px-1">
          {availableCategories.map((cat) => {
            const isActive = activeCategory === cat.id;
            const color =
              cat.id === "all" ? "#00D4E8" : CATEGORY_COLORS[cat.id] || "#00D4E8";
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={[
                  "shrink-0 px-2.5 py-1 rounded-full font-mono text-2xs font-medium tracking-wide transition-all whitespace-nowrap",
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
      )}

      {/* Posts list */}
      <div className="rounded-card bg-[var(--night)] border border-[var(--twilight)]/30 px-3 py-1">
        {displayPosts.length > 0 ? (
          displayPosts.map((post, i) => (
            <NewsRow key={post.id} post={post} isLast={i === displayPosts.length - 1} />
          ))
        ) : (
          <p className="py-4 text-center text-sm text-[var(--muted)]">
            No stories in this category
          </p>
        )}
      </div>
    </div>
  );
}
