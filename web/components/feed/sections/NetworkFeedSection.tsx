"use client";

/**
 * NetworkFeedSection — condensed 5-post teaser from independent Atlanta
 * publications. Links to the full /[portal]/network page for filters,
 * load-more, and the source directory.
 *
 * Shared pieces (NetworkPost, NetworkPostCard, PostSkeleton, category
 * config, timeAgo) are exported for reuse by NetworkFeedPage.
 */

import { useState, useEffect } from "react";
import Link from "next/link";
// Using <img> instead of next/image — RSS thumbnails come from arbitrary
// external domains that can't all be added to next.config.js remotePatterns.
import {
  Broadcast,
  ArrowRight,
  ArrowSquareOut,
  Clock,
  Newspaper,
  PaintBrush,
  ForkKnife,
  MusicNote,
  UsersThree,
  BookOpen,
  Megaphone,
  Scales,
} from "@phosphor-icons/react";
import Dot from "@/components/ui/Dot";
import FeedSectionHeader from "@/components/feed/FeedSectionHeader";


// ── Types ───────────────────────────────────────────────────────────

export interface NetworkPost {
  id: number;
  title: string;
  url: string;
  summary: string | null;
  author: string | null;
  image_url: string | null;
  published_at: string | null;
  categories?: string[];
  source: {
    name: string;
    slug: string;
    website_url: string | null;
    categories: string[];
  };
}

interface NetworkFeedSectionProps {
  portalSlug: string;
  posts?: NetworkPost[];
  isLoading?: boolean;
  /** Override section accent color (default: var(--neon-cyan)). */
  accentColor?: string;
  /** Override section title (default: "Local News"). */
  sectionTitle?: string;
  /**
   * When provided, only show category filter tabs whose id is in this list.
   * The "All" tab always appears first regardless of this setting.
   * When undefined, all categories are shown (default behavior).
   */
  visibleCategories?: string[];
  /** When provided, fetch this category first instead of "all". */
  defaultCategory?: string;
  /** Limit feed to local or parent source pools when needed. */
  sourceScope?: "all" | "local" | "parent";
}

// ── Category config ─────────────────────────────────────────────────

export const CATEGORY_COLORS: Record<string, string> = {
  news: "#00D4E8",
  arts: "#C4B5FD",
  food: "#FDBA74",
  music: "#F9A8D4",
  community: "#00D9A0",
  literary: "#FFD93D",
  investigative: "#FF6B7A",
  civic: "#7DD3FC",
  activism: "#E855A0",
  culture: "#C4B5FD",
  events: "#FFD93D",
  neighborhoods: "#00D9A0",
  politics: "#7DD3FC",
  restaurants: "#FDBA74",
};

export const CATEGORY_ICONS: Record<string, typeof Newspaper> = {
  news: Newspaper,
  culture: BookOpen,
  arts: PaintBrush,
  food: ForkKnife,
  music: MusicNote,
  community: UsersThree,
  civic: Scales,
  politics: Megaphone,
};

export const FILTER_CATEGORIES = [
  { id: "all", label: "All" },
  { id: "news", label: "News" },
  { id: "culture", label: "Culture" },
  { id: "arts", label: "Arts" },
  { id: "food", label: "Food" },
  { id: "music", label: "Music" },
  { id: "community", label: "Community" },
  { id: "civic", label: "Civic" },
  { id: "politics", label: "Politics" },
];

export function getCategoryColor(categories: string[] | undefined | null): string {
  if (!categories) return "#00D4E8";
  for (const cat of categories) {
    if (CATEGORY_COLORS[cat]) return CATEGORY_COLORS[cat];
  }
  return "#00D4E8"; // default: neon-cyan
}

// ── Time formatting ─────────────────────────────────────────────────

export function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)}w ago`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// ── Skeleton loader ─────────────────────────────────────────────────

export function PostSkeleton() {
  return (
    <div className="flex gap-3 px-3.5 py-3 animate-pulse">
      <div className="flex-1 min-w-0 space-y-2">
        <div className="h-3 w-24 rounded bg-[var(--twilight)]/40" />
        <div className="h-4 w-full rounded bg-[var(--twilight)]/50" />
        <div className="h-3.5 w-3/4 rounded bg-[var(--twilight)]/35" />
        <div className="h-3 w-32 rounded bg-[var(--twilight)]/30" />
      </div>
      <div className="w-16 h-16 rounded-lg bg-[var(--twilight)]/40 shrink-0" />
    </div>
  );
}

// ── Post card ───────────────────────────────────────────────────────

export function NetworkPostCard({
  post,
  isLast,
  compact,
}: {
  post: NetworkPost;
  isLast: boolean;
  compact?: boolean;
}) {
  const cats = post.categories ?? post.source?.categories ?? [];
  const accentColor = getCategoryColor(cats);
  const primaryCategory = cats[0] || "news";
  const CategoryIcon = CATEGORY_ICONS[primaryCategory] || Newspaper;

  return (
    <a
      href={post.url}
      target="_blank"
      rel="noopener noreferrer"
      className={[
        "group flex gap-3 px-3.5 transition-all duration-200",
        "hover:bg-white/[0.025]",
        "border-l-2",
        compact ? "py-2" : "py-3",
        !isLast && "border-b border-[var(--twilight)]/30",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        borderLeftColor: accentColor,
      }}
    >
      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Source + meta header */}
        <div className="flex items-center gap-1.5 mb-0.5">
          <CategoryIcon
            weight="bold"
            className="w-2.5 h-2.5 shrink-0"
            style={{ color: accentColor }}
          />
          <span
            className="font-mono text-2xs font-semibold tracking-[0.1em] uppercase truncate"
            style={{ color: accentColor }}
          >
            {post.source.name}
          </span>
          {/* In compact mode, author + time sit on the header line */}
          {compact && (post.author || post.published_at) && (
            <>
              <Dot className="text-[var(--muted)] text-2xs" />
              {post.author && (
                <span className="text-2xs text-[var(--muted)] truncate max-w-[100px]">
                  {post.author}
                </span>
              )}
              {post.published_at && (
                <span className="flex items-center gap-0.5 text-2xs text-[var(--muted)] shrink-0">
                  <Clock weight="bold" className="w-2 h-2" />
                  {timeAgo(post.published_at)}
                </span>
              )}
            </>
          )}
          <ArrowSquareOut
            weight="bold"
            className="w-2.5 h-2.5 shrink-0 opacity-0 group-hover:opacity-60 transition-opacity text-[var(--muted)] ml-auto"
          />
        </div>

        {/* Title */}
        <h4 className="text-sm font-medium leading-snug text-[var(--cream)] line-clamp-2 group-hover:text-white transition-colors">
          {post.title}
        </h4>

        {/* Summary (hidden in compact mode) */}
        {!compact && post.summary && (
          <p className="text-xs leading-relaxed text-[var(--muted)] line-clamp-2 mt-0.5">
            {post.summary}
          </p>
        )}

        {/* Meta: author + time (hidden in compact mode — shown in header instead) */}
        {!compact && (
          <div className="flex items-center gap-1.5 mt-1.5">
            {post.author && (
              <>
                <span className="text-2xs text-[var(--soft)] truncate max-w-[140px]">
                  {post.author}
                </span>
                <Dot className="text-[var(--muted)] text-2xs" />
              </>
            )}
            {post.published_at && (
              <span className="flex items-center gap-0.5 text-2xs text-[var(--muted)] shrink-0">
                <Clock weight="bold" className="w-2.5 h-2.5" />
                {timeAgo(post.published_at)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Thumbnail (hidden in compact mode) */}
      {!compact && post.image_url && (
        <div className="relative w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-lg overflow-hidden shrink-0 self-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.image_url}
            alt=""
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          {/* Subtle border overlay */}
          <div className="absolute inset-0 rounded-lg ring-1 ring-inset ring-white/[0.06]" />
        </div>
      )}
    </a>
  );
}

// ── Main section ────────────────────────────────────────────────────

export default function NetworkFeedSection({
  portalSlug,
  posts: postsProp,
  isLoading: isLoadingProp,
  accentColor: accentColorProp,
  sectionTitle = "Local News",
  visibleCategories,
  defaultCategory = "all",
  sourceScope = "all",
}: NetworkFeedSectionProps) {
  const sectionAccent = accentColorProp || "var(--neon-cyan)";

  // Derive the visible filter tabs. "All" always leads; remaining tabs are
  // either the full default set or narrowed by the visibleCategories prop.
  const visibleFilterCategories =
    visibleCategories === undefined
      ? FILTER_CATEGORIES
      : [
          FILTER_CATEGORIES[0], // "All" tab — always first
          ...FILTER_CATEGORIES.slice(1).filter((cat) =>
            visibleCategories.includes(cat.id)
          ),
        ];
  const initialFilter =
    defaultCategory !== "all" &&
    visibleFilterCategories.some((cat) => cat.id === defaultCategory)
      ? defaultCategory
      : "all";
  const [filter, setFilter] = useState(initialFilter);
  const [fetchedPosts, setFetchedPosts] = useState<NetworkPost[] | null>(null);
  const [isFetching, setIsFetching] = useState(postsProp === undefined);

  // Initial fetch when no posts prop is provided
  useEffect(() => {
    if (postsProp !== undefined) return;

    let cancelled = false;

    const params = new URLSearchParams({ limit: "3" });
    if (initialFilter !== "all") params.set("category", initialFilter);
    if (sourceScope !== "all") params.set("source_scope", sourceScope);

    fetch(`/api/portals/${portalSlug}/network-feed?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setFetchedPosts(data.posts ?? []);
      })
      .catch(() => {
        if (!cancelled) setFetchedPosts([]);
      })
      .finally(() => {
        if (!cancelled) setIsFetching(false);
      });

    return () => { cancelled = true; };
  }, [initialFilter, portalSlug, postsProp, sourceScope]);

  const handleFilterChange = (category: string) => {
    if (category === filter || postsProp !== undefined) return;
    setFilter(category);
    setIsFetching(true);

    const params = new URLSearchParams({ limit: "3" });
    if (category !== "all") params.set("category", category);
    if (sourceScope !== "all") params.set("source_scope", sourceScope);

    fetch(`/api/portals/${portalSlug}/network-feed?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => setFetchedPosts(data.posts ?? []))
      .catch(() => setFetchedPosts([]))
      .finally(() => setIsFetching(false));
  };

  const posts = postsProp ?? fetchedPosts;
  const isLoading = isLoadingProp ?? isFetching;

  if (!isLoading && (!posts || posts.length === 0)) return null;

  return (
    <section>
      {/* Section header */}
      <FeedSectionHeader
        title={sectionTitle}
        priority="secondary"
        accentColor={sectionAccent}
        icon={<Broadcast weight="duotone" className="w-5 h-5" />}
        seeAllHref={`/${portalSlug}/network`}
      />

      {/* Category filter pills */}
      <div className="flex items-center gap-1.5 mb-3 overflow-x-auto scrollbar-none -mx-1 px-1">
        {visibleFilterCategories.map((cat) => {
          const isActive = filter === cat.id;
          const color =
            cat.id === "all" ? "#00D4E8" : CATEGORY_COLORS[cat.id] || "#00D4E8";
          return (
            <button
              key={cat.id}
              onClick={() => handleFilterChange(cat.id)}
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

      {/* Posts list */}
      <div className="rounded-xl overflow-hidden border border-[var(--twilight)]/40 bg-[var(--night)]">
        {isLoading ? (
          <div className="p-5 space-y-4" style={{ minHeight: 280 }} role="status">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-4">
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-1/3 rounded skeleton-shimmer" style={{ opacity: 0.2, animationDelay: `${i * 80}ms` }} />
                  <div className="h-4 w-3/4 rounded skeleton-shimmer" style={{ opacity: 0.15, animationDelay: `${i * 80 + 40}ms` }} />
                  <div className="h-3 w-full rounded skeleton-shimmer" style={{ opacity: 0.1, animationDelay: `${i * 80 + 80}ms` }} />
                </div>
                <div className="shrink-0 w-20 h-16 rounded-lg skeleton-shimmer" style={{ opacity: 0.12, animationDelay: `${i * 80}ms` }} />
              </div>
            ))}
            <span className="sr-only">Loading news…</span>
          </div>
        ) : posts && posts.length > 0 ? (
          posts.map((post, index) => (
            <NetworkPostCard
              key={post.id}
              post={post}
              isLast={index === posts.length - 1}
            />
          ))
        ) : (
          <div className="px-4 py-8 text-center">
            <p className="text-xs text-[var(--muted)]">
              No posts in this category yet
            </p>
          </div>
        )}
      </div>

      {/* Footer: explore the network */}
      <Link
        href={`/${portalSlug}/network`}
        className="group flex items-center justify-center gap-2 mt-3 py-2.5 rounded-xl border border-[var(--twilight)]/30 bg-[var(--night)]/50 transition-all hover:border-[var(--neon-cyan)]/20 hover:bg-[var(--neon-cyan)]/[0.03]"
      >
        <Broadcast weight="bold" className="w-3.5 h-3.5 text-[var(--neon-cyan)]/60 group-hover:text-[var(--neon-cyan)] transition-colors" />
        <span className="font-mono text-2xs font-medium tracking-[0.08em] uppercase text-[var(--soft)] group-hover:text-[var(--neon-cyan)] transition-colors">
          Explore the Network
        </span>
        <ArrowRight className="w-3 h-3 text-[var(--muted)] group-hover:text-[var(--neon-cyan)] group-hover:translate-x-0.5 transition-all" />
      </Link>
    </section>
  );
}
