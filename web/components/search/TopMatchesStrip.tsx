"use client";

import type { RankedCandidate } from "@/lib/search/ranking/types";
import { ResultCard } from "@/components/search/cards/ResultCard";

interface TopMatchesStripProps {
  items: RankedCandidate[];
}

export function TopMatchesStrip({ items }: TopMatchesStripProps) {
  if (items.length === 0) return null;
  return (
    <section aria-label="Top matches" className="space-y-2">
      <p className="font-mono text-2xs uppercase tracking-[0.14em] text-[var(--muted)]">
        Top Matches
      </p>
      {/* Mobile: vertical stack capped at 3 */}
      <div className="sm:hidden space-y-2">
        {items.slice(0, 3).map((c) => (
          <ResultCard key={`${c.type}:${c.id}`} candidate={c} variant="top-matches" />
        ))}
      </div>
      {/* Desktop: horizontal scroll strip */}
      <div className="hidden sm:flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
        {items.map((c) => (
          <div key={`${c.type}:${c.id}`} className="flex-shrink-0 w-[280px] snap-start">
            <ResultCard candidate={c} variant="top-matches" />
          </div>
        ))}
      </div>
    </section>
  );
}
