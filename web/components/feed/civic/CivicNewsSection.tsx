"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Scales, Clock, ArrowRight, ArrowSquareOut } from "@phosphor-icons/react";
import FeedSectionHeader from "@/components/feed/FeedSectionHeader";
import { type NetworkPost, timeAgo } from "@/components/feed/sections/NetworkFeedSection";

// ── Types ─────────────────────────────────────────────────────────────

interface CivicNewsSectionProps {
  portalSlug: string;
}

// ── Skeleton loader ───────────────────────────────────────────────────

function CivicPostSkeleton() {
  return (
    <div className="p-4 rounded-xl border border-[var(--twilight)]/40 bg-[var(--night)] animate-pulse space-y-2">
      <div className="h-3 w-24 rounded bg-[var(--twilight)]/40" />
      <div className="h-4 w-full rounded bg-[var(--twilight)]/50" />
      <div className="h-3.5 w-3/4 rounded bg-[var(--twilight)]/35" />
      <div className="h-3 w-20 rounded bg-[var(--twilight)]/30" />
    </div>
  );
}

// ── Article card ──────────────────────────────────────────────────────

function CivicArticleCard({ post }: { post: NetworkPost }) {
  return (
    <a
      href={post.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col gap-1.5 p-4 rounded-xl border border-[var(--twilight)]/40 bg-[var(--night)] transition-all hover:border-[var(--action-primary)]/30 hover:bg-[var(--action-primary)]/[0.03]"
    >
      {/* Source + timestamp */}
      <div className="flex items-center gap-1.5">
        {post.source?.name && (
          <span className="font-mono text-2xs font-semibold tracking-[0.1em] uppercase text-[var(--action-primary)] truncate">
            {post.source.name}
          </span>
        )}
        {post.published_at && (
          <>
            <span className="text-[var(--muted)] text-2xs">·</span>
            <span className="flex items-center gap-0.5 text-2xs text-[var(--muted)] shrink-0">
              <Clock weight="bold" className="w-2 h-2" />
              {timeAgo(post.published_at)}
            </span>
          </>
        )}
        <ArrowSquareOut
          weight="bold"
          className="w-2.5 h-2.5 shrink-0 ml-auto opacity-0 group-hover:opacity-50 transition-opacity text-[var(--muted)]"
        />
      </div>

      {/* Headline */}
      <h4 className="text-sm font-semibold leading-snug text-[var(--cream)] line-clamp-2 group-hover:text-white transition-colors">
        {post.title}
      </h4>

      {/* 1-line summary */}
      {post.summary && (
        <p className="text-xs leading-relaxed text-[var(--muted)] line-clamp-1">
          {post.summary}
        </p>
      )}
    </a>
  );
}

// ── Main section ──────────────────────────────────────────────────────

export function CivicNewsSection({ portalSlug }: CivicNewsSectionProps) {
  const [posts, setPosts] = useState<NetworkPost[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const params = new URLSearchParams({ civic_filter: "true", limit: "6" });

    fetch(`/api/portals/${portalSlug}/network-feed?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setPosts(data.posts ?? []);
      })
      .catch(() => {
        if (!cancelled) setPosts([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [portalSlug]);

  // Suppression rule: render nothing if fewer than 3 articles or fetch errored
  if (!isLoading && (!posts || posts.length < 3)) return null;

  return (
    <section className="space-y-4">
      <FeedSectionHeader
        title="Civic News"
        priority="secondary"
        accentColor="var(--action-primary)"
        icon={<Scales weight="duotone" className="w-5 h-5" />}
        seeAllHref={`/${portalSlug}/network`}
        seeAllLabel="See all"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {isLoading
          ? [1, 2, 3, 4].map((i) => <CivicPostSkeleton key={i} />)
          : posts!.map((post) => <CivicArticleCard key={post.id} post={post} />)}
      </div>

      <Link
        href={`/${portalSlug}/network`}
        className="group flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[var(--twilight)]/30 bg-[var(--night)]/50 transition-all hover:border-[var(--action-primary)]/20 hover:bg-[var(--action-primary)]/[0.03]"
      >
        <Scales
          weight="bold"
          className="w-3.5 h-3.5 text-[var(--action-primary)]/60 group-hover:text-[var(--action-primary)] transition-colors"
        />
        <span className="font-mono text-2xs font-medium tracking-[0.08em] uppercase text-[var(--soft)] group-hover:text-[var(--action-primary)] transition-colors">
          More civic news
        </span>
        <ArrowRight className="w-3 h-3 text-[var(--muted)] group-hover:text-[var(--action-primary)] group-hover:translate-x-0.5 transition-all" />
      </Link>
    </section>
  );
}

export type { CivicNewsSectionProps };
