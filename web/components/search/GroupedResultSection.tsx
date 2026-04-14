"use client";

import type { RankedCandidate } from "@/lib/search/ranking/types";
import type { EntityType } from "@/lib/search/types";
import { ResultCard } from "@/components/search/cards/ResultCard";

interface GroupedResultSectionProps {
  type: EntityType;
  title: string;
  items: RankedCandidate[];
  total: number;
}

export function GroupedResultSection({ type, title, items, total }: GroupedResultSectionProps) {
  if (items.length === 0) return null;
  return (
    <section aria-label={`${title}, ${total} results`} className="space-y-2">
      <p className="font-mono text-2xs uppercase tracking-[0.14em] text-[var(--muted)]">
        {title} · {total}
      </p>
      <div className="space-y-2">
        {items.map((c) => (
          <ResultCard key={`${type}:${c.id}`} candidate={c} variant="grouped" />
        ))}
      </div>
    </section>
  );
}
