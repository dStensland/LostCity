"use client";

/**
 * BigStuffSection — compact month-ribbon preview of tentpole events and festivals
 * over the next ~6 months.
 *
 * Replaces the prior FestivalsSection carousel. Pure typography, no images, no
 * countdown urgency. Designed to be low-profile: the feed favors dynamic content
 * and this block doesn't change often.
 *
 * Pencil comp: docs/design-system.pen node qOUCP.
 */

import Link from "next/link";
import { Crown } from "@phosphor-icons/react";
import FeedSectionReveal from "@/components/feed/FeedSectionReveal";
import {
  groupItemsByMonth,
  type BigStuffFeedData,
  type BigStuffMonthBucket,
  type BigStuffItem,
} from "@/lib/city-pulse/loaders/load-big-stuff";

const HORIZON_MONTHS = 6;
const MONTH_NAMES = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

interface BigStuffSectionProps {
  portalSlug: string;
  portalId: string;
  initialData?: BigStuffFeedData | null;
}

export default function BigStuffSection({
  portalSlug,
  initialData,
}: BigStuffSectionProps) {
  const items = initialData?.items ?? [];

  // Compute today-derived values at render so crossing midnight while the
  // loader cache is warm doesn't corrupt the "you are here" marker.
  const today = localTodayISO();
  const currentMonthLabel = formatCurrentMonthLabel(today);

  const months = groupItemsByMonth(items, today, HORIZON_MONTHS);
  const totalItems = months.reduce((sum, m) => sum + m.items.length, 0);
  if (totalItems === 0) return null;

  const visibleMonths = trimVisibleMonths(months);
  if (visibleMonths.length === 0) return null;

  return (
    <FeedSectionReveal className="pb-2">
      <BigStuffHeader
        portalSlug={portalSlug}
        currentMonthLabel={currentMonthLabel}
      />

      <div
        className="group/ribbon flex flex-row rounded-card overflow-hidden border border-[var(--twilight)] bg-[var(--night)]"
        data-bigstuff-ribbon
      >
        {visibleMonths.map((bucket, idx) => (
          <MonthColumn
            key={bucket.monthKey}
            bucket={bucket}
            isFirst={idx === 0}
            portalSlug={portalSlug}
          />
        ))}
      </div>
    </FeedSectionReveal>
  );
}

function BigStuffHeader({
  portalSlug,
  currentMonthLabel,
}: {
  portalSlug: string;
  currentMonthLabel: string;
}) {
  return (
    <div className="mb-3">
      <p className="font-mono text-[10px] tracking-[0.15em] uppercase text-[var(--muted)]">
        THE BIG STUFF — 6 months of plans
      </p>
      <div className="mt-1 flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 rounded px-[7px] py-[3px] border border-[var(--gold)]/40 bg-[var(--gold)]/10">
          <Crown weight="duotone" className="w-3 h-3 text-[var(--gold)]" aria-hidden />
          <span className="font-mono text-[9px] font-bold tracking-[0.08em] text-[var(--gold)]">
            {currentMonthLabel}
          </span>
        </span>
        <h2 className="text-xl font-bold text-[var(--cream)] tracking-[-0.01em]">
          The Big Stuff
        </h2>
        <div className="flex-1" />
        <Link
          href={`/${portalSlug}/festivals`}
          className="font-mono text-xs text-[var(--gold)] hover:opacity-80 transition-opacity"
        >
          See all →
        </Link>
      </div>
    </div>
  );
}

/** Placeholder — real implementation in Task 6. */
function MonthColumn({
  bucket,
}: {
  bucket: BigStuffMonthBucket;
  isFirst: boolean;
  portalSlug: string;
}) {
  return (
    <div className="flex-1 p-[14px]">
      <p className="font-mono text-xs font-bold tracking-[0.12em] uppercase text-[var(--cream)]">
        {monthLabel(bucket.monthKey)}
      </p>
    </div>
  );
}

/**
 * Trim leading and trailing empty months, keeping the window from first month
 * with content through last month with content. Always keep the current month
 * (per design: "you are here" anchor) even if sparse.
 */
function trimVisibleMonths(
  months: BigStuffMonthBucket[],
): BigStuffMonthBucket[] {
  const firstWithContent = months.findIndex((m) => m.items.length > 0);
  if (firstWithContent === -1) return [];
  let lastWithContent = firstWithContent;
  for (let i = months.length - 1; i >= 0; i--) {
    if (months[i].items.length > 0) {
      lastWithContent = i;
      break;
    }
  }
  const currentIdx = months.findIndex((m) => m.isCurrentMonth);
  const start =
    currentIdx !== -1 ? Math.min(firstWithContent, currentIdx) : firstWithContent;
  const end =
    currentIdx !== -1 ? Math.max(lastWithContent, currentIdx) : lastWithContent;
  return months.slice(start, end + 1);
}

function localTodayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatCurrentMonthLabel(today: string): string {
  const [y, m] = today.split("-");
  return `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y}`;
}

function monthLabel(monthKey: string): string {
  const [, m] = monthKey.split("-");
  return MONTH_NAMES[parseInt(m, 10) - 1];
}

// Re-export BigStuffItem type for consumers that need the shape.
export type { BigStuffItem };
