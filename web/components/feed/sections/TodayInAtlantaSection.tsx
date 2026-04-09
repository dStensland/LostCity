"use client";

/**
 * TodayInAtlantaSection — tabbed category news browser.
 *
 * Compact section with category tabs (Culture, Arts, Food, etc.).
 * Each tab shows up to 3 stories. Stays near the top of the feed
 * without taking vertical space — user flips tabs to browse.
 *
 * Fetch: /api/portals/[slug]/network-feed?limit=60
 */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowRight,
  Broadcast,
} from "@phosphor-icons/react";
import Dot from "@/components/ui/Dot";
import FeedSectionHeader from "@/components/feed/FeedSectionHeader";
import SmartImage from "@/components/SmartImage";
import type { NetworkPost } from "./NetworkFeedSection";
import {
  getCategoryColor,
  CATEGORY_ICONS,
} from "./NetworkFeedSection";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TodayInAtlantaSectionProps {
  portalSlug: string;
}

// ── Category display order — culture-positive first ──────────────────────────

const CATEGORY_ORDER = [
  { id: "culture", label: "Culture" },
  { id: "arts", label: "Arts" },
  { id: "food", label: "Food & Drink" },
  { id: "music", label: "Music" },
  { id: "community", label: "Community" },
  { id: "civic", label: "Civic" },
  { id: "politics", label: "Politics" },
];

/** Max stories per tab */
const MAX_PER_TAB = 3;

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

// ── NewsRow — single post row ────────────────────────────────────────────────

function NewsRow({ post, isLast }: { post: NetworkPost; isLast: boolean }) {
  return (
    <a
      href={post.url}
      target="_blank"
      rel="noopener noreferrer"
      className={[
        "flex flex-col gap-0.5 py-2.5 transition-colors group",
        !isLast && "border-b border-[var(--twilight)]/20",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <p className="text-sm text-[var(--cream)] leading-snug line-clamp-2 group-hover:underline underline-offset-2">
        {post.title}
      </p>
      <div className="flex items-center gap-1.5 mt-0.5">
        {post.source?.name && (
          <span className="text-2xs text-[var(--soft)] font-medium truncate">{post.source.name}</span>
        )}
        {post.source?.name && <Dot className="text-[var(--muted)]" />}
        <span className="text-2xs text-[var(--muted)] flex-shrink-0">{timeAgo(post.published_at)}</span>
      </div>
    </a>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function TodayInAtlantaSection({ portalSlug }: TodayInAtlantaSectionProps) {
  const [activeTab, setActiveTab] = useState<string>("all");

  // ── Fetch via React Query — shares cache with CityPulseShell prefetch ─────
  const { data: rawPosts, isLoading: loading } = useQuery<NetworkPost[]>({
    queryKey: ["network-feed", portalSlug],
    queryFn: async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);
      try {
        const res = await fetch(
          `/api/portals/${portalSlug}/network-feed?limit=60`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error(`Network feed: ${res.status}`);
        const data = await res.json();
        const seenTitles = new Set<string>();
        return ((data.posts || []) as NetworkPost[]).filter((p) => {
          const norm = p.title.toLowerCase().trim();
          if (seenTitles.has(norm)) return false;
          seenTitles.add(norm);
          return true;
        });
      } finally {
        clearTimeout(timeoutId);
      }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
  const posts = rawPosts ?? [];

  // ── Build category buckets ─────────────────────────────────────────────────

  const tabs = useMemo(() => {
    const categoryTabs: { id: string; label: string; posts: NetworkPost[]; color: string }[] = [];

    for (const cat of CATEGORY_ORDER) {
      const matching = posts.filter((p) => {
        const cats = p.categories ?? p.source?.categories ?? [];
        return cats.includes(cat.id);
      });
      if (matching.length > 0) {
        categoryTabs.push({
          ...cat,
          posts: matching.slice(0, MAX_PER_TAB),
          color: getCategoryColor([cat.id]),
        });
      }
    }

    // Prepend "All" tab — 3 most recent regardless of category
    const allTab = {
      id: "all",
      label: "Latest",
      posts: posts.slice(0, MAX_PER_TAB),
      color: "#00D4E8",
    };

    return [allTab, ...categoryTabs];
  }, [posts]);

  // Default to "all"
  const effectiveTab = tabs.some((t) => t.id === activeTab) ? activeTab : "all";

  const activeGroup = tabs.find((t) => t.id === effectiveTab);

  // ── Guards ─────────────────────────────────────────────────────────────────

  if (loading) return null;
  if (tabs.length === 0) return null;

  return (
    <div className="mt-6 feed-section-enter">
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
          All news
          <ArrowRight weight="bold" className="w-2.5 h-2.5" />
        </Link>
      </div>

      {/* Category tabs */}
      <div className="flex items-center gap-1.5 mb-3 overflow-x-auto scrollbar-none -mx-1 px-1">
        {tabs.map((tab) => {
          const isActive = tab.id === effectiveTab;
          const CatIcon = tab.id === "all" ? Broadcast : (CATEGORY_ICONS[tab.id] || CATEGORY_ICONS.news);
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={[
                "shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full font-mono text-2xs font-medium tracking-wide transition-all whitespace-nowrap",
                isActive
                  ? "border"
                  : "text-[var(--muted)] hover:text-[var(--soft)] border border-transparent hover:border-[var(--twilight)]/40",
              ].join(" ")}
              style={
                isActive
                  ? {
                      color: tab.color,
                      backgroundColor: `color-mix(in srgb, ${tab.color} 12%, transparent)`,
                      borderColor: `color-mix(in srgb, ${tab.color} 30%, transparent)`,
                    }
                  : undefined
              }
            >
              <CatIcon weight="duotone" className="w-3 h-3" style={isActive ? { color: tab.color } : undefined} />
              {tab.label}
              <span
                className="text-2xs opacity-60"
              >
                {tab.posts.length}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active tab stories */}
      {activeGroup && (
        <div className="rounded-card bg-[var(--night)] border border-[var(--twilight)]/30 px-3 py-0.5">
          {activeGroup.posts.map((post, i) => (
            <NewsRow key={post.id} post={post} isLast={i === activeGroup.posts.length - 1} />
          ))}
        </div>
      )}
    </div>
  );
}
