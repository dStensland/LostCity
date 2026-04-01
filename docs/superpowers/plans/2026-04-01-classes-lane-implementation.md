# Classes & Workshops Lane — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Classes lane in the Find tab — a studio-first browsing experience with category/date/skill filters, venue-grouped results, and deduplicated class schedules.

**Architecture:** A new `ClassesView` component replaces the "Coming soon" placeholder in `FindShellClient`. It uses a new `/api/classes/studios` endpoint for server-side studio grouping and the existing `/api/classes` endpoint (with a new `place_id` filter) for studio schedules. A `useClassesData` hook manages fetching and caching. The Explore Home classes lane is updated from zero state to alive.

**Tech Stack:** Next.js 16 App Router, Supabase, Tailwind v4, Phosphor Icons, `window.history.replaceState` for URL sync

**Spec:** `docs/superpowers/specs/2026-04-01-classes-lane-design.md` (v2)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `web/app/api/classes/route.ts` | Modify | Add `place_id` / `place_slug` filter |
| `web/app/api/classes/studios/route.ts` | Create | Server-side studio grouping endpoint |
| `web/lib/hooks/useClassesData.ts` | Create | Data fetching hook with caching |
| `web/lib/class-categories.ts` | Create | Category metadata (labels, icons, merged list) |
| `web/components/find/classes/ClassStudioCard.tsx` | Create | Studio card component |
| `web/components/find/classes/ClassCard.tsx` | Create | Class row in schedule |
| `web/components/find/classes/ClassStudiosList.tsx` | Create | Studios list with filter bar |
| `web/components/find/classes/ClassStudioSchedule.tsx` | Create | Deduplicated class schedule |
| `web/components/find/ClassesView.tsx` | Create | Top-level lane component, URL routing |
| `web/components/find/FindShellClient.tsx` | Modify | Wire ClassesView, replace placeholder |
| `web/lib/explore-home-data.ts` | Modify | Classes lane alive state |

---

### Task 1: Add `place_id` Filter to `/api/classes`

The existing `/api/classes` endpoint can't filter by venue. The studio schedule (Level 2) needs this.

**Files:**
- Modify: `web/app/api/classes/route.ts`

- [ ] **Step 1: Read the existing route**

Read `web/app/api/classes/route.ts` to understand the full query builder. Find where other filters (class_category, skill_level, neighborhood) are applied — the `place_id` filter goes in the same section.

- [ ] **Step 2: Add the filter parameter**

After the existing parameter extraction section (around lines 63-90), add:

```typescript
const placeId = searchParams.get("place_id");
const placeSlug = searchParams.get("place_slug");
```

In the query builder section (around lines 215-251), after the neighborhood filter, add:

```typescript
if (placeId) {
  const parsed = parseInt(placeId, 10);
  if (!isNaN(parsed)) {
    query = query.eq("place_id", parsed);
  }
}
if (placeSlug && !placeId) {
  // Resolve slug to place_id
  const { data: place } = await supabase
    .from("places")
    .select("id")
    .eq("slug", placeSlug)
    .maybeSingle();
  if (place) {
    query = query.eq("place_id", (place as { id: number }).id);
  }
}
```

Also increase the limit cap when `place_id` is provided (studio schedule needs all classes for a venue):

```typescript
const maxLimit = placeId || placeSlug ? 200 : 50;
const limit = Math.min(parseIntParam(searchParams.get("limit"), 20) ?? 20, maxLimit);
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
git add web/app/api/classes/route.ts
git commit -m "feat(classes): add place_id/place_slug filter to /api/classes"
```

---

### Task 2: Create `/api/classes/studios` Endpoint

Server-side studio grouping. Returns studios with class counts, category counts, and next-class teaser.

**Files:**
- Create: `web/app/api/classes/studios/route.ts`

- [ ] **Step 1: Read the existing `/api/classes/route.ts` for patterns**

Copy the portal scoping pattern (resolvePortalQueryContext, createPortalScopedClient, applyFederatedPortalScopeToQuery) and caching pattern.

- [ ] **Step 2: Create the endpoint**

The endpoint queries events with `is_class = true`, groups by venue, and returns studio summaries + category counts.

```typescript
// web/app/api/classes/studios/route.ts

import { NextRequest, NextResponse } from "next/server";
import { resolvePortalQueryContext } from "@/lib/portal-query-context";
import { createPortalScopedClient } from "@/lib/supabase/server";
import { getSharedCacheJson, setSharedCacheJson } from "@/lib/shared-cache";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

const CACHE_NAMESPACE = "api:classes-studios";
const CACHE_TTL_MS = 90 * 1000;
const CACHE_MAX_ENTRIES = 50;

export async function GET(request: NextRequest) {
  // Rate limit
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { searchParams } = new URL(request.url);
  const classCategory = searchParams.get("class_category");
  const startDate = searchParams.get("start_date");
  const endDate = searchParams.get("end_date");
  const skillLevel = searchParams.get("skill_level");
  const portalSlug = searchParams.get("portal") || searchParams.get("portal_id");

  // Resolve portal
  // [Follow the exact same portal resolution pattern from /api/classes/route.ts]
  // Use resolvePortalQueryContext, createPortalScopedClient, etc.

  // Build cache key
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
  const cacheKey = `${portalSlug}|${classCategory || "all"}|${startDate || today}|${endDate || ""}|${skillLevel || "all"}`;

  // Check cache
  const cached = await getSharedCacheJson(CACHE_NAMESPACE, cacheKey);
  if (cached) {
    return NextResponse.json(cached, {
      headers: { "Cache-Control": "public, s-maxage=90, stale-while-revalidate=180" },
    });
  }

  // Query: all class events with filters, selecting venue join
  // Build query following /api/classes pattern:
  // .eq("is_class", true)
  // .gte("start_date", startDate || today)
  // .is("canonical_event_id", null)
  // + class_category, skill_level filters
  // + portal scoping
  // Select: id, title, start_date, start_time, class_category, place_id,
  //         venue:places(id, name, slug, neighborhood, lat, lng, image_url)
  // Order by start_date asc
  // Limit: 500 (safety cap)

  // Group results by place_id in JS
  // For each venue: { place_id, name, slug, neighborhood, lat, lng, image_url,
  //                   class_count, categories: Set, next_class: { title, start_date, start_time } }

  // Compute category_counts from the raw data
  // { painting: 24, cooking: 18, ... }

  // Return response shape:
  // { studios: [...], category_counts: {...}, total_count: N }

  // Cache and return
}
```

**IMPORTANT:** Read the actual portal scoping code from `/api/classes/route.ts` and replicate it exactly. Don't guess — copy the imports, the `resolvePortalQueryContext` call, the `createPortalScopedClient` call, and the `applyFederatedPortalScopeToQuery` call.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 4: Manual smoke test**

```bash
curl -s "http://localhost:3000/api/classes/studios?portal=atlanta" | jq '{total_count: .total_count, studio_count: (.studios | length), category_counts: .category_counts}'
```

Expected: JSON with studios array, category_counts object, total_count number.

- [ ] **Step 5: Commit**

```bash
git add web/app/api/classes/studios/route.ts
git commit -m "feat(classes): add /api/classes/studios server-side grouping endpoint"
```

---

### Task 3: Class Category Metadata

Shared category definitions with labels, icons, and the 8-category merged list.

**Files:**
- Create: `web/lib/class-categories.ts`

- [ ] **Step 1: Create the metadata file**

```typescript
// web/lib/class-categories.ts

import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import {
  Palette,
  CookingPot,
  HandGrabbing,
  PersonSimpleRun,
  Barbell,
  Hammer,
  Camera,
  Sparkle,
} from "@phosphor-icons/react";

export interface ClassCategory {
  slug: string;
  label: string;
  icon: PhosphorIcon;
  /** API values that map to this UI category */
  apiValues: string[];
}

/**
 * 8 UI categories (merged from 11 API categories).
 * "candle-making" + "floral" + "mixed" → "crafts"
 * "outdoor-skills" → merged into "fitness"
 */
export const CLASS_CATEGORIES: ClassCategory[] = [
  { slug: "painting", label: "Painting", icon: Palette, apiValues: ["painting"] },
  { slug: "cooking", label: "Cooking", icon: CookingPot, apiValues: ["cooking"] },
  { slug: "pottery", label: "Pottery", icon: HandGrabbing, apiValues: ["pottery"] },
  { slug: "dance", label: "Dance", icon: PersonSimpleRun, apiValues: ["dance"] },
  { slug: "fitness", label: "Fitness", icon: Barbell, apiValues: ["fitness", "outdoor-skills"] },
  { slug: "woodworking", label: "Woodworking", icon: Hammer, apiValues: ["woodworking"] },
  { slug: "photography", label: "Photography", icon: Camera, apiValues: ["photography"] },
  { slug: "crafts", label: "Crafts", icon: Sparkle, apiValues: ["candle-making", "floral", "mixed"] },
];

/** Map a raw API class_category to the merged UI category slug */
export function toUiCategory(apiCategory: string | null): string {
  if (!apiCategory) return "crafts";
  for (const cat of CLASS_CATEGORIES) {
    if (cat.apiValues.includes(apiCategory)) return cat.slug;
  }
  return "crafts";
}

/** Get the UI category metadata by slug */
export function getCategoryMeta(slug: string): ClassCategory | undefined {
  return CLASS_CATEGORIES.find((c) => c.slug === slug);
}

/** Get the API values for a UI category slug (for query filtering) */
export function getApiValues(uiSlug: string): string[] {
  const cat = getCategoryMeta(uiSlug);
  return cat?.apiValues ?? [];
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add web/lib/class-categories.ts
git commit -m "feat(classes): add class category metadata with merged 8-category list"
```

---

### Task 4: `useClassesData` Hook

Data fetching hook that manages both studios list and studio schedule data.

**Files:**
- Create: `web/lib/hooks/useClassesData.ts`

- [ ] **Step 1: Create the hook**

Follow the `useLaneSpots` pattern (useState + useEffect with AbortController). The hook manages two fetch modes: studios list and studio schedule.

```typescript
// web/lib/hooks/useClassesData.ts

import { useState, useEffect, useCallback, useRef } from "react";

export interface StudioSummary {
  place_id: number;
  name: string;
  slug: string;
  neighborhood: string | null;
  lat: number | null;
  lng: number | null;
  image_url: string | null;
  class_count: number;
  categories: string[];
  next_class: { title: string; start_date: string; start_time: string | null } | null;
}

export interface StudiosResponse {
  studios: StudioSummary[];
  category_counts: Record<string, number>;
  total_count: number;
}

export interface ClassEvent {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  end_time: string | null;
  class_category: string | null;
  skill_level: string | null;
  instructor: string | null;
  capacity: number | null;
  price_min: number | null;
  is_free: boolean | null;
  image_url: string | null;
  series_id: string | null;
  slug: string | null;
  venue: { id: number; name: string; slug: string; neighborhood: string | null } | null;
}

interface UseClassesDataParams {
  portalSlug: string;
  category?: string | null;
  dateWindow?: string | null;
  skillLevel?: string | null;
  search?: string | null;
  studioSlug?: string | null;
}

interface UseClassesDataResult {
  studios: StudiosResponse | null;
  schedule: ClassEvent[] | null;
  studiosLoading: boolean;
  scheduleLoading: boolean;
  error: string | null;
}

export function useClassesData({
  portalSlug,
  category,
  dateWindow,
  skillLevel,
  search,
  studioSlug,
}: UseClassesDataParams): UseClassesDataResult {
  const [studios, setStudios] = useState<StudiosResponse | null>(null);
  const [schedule, setSchedule] = useState<ClassEvent[] | null>(null);
  const [studiosLoading, setStudiosLoading] = useState(true);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cache studios data to avoid refetch on back navigation
  const studiosCache = useRef<Map<string, StudiosResponse>>(new Map());

  // Compute date range from window
  const dateRange = computeDateRange(dateWindow);

  // Fetch studios list
  useEffect(() => {
    if (studioSlug) return; // Don't fetch studios when viewing a schedule

    const cacheKey = `${category || "all"}|${dateWindow || "week"}|${skillLevel || "all"}|${search || ""}`;
    const cached = studiosCache.current.get(cacheKey);
    if (cached) {
      setStudios(cached);
      setStudiosLoading(false);
      return;
    }

    setStudiosLoading(true);
    setError(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const params = new URLSearchParams({ portal: portalSlug });
    if (category) {
      // Map UI category to API values — need to import getApiValues
      // and pass each value, or pass the UI slug and let the API handle it
      params.set("class_category", category);
    }
    if (dateRange.start) params.set("start_date", dateRange.start);
    if (dateRange.end) params.set("end_date", dateRange.end);
    if (skillLevel && skillLevel !== "all") params.set("skill_level", skillLevel);
    if (search) params.set("q", search);

    fetch(`/api/classes/studios?${params}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Failed to load"))))
      .then((json: StudiosResponse) => {
        setStudios(json);
        studiosCache.current.set(cacheKey, json);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError("Unable to load classes");
      })
      .finally(() => {
        clearTimeout(timeoutId);
        setStudiosLoading(false);
      });

    return () => { controller.abort(); clearTimeout(timeoutId); };
  }, [portalSlug, category, dateWindow, skillLevel, search, studioSlug, dateRange.start, dateRange.end]);

  // Fetch studio schedule
  useEffect(() => {
    if (!studioSlug) {
      setSchedule(null);
      return;
    }

    setScheduleLoading(true);
    setError(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const params = new URLSearchParams({
      portal: portalSlug,
      place_slug: studioSlug,
      limit: "200",
    });
    if (dateRange.start) params.set("start_date", dateRange.start);
    if (dateRange.end) params.set("end_date", dateRange.end);
    if (skillLevel && skillLevel !== "all") params.set("skill_level", skillLevel);

    fetch(`/api/classes?${params}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Failed to load"))))
      .then((json) => setSchedule((json as { classes: ClassEvent[] }).classes))
      .catch((err) => {
        if (err.name !== "AbortError") setError("Unable to load schedule");
      })
      .finally(() => {
        clearTimeout(timeoutId);
        setScheduleLoading(false);
      });

    return () => { controller.abort(); clearTimeout(timeoutId); };
  }, [portalSlug, studioSlug, dateRange.start, dateRange.end, skillLevel]);

  return { studios, schedule, studiosLoading, scheduleLoading, error };
}

function computeDateRange(window: string | null | undefined): { start: string; end: string | null } {
  const now = new Date();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(now);
  const d = new Date(today + "T00:00:00");

  switch (window) {
    case "weekend": {
      const day = d.getDay();
      const fri = new Date(d);
      const sun = new Date(d);
      if (day <= 5) {
        fri.setDate(d.getDate() + (5 - day));
        sun.setDate(d.getDate() + (7 - day));
      } else if (day === 6) {
        fri.setDate(d.getDate() - 1);
        sun.setDate(d.getDate() + 1);
      } else {
        fri.setDate(d.getDate() - 2);
      }
      return { start: fri.toISOString().slice(0, 10), end: sun.toISOString().slice(0, 10) };
    }
    case "2weeks": {
      const end = new Date(d);
      end.setDate(d.getDate() + 14);
      return { start: today, end: end.toISOString().slice(0, 10) };
    }
    case "all":
      return { start: today, end: null };
    default: // "week"
    {
      const end = new Date(d);
      end.setDate(d.getDate() + 7);
      return { start: today, end: end.toISOString().slice(0, 10) };
    }
  }
}
```

**IMPORTANT:** The actual types returned by `/api/classes` and `/api/classes/studios` may differ from the interfaces above. Read the actual API responses and adapt the types to match.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add web/lib/hooks/useClassesData.ts
git commit -m "feat(classes): add useClassesData hook with caching"
```

---

### Task 5: `ClassStudioCard` Component

Studio card for the studios list.

**Files:**
- Create: `web/components/find/classes/ClassStudioCard.tsx`

- [ ] **Step 1: Create the component**

Follow the VenueCard pattern from the design system. Uses SmartImage for venue photos with IconBox fallback.

```typescript
// web/components/find/classes/ClassStudioCard.tsx
"use client";

import Link from "next/link";
import SmartImage from "@/components/SmartImage";
import { Dot } from "@/components/ui/Dot";
import { getCategoryMeta } from "@/lib/class-categories";
import type { StudioSummary } from "@/lib/hooks/useClassesData";

interface ClassStudioCardProps {
  studio: StudioSummary;
  portalSlug: string;
  activeCategory?: string | null;
}

export function ClassStudioCard({ studio, portalSlug, activeCategory }: ClassStudioCardProps) {
  const scheduleUrl = `/${portalSlug}?view=find&lane=classes&studio=${studio.slug}${activeCategory ? `&category=${activeCategory}` : ""}`;

  // Format next class teaser
  const nextTeaser = studio.next_class
    ? `Next: ${studio.next_class.title} · ${formatClassTime(studio.next_class.start_date, studio.next_class.start_time)}`
    : null;

  // Primary category for fallback icon
  const primaryCat = getCategoryMeta(studio.categories[0] || "crafts");

  return (
    <div className="flex items-center gap-4 p-4 rounded-card bg-[var(--night)] border border-[var(--twilight)]/40">
      {/* Venue image or fallback */}
      <div className="w-20 h-20 rounded-lg shrink-0 overflow-hidden relative">
        {studio.image_url ? (
          <SmartImage src={studio.image_url} alt={studio.name} fill className="object-cover" />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ backgroundColor: "color-mix(in srgb, #C9874F 15%, transparent)" }}
          >
            {primaryCat && <primaryCat.icon size={28} weight="duotone" className="text-[#C9874F]" />}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-base font-semibold text-[var(--cream)] truncate">{studio.name}</p>
        <div className="flex items-center gap-1.5 text-sm text-[var(--soft)]">
          {studio.neighborhood && <span className="truncate">{studio.neighborhood}</span>}
        </div>
        <p className="font-mono text-xs font-medium" style={{ color: "#C9874F" }}>
          {studio.class_count} class{studio.class_count !== 1 ? "es" : ""} this week
        </p>
        {nextTeaser && (
          <p className="text-xs text-[var(--muted)] truncate">{nextTeaser}</p>
        )}
      </div>

      {/* Action */}
      <Link
        href={scheduleUrl}
        className="shrink-0 text-xs font-medium hover:opacity-80 transition-opacity"
        style={{ color: "#C9874F" }}
      >
        See schedule →
      </Link>
    </div>
  );
}

function formatClassTime(date: string, time: string | null): string {
  const d = new Date(date + "T00:00:00");
  const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
  if (!time) return dayName;
  const t = new Date(`2000-01-01T${time}`);
  const timeStr = t.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${dayName} ${timeStr}`;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add web/components/find/classes/ClassStudioCard.tsx
git commit -m "feat(classes): add ClassStudioCard component"
```

---

### Task 6: `ClassCard` Component + Series Deduplication

Class row for the studio schedule, with series dedup logic.

**Files:**
- Create: `web/components/find/classes/ClassCard.tsx`

- [ ] **Step 1: Create the dedup utility and card component**

The component receives pre-grouped class data and renders it. The grouping logic lives in a utility function that can be tested independently.

```typescript
// web/components/find/classes/ClassCard.tsx
"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import type { ClassEvent } from "@/lib/hooks/useClassesData";

// ---------------------------------------------------------------------------
// Series grouping types
// ---------------------------------------------------------------------------
export interface GroupedClass {
  key: string;
  title: string;
  skillLevel: string | null;
  instructor: string | null;
  capacity: number | null;
  priceMin: number | null;
  isFree: boolean | null;
  pattern: string; // "Tuesdays & Thursdays, 6–8 PM" or "Saturday, Apr 12 · 10 AM – 1 PM"
  patternType: "recurring" | "multi-session" | "one-off" | "irregular";
  nextDate: string;
  nextTime: string | null;
  detailUrl: string;
  instances: ClassEvent[];
}

// ---------------------------------------------------------------------------
// Grouping logic
// ---------------------------------------------------------------------------
export function groupClassesBySeries(classes: ClassEvent[], portalSlug: string): GroupedClass[] {
  const groups = new Map<string, ClassEvent[]>();

  for (const cls of classes) {
    // Primary: group by series_id
    // Fallback: group by (place_id + normalized_title + start_time)
    const key = cls.series_id
      ? `series:${cls.series_id}`
      : `title:${cls.venue?.id ?? 0}:${normalizeTitle(cls.title)}:${cls.start_time ?? ""}`;

    const existing = groups.get(key) ?? [];
    existing.push(cls);
    groups.set(key, existing);
  }

  // Convert to GroupedClass entries
  const result: GroupedClass[] = [];
  for (const [key, instances] of groups) {
    // Sort instances by date
    instances.sort((a, b) => a.start_date.localeCompare(b.start_date));
    const first = instances[0];
    const upcoming = instances.find((i) => i.start_date >= todayET()) ?? first;

    result.push({
      key,
      title: first.title,
      skillLevel: first.skill_level,
      instructor: first.instructor,
      capacity: first.capacity,
      priceMin: first.price_min,
      isFree: first.is_free,
      pattern: derivePattern(instances),
      patternType: derivePatternType(instances),
      nextDate: upcoming.start_date,
      nextTime: upcoming.start_time,
      detailUrl: `/${portalSlug}/events/${upcoming.slug || upcoming.id}`,
      instances,
    });
  }

  // Sort: recurring first (alphabetical), then one-offs by date
  result.sort((a, b) => {
    if (a.patternType === "one-off" && b.patternType !== "one-off") return 1;
    if (a.patternType !== "one-off" && b.patternType === "one-off") return -1;
    if (a.patternType === "one-off") return a.nextDate.localeCompare(b.nextDate);
    return a.title.localeCompare(b.title);
  });

  return result;
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/\s+/g, " ").trim();
}

function todayET(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
}

function derivePatternType(instances: ClassEvent[]): GroupedClass["patternType"] {
  if (instances.length === 1) return "one-off";
  // Check if all on the same weekday(s)
  const days = new Set(instances.map((i) => new Date(i.start_date + "T00:00:00").getDay()));
  if (days.size <= 2 && instances.length >= 3) return "recurring";
  if (instances.length >= 3 && instances.length <= 12) return "multi-session";
  return "irregular";
}

function derivePattern(instances: ClassEvent[]): string {
  if (instances.length === 1) {
    const d = new Date(instances[0].start_date + "T00:00:00");
    const dateStr = d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
    const timeStr = formatTimeRange(instances[0].start_time, instances[0].end_time);
    return timeStr ? `${dateStr} · ${timeStr}` : dateStr;
  }

  const type = derivePatternType(instances);

  if (type === "recurring") {
    const dayNames = [...new Set(instances.map((i) => {
      return new Date(i.start_date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long" });
    }))];
    const dayStr = dayNames.length === 1 ? `${dayNames[0]}s` : dayNames.map((d) => `${d}s`).join(" & ");
    const timeStr = formatTimeRange(instances[0].start_time, instances[0].end_time);
    return timeStr ? `${dayStr}, ${timeStr}` : dayStr;
  }

  if (type === "multi-session") {
    const first = new Date(instances[0].start_date + "T00:00:00");
    const last = new Date(instances[instances.length - 1].start_date + "T00:00:00");
    const firstStr = first.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const lastStr = last.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return `${instances.length} sessions · ${firstStr} – ${lastStr}`;
  }

  return "Multiple sessions";
}

function formatTimeRange(start: string | null, end: string | null): string {
  if (!start) return "";
  const s = new Date(`2000-01-01T${start}`);
  const startStr = s.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (!end) return startStr;
  const e = new Date(`2000-01-01T${end}`);
  const endStr = e.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${startStr} – ${endStr}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
interface ClassCardProps {
  group: GroupedClass;
}

const SKILL_COLORS: Record<string, { bg: string; text: string }> = {
  beginner: { bg: "color-mix(in srgb, var(--neon-green) 15%, transparent)", text: "var(--neon-green)" },
  intermediate: { bg: "color-mix(in srgb, var(--gold) 15%, transparent)", text: "var(--gold)" },
  advanced: { bg: "color-mix(in srgb, var(--coral) 15%, transparent)", text: "var(--coral)" },
  "all-levels": { bg: "var(--twilight)", text: "var(--soft)" },
};

export function ClassCard({ group }: ClassCardProps) {
  const skill = SKILL_COLORS[group.skillLevel ?? "all-levels"] ?? SKILL_COLORS["all-levels"];
  const nextDateStr = new Date(group.nextDate + "T00:00:00")
    .toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  return (
    <div className="p-4 rounded-card bg-[var(--night)] border border-[var(--twilight)]/40 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <p className="text-base font-semibold text-[var(--cream)] leading-tight">{group.title}</p>
        <Link
          href={group.detailUrl}
          className="shrink-0 text-xs font-medium hover:opacity-80 transition-opacity"
          style={{ color: "#C9874F" }}
        >
          Details →
        </Link>
      </div>

      {/* Metadata row */}
      <div className="flex items-center gap-2 flex-wrap">
        {group.skillLevel && (
          <span
            className="px-2 py-0.5 rounded-full font-mono text-2xs font-bold uppercase tracking-wider"
            style={{ backgroundColor: skill.bg, color: skill.text }}
          >
            {group.skillLevel}
          </span>
        )}
        {group.isFree ? (
          <span className="text-xs font-medium text-[var(--neon-green)]">Free</span>
        ) : group.priceMin ? (
          <span className="text-xs text-[var(--soft)]">${group.priceMin}</span>
        ) : null}
        {group.capacity && (
          <span className="text-xs text-[var(--muted)]">Capacity: {group.capacity}</span>
        )}
      </div>

      {/* Schedule pattern */}
      <p className="text-sm text-[var(--soft)]">{group.pattern}</p>

      {/* Instructor */}
      {group.instructor && (
        <p className="text-xs text-[var(--muted)]">Instructor: {group.instructor}</p>
      )}

      {/* Next date */}
      <p className="text-xs text-[var(--muted)]">Next: {nextDateStr}</p>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add web/components/find/classes/ClassCard.tsx
git commit -m "feat(classes): add ClassCard with series dedup and pattern derivation"
```

---

### Task 7: `ClassStudiosList` Component

Studios list with filter bar. The default landing for the Classes lane.

**Files:**
- Create: `web/components/find/classes/ClassStudiosList.tsx`

- [ ] **Step 1: Create the component**

Follow the RegularsView filter chip pattern: horizontal scrollable chips, `window.history.replaceState` for URL sync.

The component receives `studios` data and filter state from `ClassesView` via props. It renders:
- Search bar
- Filter chips (category with counts, date window, skill level)
- Studio cards list
- Loading/empty/error states

Read `web/components/find/RegularsView.tsx` lines 262-286 for the exact chip rendering pattern and scrollable container classes.

Key elements:
- Search input: same pattern as ExploreHome search bar
- Category chips: derived from `CLASS_CATEGORIES` with counts from `studios.category_counts`
- Date window chips: This Week | Weekend | Next 2 Weeks | All Upcoming
- Skill level chips: All | Beginner | Intermediate | Advanced
- Separator between chip groups: `<div className="w-px h-6 bg-[var(--twilight)] shrink-0" />`
- Active chip: `color-mix(in srgb, #C9874F 10%, transparent)` background, `#C9874F` text
- Studio cards: `<ClassStudioCard>` mapped from `studios.studios`
- Data density check: if `studios.total_count < 10`, skip filter chips and render flat list

**Empty states:**
- No results: "No classes found for these filters. Try a broader date range or different category."
- No data at all: "Classes coming soon. Know a studio that should be listed?"
- Search no results: "No classes matching '{query}'."

**Loading state:** 4 skeleton studio cards with shimmer.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add web/components/find/classes/ClassStudiosList.tsx
git commit -m "feat(classes): add ClassStudiosList with filter chips and empty states"
```

---

### Task 8: `ClassStudioSchedule` Component

Deduplicated class schedule for a specific studio.

**Files:**
- Create: `web/components/find/classes/ClassStudioSchedule.tsx`

- [ ] **Step 1: Create the component**

The component receives `schedule` (ClassEvent[]) and studio metadata from props. It:
1. Groups classes using `groupClassesBySeries()` from ClassCard
2. Renders a studio header (image, name, neighborhood, "See venue →" link)
3. Renders grouped ClassCard components
4. Back navigation breadcrumb

Key elements:
- Studio header: full-width image (120px, fallback to accent gradient), name, neighborhood
- Back link: "← Studios" that navigates back (removes `studio` param from URL)
- Filter chips carry over from Level 1 (date window + skill level, no category)
- Class list: `groupClassesBySeries(schedule, portalSlug)` then map to `<ClassCard>`
- Loading state: 3 skeleton class cards
- Empty state: "No upcoming classes at this studio." with date range suggestion

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add web/components/find/classes/ClassStudioSchedule.tsx
git commit -m "feat(classes): add ClassStudioSchedule with series grouping"
```

---

### Task 9: `ClassesView` Top-Level Component

URL routing between studios list and studio schedule. Owns `useClassesData` hook.

**Files:**
- Create: `web/components/find/ClassesView.tsx`

- [ ] **Step 1: Create the component**

```typescript
// web/components/find/ClassesView.tsx
"use client";

import { useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { useClassesData } from "@/lib/hooks/useClassesData";
import dynamic from "next/dynamic";

const ClassStudiosList = dynamic(() =>
  import("./classes/ClassStudiosList").then((m) => ({ default: m.ClassStudiosList })),
  { loading: () => <div className="py-16 text-center text-[var(--muted)] font-mono text-sm">Loading...</div> }
);

const ClassStudioSchedule = dynamic(() =>
  import("./classes/ClassStudioSchedule").then((m) => ({ default: m.ClassStudioSchedule })),
  { loading: () => <div className="py-16 text-center text-[var(--muted)] font-mono text-sm">Loading...</div> }
);

interface ClassesViewProps {
  portalId: string;
  portalSlug: string;
}

export default function ClassesView({ portalId, portalSlug }: ClassesViewProps) {
  const searchParams = useSearchParams();
  const category = searchParams.get("category");
  const dateWindow = searchParams.get("window");
  const skillLevel = searchParams.get("skill");
  const search = searchParams.get("q");
  const studioSlug = searchParams.get("studio");

  const { studios, schedule, studiosLoading, scheduleLoading, error } = useClassesData({
    portalSlug,
    category,
    dateWindow,
    skillLevel,
    search,
    studioSlug,
  });

  // URL update helper (no full navigation)
  const updateUrl = useCallback((params: Record<string, string | null>) => {
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries(params)) {
      if (value === null) url.searchParams.delete(key);
      else url.searchParams.set(key, value);
    }
    window.history.replaceState({}, "", url.toString());
  }, []);

  if (studioSlug) {
    // Level 2: Studio Schedule
    // Find studio metadata from studios cache (if available)
    const studioMeta = studios?.studios.find((s) => s.slug === studioSlug) ?? null;

    return (
      <ClassStudioSchedule
        schedule={schedule}
        studioMeta={studioMeta}
        studioSlug={studioSlug}
        portalSlug={portalSlug}
        loading={scheduleLoading}
        error={error}
        dateWindow={dateWindow}
        skillLevel={skillLevel}
        onFilterChange={updateUrl}
      />
    );
  }

  // Level 1: Studios List
  return (
    <ClassStudiosList
      studios={studios}
      portalSlug={portalSlug}
      loading={studiosLoading}
      error={error}
      category={category}
      dateWindow={dateWindow}
      skillLevel={skillLevel}
      search={search}
      onFilterChange={updateUrl}
    />
  );
}
```

**IMPORTANT:** Check if `useSearchParams` correctly reads the params after `replaceState` updates. The RegularsView pattern uses `useState` for filter state AND syncs to URL. The `useSearchParams` approach above may not re-render on `replaceState` changes. If so, use `useState` for filter state and sync to URL on change (same pattern as RegularsView).

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add web/components/find/ClassesView.tsx
git commit -m "feat(classes): add ClassesView top-level component with URL routing"
```

---

### Task 10: Wire ClassesView into FindShellClient

Replace the placeholder.

**Files:**
- Modify: `web/components/find/FindShellClient.tsx`

- [ ] **Step 1: Add dynamic import and replace placeholder**

Read `web/components/find/FindShellClient.tsx`. Add a dynamic import for ClassesView:

```typescript
const ClassesView = dynamic(() => import("./ClassesView"), {
  loading: () => <div className="py-16 text-center text-[var(--muted)] font-mono text-sm">Loading...</div>,
});
```

Replace the placeholder block (the `{lane === "classes" && (<div className="py-16 ...">...Coming soon...</div>)}`) with:

```typescript
{lane === "classes" && (
  <ClassesView portalId={portalId} portalSlug={portalSlug} />
)}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add web/components/find/FindShellClient.tsx
git commit -m "feat(classes): wire ClassesView into FindShellClient"
```

---

### Task 11: Update Explore Home — Classes Alive State

Replace the hardcoded zero state with real class queries.

**Files:**
- Modify: `web/lib/explore-home-data.ts`

- [ ] **Step 1: Read the file and find the classes hardcoded block**

Find the line where classes is hardcoded to zero state (around line 853). Also find the `Promise.allSettled` block where other lane queries are defined.

- [ ] **Step 2: Add class queries to Promise.allSettled**

Add 3 queries following the events lane pattern:

```typescript
// Classes total count
supabase
  .from("events")
  .select("id", { count: "exact", head: true })
  .eq("is_class", true)
  .gte("start_date", today)
  // + apply portal scope via applyManifestFederatedScopeToQuery or baseEventQuery-like pattern
  // But DO NOT use baseEventQuery directly since it filters OUT classes

// Classes today count
// Same but with .eq("start_date", today)

// Classes preview (3-4 items with images)
supabase
  .from("events")
  .select("id, title:name, slug, image_url, start_date, start_time, class_category, venue:places(name, neighborhood)")
  .eq("is_class", true)
  .gte("start_date", today)
  .order("image_url", { ascending: false, nullsFirst: false })
  .order("start_date", { ascending: true })
  .limit(4)
  // + portal scope
```

**IMPORTANT:** Classes are excluded from `baseEventQuery` (it has `.or("is_class.eq.false,is_class.is.null")`). You need separate queries that ADD `.eq("is_class", true)` instead. Copy the portal scoping from `baseEventQuery` but swap the class filter.

- [ ] **Step 3: Replace the hardcoded zero state with buildLane call**

Replace the hardcoded classes block with a `buildLane("classes", ...)` call using the query results, matching the pattern of other lanes.

Classes uses the non-temporal scoring path (same as Places): alive when `totalCount >= 3`.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 5: Commit**

```bash
git add web/lib/explore-home-data.ts
git commit -m "feat(classes): Explore Home classes lane alive with real data"
```

---

### Task 12: Browser Tests

**Files:**
- Reference: spec verification checklist

- [ ] **Step 1: Start dev server**

Run: `cd /Users/coach/Projects/LostCity/web && npm run dev`

- [ ] **Step 2: Studios list verification**

Navigate to `http://localhost:3000/atlanta?view=find&lane=classes`.

Verify:
1. Studios list renders with studio cards (not "Coming soon")
2. Category filter chips show with counts
3. Date window chips work (This Week / Weekend / etc.)
4. Skill level chips work
5. Search bar filters studios
6. Studios without images show category-tinted fallback
7. Empty state renders when filters produce no results

- [ ] **Step 3: Studio schedule verification**

Click "See schedule →" on a studio card.

Verify:
8. Studio header shows venue image/name/neighborhood
9. Classes are deduplicated by series
10. Recurring classes show pattern ("Tuesdays & Thursdays, 6–8 PM")
11. One-off workshops show single date
12. "Details →" links to event detail page
13. Back navigation returns to studios list without refetch

- [ ] **Step 4: Mobile verification (375px)**

14. Full-width studio cards
15. Horizontally scrollable filter chips
16. Compact header on schedule view

- [ ] **Step 5: Explore Home verification**

Navigate to `http://localhost:3000/atlanta?view=find`.

17. Classes section shows alive state (not "Coming soon")
18. Preview items show class images and titles

- [ ] **Step 6: API verification**

```bash
curl -s "http://localhost:3000/api/classes/studios?portal=atlanta" | jq '.total_count'
curl -s "http://localhost:3000/api/classes?portal=atlanta&place_slug=atlanta-clay-works&limit=5" | jq '.classes | length'
```

- [ ] **Step 7: Commit any fixes**

```bash
git add -A && git commit -m "fix(classes): browser test fixes"
```
