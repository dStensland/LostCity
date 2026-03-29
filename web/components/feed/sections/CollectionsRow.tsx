"use client";

/**
 * CollectionsRow — Horizontal scroll of collection cards for the CityPulse browse section.
 *
 * Self-fetches from `/api/portals/[slug]/collections` and renders data-driven bundles
 * (Free This Weekend, Date Night, New in City, etc.) with counts and linked URLs.
 *
 * Returns null if no collections (empty result or fetch fails).
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import FeedSectionHeader from "@/components/feed/FeedSectionHeader";

// ──────────────────────────────────────────────────────────────────────────────

interface Collection {
  title: string;
  count: number;
  slug: string;
  categories: string[];
  href: string;
}

interface CollectionsResponse {
  collections: Collection[];
}

interface CollectionsRowProps {
  portalSlug: string;
}

// Accent color per collection slug for left-border visual distinction
function getCollectionAccent(slug: string): string {
  if (slug.startsWith("free")) return "var(--neon-green)";
  if (slug.includes("closing")) return "var(--neon-red)";
  if (slug.startsWith("new-in")) return "var(--gold)";
  if (slug.includes("date")) return "var(--coral)";
  if (slug.includes("family") || slug.includes("kid")) return "var(--vibe)";
  if (slug.includes("outdoor") || slug.includes("park")) return "var(--neon-cyan)";
  // Default accent
  return "var(--twilight)";
}

// ──────────────────────────────────────────────────────────────────────────────

export function CollectionsRow({ portalSlug }: CollectionsRowProps) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    fetch(`/api/portals/${portalSlug}/collections`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: CollectionsResponse) => {
        if (controller.signal.aborted) return;
        setCollections(data.collections || []);
        setLoading(false);
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return;
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => { clearTimeout(timeoutId); controller.abort(); };
  }, [portalSlug]);

  // Skeleton loading state
  if (loading) {
    return (
      <section className="space-y-2 pb-2">
        <div className="px-4">
          <FeedSectionHeader title="Collections" priority="tertiary" accentColor="var(--gold)" />
        </div>
        <div className="px-4 space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 rounded-lg bg-[var(--cream)]/[0.03] animate-pulse" />
          ))}
        </div>
      </section>
    );
  }

  if (collections.length === 0) return null;

  return (
    <section className="space-y-2 pb-2">
      {/* Section header */}
      <div className="px-4">
        <FeedSectionHeader title="Collections" priority="tertiary" accentColor="var(--gold)" />
      </div>

      {/* Horizontal scroll container */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4">
        {collections.map((collection) => (
          <Link
            key={collection.slug}
            href={collection.href}
            className="flex-shrink-0 min-w-[180px] rounded-lg border border-[var(--twilight)]/60 border-l-2 bg-[var(--night)] px-3.5 py-2.5 transition-all hover:border-[var(--twilight)] hover:bg-[var(--dusk)]"
            style={{ borderLeftColor: getCollectionAccent(collection.slug) }}
          >
            {/* Title */}
            <h3 className="text-sm font-medium text-[var(--cream)] truncate">
              {collection.title}
            </h3>

            {/* Subtitle: count + categories */}
            <p className="text-xs text-[var(--muted)] mt-0.5 truncate">
              {collection.count} {collection.count === 1 ? "event" : "events"} · {collection.categories.join(", ")}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
