"use client";

import { useState } from "react";
import { ArrowSquareOut } from "@phosphor-icons/react";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

export type EditorialMention = {
  id: number;
  source_key: string;
  article_url: string;
  article_title: string;
  mention_type: string;
  published_at: string | null;
  guide_name: string | null;
  snippet: string | null;
};

export const EDITORIAL_SOURCE_LABELS: Record<string, string> = {
  eater_atlanta: "Eater Atlanta",
  infatuation_atlanta: "The Infatuation",
  rough_draft_atlanta: "Rough Draft Atlanta",
  atlanta_eats: "Atlanta Eats",
  atlanta_magazine: "Atlanta Magazine",
  thrillist_atlanta: "Thrillist",
  whatnow_atlanta: "What Now Atlanta",
  axios_atlanta: "Axios Atlanta",
  atl_bucket_list: "ATL Bucket List",
  atlas_obscura: "Atlas Obscura",
  atlanta_trails: "Atlanta Trails",
  explore_georgia: "Explore Georgia",
};

const MENTION_TYPE_WEIGHT: Record<string, number> = {
  best_of: 0,
  guide_inclusion: 1,
  review: 2,
  opening: 3,
  feature: 4,
};

const MAX_VISIBLE = 3;

export function getEditorialSourceLabel(sourceKey: string): string {
  return EDITORIAL_SOURCE_LABELS[sourceKey] || sourceKey;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AccoladesSection({
  mentions,
  title = "Featured In",
}: {
  mentions: EditorialMention[];
  title?: string;
}) {
  const [showAll, setShowAll] = useState(false);

  const sorted = [...mentions].sort(
    (a, b) =>
      (MENTION_TYPE_WEIGHT[a.mention_type] ?? 5) -
      (MENTION_TYPE_WEIGHT[b.mention_type] ?? 5)
  );

  const visible = showAll ? sorted : sorted.slice(0, MAX_VISIBLE);
  const hasMore = sorted.length > MAX_VISIBLE;

  return (
    <div>
      <div className="space-y-2">
        {visible.map((m) => {
          const sourceLabel = getEditorialSourceLabel(m.source_key);
          const mainText = m.guide_name || m.article_title;

          return (
            <a
              key={m.id}
              href={m.article_url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start gap-3 p-3 rounded-xl border border-[var(--twilight)]/40 hover:border-[var(--twilight)]/70 bg-[var(--night)] transition-colors focus-ring"
            >
              <div className="flex-1 min-w-0">
                <span className="block font-mono text-2xs font-bold uppercase tracking-[0.14em] text-[var(--muted)] mb-1">
                  {sourceLabel}
                </span>
                <span className="block text-sm font-medium text-[var(--cream)] leading-snug group-hover:opacity-80 transition-opacity">
                  {mainText}
                </span>
                {m.snippet && (
                  <span className="block text-xs text-[var(--soft)] mt-1 leading-relaxed line-clamp-2">
                    {m.snippet}
                  </span>
                )}
              </div>
              <ArrowSquareOut
                size={14}
                weight="light"
                className="text-[var(--muted)] group-hover:text-[var(--soft)] transition-colors shrink-0 mt-0.5"
              />
            </a>
          );
        })}
      </div>
      {hasMore && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="mt-2 font-mono text-xs text-[var(--soft)] hover:text-[var(--cream)] transition-colors focus-ring rounded"
        >
          See all {sorted.length} mentions &rarr;
        </button>
      )}
    </div>
  );
}
