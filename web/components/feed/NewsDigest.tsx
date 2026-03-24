"use client";

/**
 * NewsDigest — compact 3-headline briefing zone component.
 *
 * Fetches from /api/portals/[slug]/network-feed with server-side category
 * filtering and title deduplication. Returns null when no headlines found.
 *
 * Intended to sit inside CityBriefing, ~120-130px total height.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import type { NetworkPost } from "./sections/NetworkFeedSection";

// ── Constants ─────────────────────────────────────────────────────────────────

const CULTURE_POSITIVE_PARAM = "culture,arts,food,music,community";

// ── Props ─────────────────────────────────────────────────────────────────────

export interface NewsDigestProps {
  portalSlug: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getPostCategories(post: NetworkPost): string[] {
  return post.categories ?? post.source?.categories ?? [];
}

const CULTURE_POSITIVE_SET = new Set(["culture", "arts", "food", "music", "community"]);

function formatCategory(cats: string[]): string {
  const match = cats.find((c) => CULTURE_POSITIVE_SET.has(c));
  if (!match) return "";
  return match.charAt(0).toUpperCase() + match.slice(1);
}

// ── Sub-component: single headline row ────────────────────────────────────────

function HeadlineRow({ post, isLast }: { post: NetworkPost; isLast: boolean }) {
  const cats = getPostCategories(post);
  const categoryLabel = formatCategory(cats);

  return (
    <a
      href={post.url}
      target="_blank"
      rel="noopener noreferrer"
      className={[
        "flex flex-col gap-0.5 py-2.5 transition-colors group",
        !isLast && "border-b border-[var(--twilight)]/30",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <p className="text-xs font-medium text-[var(--cream)] line-clamp-1 group-hover:underline underline-offset-2">
        {post.title}
      </p>
      <div className="flex items-center gap-1">
        {post.source?.name && (
          <span className="text-2xs text-[var(--muted)] truncate">{post.source.name}</span>
        )}
        {post.source?.name && categoryLabel && (
          <span className="text-2xs text-[var(--muted)]">·</span>
        )}
        {categoryLabel && (
          <span className="text-2xs text-[var(--muted)]">{categoryLabel}</span>
        )}
      </div>
    </a>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function NewsDigest({ portalSlug }: NewsDigestProps) {
  const [headlines, setHeadlines] = useState<NetworkPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    fetch(
      `/api/portals/${portalSlug}/network-feed?limit=3&categories=${CULTURE_POSITIVE_PARAM}`,
      { signal: controller.signal },
    )
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        if (controller.signal.aborted) return;
        setHeadlines((data.posts ?? []) as NetworkPost[]);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    return () => controller.abort();
  }, [portalSlug]);

  // Skeleton placeholder — reserves the same ~130px while loading
  if (loading) {
    return (
      <div className="px-5 py-3 border-b border-[var(--twilight)]">
        <div className="flex items-center justify-between mb-2">
          <div className="h-2.5 w-28 rounded skeleton-shimmer" style={{ opacity: 0.15 }} />
          <div className="h-2.5 w-16 rounded skeleton-shimmer" style={{ opacity: 0.1 }} />
        </div>
        <div className="space-y-0">
          {[0, 1, 2].map((i) => (
            <div key={i} className="py-2.5" style={i < 2 ? { borderBottom: "1px solid color-mix(in srgb, var(--twilight) 30%, transparent)" } : undefined}>
              <div className="h-3 rounded skeleton-shimmer mb-1" style={{ width: `${80 - i * 12}%`, opacity: 0.15, animationDelay: `${i * 0.08}s` }} />
              <div className="h-2 w-28 rounded skeleton-shimmer" style={{ opacity: 0.1 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (headlines.length === 0) return null;

  return (
    <div className="px-5 py-3 border-b border-[var(--twilight)] animate-fade-in">
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-2xs uppercase tracking-[1.2px] text-[var(--muted)]">
          Today in Atlanta
        </span>
        <Link
          href={`/${portalSlug}/network`}
          className="font-mono text-2xs uppercase tracking-[1.2px] text-[var(--muted)] hover:text-[var(--soft)] transition-colors"
        >
          All news →
        </Link>
      </div>

      {/* Headline rows */}
      <div>
        {headlines.map((post, i) => (
          <HeadlineRow
            key={post.id}
            post={post}
            isLast={i === headlines.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

export type { NewsDigestProps as NewsDigestComponentProps };
