# Big Stuff Month-Ribbon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current 4-card "Big Stuff" festival carousel on the Atlanta feed with a compact, typography-only month ribbon showing 3–6 dynamic columns of upcoming tentpole events and festivals over the next 6 months.

**Architecture:** Add a NEW loader `load-big-stuff.ts` (sibling to the existing `load-festivals.ts`, which stays intact because the see-all page's filter UI still consumes the `/api/festivals/upcoming` route via `useFestivalsList`). The new loader uses a forward-looking query (`start_date > today`) with the `announced_2026 = true` gate and returns a flat `BigStuffItem[]` — grouping into months happens in the component. `BigStuffSection` (new client component) computes display-only fields (`isCurrentMonth`, `currentMonthLabel`) at render time so cached payloads don't go stale across midnight. The see-all page keeps its current route + data path; only copy changes. Delete the dead `WhatsHappeningSection`. Delete the old `FestivalsSection` after manifest swap.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Supabase (Postgres), Tailwind v4 with `@theme inline` design tokens, Vitest for unit tests.

**Pencil comp:** `docs/design-system.pen`, node id `qOUCP` ("Big Stuff — Feed (Month Ribbon)").

**Reference files (read before starting):**
- `web/components/feed/sections/FestivalsSection.tsx` — old implementation, deleted in Task 12
- `web/lib/city-pulse/loaders/load-festivals.ts` — DO NOT MODIFY (still powers see-all page via `useFestivalsList`)
- `web/lib/hooks/useFestivalsList.ts` — confirmed live consumer of the existing `/api/festivals/upcoming` route
- `web/app/api/festivals/upcoming/route.ts` — unchanged by this plan
- `web/lib/festivals.ts` — `Festival` type + `getAllFestivals` / `getTentpoleEvents`
- `web/lib/city-pulse/manifests/atlanta.tsx` — feed manifest entry point
- `web/app/[portal]/festivals/page.tsx` — see-all page, copy-only edits
- `web/components/feed/FeedSectionReveal.tsx` — already applies `feed-section-enter` internally; do NOT re-add that class
- `web/lib/music/festivals-horizon-loader.ts` — reference pattern for `announced_2026` gate
- `docs/design-truth.md` — design principles, anti-pattern gallery
- `web/CLAUDE.md` — design tokens + component recipes

---

## Task 1: Pre-flight data audit

**Status: ALREADY COMPLETED** (2026-04-18). Results:
- 20 confirmed festivals (`announced_2026=true`) in the next 6 months for the Atlanta portal.
- Many tentpole events: NASCAR, FIFA World Cup matches, MomoCon, Streets Alive, Caribbean Carnival, Georgia Renaissance Festival.
- Every month has ≥1 item; most have ≥3.

**Decision:** `MIN_COLUMNS = 3`, `MAX_COLUMNS = 6` as originally planned.

Flagged as out-of-scope for this workstream (note for later):
- FIFA World Cup match events appear as individual rows — will compete for June/July slots. Crawler-level dedup concern.
- "Atlanta Caribbean Carnival" appears twice with near-dupe titles. Crawler dedup issue.

No action in this task. Proceed to Task 2.

---

## Task 2: Extract design spec from Pencil

**Files:** creates `docs/design-handoff/big-stuff-ribbon.md` (or equivalent; the skill owns the exact filename).

**Goal:** Produce a CSS/spacing spec from the Pencil comp that the implementation tasks can follow without ambiguity.

- [ ] **Step 1: Run the extract skill**

Invoke: `/design-handoff extract qOUCP`

Follow the skill's prompts. It reads the Pencil node structure, resolves variables against design tokens, and writes a spec file with exact `fontSize`, `fontFamily`, `fontWeight`, `fill`, padding, gap, border-radius, and stroke values.

- [ ] **Step 2: Review the spec**

Open the generated spec file. Verify:
- Month label: `font-mono text-[11px] font-bold tracking-[0.12em] uppercase text-[var(--cream)]` (Space Mono, 11, 700, letter-spacing 1.2)
- Item title: `font-family: Outfit; font-size: 12; font-weight: 600; color: var(--cream); line-height: 1.3` (may bump to 14 during verify — see Task 14)
- Item date: `font-mono text-[10px] text-[var(--muted)] tracking-[0.2]` (Space Mono, 10)
- Ribbon container: `bg-[var(--night)] border border-[var(--twilight)] rounded-card` (radius 12px)
- Column dividers: `border-l border-[var(--twilight)]` (1px) on columns 2..N
- Column padding: `p-[14px]` on all sides
- Column gap between items: `gap-[10px]` vertical
- Current-month dot: 5×5 ellipse, `fill: var(--gold)`
- Header subheader: `font-mono text-[10px] tracking-[0.15em] text-[var(--muted)]` uppercase
- Header badge (current month): Crown icon + "APR 2026" text in `bg-[var(--gold)]/10 border border-[var(--gold)]/40 rounded px-[7px] py-[3px] gap-[5px]`
- Header title: `font-bold text-xl text-[var(--cream)] tracking-[-0.01em]`
- "See all →" link: `font-mono text-xs text-[var(--gold)]`

- [ ] **Step 3: Commit the spec**

```bash
git add docs/design-handoff/big-stuff-ribbon.md
git commit -m "design: extract Big Stuff month-ribbon spec from Pencil"
```

---

## Task 3: Create the new Big Stuff loader

**Files:**
- Create: `web/lib/city-pulse/loaders/load-big-stuff.ts`
- Test: `web/lib/city-pulse/loaders/load-big-stuff.test.ts`

**Goal:** Add a dedicated loader that queries forward-looking tentpoles + confirmed festivals and groups them by month. Leaves the existing `load-festivals.ts` alone (still powers `/api/festivals/upcoming` for the see-all page's filter UI via `useFestivalsList`). Returns a data-only payload (no display strings like `currentMonthLabel`) so cache staleness across midnight doesn't corrupt the "you are here" marker.

- [ ] **Step 1: Write the failing test**

Create `web/lib/city-pulse/loaders/load-big-stuff.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { groupItemsByMonth, type BigStuffItem } from "./load-big-stuff";

const mkItem = (partial: Partial<BigStuffItem>): BigStuffItem => ({
  id: partial.id ?? "x",
  kind: partial.kind ?? "festival",
  title: partial.title ?? "Item",
  startDate: partial.startDate ?? "2026-05-01",
  endDate: partial.endDate ?? null,
  location: partial.location ?? null,
  href: partial.href ?? "/",
});

describe("groupItemsByMonth", () => {
  it("groups items by calendar month within the 6-month horizon", () => {
    const today = "2026-04-18";
    const items: BigStuffItem[] = [
      mkItem({ id: "1", title: "Shaky Knees", startDate: "2026-05-02", endDate: "2026-05-04" }),
      mkItem({ id: "2", title: "Music Midtown", startDate: "2026-09-13", endDate: "2026-09-14" }),
      mkItem({ id: "3", kind: "tentpole", title: "Peachtree Rd Race", startDate: "2026-07-04", location: "Buckhead" }),
    ];

    const grouped = groupItemsByMonth(items, today, 6);

    expect(grouped).toHaveLength(6);
    expect(grouped.map((g) => g.monthKey)).toEqual([
      "2026-04","2026-05","2026-06","2026-07","2026-08","2026-09",
    ]);
    expect(grouped[1].items).toHaveLength(1);
    expect(grouped[1].items[0].title).toBe("Shaky Knees");
    expect(grouped[3].items[0].title).toBe("Peachtree Rd Race");
  });

  it("caps items per month at 3 and counts overflow", () => {
    const today = "2026-04-18";
    const items: BigStuffItem[] = [
      mkItem({ id: "1", title: "A", startDate: "2026-05-01" }),
      mkItem({ id: "2", title: "B", startDate: "2026-05-05" }),
      mkItem({ id: "3", title: "C", startDate: "2026-05-10" }),
      mkItem({ id: "4", title: "D", startDate: "2026-05-15" }),
    ];

    const grouped = groupItemsByMonth(items, today, 6);
    const may = grouped.find((g) => g.monthKey === "2026-05");

    expect(may?.items).toHaveLength(3);
    expect(may?.overflowCount).toBe(1);
  });

  it("excludes items with startDate <= today (forward-only filter)", () => {
    const today = "2026-04-18";
    const items: BigStuffItem[] = [
      mkItem({ id: "past", startDate: "2026-04-10" }),
      mkItem({ id: "today", startDate: "2026-04-18" }),
      mkItem({ id: "future", startDate: "2026-04-25" }),
    ];

    const grouped = groupItemsByMonth(items, today, 6);
    const apr = grouped.find((g) => g.monthKey === "2026-04");

    expect(apr?.items).toHaveLength(1);
    expect(apr?.items[0].id).toBe("future");
  });

  it("returns empty-items buckets for months with no data", () => {
    const today = "2026-04-18";
    const items: BigStuffItem[] = [
      mkItem({ id: "may", startDate: "2026-05-02" }),
    ];

    const grouped = groupItemsByMonth(items, today, 6);

    expect(grouped).toHaveLength(6);
    expect(grouped.filter((g) => g.items.length === 0)).toHaveLength(5);
  });

  it("marks the current month with isCurrentMonth=true", () => {
    const grouped = groupItemsByMonth([], "2026-04-18", 6);
    expect(grouped[0].isCurrentMonth).toBe(true);
    expect(grouped.slice(1).every((g) => !g.isCurrentMonth)).toBe(true);
  });

  it("handles year rollover (Nov 2026 → Apr 2027)", () => {
    const today = "2026-11-18";
    const items: BigStuffItem[] = [
      mkItem({ id: "dec", title: "New Year's Eve ATL", startDate: "2026-12-31" }),
      mkItem({ id: "jan", title: "MLK Day Parade", startDate: "2027-01-19" }),
    ];

    const grouped = groupItemsByMonth(items, today, 6);

    expect(grouped.map((g) => g.monthKey)).toEqual([
      "2026-11","2026-12","2027-01","2027-02","2027-03","2027-04",
    ]);
    expect(grouped[1].items[0].title).toBe("New Year's Eve ATL");
    expect(grouped[2].items[0].title).toBe("MLK Day Parade");
  });

  it("silently drops items beyond the horizon ceiling", () => {
    const today = "2026-04-18";
    const items: BigStuffItem[] = [
      mkItem({ id: "in", startDate: "2026-09-30" }),  // month 6, inside
      mkItem({ id: "out", startDate: "2026-10-01" }), // month 7, dropped
    ];

    const grouped = groupItemsByMonth(items, today, 6);
    const allItems = grouped.flatMap((g) => g.items);

    expect(allItems).toHaveLength(1);
    expect(allItems[0].id).toBe("in");
  });
});
```

- [ ] **Step 2: Run the test to verify failure**

Run: `cd web && npx vitest run lib/city-pulse/loaders/load-big-stuff.test.ts`
Expected: FAIL with "Cannot find module './load-big-stuff'".

- [ ] **Step 3: Create the new loader module**

Create `web/lib/city-pulse/loaders/load-big-stuff.ts`:

```typescript
/**
 * Server loader for the "Big Stuff" feed section (month ribbon).
 *
 * Added 2026-04-18. Sibling to load-festivals.ts, which continues to power the
 * see-all page's filter UI via /api/festivals/upcoming. This loader is Big
 * Stuff-specific: forward-looking query, announced_2026 gate, month-grouped
 * payload for the ribbon component.
 *
 * Display-only fields (currentMonthLabel, etc.) are NOT computed here — the
 * component derives them at render time so cached payloads don't go stale
 * across midnight.
 */
import { createClient } from "@/lib/supabase/server";
import { getLocalDateString } from "@/lib/formats";
import { getOrSetSharedCacheJson } from "@/lib/shared-cache";
import { applyFeedGate } from "@/lib/feed-gate";
import { applyFederatedPortalScopeToQuery } from "@/lib/portal-scope";
import {
  getPortalSourceAccess,
  isEventCategoryAllowedForSourceAccess,
} from "@/lib/federation";
import { logger } from "@/lib/logger";
import type { FeedSectionContext } from "../feed-section-contract";

const HORIZON_MONTHS = 6;
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

/** Feed-contract loader. Errors are swallowed so the feed stays up. */
export async function loadBigStuffForFeed(
  ctx: FeedSectionContext,
): Promise<BigStuffFeedData | null> {
  try {
    const items = await fetchBigStuffForPortal(ctx.portalId, ctx.portalSlug);
    return { items };
  } catch (err) {
    logger.error("load-big-stuff failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

// ── Grouping (tested, pure) ──────────────────────────────────────────────

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

// ── Database fetch ────────────────────────────────────────────────────────

async function fetchBigStuffForPortal(
  portalId: string | null | undefined,
  portalSlug: string,
): Promise<BigStuffItem[]> {
  const cacheKey = `${portalId ?? "none"}|big-stuff-v1`;

  return getOrSetSharedCacheJson<BigStuffItem[]>(
    "api:big-stuff",
    cacheKey,
    5 * 60 * 1000,
    async () => {
      const supabase = await createClient();
      const today = getLocalDateString();
      const horizonDate = addMonthsISO(today, HORIZON_MONTHS);

      let festivalsQuery = supabase
        .from("festivals")
        .select(
          "id, name, slug, neighborhood, location, announced_start, announced_end, festival_type, portal_id, announced_2026",
        )
        .eq("announced_2026", true)
        .gt("announced_start", today)
        .lte("announced_start", horizonDate)
        .not(
          "festival_type",
          "in",
          "(conference,trade_show,professional_development,convention)",
        )
        .order("announced_start", { ascending: true })
        .limit(60);

      if (portalId) {
        festivalsQuery = festivalsQuery.eq("portal_id", portalId);
      }

      const [festivalsResult, sourceAccess] = await Promise.all([
        festivalsQuery,
        portalId ? getPortalSourceAccess(portalId) : Promise.resolve(null),
      ]);

      const { data: festivalsData, error: festivalsError } = festivalsResult;
      if (festivalsError) throw festivalsError;

      const festivals: BigStuffItem[] = ((festivalsData ?? []) as Array<{
        id: string;
        name: string;
        slug: string | null;
        neighborhood: string | null;
        location: string | null;
        announced_start: string;
        announced_end: string | null;
      }>).map((f) => ({
        id: `festival:${f.id}`,
        kind: "festival",
        title: f.name,
        startDate: f.announced_start,
        endDate: f.announced_end,
        location: f.neighborhood || f.location,
        href: f.slug ? `/${portalSlug}/festivals/${f.slug}` : `/${portalSlug}/festivals`,
      }));

      const allowedSourceIds: number[] | null = sourceAccess?.sourceIds ?? null;
      let tentpoles: BigStuffItem[] = [];

      if (!portalId || (allowedSourceIds && allowedSourceIds.length > 0)) {
        let tentpoleQuery = supabase
          .from("events")
          .select(
            `id, title, start_date, end_date, category:category_id, source_id, venue:places(id, name, slug, neighborhood)`,
          )
          .eq("is_tentpole", true)
          .eq("is_active", true)
          .is("festival_id", null)
          .gt("start_date", today)
          .lte("start_date", horizonDate)
          .is("canonical_event_id", null)
          .order("start_date", { ascending: true })
          .limit(60);

        if (allowedSourceIds && allowedSourceIds.length > 0) {
          tentpoleQuery = tentpoleQuery.in("source_id", allowedSourceIds);
        }
        tentpoleQuery = applyFeedGate(tentpoleQuery);
        if (portalId) {
          tentpoleQuery = applyFederatedPortalScopeToQuery(tentpoleQuery, {
            portalId,
            sourceIds: allowedSourceIds || [],
          });
        }

        const { data: tentpoleData, error: tentpoleError } = await tentpoleQuery;
        if (tentpoleError) {
          logger.error("load-big-stuff tentpoles error", {
            error: tentpoleError.message,
          });
        } else {
          const raw = (tentpoleData ?? []) as Array<{
            id: number;
            title: string;
            start_date: string;
            end_date: string | null;
            category: string | null;
            source_id: number | null;
            venue: { id: number; name: string; slug: string; neighborhood: string | null } | null;
          }>;
          tentpoles = raw
            .filter((event) =>
              isEventCategoryAllowedForSourceAccess(
                sourceAccess,
                event.source_id,
                event.category,
              ),
            )
            .map((e) => ({
              id: `event:${e.id}`,
              kind: "tentpole",
              title: e.title,
              startDate: e.start_date,
              endDate: e.end_date,
              location: e.venue?.name || e.venue?.neighborhood || null,
              href: `/${portalSlug}?event=${e.id}`,
            }));
        }
      }

      // Dedup tentpoles whose normalized title matches a festival name.
      const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
      const festivalNorms = festivals.map((f) => normalize(f.title));
      const dedupedTentpoles = tentpoles.filter((t) => {
        const norm = normalize(t.title);
        return !festivalNorms.some((fn) => fn.includes(norm) || norm.includes(fn));
      });

      return [...festivals, ...dedupedTentpoles];
    },
    { maxEntries: 100 },
  );
}

function addMonthsISO(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split("-").map((v) => parseInt(v, 10));
  const dt = new Date(Date.UTC(y, m - 1 + months, d));
  return dt.toISOString().slice(0, 10);
}
```

- [ ] **Step 4: Run the unit tests**

Run: `cd web && npx vitest run lib/city-pulse/loaders/load-big-stuff.test.ts`
Expected: PASS (7 tests green).

- [ ] **Step 5: TypeScript check**

Run: `cd web && npx tsc --noEmit`
Expected: no new errors. (Old errors elsewhere may exist — record them separately; don't fix in this task.)

- [ ] **Step 6: Commit**

```bash
git add web/lib/city-pulse/loaders/load-big-stuff.ts web/lib/city-pulse/loaders/load-big-stuff.test.ts
git commit -m "feat(feed): add Big Stuff loader with forward-looking query and month grouping"
```

---

## Task 4: (intentionally no-op — route stays unchanged)

The existing `/api/festivals/upcoming` route is still consumed by `web/lib/hooks/useFestivalsList.ts` to power the see-all page's filter UI (`search`, `categories`, `neighborhoods`, `price`, `date` query params). The Big Stuff loader is a NEW sibling module; the old route and its flat `{festivals, standalone_tentpoles}` payload remain untouched.

No file changes in this task. Skip ahead to Task 5.

---

## Task 5: Create the `BigStuffSection` component shell

**Files:**
- Create: `web/components/feed/sections/BigStuffSection.tsx`

**Goal:** New component with the final props shape, an empty render (returns `null` when no data), and a custom header (not `FeedSectionHeader`) matching the comp's gold chip + Crown + "APR 2026" + title + see-all layout. Body comes in Task 6. The old `FestivalsSection.tsx` stays untouched for now — the manifest swap happens in Task 9 so we can develop the new component in isolation.

Why a custom header instead of `FeedSectionHeader`: at `priority="secondary"` the shared header renders the `badge` prop as a small inline pill inside the `<h3>`, not as the comp's standalone gold chip with the Crown icon and "APR 2026" text. Building the header inline gives us the exact comp layout without fighting the variant system.

- [ ] **Step 1: Write the component shell**

Create `web/components/feed/sections/BigStuffSection.tsx`:

```typescript
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
```

- [ ] **Step 2: TypeScript check**

Run: `cd web && npx tsc --noEmit`
Expected: no new errors. The component isn't wired into the feed yet so there are no render consumers to break.

- [ ] **Step 3: Commit**

```bash
git add web/components/feed/sections/BigStuffSection.tsx
git commit -m "feat(feed): add BigStuffSection component shell (custom header + placeholder body)"
```

---

## Task 6: Implement the month-column body

**Files:**
- Modify: `web/components/feed/sections/BigStuffSection.tsx` (replace the `MonthColumn` placeholder)

**Goal:** Complete the ribbon body per the Pencil comp. Each column shows a month label (with gold dot for current month), up to 3 items (title + date), and a `+N more` overflow line when truncated. Sparse columns (0–1 items) get 40% opacity on the month label unless current. No em-dash.

- [ ] **Step 1: Replace `MonthColumn` with the full implementation**

Note: `MONTH_NAMES` and `monthLabel` were added to the file in Task 5. Reuse them — don't re-declare.

Replace the `MonthColumn` placeholder with the full version and add `ItemRow` + `SHORT_MONTH` + `formatItemDate` as file-level helpers:

```typescript
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
      className={`flex-1 min-w-0 flex flex-col gap-2.5 p-[14px] ${
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
  return `${startLabel} – ${SHORT_MONTH[em - 1]} ${ed}`;
}
```

The `group/ribbon` class on the outer container was already applied in Task 5 — no additional edit needed here.

- [ ] **Step 2: TypeScript check**

Run: `cd web && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add web/components/feed/sections/BigStuffSection.tsx
git commit -m "feat(feed): implement Big Stuff month-column body with item rows and overflow link"
```

---

## Task 7: Verify motion spec is in place (no code change expected)

**Files:** none — reading step.

**Goal:** Confirm entrance + hover are wired correctly and don't require additional edits.

- [ ] **Step 1: Confirm `feed-section-enter` is NOT added in BigStuffSection**

`FeedSectionReveal` already applies `feed-section-enter` + `is-visible` internally when the section enters the viewport (see `web/components/feed/FeedSectionReveal.tsx`). Re-adding it via `className` would double the class on the element. The plan uses only `className="pb-2"` on the reveal wrapper — confirm this is what Task 5's code shows.

- [ ] **Step 2: Confirm hover cascade is Tailwind-only (no `!important`)**

Task 6's `ItemRow` uses `group-hover/ribbon:opacity-75 hover:opacity-100`. The item's own `:hover` state wins because it applies when the mouse is on the item (which also means the ribbon group is hovered); the cascade works without `!important` because the `hover:` utility is declared after `group-hover/ribbon:` in the class string and generates higher specificity at the CSS-variant level. Don't add `!` — this repo doesn't use the pattern.

- [ ] **Step 3: TypeScript check (nothing to change)**

Run: `cd web && npx tsc --noEmit`
Expected: no new errors.

No commit — no file changed.

---

## Task 8: Mobile responsive pass

**Files:**
- Modify: `web/components/feed/sections/BigStuffSection.tsx`

**Goal:** At <640px, the 6-column flex row becomes a horizontal scroll with 3 visible columns at a time (column min-width 110px). Snap-x scroll. First column pinned-left so the current month is always the entry point.

- [ ] **Step 1: Update the ribbon container classes**

Replace the ribbon container opening div:

```typescript
<div
  className="group/ribbon flex flex-row rounded-card border border-[var(--twilight)] bg-[var(--night)] overflow-x-auto sm:overflow-hidden snap-x snap-mandatory [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
  data-bigstuff-ribbon
>
```

Note: `overflow-hidden` moves to `sm:overflow-hidden` so mobile allows horizontal scroll. Snap utilities added.

- [ ] **Step 2: Update the column classes**

Change `MonthColumn`'s outer div. Column gets a 110px mobile min-width, unset at `sm:` so flex takes over:

```typescript
<div
  className={`flex-shrink-0 sm:flex-shrink snap-start min-w-[110px] sm:min-w-0 sm:flex-1 flex flex-col gap-2.5 p-[14px] ${
    isFirst ? "" : "border-l border-[var(--twilight)]"
  }`}
>
```

Mobile: each column is fixed 110px min, does not shrink, snaps to start.
Desktop (`sm:`): resets to flex:1 so six columns distribute the content width equally.

- [ ] **Step 3: TypeScript check**

Run: `cd web && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add web/components/feed/sections/BigStuffSection.tsx
git commit -m "feat(feed): add mobile snap-scroll layout to Big Stuff ribbon"
```

---

## Task 9: Swap the manifest to render `BigStuffSection`

**Files:**
- Modify: `web/lib/city-pulse/manifests/atlanta.tsx`

**Goal:** Replace the `FestivalsSection` adapter with one that renders `BigStuffSection` and consumes the new `BigStuffFeedData` shape. The manifest entry for the `festivals` section now points to `loadBigStuffForFeed` from the new loader module.

- [ ] **Step 1: Edit the manifest**

In `web/lib/city-pulse/manifests/atlanta.tsx`:

Replace the existing import line:
```typescript
// Remove:
//   import FestivalsSection from "@/components/feed/sections/FestivalsSection";
// Add:
import BigStuffSection from "@/components/feed/sections/BigStuffSection";
```

Replace the old loader import block:
```typescript
// Remove:
//   import {
//     loadFestivalsForFeed,
//     type FestivalsFeedData,
//   } from "../loaders/load-festivals";

// Add:
import {
  loadBigStuffForFeed,
  type BigStuffFeedData,
} from "../loaders/load-big-stuff";
```

Replace the `FestivalsSectionIsland` function with:

```typescript
function BigStuffSectionIsland({ ctx, initialData }: FeedSectionComponentProps) {
  const data = initialData as BigStuffFeedData | null | undefined;
  return (
    <BigStuffSection
      portalSlug={ctx.portalSlug}
      portalId={ctx.portalId}
      initialData={data ?? null}
    />
  );
}
```

Update the manifest entry (the `festivals` section object) to reference the renamed island and new loader:

```typescript
{
  id: "festivals",
  render: "server",
  component: BigStuffSectionIsland,
  loader: loadBigStuffForFeed,
  wrapper: {
    id: "city-pulse-festivals",
    className: "scroll-mt-28",
    dataAnchor: true,
    indexLabel: "The Big Stuff",
    blockId: "festivals",
  },
  shouldRender: (ctx) => Boolean(ctx.portalId),
},
```

- [ ] **Step 2: TypeScript check**

Run: `cd web && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Start dev server and load Atlanta feed**

```bash
cd web && npm run dev
```

Visit `http://localhost:3000/atlanta`. Scroll to The Big Stuff section. Expected: the new typographic ribbon renders in place of the old carousel.

- [ ] **Step 4: Commit**

```bash
git add web/lib/city-pulse/manifests/atlanta.tsx
git commit -m "feat(feed): swap manifest to render BigStuffSection"
```

---

## Task 10: Update the see-all page copy

**Files:**
- Modify: `web/app/[portal]/festivals/page.tsx`

**Goal:** The page title and copy still lean on "festivals." Update to neutral "Big Stuff" language so tentpole events (DragonCon, Music Midtown) read naturally as peers.

- [ ] **Step 1: Update the metadata description**

Find the `generateMetadata` return (around line 30–36):

```typescript
return {
  title: `The Big Stuff | ${portalName}`,
  description: `The biggest events and festivals in ${portalName}. Curated tentpole events you won't want to miss.`,
};
```

Update the description:

```typescript
return {
  title: `The Big Stuff | ${portalName}`,
  description: `Festivals, tentpole events, and season-defining moments coming up in ${portalName}. Mark your calendar.`,
};
```

- [ ] **Step 2: Soften the empty state copy**

Find the empty state paragraph (around line 253–258):

```typescript
<p className="text-[var(--muted)]">
  No major events coming up yet. Check back soon!
</p>
```

Change to:

```typescript
<p className="text-[var(--muted)]">
  Nothing on the 6-month horizon yet. Check back soon.
</p>
```

- [ ] **Step 3: Browser-verify**

Visit `http://localhost:3000/atlanta/festivals`. Expected: heading "The Big Stuff", neutral description, updated empty state.

- [ ] **Step 4: Commit**

```bash
git add web/app/[portal]/festivals/page.tsx
git commit -m "chore(feed): neutralize 'festivals' language on Big Stuff see-all page"
```

---

## Task 11: Delete dead `WhatsHappeningSection` component

**Files:**
- Delete: `web/components/feed/sections/WhatsHappeningSection.tsx`

**Goal:** This file is not imported anywhere; it carries an older iteration of the festivals+tentpoles data model. Remove to keep the section directory clean.

- [ ] **Step 1: Confirm no imports**

Run:

```bash
grep -rn "WhatsHappeningSection\|whats-happening\|whats_happening" web/ 2>/dev/null
```

Expected: only the file itself matches. If anything else imports it, STOP and flag.

- [ ] **Step 2: Delete the file**

```bash
git rm web/components/feed/sections/WhatsHappeningSection.tsx
```

- [ ] **Step 3: TypeScript check**

Run: `cd web && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(feed): remove dead WhatsHappeningSection component"
```

---

## Task 12: Delete the old `FestivalsSection` component

**Files:**
- Delete: `web/components/feed/sections/FestivalsSection.tsx`

**Goal:** After Task 9 the manifest no longer references `FestivalsSection`. Remove the file so future readers aren't confused by two implementations.

- [ ] **Step 1: Confirm no imports**

Run:

```bash
grep -rn "FestivalsSection\|from.*FestivalsSection" web/ 2>/dev/null | grep -v "node_modules" | grep -v "BigStuffSection"
```

Expected: no matches outside the file itself.

- [ ] **Step 2: Delete**

```bash
git rm web/components/feed/sections/FestivalsSection.tsx
```

- [ ] **Step 3: Full TypeScript check + lint**

```bash
cd web && npx tsc --noEmit && npm run lint
```

Expected: no new errors. (Lint should pass clean on touched files; pre-existing lint issues elsewhere don't block this task.)

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(feed): remove old FestivalsSection carousel (superseded by BigStuffSection)"
```

---

## Task 13: Browser verification — desktop

**Files:** none — manual verification step.

**Goal:** Load the Atlanta feed in a real browser and confirm visual + functional correctness against the comp at desktop viewport.

- [ ] **Step 1: Start dev server (if not already running)**

```bash
cd web && npm run dev
```

- [ ] **Step 2: Open Chrome at 1440×900**

Navigate to `http://localhost:3000/atlanta`. Scroll to "The Big Stuff" section.

- [ ] **Step 3: Check the checklist**

Confirm each:
- [ ] Ribbon is a single horizontal row, full content-width (no dead right-side space).
- [ ] 3–6 columns depending on data density. Columns with ≥2 items render at full opacity.
- [ ] Current-month column has a small gold dot before the label.
- [ ] Header badge reads e.g. "APR 2026" in a gold chip with Crown icon.
- [ ] Sparse columns (1 item) have month label at ~40% opacity unless it's the current month.
- [ ] Empty months entirely absent from the visible ribbon (`trimVisibleMonths` working).
- [ ] Hovering an item: siblings dim to 75%, hovered item stays 100%, title gains gold underline.
- [ ] "+N more" link renders when a month has >3 items.
- [ ] "See all →" link at header top-right navigates to `/atlanta/festivals`.
- [ ] Clicking an item navigates to its detail page (festival → `/atlanta/festivals/[slug]`, tentpole → overlay).
- [ ] No console errors, no console warnings specific to Big Stuff.
- [ ] Ribbon height at desktop: ~180–220px total (header + body).

- [ ] **Step 4: Screenshot**

Take a screenshot of the ribbon in its feed context (with The Lineup above and Now Showing below in frame). Save to `/tmp/big-stuff-desktop.png` for the handoff verify step (Task 14).

No commit — verification step.

---

## Task 14: Design handoff verify

**Files:** none — uses the `/design-handoff verify` skill.

**Goal:** Compare the live implementation against the Pencil comp. The skill flags divergence in typography, spacing, color, and layout.

- [ ] **Step 1: Run the verify skill**

Invoke: `/design-handoff verify qOUCP http://localhost:3000/atlanta`

Follow skill prompts. It takes a screenshot of the ribbon at desktop, compares against the extracted spec from Task 2, and reports deltas.

- [ ] **Step 2: Address any blocking deltas**

Common issues to expect:
- Font size drift (Outfit 12 vs 14 — designer note said "consider 14 at implementation"; defer to verify signal)
- Stroke/border thickness mismatch between month dividers
- Padding off by 1–2px (usually OK unless it snowballs)

Record notes in a scratch file; fix non-blocking nits after Task 15 (or punt to a follow-up commit).

- [ ] **Step 3: Mobile truncation check (manual, real Chrome)**

`resize_window` is a no-op on the viewport (per memory `feedback_mcp_browser_hidden_tab.md`). Do this step manually in a real Chrome window:
1. Open Chrome DevTools, device toolbar, iPhone 12 (390×844).
2. Visit `http://localhost:3000/atlanta`.
3. Scroll to Big Stuff. Confirm:
   - Horizontal scroll works (snap-x, 3 columns visible at once, ~110–120px each).
   - No mid-word truncation on event titles ("Shaky Knees", "Music Midtown" etc. all fit).
   - If any title truncates mid-word, flag to the plan executor for decision: widen columns to 130px, or abbreviate titles at data-layer ("Atlanta Jazz Festival" → "Jazz Festival") via a source-side alias. **Mid-word truncation is a hard block** per the anti-pattern gallery.

- [ ] **Step 4: Record verdict**

In the verify output, the skill returns PASS / PASS-WITH-NOTES / BLOCK. Record.

No commit — verification step.

---

## Task 15: Final lint, TypeScript, and release commit

**Files:** none specific — runs against the whole codebase.

**Goal:** Ship clean.

- [ ] **Step 1: Full TypeScript check**

```bash
cd web && npx tsc --noEmit
```

Expected: no new errors attributable to this workstream. (Record any pre-existing errors separately.)

- [ ] **Step 2: Lint the touched files**

```bash
cd web && npm run lint -- components/feed/sections/BigStuffSection.tsx lib/city-pulse/loaders/load-big-stuff.ts lib/city-pulse/loaders/load-big-stuff.test.ts app/\[portal\]/festivals/page.tsx lib/city-pulse/manifests/atlanta.tsx
```

Expected: no errors, no warnings.

- [ ] **Step 3: Unit tests**

```bash
cd web && npx vitest run lib/city-pulse/loaders
```

Expected: PASS (the 7 tests from Task 3 + any adjacent tests).

- [ ] **Step 4: Final verification sweep**

Re-visit `http://localhost:3000/atlanta` in the browser. Confirm:
- [ ] The Big Stuff renders with real data.
- [ ] No console errors.
- [ ] Feed sections above and below (The Lineup, Now Showing) still render correctly — no regression.

- [ ] **Step 5: Create PR**

```bash
git log --oneline main..HEAD
```

Confirm the commit list tells a clean story: loader add → component build → manifest swap → see-all copy → dead code removal → verification.

Create PR with:

Title: `feat(feed): rebuild Big Stuff as compact month ribbon`

Body (suggested):

```
## Summary
- Replaces the 4-card "Big Stuff" festival carousel with a compact typographic month ribbon (Option A from the /elevate audit).
- Data window is now forward-looking (`start_date > today`) and gated on `announced_2026 = true`; no more "Happening Now" items colliding with The Lineup.
- Dynamic column count (3–6) based on data density. Pure typography — no images, no countdown urgency badges.
- Mobile: horizontal snap-scroll, 3 columns visible.

## Design reference
- Pencil comp: `docs/design-system.pen` node `qOUCP`.
- Audit / plan: `docs/superpowers/plans/2026-04-18-big-stuff-month-ribbon.md`.

## Test plan
- [x] Unit: `web/lib/city-pulse/loaders/load-big-stuff.test.ts` — grouping, truncation, forward-filter, empty-month, year-rollover, beyond-horizon behavior.
- [x] Browser desktop: Atlanta feed renders ribbon, sibling hover dim works, "+N more" overflow links work.
- [x] Browser mobile (real Chrome, iPhone 12): snap-scroll, no mid-word truncation.
- [x] `/design-handoff verify qOUCP http://localhost:3000/atlanta`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

No commit in this step — the PR is the ship unit.

---

## Self-Review Notes

**Spec coverage:**
- Form (3–6 dynamic columns, typography-only, ~180px): covered by Tasks 5, 6, 8.
- Header (subheader, title, current-month badge, see-all): covered by Task 5 (custom `BigStuffHeader` — not `FeedSectionHeader`, because the `secondary` priority doesn't render the badge as a standalone gold chip).
- Typography spec: covered by Tasks 2 (extract) + 5/6 (apply).
- Data rules (forward-only, `announced_2026`, tentpole peers, dynamic columns, 6-month ceiling): covered by Tasks 1, 3.
- Motion spec (entrance via `FeedSectionReveal`, hover opacity lift, underline reveal, no scroll trigger): covered by Tasks 5, 6, 7.
- Mobile (snap-scroll, 3 visible, 110–120px columns, truncation test): covered by Tasks 8, 14.
- See-all page (neutralize festival framing): covered by Task 10.
- Cleanup (`WhatsHappeningSection`, old `FestivalsSection`): covered by Tasks 11, 12.
- Process gates (pre-flight audit, extract, implementation, browser verify, handoff verify, lint/tsc): covered by Tasks 1, 2, 3, 5–9, 13, 14, 15.

**Explicitly out of scope:**
- `/api/festivals/upcoming` route and `load-festivals.ts` are NOT modified. They continue to power the see-all page's filter UI via `useFestivalsList`. Task 4 is a no-op placeholder.

**Type consistency:**
- Task 3 defines `BigStuffMonthBucket.isCurrentMonth` (boolean). Task 5's `MonthColumn` and `trimVisibleMonths` consume it. Consistent.
- Task 3 defines `overflowCount` (number). Task 6's `MonthColumn` renders `+N more` when `overflowCount > 0`. Consistent.
- `BigStuffFeedData` now only holds `items: BigStuffItem[]` (no `currentMonthLabel`). Task 5 computes `currentMonthLabel` at render from `new Date()`. Consistent.
- Task 3 `loadBigStuffForFeed` returns `BigStuffFeedData | null`. Task 9's manifest consumes the same type. Consistent.

**Changes in response to expert review (2026-04-18):**
- **(architect-review, full-stack-dev)** Route preserved: new sibling loader `load-big-stuff.ts` instead of rewriting `load-festivals.ts`. Task 4 is now a no-op.
- **(architect-review)** Display strings computed at render, not cached.
- **(full-stack-dev)** Custom header in `BigStuffSection` (bypasses `FeedSectionHeader` limitations at `secondary` priority).
- **(full-stack-dev)** `hover:opacity-100` (no `!`) — matches codebase conventions.
- **(full-stack-dev)** No re-adding `feed-section-enter` (already in `FeedSectionReveal`).
- **(architect-review)** Added year-rollover + beyond-horizon test cases.

**Known gotchas flagged in memory that apply here:**
- `as never` pattern for Supabase writes — N/A, this workstream is all reads.
- `SmartImage` vs `next/image` — N/A, the new component has no images.
- `text-[var(--text-xs)]` Tailwind v4 bug — avoided; using bare `text-xs`, `text-sm`.
- Pencil MCP `fill` vs `fills` — N/A, no Pencil edits remain after extraction.
- `mask-fade-x` on carousels — avoided; the ribbon isn't a carousel (snap-scroll only on mobile, no edge fades).
