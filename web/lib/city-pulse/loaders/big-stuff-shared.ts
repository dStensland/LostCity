/**
 * Shared types and pure helpers for the Big Stuff feed section.
 *
 * Split out of load-big-stuff.ts so client components can import this without
 * dragging in server-only modules (supabase/server → next/headers).
 */

const MAX_ITEMS_PER_MONTH = 3;

export type BigStuffKind = "festival" | "tentpole";

export interface BigStuffItem {
  id: string;
  kind: BigStuffKind;
  title: string;
  startDate: string;
  endDate: string | null;
  location: string | null;
  href: string;
}

export interface BigStuffMonthBucket {
  /** YYYY-MM */
  monthKey: string;
  /** Absolute month index, e.g. 2026-04 → (2026*12)+4; used for stable sort */
  monthIndex: number;
  /** Truncated list, capped at MAX_ITEMS_PER_MONTH */
  items: BigStuffItem[];
  /** How many additional items existed beyond the cap */
  overflowCount: number;
  /**
   * True when this monthKey matches the `today` arg passed at group time.
   * Caller passes today at render, so this flag reflects render-time clock,
   * not cache-write time.
   */
  isCurrentMonth: boolean;
}

export interface BigStuffFeedData {
  /** Raw items, unshuffled. Grouping happens in the component via groupItemsByMonth. */
  items: BigStuffItem[];
}

export function groupItemsByMonth(
  items: BigStuffItem[],
  today: string,
  horizonMonths: number,
): BigStuffMonthBucket[] {
  const [yStr, mStr] = today.split("-");
  const baseYear = parseInt(yStr, 10);
  const baseMonth = parseInt(mStr, 10); // 1..12
  const baseIndex = baseYear * 12 + baseMonth;
  const currentMonthKey = `${yStr}-${mStr.padStart(2, "0")}`;

  const buckets = new Map<string, BigStuffMonthBucket>();
  for (let offset = 0; offset < horizonMonths; offset++) {
    const idx = baseIndex + offset;
    const year = Math.floor((idx - 1) / 12);
    const month = ((idx - 1) % 12) + 1;
    const monthKey = `${year}-${month.toString().padStart(2, "0")}`;
    buckets.set(monthKey, {
      monthKey,
      monthIndex: idx,
      items: [],
      overflowCount: 0,
      isCurrentMonth: monthKey === currentMonthKey,
    });
  }

  const sorted = [...items]
    .filter((it) => it.startDate > today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  for (const item of sorted) {
    const monthKey = item.startDate.slice(0, 7);
    const bucket = buckets.get(monthKey);
    if (!bucket) continue; // beyond horizon
    if (bucket.items.length < MAX_ITEMS_PER_MONTH) {
      bucket.items.push(item);
    } else {
      bucket.overflowCount += 1;
    }
  }

  return Array.from(buckets.values()).sort((a, b) => a.monthIndex - b.monthIndex);
}
