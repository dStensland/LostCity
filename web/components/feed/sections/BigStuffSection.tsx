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
import { getLocalDateString } from "@/lib/formats";
import {
  groupItemsByMonth,
  type BigStuffFeedData,
  type BigStuffMonthBucket,
  type BigStuffItem,
} from "@/lib/city-pulse/loaders/big-stuff-shared";

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
  const today = getLocalDateString();
  const currentMonthLabel = formatCurrentMonthLabel(today);

  const months = groupItemsByMonth(items, today, HORIZON_MONTHS);
  const visibleMonths = trimVisibleMonths(months);
  if (visibleMonths.length === 0) return null;

  return (
    <FeedSectionReveal className="pb-2">
      <BigStuffHeader
        portalSlug={portalSlug}
        currentMonthLabel={currentMonthLabel}
      />

      <div
        className="group/ribbon flex flex-row rounded-card border border-[var(--twilight)] bg-[var(--night)] overflow-x-auto sm:overflow-hidden snap-x snap-mandatory [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
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
        <h3 className="text-xl font-bold text-[var(--cream)] tracking-[-0.01em]">
          The Big Stuff
        </h3>
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

function MonthColumn({
  bucket,
  isFirst,
  portalSlug,
}: {
  bucket: BigStuffMonthBucket;
  isFirst: boolean;
  portalSlug: string;
}) {
  const isSparse = bucket.items.length < 2;
  const labelClass = [
    "flex items-center gap-1.5",
    "font-mono text-xs font-bold tracking-[0.12em] uppercase text-[var(--cream)]",
    isSparse && !bucket.isCurrentMonth ? "opacity-40" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={`flex-shrink-0 sm:flex-shrink snap-start min-w-[110px] sm:min-w-0 sm:flex-1 flex flex-col gap-2.5 p-[14px] ${
        isFirst ? "" : "border-l border-[var(--twilight)]"
      }`}
    >
      <div className={labelClass}>
        {bucket.isCurrentMonth && (
          <span
            aria-hidden
            className="inline-block w-[5px] h-[5px] rounded-full bg-[var(--gold)]"
          />
        )}
        <span>{monthLabel(bucket.monthKey)}</span>
      </div>

      {bucket.items.map((item) => (
        <ItemRow key={item.id} item={item} />
      ))}

      {bucket.overflowCount > 0 && (
        <Link
          href={`/${portalSlug}/festivals`}
          className="font-mono text-[10px] text-[var(--muted)] hover:text-[var(--gold)] transition-colors tracking-[0.2em] uppercase"
        >
          +{bucket.overflowCount} more
        </Link>
      )}
    </div>
  );
}

function ItemRow({ item }: { item: BigStuffItem }) {
  // Hover cascade: on a ribbon hover, siblings dim to 75%. The hovered item
  // itself has a more-specific :hover rule that wins the cascade and restores
  // opacity to 100% — no !important needed.
  return (
    <Link
      href={item.href}
      className="group/item block min-w-0 transition-opacity duration-200 group-hover/ribbon:opacity-75 hover:opacity-100"
    >
      <p className="text-sm font-semibold text-[var(--cream)] leading-snug truncate group-hover/item:underline decoration-[var(--gold)] underline-offset-[3px]">
        {item.title}
      </p>
      <p className="font-mono text-[10px] text-[var(--muted)] mt-0.5 tracking-[0.2em] truncate">
        {formatItemDate(item.startDate, item.endDate)}
      </p>
    </Link>
  );
}

const SHORT_MONTH = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function formatItemDate(startDate: string, endDate: string | null): string {
  const [sy, sm, sd] = startDate.split("-").map((v) => parseInt(v, 10));
  const startLabel = `${SHORT_MONTH[sm - 1]} ${sd}`;
  if (!endDate || endDate === startDate) return startLabel;
  const [ey, em, ed] = endDate.split("-").map((v) => parseInt(v, 10));
  if (sy === ey && sm === em) {
    return `${SHORT_MONTH[sm - 1]} ${sd} – ${ed}`;
  }
  if (sy !== ey) {
    return `${startLabel} – ${SHORT_MONTH[em - 1]} ${ed}, ${ey}`;
  }
  return `${startLabel} – ${SHORT_MONTH[em - 1]} ${ed}`;
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

function formatCurrentMonthLabel(today: string): string {
  const [y, m] = today.split("-");
  return `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y}`;
}

function monthLabel(monthKey: string): string {
  const [, m] = monthKey.split("-");
  return MONTH_NAMES[parseInt(m, 10) - 1];
}

