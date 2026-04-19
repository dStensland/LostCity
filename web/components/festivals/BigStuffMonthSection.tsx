"use client";

import BigStuffHeroCard from "./BigStuffHeroCard";
import BigStuffRow from "./BigStuffRow";
import type { BigStuffPageItem } from "@/lib/big-stuff/types";

const MONTH_LABELS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

const TIER_RANK: Record<BigStuffPageItem["tier"], number> = {
  hero: 0,
  featured: 1,
  standard: 2,
};

function sortItems(items: BigStuffPageItem[]): BigStuffPageItem[] {
  return [...items].sort((a, b) => {
    if (a.isLiveNow !== b.isLiveNow) return a.isLiveNow ? -1 : 1;
    if (a.tier !== b.tier) return TIER_RANK[a.tier] - TIER_RANK[b.tier];
    return a.startDate.localeCompare(b.startDate);
  });
}

export interface BigStuffMonthSectionProps {
  monthKey: string;
  items: BigStuffPageItem[];
}

export default function BigStuffMonthSection({
  monthKey,
  items,
}: BigStuffMonthSectionProps) {
  if (items.length === 0) return null;
  const sorted = sortItems(items);
  const [top, ...rest] = sorted;
  const [y, m] = monthKey.split("-");
  const label = `${MONTH_LABELS[parseInt(m, 10) - 1]} ${y}`;

  return (
    <section id={`month-${monthKey}`} className="scroll-mt-[40px]">
      <h2 className="font-mono text-xs font-bold tracking-[0.14em] uppercase text-[var(--cream)] border-t border-[var(--twilight)] pt-4 mb-4">
        {label}
      </h2>
      <div className="space-y-3">
        <BigStuffHeroCard item={top} />
        {rest.map((it) => (
          <BigStuffRow key={it.id} item={it} />
        ))}
      </div>
    </section>
  );
}
