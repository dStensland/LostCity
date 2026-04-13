# On the Horizon — Timeline Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat carousel "On the Horizon" section with stacked monthly time buckets, each with a headliner card and compact supporting rows.

**Architecture:** Server-side bucketing in `buildPlanningHorizonSection` produces typed `HorizonBucket[]` in section meta. Client renders buckets as a vertical stack with progressive disclosure (3 buckets default, expanding). Gold left rail groups headliner + supporting rows visually.

**Tech Stack:** Next.js 16 (React 19), Tailwind v4 (CSS variables via `@theme inline`), Supabase, TypeScript

**Spec:** `docs/superpowers/specs/2026-04-13-on-the-horizon-redesign.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `web/lib/city-pulse/types.ts` | Modify | Add `HorizonBucket` interface |
| `web/lib/city-pulse/pipeline/resolve-portal.ts` | Modify | Change `horizonStart` from 7→28 days |
| `web/lib/city-pulse/section-builders.ts` | Modify | Rewrite `buildPlanningHorizonSection` to produce buckets |
| `web/components/feed/HorizonHeadlinerCard.tsx` | Create | Full-width headliner card |
| `web/components/feed/HorizonSupportingRow.tsx` | Create | Compact no-thumbnail row |
| `web/components/feed/HorizonBucket.tsx` | Create | Bucket container: header + headliner + rows + disclosure |
| `web/components/feed/sections/PlanningHorizonSection.tsx` | Rewrite | Vertical bucket stack with progressive disclosure |
| `web/components/feed/CityPulseShell.tsx` | Modify | Adjust wrapper spacing |
| `web/components/feed/PlanningHorizonCard.tsx` | Delete | Replaced by HorizonHeadlinerCard |

---

### Task 1: Add `HorizonBucket` Type

**Files:**
- Modify: `web/lib/city-pulse/types.ts`

- [ ] **Step 1: Add HorizonBucket interface after CityPulseSection (around line 227)**

```typescript
/** A time bucket for the "On the Horizon" section. Built server-side. */
export interface HorizonBucket {
  /** Month key, e.g. "2026-05" */
  key: string;
  /** Display label, e.g. "May" */
  label: string;
  /** Relative time, e.g. "6 weeks away" */
  relativeLabel: string;
  /** The highest-importance event for this bucket, or null if small bucket */
  headliner: CityPulseEventItem | null;
  /** Non-headliner events (capped at 3 for initial render) */
  supporting: CityPulseEventItem[];
  /** Total qualifying events in this month (before cap) */
  totalCount: number;
  /** Events hidden behind "N more" disclosure */
  overflowCount: number;
  /** True when totalCount <= 2 — skip headliner/supporting split */
  isSmallBucket: boolean;
}
```

- [ ] **Step 2: Run tsc to verify**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit`
Expected: PASS (no errors)

- [ ] **Step 3: Commit**

```bash
git add web/lib/city-pulse/types.ts
git commit -m "feat(horizon): add HorizonBucket type for timeline layout"
```

---

### Task 2: Shift Horizon Start Boundary to 28 Days

**Files:**
- Modify: `web/lib/city-pulse/pipeline/resolve-portal.ts` (~line 191)

- [ ] **Step 1: Change horizonStart from 7 days to 28 days**

In `resolve-portal.ts`, find the line:
```typescript
const horizonStart = getLocalDateString(addDays(effectiveNow, 7));
```

Replace with:
```typescript
const horizonStart = getLocalDateString(addDays(effectiveNow, 28));
```

This creates clean temporal separation from the Lineup's "Coming Up" tab (which owns 0-28 days).

- [ ] **Step 2: Run tsc to verify**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add web/lib/city-pulse/pipeline/resolve-portal.ts
git commit -m "feat(horizon): shift horizon start from 7 to 28 days — clean separation from Lineup"
```

---

### Task 3: Rewrite `buildPlanningHorizonSection` for Bucket Output

**Files:**
- Modify: `web/lib/city-pulse/section-builders.ts` (lines 1071-1292)

This is the largest task. The existing function filters, deduplicates, and sorts events, then returns a flat `items` array with `month_counts` meta. We preserve the filtering/dedup logic but change the output to bucket structure.

- [ ] **Step 1: Add helper imports at top of file**

At the top of section-builders.ts, ensure these are imported (add any missing):

```typescript
import type { HorizonBucket } from "@/lib/city-pulse/types";
```

- [ ] **Step 2: Add bucket-building helper above the main function**

Insert above `buildPlanningHorizonSection` (around line 1068):

```typescript
/**
 * Build a relative time label for a month bucket.
 * Returns e.g. "3 weeks away", "2 months away".
 */
function bucketRelativeLabel(monthKey: string, now: Date): string {
  // First day of the bucket month
  const [yearStr, monthStr] = monthKey.split("-");
  const bucketStart = new Date(Number(yearStr), Number(monthStr) - 1, 1);
  const diffMs = bucketStart.getTime() - now.getTime();
  const diffDays = Math.max(0, Math.round(diffMs / (24 * 60 * 60 * 1000)));

  if (diffDays <= 7) return "this week";
  if (diffDays <= 14) return "next week";
  const weeks = Math.round(diffDays / 7);
  if (weeks <= 8) return `${weeks} weeks away`;
  const months = Math.round(diffDays / 30);
  return months === 1 ? "1 month away" : `${months} months away`;
}

/**
 * Select the best headliner from a set of events.
 * Excludes sold-out/cancelled. Ranks by importance, then data quality, then date.
 */
function selectHeadliner(events: FeedEventData[]): FeedEventData | null {
  const importanceRank = (imp: string | undefined): number => {
    if (imp === "flagship") return 0;
    if (imp === "major") return 1;
    return 2;
  };

  const dataQualityScore = (e: FeedEventData): number => {
    let score = 0;
    const blurb = (e.featured_blurb ?? "").trim();
    const desc = (e.description ?? "").trim();
    if (blurb.length >= 20) score += 2;
    else if (desc.length >= 20) score += 1;
    if (getEffectiveEventImageUrl(e)) score += 1;
    return score;
  };

  const candidates = events.filter((e) => {
    const raw = e as Record<string, unknown>;
    const status = raw.ticket_status as string | undefined;
    return status !== "sold-out" && status !== "cancelled";
  });

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const rawA = a as Record<string, unknown>;
    const rawB = b as Record<string, unknown>;
    // 1. Importance tier
    const impDiff = importanceRank(rawA.importance as string | undefined) -
                    importanceRank(rawB.importance as string | undefined);
    if (impDiff !== 0) return impDiff;
    // 2. Data quality
    const qualDiff = dataQualityScore(b) - dataQualityScore(a);
    if (qualDiff !== 0) return qualDiff;
    // 3. Earliest date
    return a.start_date.localeCompare(b.start_date);
  });

  return candidates[0];
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
```

- [ ] **Step 3: Rewrite the return section of buildPlanningHorizonSection**

Keep all existing code from line 1071 through the `capped` array (line 1260). Then replace everything from line 1262 to the end of the function (line 1292) with:

Replace this block:
```typescript
  // Compute per-month counts for the month selector
  const monthCounts: Record<string, number> = {};
  for (const e of capped) {
    const monthKey = e.start_date.slice(0, 7);
    monthCounts[monthKey] = (monthCounts[monthKey] || 0) + 1;
  }

  // Enrich with urgency + freshness so the client doesn't need to recompute
  const items: CityPulseItem[] = capped.map((e) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = e as any;
    const enriched = {
      ...e,
      urgency: getPlanningUrgency(raw),
      ticket_freshness: ticketStatusFreshness(raw.ticket_status_checked_at),
    };
    return makeEventItem(enriched as FeedEventData, undefined, editorialMap);
  });

  return {
    id: "planning-horizon",
    type: "planning_horizon",
    title: "On the Horizon",
    subtitle: "Big events worth planning around",
    priority: "secondary",
    accent_color: "var(--gold)",
    items,
    layout: "carousel",
    meta: { month_counts: monthCounts },
  };
```

With:
```typescript
  // --- Tapering rule: beyond 3 months, only flagship/tentpole ---
  const threeMonthsOut = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)
    .toISOString().split("T")[0];

  const tapered = capped.filter((e) => {
    if (e.start_date <= threeMonthsOut) return true;
    const raw = e as Record<string, unknown>;
    return raw.importance === "flagship" || raw.is_tentpole;
  });

  // --- Group events by month ---
  const monthGroups = new Map<string, FeedEventData[]>();
  for (const e of tapered) {
    const monthKey = e.start_date.slice(0, 7);
    const group = monthGroups.get(monthKey) ?? [];
    group.push(e);
    monthGroups.set(monthKey, group);
  }

  // --- Enrich a single event with urgency + freshness, produce CityPulseItem ---
  const enrichEvent = (e: FeedEventData): CityPulseItem => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = e as any;
    const enriched = {
      ...e,
      urgency: getPlanningUrgency(raw),
      ticket_freshness: ticketStatusFreshness(raw.ticket_status_checked_at),
    };
    return makeEventItem(enriched as FeedEventData, undefined, editorialMap);
  };

  // --- Build buckets ---
  const SUPPORTING_CAP = 3;
  const sortedMonthKeys = [...monthGroups.keys()].sort();
  const buckets: HorizonBucket[] = [];

  for (const monthKey of sortedMonthKeys) {
    const monthEvents = monthGroups.get(monthKey)!;
    const monthNum = Number(monthKey.split("-")[1]) - 1;
    const label = MONTH_NAMES[monthNum];
    const relativeLabel = bucketRelativeLabel(monthKey, now);
    const totalCount = monthEvents.length;
    const isSmallBucket = totalCount <= 2;

    let headliner: CityPulseEventItem | null = null;
    let supporting: CityPulseEventItem[];

    if (isSmallBucket) {
      headliner = null;
      supporting = monthEvents.map(enrichEvent);
    } else {
      const headlinerEvent = selectHeadliner(monthEvents);
      if (headlinerEvent) {
        headliner = enrichEvent(headlinerEvent);
        const rest = monthEvents.filter((e) => e.id !== headlinerEvent.id);
        supporting = rest.map(enrichEvent);
      } else {
        // All events are sold-out/cancelled — treat as small bucket
        supporting = monthEvents.map(enrichEvent);
      }
    }

    const visibleSupporting = Math.min(supporting.length, SUPPORTING_CAP);
    const overflowCount = Math.max(0, supporting.length - visibleSupporting);

    buckets.push({
      key: monthKey,
      label,
      relativeLabel,
      headliner,
      supporting,
      totalCount,
      overflowCount,
      isSmallBucket,
    });
  }

  if (buckets.length === 0) return null;

  // Flatten all bucket events into items for backward compatibility
  const allItems: CityPulseItem[] = [];
  for (const bucket of buckets) {
    if (bucket.headliner) allItems.push(bucket.headliner);
    allItems.push(...bucket.supporting);
  }

  return {
    id: "planning-horizon",
    type: "planning_horizon",
    title: "On the Horizon",
    subtitle: "Big events worth planning around",
    priority: "secondary",
    accent_color: "var(--gold)",
    items: allItems,
    layout: "list",
    meta: { buckets },
  };
```

- [ ] **Step 4: Update the builder's own start boundary**

In the same function, find the internal start boundary (around line 1076-1077):
```typescript
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const weekFromNowStr = weekFromNow.toISOString().split("T")[0];
```

Replace with:
```typescript
  const fourWeeksFromNow = new Date(now.getTime() + 28 * 24 * 60 * 60 * 1000);
  const fourWeeksFromNowStr = fourWeeksFromNow.toISOString().split("T")[0];
```

And update the filter on the same line that references `weekFromNowStr` (~line 1093):
```typescript
    return qualifies && e.start_date >= fourWeeksFromNowStr;
```

- [ ] **Step 5: Run tsc to verify**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add web/lib/city-pulse/section-builders.ts
git commit -m "feat(horizon): rewrite section builder to produce time buckets with headliner selection"
```

---

### Task 4: Create `HorizonHeadlinerCard` Component

**Files:**
- Create: `web/components/feed/HorizonHeadlinerCard.tsx`

- [ ] **Step 1: Create the headliner card component**

```typescript
"use client";

import { memo } from "react";
import Link from "next/link";
import SmartImage from "@/components/SmartImage";
import { CategoryIcon } from "@/components/icons/CategoryIcon";
import { Dot } from "@/components/ui/Dot";
import type { CityPulseEventItem } from "@/lib/city-pulse/types";
import type { PlanningUrgency } from "@/lib/types/planning-horizon";
import { ticketStatusFreshness } from "@/lib/types/planning-horizon";

/* ------------------------------------------------------------------ */
/*  Urgency Pill                                                       */
/* ------------------------------------------------------------------ */

function UrgencyPill({ urgency }: { urgency: NonNullable<PlanningUrgency> }) {
  const styles: Record<string, string> = {
    just_on_sale:
      "bg-[var(--coral)]/20 text-[var(--coral)] border-[var(--coral)]/30 animate-pulse",
    selling_fast:
      "bg-[var(--coral)]/15 text-[var(--coral)] border-[var(--coral)]/25",
    early_bird_ending:
      "bg-[var(--gold)]/15 text-[var(--gold)] border-[var(--gold)]/25",
    registration_closing:
      "bg-[var(--gold)]/15 text-[var(--gold)] border-[var(--gold)]/25",
    sold_out:
      "bg-[var(--twilight)]/60 text-[var(--muted)] border-[var(--twilight)]",
    cancelled:
      "bg-[var(--twilight)]/60 text-[var(--muted)] border-[var(--twilight)] line-through",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-2xs font-bold uppercase tracking-wider ${styles[urgency.type] ?? ""}`}
    >
      {urgency.label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Date Formatting                                                    */
/* ------------------------------------------------------------------ */

function formatEventDate(startDate: string, endDate?: string | null): string {
  const start = new Date(startDate + "T12:00:00");
  const opts: Intl.DateTimeFormatOptions = {
    weekday: "short",
    month: "short",
    day: "numeric",
  };
  const startStr = start.toLocaleDateString("en-US", opts);

  if (endDate && endDate !== startDate) {
    const end = new Date(endDate + "T12:00:00");
    const endOpts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    // Same month → "Fri, Apr 17–20"
    if (start.getMonth() === end.getMonth()) {
      return `${startStr}–${end.getDate()}`;
    }
    return `${startStr} – ${end.toLocaleDateString("en-US", endOpts)}`;
  }
  return startStr;
}

/* ------------------------------------------------------------------ */
/*  Price Formatting                                                   */
/* ------------------------------------------------------------------ */

function formatPrice(
  isFree: boolean | undefined,
  priceMin: number | null | undefined,
  priceMax: number | null | undefined,
): string | null {
  if (isFree) return "Free";
  if (priceMin != null && priceMax != null && priceMin !== priceMax) {
    return `$${priceMin}–$${priceMax}`;
  }
  if (priceMin != null) return `From $${priceMin}`;
  if (priceMax != null) return `Up to $${priceMax}`;
  return null;
}

/* ------------------------------------------------------------------ */
/*  Ticket CTA                                                         */
/* ------------------------------------------------------------------ */

function TicketCTA({ event }: { event: Record<string, unknown> }) {
  const status = event.ticket_status as string | undefined;
  if (status === "sold-out" || status === "cancelled") return null;

  const ticketUrl = event.ticket_url as string | null;
  const sourceUrl = event.source_url as string | null;
  const isFree = event.is_free as boolean | undefined;
  const href = ticketUrl ?? sourceUrl;

  if (!href && !isFree) return null;

  const freshness = ticketStatusFreshness(
    event.ticket_status_checked_at as string | null,
  );

  if (isFree || !ticketUrl) {
    return (
      <div className="mt-3">
        <a
          href={href ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--neon-green)]/15 px-4 py-2 font-mono text-xs font-bold text-[var(--neon-green)] transition-colors hover:bg-[var(--neon-green)]/25"
          onClick={(e) => e.stopPropagation()}
        >
          Get Details
        </a>
      </div>
    );
  }

  return (
    <div className="mt-3 flex items-center gap-3">
      <a
        href={ticketUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--coral)]/15 px-4 py-2 font-mono text-xs font-bold text-[var(--coral)] transition-colors hover:bg-[var(--coral)]/25"
        onClick={(e) => e.stopPropagation()}
      >
        Get Tickets
      </a>
      {freshness && (
        <span className="font-mono text-2xs text-[var(--muted)]">
          {freshness}
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

interface HorizonHeadlinerCardProps {
  item: CityPulseEventItem;
  portalSlug: string;
}

export const HorizonHeadlinerCard = memo(function HorizonHeadlinerCard({
  item,
  portalSlug,
}: HorizonHeadlinerCardProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const event = item.event as any;
  const urgency = event.urgency as PlanningUrgency;
  const category = event.category ?? event.category_id ?? "other";
  const imageUrl = event.image_url as string | null;
  const venue = event.venue as { name?: string; neighborhood?: string } | null;
  const description = (event.featured_blurb ?? event.description ?? "") as string;
  const price = formatPrice(event.is_free, event.price_min, event.price_max);

  return (
    <Link
      href={`/${portalSlug}/events/${event.id}`}
      className="group block overflow-hidden rounded-card border border-[var(--twilight)]/40 bg-[var(--night)] shadow-card-sm hover-lift"
    >
      {/* Image zone */}
      <div className="relative h-36 sm:h-[200px] overflow-hidden">
        {imageUrl ? (
          <>
            <SmartImage
              src={imageUrl}
              alt={event.title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, 700px"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--night)] via-[var(--night)]/40 to-transparent" />
          </>
        ) : (
          <>
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--dusk)] to-[var(--night)]" />
            <div className="absolute inset-0 flex items-center justify-center opacity-20">
              <CategoryIcon
                type={category}
                size={64}
                glow="subtle"
                weight="light"
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--night)]/90 via-[var(--night)]/40 to-transparent" />
          </>
        )}

        {/* Category badge — top left */}
        <div className="absolute top-2.5 left-2.5">
          <span
            data-category={category}
            className="inline-flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 font-mono text-2xs font-bold uppercase tracking-wider text-category backdrop-blur-sm"
          >
            <CategoryIcon type={category} size={10} weight="bold" />
            {category}
          </span>
        </div>

        {/* Urgency pill — bottom left */}
        {urgency && (
          <div className="absolute bottom-2.5 left-2.5">
            <UrgencyPill urgency={urgency} />
          </div>
        )}
      </div>

      {/* Content zone */}
      <div className="flex flex-col gap-1.5 p-4">
        {/* Date */}
        <span className="font-mono text-xs text-[var(--gold)]">
          {formatEventDate(event.start_date, event.end_date)}
        </span>

        {/* Title */}
        <h4 className="text-lg font-semibold leading-tight text-[var(--cream)] line-clamp-2">
          {event.title}
        </h4>

        {/* Description */}
        {description.length >= 20 && (
          <p className="text-sm leading-snug text-[var(--soft)] line-clamp-2">
            {description}
          </p>
        )}

        {/* Venue + Price */}
        <div className="flex items-center gap-1 text-xs text-[var(--muted)]">
          {venue?.name && <span className="truncate">{venue.name}</span>}
          {venue?.name && venue?.neighborhood && <Dot />}
          {venue?.neighborhood && (
            <span className="truncate">{venue.neighborhood}</span>
          )}
          {price && (
            <>
              <Dot />
              <span
                className={
                  event.is_free
                    ? "text-[var(--neon-green)]"
                    : "font-mono"
                }
              >
                {price}
              </span>
            </>
          )}
        </div>

        {/* Ticket CTA */}
        <TicketCTA event={event} />
      </div>
    </Link>
  );
});
```

- [ ] **Step 2: Run tsc to verify**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add web/components/feed/HorizonHeadlinerCard.tsx
git commit -m "feat(horizon): create HorizonHeadlinerCard — full-width headliner with image, description, ticket CTA"
```

---

### Task 5: Create `HorizonSupportingRow` Component

**Files:**
- Create: `web/components/feed/HorizonSupportingRow.tsx`

- [ ] **Step 1: Create the supporting row component**

```typescript
"use client";

import { memo } from "react";
import Link from "next/link";
import { CategoryIcon } from "@/components/icons/CategoryIcon";
import { Dot } from "@/components/ui/Dot";
import type { CityPulseEventItem } from "@/lib/city-pulse/types";

interface HorizonSupportingRowProps {
  item: CityPulseEventItem;
  portalSlug: string;
}

function formatShortDate(startDate: string): string {
  const d = new Date(startDate + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatPrice(
  isFree: boolean | undefined,
  priceMin: number | null | undefined,
): string | null {
  if (isFree) return "Free";
  if (priceMin != null) return `$${priceMin}`;
  return null;
}

export const HorizonSupportingRow = memo(function HorizonSupportingRow({
  item,
  portalSlug,
}: HorizonSupportingRowProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const event = item.event as any;
  const category = event.category ?? event.category_id ?? "other";
  const venue = event.venue as { name?: string; neighborhood?: string } | null;
  const price = formatPrice(event.is_free, event.price_min);
  const isSoldOut =
    event.ticket_status === "sold-out" || event.ticket_status === "cancelled";

  return (
    <Link
      href={`/${portalSlug}/events/${event.id}`}
      className={`group flex min-h-[44px] items-center gap-2.5 rounded-lg px-3 py-2 transition-colors hover:bg-[var(--twilight)]/30 ${isSoldOut ? "opacity-50" : ""}`}
    >
      {/* Category dot */}
      <span
        data-category={category}
        className="flex h-2.5 w-2.5 flex-shrink-0 items-center justify-center"
      >
        <CategoryIcon type={category} size={10} weight="bold" />
      </span>

      {/* Date */}
      <span className="flex-shrink-0 font-mono text-xs text-[var(--gold)]">
        {formatShortDate(event.start_date)}
      </span>

      {/* Title */}
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--cream)] group-hover:text-[var(--gold)]">
        {event.title}
      </span>

      {/* Venue + neighborhood */}
      <span className="hidden items-center gap-1 text-xs text-[var(--muted)] sm:flex">
        {venue?.name && (
          <span className="max-w-[120px] truncate">{venue.name}</span>
        )}
        {venue?.name && venue?.neighborhood && <Dot />}
        {venue?.neighborhood && (
          <span className="max-w-[100px] truncate">{venue.neighborhood}</span>
        )}
      </span>

      {/* Price / Sold Out badge */}
      <span className="flex-shrink-0 text-right">
        {isSoldOut ? (
          <span className="font-mono text-2xs font-bold uppercase text-[var(--muted)]">
            Sold Out
          </span>
        ) : price ? (
          <span
            className={`font-mono text-xs ${event.is_free ? "text-[var(--neon-green)]" : "text-[var(--soft)]"}`}
          >
            {price}
          </span>
        ) : null}
      </span>
    </Link>
  );
});
```

- [ ] **Step 2: Run tsc to verify**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add web/components/feed/HorizonSupportingRow.tsx
git commit -m "feat(horizon): create HorizonSupportingRow — compact no-thumbnail event row"
```

---

### Task 6: Create `HorizonBucket` Component

**Files:**
- Create: `web/components/feed/HorizonBucket.tsx`

- [ ] **Step 1: Create the bucket container component**

```typescript
"use client";

import { useState } from "react";
import { CountBadge } from "@/components/ui/CountBadge";
import type { HorizonBucket as HorizonBucketType } from "@/lib/city-pulse/types";
import { HorizonHeadlinerCard } from "@/components/feed/HorizonHeadlinerCard";
import { HorizonSupportingRow } from "@/components/feed/HorizonSupportingRow";
import { StandardRow } from "@/components/feed/StandardRow";

interface HorizonBucketProps {
  bucket: HorizonBucketType;
  portalSlug: string;
}

export function HorizonBucketComponent({
  bucket,
  portalSlug,
}: HorizonBucketProps) {
  const [showOverflow, setShowOverflow] = useState(false);

  return (
    <div className="border-l-2 border-[var(--gold)]/30 pl-4">
      {/* Bucket header */}
      <div className="mb-3 flex items-center gap-2">
        <h4 className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-[var(--gold)]">
          {bucket.label}
        </h4>
        <span className="font-mono text-xs text-[var(--muted)]">·</span>
        <span className="font-mono text-xs text-[var(--muted)]">
          {bucket.relativeLabel}
        </span>
        <CountBadge count={bucket.totalCount} placement="inline" />
      </div>

      {/* Small bucket — just rows, no headliner */}
      {bucket.isSmallBucket ? (
        <div className="space-y-0.5">
          {bucket.supporting.map((item) => (
            <HorizonSupportingRow
              key={`horizon-row-${item.event.id}`}
              item={item}
              portalSlug={portalSlug}
            />
          ))}
        </div>
      ) : (
        <>
          {/* Headliner card */}
          {bucket.headliner && (
            <div className="mb-2">
              <HorizonHeadlinerCard
                item={bucket.headliner}
                portalSlug={portalSlug}
              />
            </div>
          )}

          {/* Supporting rows */}
          {bucket.supporting.length > 0 && (
            <div className="space-y-0.5">
              {bucket.supporting.map((item) => (
                <HorizonSupportingRow
                  key={`horizon-row-${item.event.id}`}
                  item={item}
                  portalSlug={portalSlug}
                />
              ))}
            </div>
          )}

          {/* Overflow disclosure */}
          {bucket.overflowCount > 0 && !showOverflow && (
            <button
              onClick={() => setShowOverflow(true)}
              className="mt-1.5 w-full rounded-lg px-3 py-2 text-center font-mono text-xs text-[var(--gold)] transition-colors hover:bg-[var(--twilight)]/30"
            >
              {bucket.overflowCount} more in {bucket.label}
            </button>
          )}
        </>
      )}
    </div>
  );
}
```

The server sends ALL supporting events (not capped). The client handles the initial 3-visible cap with inline expansion.

- [ ] **Step 2: Create the final HorizonBucket component**

```typescript
"use client";

import { useState } from "react";
import { CountBadge } from "@/components/ui/CountBadge";
import type { HorizonBucket as HorizonBucketType } from "@/lib/city-pulse/types";
import { HorizonHeadlinerCard } from "@/components/feed/HorizonHeadlinerCard";
import { HorizonSupportingRow } from "@/components/feed/HorizonSupportingRow";

const VISIBLE_CAP = 3;

interface HorizonBucketProps {
  bucket: HorizonBucketType;
  portalSlug: string;
}

export function HorizonBucketComponent({
  bucket,
  portalSlug,
}: HorizonBucketProps) {
  const [expanded, setExpanded] = useState(false);

  const visibleRows = expanded
    ? bucket.supporting
    : bucket.supporting.slice(0, VISIBLE_CAP);
  const hiddenCount = bucket.supporting.length - VISIBLE_CAP;

  return (
    <div className="border-l-2 border-[var(--gold)]/30 pl-4">
      {/* Bucket header */}
      <div className="mb-3 flex items-center gap-2">
        <h4 className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-[var(--gold)]">
          {bucket.label}
        </h4>
        <span className="font-mono text-xs text-[var(--muted)]">·</span>
        <span className="font-mono text-xs text-[var(--muted)]">
          {bucket.relativeLabel}
        </span>
        <CountBadge count={bucket.totalCount} placement="inline" />
      </div>

      {/* Small bucket — just rows, no headliner */}
      {bucket.isSmallBucket ? (
        <div className="space-y-0.5">
          {bucket.supporting.map((item) => (
            <HorizonSupportingRow
              key={`horizon-row-${item.event.id}`}
              item={item}
              portalSlug={portalSlug}
            />
          ))}
        </div>
      ) : (
        <>
          {/* Headliner card */}
          {bucket.headliner && (
            <div className="mb-2">
              <HorizonHeadlinerCard
                item={bucket.headliner}
                portalSlug={portalSlug}
              />
            </div>
          )}

          {/* Supporting rows */}
          {visibleRows.length > 0 && (
            <div className="space-y-0.5">
              {visibleRows.map((item) => (
                <HorizonSupportingRow
                  key={`horizon-row-${item.event.id}`}
                  item={item}
                  portalSlug={portalSlug}
                />
              ))}
            </div>
          )}

          {/* Overflow disclosure */}
          {hiddenCount > 0 && !expanded && (
            <button
              onClick={() => setExpanded(true)}
              className="mt-1.5 w-full rounded-lg px-3 py-2 text-center font-mono text-xs text-[var(--gold)] transition-colors hover:bg-[var(--twilight)]/30"
            >
              {hiddenCount} more in {bucket.label}
            </button>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Run tsc to verify**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add web/components/feed/HorizonBucket.tsx web/lib/city-pulse/section-builders.ts
git commit -m "feat(horizon): create HorizonBucket container with inline overflow expansion"
```

---

### Task 7: Rewrite `PlanningHorizonSection` for Vertical Bucket Layout

**Files:**
- Rewrite: `web/components/feed/sections/PlanningHorizonSection.tsx`

- [ ] **Step 1: Replace the entire file contents**

```typescript
"use client";

import { useState } from "react";
import type { CityPulseSection, HorizonBucket } from "@/lib/city-pulse/types";
import { Binoculars } from "@phosphor-icons/react";
import FeedSectionHeader from "@/components/feed/FeedSectionHeader";
import { HorizonBucketComponent } from "@/components/feed/HorizonBucket";

const DEFAULT_VISIBLE_BUCKETS = 3;

interface Props {
  section: CityPulseSection;
  portalSlug: string;
}

export default function PlanningHorizonSection({ section, portalSlug }: Props) {
  const buckets = (section.meta?.buckets ?? []) as HorizonBucket[];
  const [showAllBuckets, setShowAllBuckets] = useState(false);

  if (buckets.length === 0) return null;

  const visibleBuckets = showAllBuckets
    ? buckets
    : buckets.slice(0, DEFAULT_VISIBLE_BUCKETS);
  const hiddenBucketCount = buckets.length - DEFAULT_VISIBLE_BUCKETS;

  return (
    <div>
      <FeedSectionHeader
        title={section.title}
        priority={section.priority}
        accentColor="var(--gold)"
        icon={<Binoculars weight="duotone" className="w-3.5 h-3.5" />}
      />

      {section.subtitle && (
        <p className="mt-1 mb-4 text-sm text-[var(--soft)]">
          {section.subtitle}
        </p>
      )}

      {/* Bucket stack */}
      <div className="space-y-6">
        {visibleBuckets.map((bucket) => (
          <HorizonBucketComponent
            key={bucket.key}
            bucket={bucket}
            portalSlug={portalSlug}
          />
        ))}
      </div>

      {/* "See N more months" expansion */}
      {hiddenBucketCount > 0 && !showAllBuckets && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={() => setShowAllBuckets(true)}
            className="min-h-[44px] w-full max-w-sm rounded-full border border-[var(--twilight)] bg-[var(--twilight)]/30 px-6 py-2.5 font-mono text-xs text-[var(--soft)] transition-colors hover:bg-[var(--twilight)]/50"
          >
            {hiddenBucketCount} more month{hiddenBucketCount !== 1 ? "s" : ""}
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run tsc to verify**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add web/components/feed/sections/PlanningHorizonSection.tsx
git commit -m "feat(horizon): rewrite PlanningHorizonSection for vertical bucket layout"
```

---

### Task 8: Update CityPulseShell Wrapper

**Files:**
- Modify: `web/components/feed/CityPulseShell.tsx` (~lines 606-621)

- [ ] **Step 1: Adjust the horizon section wrapper spacing**

The section is now taller (vertical stacked buckets vs. single carousel strip). The existing `mt-8` and divider are fine. No changes needed unless the section looks cramped — verify in browser.

Check if there are any imports referencing the old `PlanningHorizonCard` in this file. If so, remove them. The shell only imports `PlanningHorizonSection`, not the card directly, so this should be clean.

- [ ] **Step 2: Run tsc to verify no stale imports**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit (if any changes were made)**

```bash
git add web/components/feed/CityPulseShell.tsx
git commit -m "chore(horizon): verify shell wrapper compatibility with vertical bucket layout"
```

---

### Task 9: Delete Old `PlanningHorizonCard`

**Files:**
- Delete: `web/components/feed/PlanningHorizonCard.tsx`

- [ ] **Step 1: Check for remaining imports of the old card**

Run: `grep -r "PlanningHorizonCard" web/ --include="*.tsx" --include="*.ts" -l`

Expected: Only `web/components/feed/PlanningHorizonCard.tsx` itself should appear. The old section component no longer imports it (rewritten in Task 7). If other files reference it, update them first.

- [ ] **Step 2: Delete the file**

```bash
rm web/components/feed/PlanningHorizonCard.tsx
```

- [ ] **Step 3: Run tsc to verify**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add -u web/components/feed/PlanningHorizonCard.tsx
git commit -m "chore(horizon): delete PlanningHorizonCard — replaced by HorizonHeadlinerCard"
```

---

### Task 10: Browser Verification

**Files:** None (testing only)

- [ ] **Step 1: Start dev server and verify**

Run: `cd /Users/coach/Projects/LostCity/web && npm run dev`

Navigate to the Atlanta portal feed. Scroll to "On the Horizon" section. Verify:

1. Section renders with vertical time buckets, not a horizontal carousel
2. Each bucket has a gold left rail, header with month name + relative time + count
3. First bucket's headliner card shows a large image, title, description, ticket CTA
4. Supporting rows beneath the headliner are compact (no thumbnails)
5. "N more in [Month]" disclosure link expands to show additional events
6. Only 3 buckets visible initially; "N more months" button shows at the bottom
7. No overlapping events with the Lineup section's "Coming Up" tab
8. Section looks correct at 375px mobile width (headliner image ~140px, touch targets 44px+)

- [ ] **Step 2: Check for empty/degraded states**

- If there are months with 1-2 events, verify they render as rows without headliner
- If headliner has no image, verify the category gradient fallback renders
- If a far-future bucket (4+ months) shows, verify only flagship/tentpole events appear

- [ ] **Step 3: Run full tsc build**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit && npm run build`
Expected: PASS

- [ ] **Step 4: Final commit if any tweaks were needed**

```bash
git add -A
git commit -m "fix(horizon): browser-verified adjustments for timeline layout"
```
