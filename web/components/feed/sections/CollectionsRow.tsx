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

  // Return null if no collections or loading (we don't show a skeleton for this row)
  if (loading || collections.length === 0) return null;

  return (
    <section className="space-y-2 pb-2">
      {/* Section label */}
      <h2 className="text-2xs uppercase tracking-wider text-[var(--muted)] font-mono px-4">
        Collections
      </h2>

      {/* Horizontal scroll container */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4">
        {collections.map((collection) => (
          <Link
            key={collection.slug}
            href={collection.href}
            className="flex-shrink-0 min-w-[180px] rounded-lg border border-[var(--cream)]/[0.08] bg-[var(--cream)]/[0.04] px-3.5 py-2.5 transition-all hover:border-[var(--cream)]/[0.12] hover:bg-[var(--cream)]/[0.06]"
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
