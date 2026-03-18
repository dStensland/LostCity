"use client";

import { ArrowSquareOut } from "@phosphor-icons/react";
import { SectionHeader } from "./SectionHeader";

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

export function getEditorialSourceLabel(sourceKey: string): string {
  return EDITORIAL_SOURCE_LABELS[sourceKey] || sourceKey;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AccoladesSection({
  mentions,
  title = "In the Press",
}: {
  mentions: EditorialMention[];
  title?: string;
}) {
  const sorted = [...mentions].sort(
    (a, b) =>
      (MENTION_TYPE_WEIGHT[a.mention_type] ?? 5) -
      (MENTION_TYPE_WEIGHT[b.mention_type] ?? 5)
  );

  return (
    <div>
      <SectionHeader title={title} variant="divider" />
      <div className="space-y-1">
        {sorted.map((m) => (
          <a
            key={m.id}
            href={m.article_url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-2 py-1.5 text-sm hover:opacity-80 transition-opacity focus-ring rounded"
          >
            <span className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)] shrink-0">
              {getEditorialSourceLabel(m.source_key)}
            </span>
            <span className="text-[var(--twilight)]">&mdash;</span>
            <span className="text-[var(--soft)] truncate flex-1">
              {m.article_title}
            </span>
            <ArrowSquareOut
              size={12}
              weight="light"
              className="text-[var(--muted)] group-hover:text-[var(--soft)] transition-colors shrink-0"
            />
          </a>
        ))}
      </div>
    </div>
  );
}
