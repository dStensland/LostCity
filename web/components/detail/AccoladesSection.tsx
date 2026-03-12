"use client";

import { ArrowSquareOut } from "@phosphor-icons/react";
import { SectionHeader } from "./SectionHeader";
import Badge from "@/components/ui/Badge";

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

const EDITORIAL_SOURCE_LABELS: Record<string, string> = {
  eater_atlanta: "Eater Atlanta",
  infatuation_atlanta: "The Infatuation",
  rough_draft_atlanta: "Rough Draft Atlanta",
  atlanta_eats: "Atlanta Eats",
  atlanta_magazine: "Atlanta Magazine",
  thrillist_atlanta: "Thrillist",
  whatnow_atlanta: "What Now Atlanta",
  axios_atlanta: "Axios Atlanta",
  atl_bucket_list: "ATL Bucket List",
};

const MENTION_TYPE_WEIGHT: Record<string, number> = {
  best_of: 0,
  guide_inclusion: 1,
  review: 2,
  opening: 3,
  feature: 4,
};

const SOURCE_ACCENT: Record<string, string> = {
  best_of: "var(--coral)",
  guide_inclusion: "var(--gold)",
  opening: "var(--neon-green)",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AccoladesSection({
  mentions,
}: {
  mentions: EditorialMention[];
}) {
  const sorted = [...mentions].sort(
    (a, b) =>
      (MENTION_TYPE_WEIGHT[a.mention_type] ?? 5) -
      (MENTION_TYPE_WEIGHT[b.mention_type] ?? 5)
  );

  return (
    <div>
      <SectionHeader title="Accolades" variant="divider" />
      <div className="space-y-2">
        {sorted.map((m) => {
          const accent = SOURCE_ACCENT[m.mention_type] ?? "var(--soft)";
          return (
            <a
              key={m.id}
              href={m.article_url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col gap-1.5 px-3.5 py-3 rounded-card border border-[var(--twilight)]/40 bg-[var(--night)] hover:border-[var(--coral)]/30 hover:bg-[var(--dusk)] transition-all duration-150 focus-ring"
            >
              {/* Source + badge row */}
              <div className="flex items-center justify-between">
                <span
                  className="font-mono text-xs font-bold uppercase tracking-[0.12em]"
                  style={{ color: accent }}
                >
                  {EDITORIAL_SOURCE_LABELS[m.source_key] || m.source_key}
                </span>
                {m.mention_type === "best_of" && (
                  <Badge
                    variant="accent"
                    accentColor="var(--gold)"
                    size="sm"
                  >
                    Best Of
                  </Badge>
                )}
                {m.mention_type === "guide_inclusion" && (
                  <Badge variant="neutral" size="sm">
                    Guide
                  </Badge>
                )}
                {m.mention_type === "opening" && (
                  <Badge variant="success" size="sm">
                    Opening
                  </Badge>
                )}
              </div>

              {/* Title */}
              <p className="text-sm font-medium text-[var(--cream)] leading-snug line-clamp-2">
                {m.article_title}
              </p>

              {/* Optional snippet */}
              {m.snippet && (
                <p className="text-xs text-[var(--soft)] italic line-clamp-1">
                  {m.snippet}
                </p>
              )}

              {/* Date + exit icon */}
              <div className="flex items-center justify-between mt-0.5">
                {m.published_at ? (
                  <span className="text-xs text-[var(--muted)]">
                    {new Date(m.published_at).toLocaleDateString("en-US", {
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                ) : (
                  <span />
                )}
                <ArrowSquareOut
                  size={12}
                  weight="light"
                  className="text-[var(--muted)] group-hover:text-[var(--soft)] transition-colors flex-shrink-0"
                />
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
