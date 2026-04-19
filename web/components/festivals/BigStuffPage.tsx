"use client";

import { useCallback, useMemo, useState } from "react";
import BigStuffFilterChips, { type FilterValue } from "./BigStuffFilterChips";
import BigStuffRibbon from "./BigStuffRibbon";
import BigStuffCollapsedStrip from "./BigStuffCollapsedStrip";
import BigStuffMonthSection from "./BigStuffMonthSection";
import { groupItemsByMonth } from "@/lib/city-pulse/loaders/big-stuff-shared";
import { getLocalDateString } from "@/lib/formats";
import type { BigStuffPageData, BigStuffPageItem, BigStuffType } from "@/lib/big-stuff/types";

const HORIZON_MONTHS = 6;

export interface BigStuffPageProps {
  portalSlug: string;
  portalName: string;
  data: BigStuffPageData | null;
}

export default function BigStuffPage(props: BigStuffPageProps) {
  const { portalName, data } = props;
  const items = useMemo(() => data?.items ?? [], [data]);
  const [active, setActive] = useState<FilterValue>("all");

  const today = getLocalDateString();

  // Counts from the unfiltered data (constant per-load).
  const counts = useMemo<Record<BigStuffType, number>>(() => {
    const out: Record<BigStuffType, number> = {
      festival: 0,
      convention: 0,
      sports: 0,
      community: 0,
      other: 0,
    };
    for (const it of items) out[it.type]++;
    return out;
  }, [items]);

  // Filtered items.
  const filtered = useMemo(() => {
    if (active === "all") return items;
    return items.filter((it) => it.type === active);
  }, [items, active]);

  // Group filtered items by month.
  const monthBuckets = useMemo(
    () => groupItemsByMonth(filtered, today, HORIZON_MONTHS, Number.POSITIVE_INFINITY),
    [filtered, today],
  );
  const nonEmptyMonths = monthBuckets.filter((b) => b.items.length > 0);
  const monthKeys = nonEmptyMonths.map((b) => b.monthKey);

  const handleJump = useCallback((key: string) => {
    const el = document.getElementById(`month-${key}`);
    if (!el) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth", block: "start" });
  }, []);

  if (items.length === 0) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-10">
        <Header portalName={portalName} counts={counts} active={active} onChange={setActive} ribbonMonths={[]} onJump={handleJump} />
        <p className="mt-12 text-center text-[var(--muted)]">
          Nothing on the 6-month horizon yet. Check back soon.
        </p>
      </main>
    );
  }

  if (nonEmptyMonths.length === 0) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-10">
        <Header portalName={portalName} counts={counts} active={active} onChange={setActive} ribbonMonths={[]} onJump={handleJump} />
        <p className="mt-12 text-center text-[var(--muted)]">
          No {active === "all" ? "events" : active + " events"} in the next 6 months. Try a different filter.
        </p>
      </main>
    );
  }

  const ribbonMonths = nonEmptyMonths.map((b) => ({
    monthKey: b.monthKey,
    count: b.items.length,
    isCurrent: b.isCurrentMonth,
  }));

  return (
    <>
      <BigStuffCollapsedStrip monthKeys={monthKeys} onJump={handleJump} />
      <main className="max-w-4xl mx-auto px-4 py-10">
        <Header portalName={portalName} counts={counts} active={active} onChange={setActive} ribbonMonths={ribbonMonths} onJump={handleJump} />
        <div className="mt-8 space-y-10">
          {nonEmptyMonths.map((b) => (
            <BigStuffMonthSection
              key={b.monthKey}
              monthKey={b.monthKey}
              items={b.items as BigStuffPageItem[]}
            />
          ))}
        </div>
      </main>
    </>
  );
}

function Header({
  portalName,
  counts,
  active,
  onChange,
  ribbonMonths,
  onJump,
}: {
  portalName: string;
  counts: Record<BigStuffType, number>;
  active: FilterValue;
  onChange: (v: FilterValue) => void;
  ribbonMonths: Array<{ monthKey: string; count: number; isCurrent: boolean }>;
  onJump: (key: string) => void;
}) {
  return (
    <header>
      <h1 className="text-3xl font-bold text-[var(--cream)] tracking-[-0.02em]">The Big Stuff</h1>
      <p className="text-[var(--soft)] mt-1">
        Festivals, tentpoles, and season-defining moments coming up in {portalName}.
      </p>
      <div className="mt-5">
        <BigStuffFilterChips counts={counts} active={active} onChange={onChange} />
      </div>
      {ribbonMonths.length > 0 && (
        <div className="mt-4">
          <BigStuffRibbon months={ribbonMonths} onJump={onJump} />
        </div>
      )}
    </header>
  );
}

export type { BigStuffPageItem };
