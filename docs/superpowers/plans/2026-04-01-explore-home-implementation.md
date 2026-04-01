# Explore Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Find tab launchpad with an Explore Home dashboard — a tasting menu of lane previews with alive/quiet/zero states that helps people find the right discovery lane.

**Architecture:** New `ExploreHome` component replaces `FindView` as the `lane=null` state in `FindShellClient`. A new API endpoint (`/api/portals/[slug]/explore-home`) runs parallel Supabase queries to compute lane preview data with alive/quiet/zero states. The sidebar and mobile lane bar are updated with a Classes lane and liveness count badges.

**Tech Stack:** Next.js 16 App Router, Supabase, Tailwind v4 with CSS variable tokens, Phosphor Icons

**Spec:** `docs/superpowers/specs/2026-04-01-explore-home-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `web/lib/types/explore-home.ts` | Create | Type definitions for ExploreHome API response |
| `web/lib/explore-home-data.ts` | Create | Server-side data fetcher — parallel Supabase queries |
| `web/app/api/portals/[slug]/explore-home/route.ts` | Create | API route with time-slot caching |
| `web/components/find/ExploreHomeSection.tsx` | Create | Lane section component (alive/quiet/zero states) |
| `web/components/find/ExploreHome.tsx` | Create | Main Explore Home layout (search + 2-col grid) |
| `web/components/find/FindShellClient.tsx` | Modify | Wire ExploreHome, add "classes" to SHELL_LANES |
| `web/components/find/FindSidebar.tsx` | Modify | Add Classes lane to BROWSE_LANES, add liveness badges |
| `web/components/find/MobileLaneBar.tsx` | Modify | Add Classes lane to MOBILE_LANES |

---

### Task 1: ExploreHome Types

**Files:**
- Create: `web/lib/types/explore-home.ts`

- [ ] **Step 1: Create type definitions**

```typescript
// web/lib/types/explore-home.ts

export type LaneState = "alive" | "quiet" | "zero";

export type LaneSlug =
  | "events"
  | "now-showing"
  | "live-music"
  | "stage"
  | "regulars"
  | "places"
  | "classes"
  | "calendar"
  | "map";

export interface PreviewItem {
  id: number;
  type: "event" | "showtime" | "place" | "regular" | "class";
  title: string;
  subtitle: string;
  image_url: string | null;
  metadata: string;
  detail_url: string;
}

export interface LanePreview {
  state: LaneState;
  count: number;
  count_today: number | null;
  count_weekend: number | null;
  copy: string;
  items: PreviewItem[];
}

export interface ExploreHomeResponse {
  lanes: Record<LaneSlug, LanePreview>;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors related to `explore-home.ts`

- [ ] **Step 3: Commit**

```bash
git add web/lib/types/explore-home.ts
git commit -m "feat(explore-home): add ExploreHome type definitions"
```

---

### Task 2: Server-Side Data Fetcher

**Files:**
- Create: `web/lib/explore-home-data.ts`
- Reference: `web/lib/find-data.ts` (parallel query pattern), `web/lib/city-pulse/time-slots.ts` (time slots)

- [ ] **Step 1: Create the data fetcher**

This follows the same parallel-query pattern as `find-data.ts`. It runs count queries + preview item queries for each lane in parallel, then computes alive/quiet/zero state.

**IMPORTANT:** The table/column names below (`showtimes`, `regulars`, `owner_portal_id`, `vertical`, etc.) are best guesses based on the codebase exploration. Before writing queries, verify actual table names by running `\dt` in Supabase or checking `web/lib/supabase/database.types.ts`. Adapt column names to match the real schema.

```typescript
// web/lib/explore-home-data.ts

import { createServiceClient } from "@/lib/supabase/service";
import { getTimeSlot } from "@/lib/city-pulse/time-slots";
import type {
  ExploreHomeResponse,
  LanePreview,
  LaneSlug,
  LaneState,
  PreviewItem,
} from "@/lib/types/explore-home";

// ---------------------------------------------------------------------------
// Liveness thresholds — lane is "alive" if score >= threshold
// ---------------------------------------------------------------------------
const ALIVE_THRESHOLD = 3;

function computeState(
  countToday: number,
  countWeekend: number,
  countTotal: number,
  timeBoost: number,
): LaneState {
  if (countTotal === 0) return "zero";
  const score =
    (countToday > 0 ? 3 : 0) +
    (countWeekend > 0 ? 2 : 0) +
    (countTotal > 5 ? 1 : 0) +
    timeBoost;
  return score >= ALIVE_THRESHOLD ? "alive" : "quiet";
}

// ---------------------------------------------------------------------------
// Time-of-day boost per lane
// ---------------------------------------------------------------------------
function getTimeBoost(lane: LaneSlug, hourEt: number): number {
  const slot = getTimeSlot(hourEt);
  switch (lane) {
    case "live-music":
    case "stage":
      return slot === "evening" || slot === "late_night" ? 2 : 0;
    case "events":
    case "places":
      return slot === "morning" || slot === "midday" ? 1 : 0;
    case "regulars":
      return slot === "happy_hour" ? 2 : 0;
    default:
      return 0;
  }
}

// ---------------------------------------------------------------------------
// Quiet-state copy generators
// ---------------------------------------------------------------------------
function quietCopy(lane: LaneSlug, count: number, countWeekend: number): string {
  switch (lane) {
    case "events":
      return `${count} events coming up${countWeekend > 0 ? ` — ${countWeekend} this weekend` : ""}`;
    case "now-showing":
      return `${count} film${count !== 1 ? "s" : ""} in theaters`;
    case "live-music":
      return `${count} show${count !== 1 ? "s" : ""} this week`;
    case "stage":
      return `${count} production${count !== 1 ? "s" : ""} running this week — tickets available`;
    case "regulars":
      return `${count} weekly regular${count !== 1 ? "s" : ""}`;
    case "places":
      return `${count} places to explore`;
    case "classes":
      return `${count} class${count !== 1 ? "es" : ""} this month`;
    case "calendar":
      return `${count} events this week`;
    case "map":
      return `${count} events & places near you`;
  }
}

// ---------------------------------------------------------------------------
// Main fetcher
// ---------------------------------------------------------------------------
export async function getExploreHomeData(
  portalSlug: string,
): Promise<ExploreHomeResponse | null> {
  try {
    const supabase = createServiceClient();

    // Resolve portal
    const { data: portal } = await supabase
      .from("portals")
      .select("id, city_filter")
      .eq("slug", portalSlug)
      .maybeSingle();

    if (!portal) return null;
    const portalId = portal.id as string;
    const cityFilter = (portal as { city_filter: string[] | null }).city_filter;

    // Compute date boundaries
    const now = new Date();
    const hourEt = Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        hour: "numeric",
        hour12: false,
      }).format(now),
    );
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
    }).format(now);

    // Weekend end: next Sunday
    const d = new Date(today + "T00:00:00");
    const dayOfWeek = d.getDay(); // 0=Sun
    const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
    const weekendEnd = new Date(d);
    weekendEnd.setDate(d.getDate() + daysToSunday);
    const weekendEndStr = weekendEnd.toISOString().slice(0, 10);

    // Build base event query filter
    const baseEventFilter = (q: ReturnType<typeof supabase.from>) => {
      let query = q
        .eq("owner_portal_id", portalId)
        .gte("start_date", today)
        .eq("status", "published");
      if (cityFilter?.length) {
        query = query.in("city", cityFilter);
      }
      return query;
    };

    // -----------------------------------------------------------------------
    // Phase 1: All count + preview queries in parallel
    // -----------------------------------------------------------------------
    const [
      eventsToday,
      eventsWeekend,
      eventsPreview,
      filmsResult,
      musicResult,
      stageResult,
      regularsResult,
      placesCount,
      placesPreview,
    ] = await Promise.all([
      // Events today count
      supabase
        .from("events")
        .select("id", { count: "exact", head: true })
        .eq("owner_portal_id", portalId)
        .eq("start_date", today)
        .eq("status", "published"),

      // Events this weekend count
      supabase
        .from("events")
        .select("id", { count: "exact", head: true })
        .eq("owner_portal_id", portalId)
        .gte("start_date", today)
        .lte("start_date", weekendEndStr)
        .eq("status", "published"),

      // Events preview items (3 soonest today)
      supabase
        .from("events")
        .select("id, name, slug, image_url, start_time, start_date")
        .eq("owner_portal_id", portalId)
        .eq("start_date", today)
        .eq("status", "published")
        .order("start_time", { ascending: true, nullsFirst: false })
        .limit(4),

      // Film showtimes — count films with showtimes today
      supabase
        .from("showtimes")
        .select("film_title", { count: "exact", head: false })
        .eq("owner_portal_id", portalId)
        .eq("date", today)
        .eq("vertical", "film")
        .limit(5),

      // Music showtimes
      supabase
        .from("showtimes")
        .select("film_title, venue_name, time", { count: "exact", head: false })
        .eq("owner_portal_id", portalId)
        .eq("date", today)
        .eq("vertical", "music")
        .order("time", { ascending: true })
        .limit(4),

      // Stage showtimes
      supabase
        .from("showtimes")
        .select("id", { count: "exact", head: true })
        .eq("owner_portal_id", portalId)
        .gte("date", today)
        .lte("date", weekendEndStr)
        .eq("vertical", "stage"),

      // Regulars count
      supabase
        .from("regulars")
        .select("id", { count: "exact", head: true })
        .eq("owner_portal_id", portalId)
        .eq("status", "active"),

      // Places count
      supabase
        .from("places")
        .select("id", { count: "exact", head: true })
        .eq("owner_portal_id", portalId)
        .not("name", "is", null),

      // Places preview (8 with images)
      supabase
        .from("places")
        .select("id, name, slug, image_url, neighborhood, place_type")
        .eq("owner_portal_id", portalId)
        .not("image_url", "is", null)
        .order("data_quality", { ascending: false })
        .limit(8),
    ]);

    // -----------------------------------------------------------------------
    // Phase 2: Build lane previews
    // -----------------------------------------------------------------------

    const evTodayCount = eventsToday.count ?? 0;
    const evWeekendCount = eventsWeekend.count ?? 0;
    const evTotalCount = Math.max(evTodayCount, evWeekendCount);

    // Deduplicate film titles
    const filmTitles = [
      ...new Set((filmsResult.data ?? []).map((s) => (s as { film_title: string }).film_title)),
    ];

    const musicData = musicResult.data ?? [];
    const stageCount = stageResult.count ?? 0;
    const regularsCount = regularsResult.count ?? 0;
    const placesTotalCount = placesCount.count ?? 0;

    function buildLane(
      slug: LaneSlug,
      countTotal: number,
      countToday: number | null,
      countWeekend: number | null,
      items: PreviewItem[],
    ): LanePreview {
      const state = computeState(
        countToday ?? 0,
        countWeekend ?? 0,
        countTotal,
        getTimeBoost(slug, hourEt),
      );
      return {
        state,
        count: countTotal,
        count_today: countToday,
        count_weekend: countWeekend,
        copy: state === "zero"
          ? ""
          : quietCopy(slug, countTotal, countWeekend ?? 0),
        items: state === "alive" ? items : [],
      };
    }

    const eventItems: PreviewItem[] = (eventsPreview.data ?? []).map((e) => {
      const ev = e as { id: number; name: string; slug: string; image_url: string | null; start_time: string | null; start_date: string };
      const timeStr = ev.start_time
        ? new Date(`2000-01-01T${ev.start_time}`).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          })
        : "TBA";
      return {
        id: ev.id,
        type: "event" as const,
        title: ev.name,
        subtitle: "",
        image_url: ev.image_url,
        metadata: timeStr,
        detail_url: `/${portalSlug}/events/${ev.slug || ev.id}`,
      };
    });

    const filmItems: PreviewItem[] = filmTitles.slice(0, 5).map((title, i) => ({
      id: i,
      type: "showtime" as const,
      title,
      subtitle: "",
      image_url: null,
      metadata: "",
      detail_url: `/${portalSlug}?view=find&lane=now-showing&vertical=film`,
    }));

    const musicItems: PreviewItem[] = musicData.slice(0, 4).map((s, i) => {
      const show = s as { film_title: string; venue_name: string; time: string };
      return {
        id: i,
        type: "showtime" as const,
        title: show.film_title,
        subtitle: show.venue_name ?? "",
        image_url: null,
        metadata: show.time ?? "",
        detail_url: `/${portalSlug}?view=find&lane=live-music&vertical=music`,
      };
    });

    const placeItems: PreviewItem[] = (placesPreview.data ?? []).map((p) => {
      const place = p as { id: number; name: string; slug: string; image_url: string | null; neighborhood: string | null; place_type: string | null };
      return {
        id: place.id,
        type: "place" as const,
        title: place.name,
        subtitle: place.neighborhood ?? "",
        image_url: place.image_url,
        metadata: place.place_type ?? "",
        detail_url: `/${portalSlug}/places/${place.slug || place.id}`,
      };
    });

    const lanes: Record<LaneSlug, LanePreview> = {
      events: buildLane("events", evTotalCount, evTodayCount, evWeekendCount, eventItems),
      "now-showing": buildLane("now-showing", filmTitles.length, filmTitles.length, null, filmItems),
      "live-music": buildLane("live-music", musicData.length, musicData.length, null, musicItems),
      stage: buildLane("stage", stageCount, 0, stageCount, []),
      regulars: buildLane("regulars", regularsCount, null, null, []),
      places: buildLane("places", placesTotalCount, null, null, placeItems),
      classes: { state: "zero", count: 0, count_today: null, count_weekend: null, copy: "", items: [] },
      calendar: buildLane("calendar", evWeekendCount, evTodayCount, evWeekendCount, []),
      map: buildLane("map", evTotalCount + placesTotalCount, null, null, []),
    };

    return { lanes };
  } catch (err) {
    console.error("[explore-home-data] Failed to fetch:", err);
    return null;
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors related to `explore-home-data.ts`

- [ ] **Step 3: Commit**

```bash
git add web/lib/explore-home-data.ts
git commit -m "feat(explore-home): add server-side data fetcher with parallel queries"
```

---

### Task 3: API Route

**Files:**
- Create: `web/app/api/portals/[slug]/explore-home/route.ts`
- Reference: `web/app/api/portals/[slug]/city-pulse/route.ts` (caching pattern), `web/lib/shared-cache.ts`

- [ ] **Step 1: Create the API route**

```typescript
// web/app/api/portals/[slug]/explore-home/route.ts

import { NextResponse } from "next/server";
import { getExploreHomeData } from "@/lib/explore-home-data";
import {
  getSharedCacheJson,
  setSharedCacheJson,
} from "@/lib/shared-cache";
import { getTimeSlot } from "@/lib/city-pulse/time-slots";

const CACHE_NAMESPACE = "api:explore-home";
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 min
const CACHE_MAX_ENTRIES = 50;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  // Time-slot cache key
  const now = new Date();
  const hourEt = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      hour12: false,
    }).format(now),
  );
  const timeSlot = getTimeSlot(hourEt);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  }).format(now);
  const cacheKey = `${slug}|${timeSlot}|${today}`;

  // Check cache
  const cached = await getSharedCacheJson(CACHE_NAMESPACE, cacheKey);
  if (cached) {
    return NextResponse.json(cached, {
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
      },
    });
  }

  // Fetch fresh data
  const data = await getExploreHomeData(slug);
  if (!data) {
    return NextResponse.json(
      { error: "Portal not found or data fetch failed" },
      { status: 404 },
    );
  }

  // Write cache
  await setSharedCacheJson(CACHE_NAMESPACE, cacheKey, data, CACHE_TTL_MS, {
    maxEntries: CACHE_MAX_ENTRIES,
  });

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
    },
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Manual smoke test**

Run dev server and curl the endpoint:

```bash
curl -s http://localhost:3000/api/portals/atlanta/explore-home | jq '.lanes | keys'
```

Expected: Array of 9 lane slugs.

- [ ] **Step 4: Commit**

```bash
git add web/app/api/portals/\[slug\]/explore-home/route.ts
git commit -m "feat(explore-home): add API route with time-slot caching"
```

---

### Task 4: ExploreHomeSection Component

**Files:**
- Create: `web/components/find/ExploreHomeSection.tsx`

This is the unified section component that renders alive/quiet/zero states. Same card anatomy for all lanes — lane-specific content provides visual variety.

- [ ] **Step 1: Create the section component**

```typescript
// web/components/find/ExploreHomeSection.tsx

"use client";

import Link from "next/link";
import SmartImage from "@/components/SmartImage";
import type { LanePreview, LaneSlug } from "@/lib/types/explore-home";

// ---------------------------------------------------------------------------
// Lane metadata (labels, icons, accents, hrefs)
// ---------------------------------------------------------------------------
const LANE_META: Record<
  LaneSlug,
  { label: string; accent: string; href: string; zeroCta: string }
> = {
  events: { label: "EVENTS", accent: "#FF6B7A", href: "?view=find&lane=events", zeroCta: "" },
  "now-showing": { label: "NOW SHOWING", accent: "#FF6B7A", href: "?view=find&lane=now-showing&vertical=film", zeroCta: "" },
  "live-music": { label: "LIVE MUSIC", accent: "#A78BFA", href: "?view=find&lane=live-music&vertical=music", zeroCta: "" },
  stage: { label: "STAGE & COMEDY", accent: "#E855A0", href: "?view=find&lane=stage&vertical=stage", zeroCta: "" },
  regulars: { label: "REGULARS", accent: "#FFD93D", href: "?view=find&lane=regulars", zeroCta: "" },
  places: { label: "PLACES", accent: "#00D9A0", href: "?view=find&lane=places", zeroCta: "" },
  classes: { label: "CLASSES & WORKSHOPS", accent: "#C9874F", href: "?view=find&lane=classes", zeroCta: "Coming soon — know a great class?" },
  calendar: { label: "CALENDAR", accent: "#FFD93D", href: "?view=find&lane=calendar", zeroCta: "" },
  map: { label: "MAP", accent: "#00D4E8", href: "?view=find&lane=map", zeroCta: "" },
};

// ---------------------------------------------------------------------------
// Liveness badge text
// ---------------------------------------------------------------------------
function badgeText(lane: LaneSlug, preview: LanePreview): string | null {
  if (preview.state !== "alive") return null;
  if (preview.count_today && preview.count_today > 0) {
    return `TONIGHT · ${preview.count_today}`;
  }
  if (preview.count_weekend && preview.count_weekend > 0) {
    return `THIS WEEKEND · ${preview.count_weekend}`;
  }
  if (preview.count > 0) {
    return `${preview.count}`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
interface ExploreHomeSectionProps {
  laneSlug: LaneSlug;
  preview: LanePreview;
  portalSlug: string;
}

export function ExploreHomeSection({
  laneSlug,
  preview,
  portalSlug,
}: ExploreHomeSectionProps) {
  const meta = LANE_META[laneSlug];
  const badge = badgeText(laneSlug, preview);
  const laneHref = `/${portalSlug}${meta.href}`;

  return (
    <div className="rounded-card bg-[var(--night)] border border-[var(--twilight)]/40 p-4 sm:p-5 flex flex-col gap-3">
      {/* Header: label + liveness badge */}
      <div className="flex items-center justify-between">
        <Link
          href={laneHref}
          className="mono-label hover:opacity-80 transition-opacity"
          style={{ color: preview.state === "alive" ? meta.accent : "var(--cream)" }}
        >
          {meta.label}
        </Link>
        {badge && (
          <span
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-2xs font-bold tracking-wider"
            style={{
              backgroundColor: `${meta.accent}1A`,
              color: meta.accent,
            }}
          >
            {preview.state === "alive" && preview.count_today && preview.count_today > 0 && (
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ backgroundColor: meta.accent }}
              />
            )}
            {badge}
          </span>
        )}
      </div>

      {/* Alive: preview items */}
      {preview.state === "alive" && preview.items.length > 0 && (
        <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-1 px-1">
          {preview.items.map((item) => (
            <Link
              key={`${item.type}-${item.id}`}
              href={item.detail_url}
              className="shrink-0 w-[140px] sm:w-[160px] group"
            >
              <div className="w-full aspect-[16/10] rounded-lg bg-[var(--dusk)] overflow-hidden mb-2">
                {item.image_url && (
                  <SmartImage
                    src={item.image_url}
                    alt={item.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                )}
              </div>
              <p className="text-sm font-semibold text-[var(--cream)] leading-tight truncate group-hover:text-[var(--soft)] transition-colors">
                {item.title}
              </p>
              {(item.subtitle || item.metadata) && (
                <p className="text-xs text-[var(--muted)] truncate mt-0.5">
                  {[item.subtitle, item.metadata].filter(Boolean).join(" · ")}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}

      {/* Quiet: count copy */}
      {preview.state === "quiet" && (
        <p className="text-sm text-[var(--soft)]">{preview.copy}</p>
      )}

      {/* Zero: CTA */}
      {preview.state === "zero" && meta.zeroCta && (
        <p className="text-sm text-[var(--soft)]">{meta.zeroCta}</p>
      )}

      {/* Footer link */}
      <div className="flex justify-end">
        <Link
          href={laneHref}
          className="text-xs font-medium transition-opacity hover:opacity-80"
          style={{ color: meta.accent }}
        >
          {preview.state === "zero" && meta.zeroCta ? "Tell us →" : preview.state === "quiet" ? "Browse →" : `Explore ${meta.label.charAt(0) + meta.label.slice(1).toLowerCase()} →`}
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add web/components/find/ExploreHomeSection.tsx
git commit -m "feat(explore-home): add ExploreHomeSection component with alive/quiet/zero states"
```

---

### Task 5: ExploreHome Main Component

**Files:**
- Create: `web/components/find/ExploreHome.tsx`
- Reference: `web/components/find/FindView.tsx` (component it replaces)

- [ ] **Step 1: Create the ExploreHome component**

```typescript
// web/components/find/ExploreHome.tsx

"use client";

import { useState, useEffect } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { ExploreHomeSection } from "./ExploreHomeSection";
import type { ExploreHomeResponse, LaneSlug } from "@/lib/types/explore-home";

// Fixed lane order — never changes between visits
const LANE_ORDER: LaneSlug[] = [
  "events",
  "now-showing",
  "live-music",
  "stage",
  "regulars",
  "places",
  "classes",
  "calendar",
  "map",
];

// Skeleton section for loading state
function SectionSkeleton() {
  return (
    <div className="rounded-card bg-[var(--night)] border border-[var(--twilight)]/40 p-4 sm:p-5 animate-pulse">
      <div className="h-3 w-24 bg-[var(--twilight)] rounded mb-4" />
      <div className="flex gap-3">
        <div className="w-[140px] sm:w-[160px] shrink-0">
          <div className="aspect-[16/10] bg-[var(--twilight)] rounded-lg mb-2" />
          <div className="h-3 w-20 bg-[var(--twilight)] rounded" />
        </div>
        <div className="w-[140px] sm:w-[160px] shrink-0">
          <div className="aspect-[16/10] bg-[var(--twilight)] rounded-lg mb-2" />
          <div className="h-3 w-20 bg-[var(--twilight)] rounded" />
        </div>
      </div>
    </div>
  );
}

interface ExploreHomeProps {
  portalSlug: string;
}

export default function ExploreHome({ portalSlug }: ExploreHomeProps) {
  const router = useRouter();
  const [data, setData] = useState<ExploreHomeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    fetch(`/api/portals/${portalSlug}/explore-home`, {
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setData(json as ExploreHomeResponse | null))
      .catch(() => {})
      .finally(() => {
        clearTimeout(timeoutId);
        setLoading(false);
      });

    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [portalSlug]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/${portalSlug}?view=find&lane=events&q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  // Split lanes into two columns for desktop
  const col1Lanes = LANE_ORDER.filter((_, i) => i % 2 === 0);
  const col2Lanes = LANE_ORDER.filter((_, i) => i % 2 === 1);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 max-w-[1200px]">
      {/* Search bar */}
      <form onSubmit={handleSearchSubmit} className="mb-6">
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] focus-within:border-[var(--coral)] transition-colors">
          <MagnifyingGlass size={18} className="text-[var(--muted)] shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search events, places, showtimes..."
            className="flex-1 bg-transparent text-sm text-[var(--cream)] placeholder:text-[var(--muted)] outline-none"
          />
        </div>
      </form>

      {/* Lane grid */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <SectionSkeleton key={i} />
          ))}
        </div>
      ) : data ? (
        <>
          {/* Desktop: 2-column grid */}
          <div className="hidden lg:grid grid-cols-2 gap-5">
            <div className="flex flex-col gap-5">
              {col1Lanes.map((slug) => (
                <ExploreHomeSection
                  key={slug}
                  laneSlug={slug}
                  preview={data.lanes[slug]}
                  portalSlug={portalSlug}
                />
              ))}
            </div>
            <div className="flex flex-col gap-5">
              {col2Lanes.map((slug) => (
                <ExploreHomeSection
                  key={slug}
                  laneSlug={slug}
                  preview={data.lanes[slug]}
                  portalSlug={portalSlug}
                />
              ))}
            </div>
          </div>

          {/* Mobile: single column */}
          <div className="lg:hidden flex flex-col gap-4">
            {LANE_ORDER.map((slug) => (
              <ExploreHomeSection
                key={slug}
                laneSlug={slug}
                preview={data.lanes[slug]}
                portalSlug={portalSlug}
              />
            ))}
          </div>
        </>
      ) : (
        <p className="text-sm text-[var(--muted)] text-center py-16">
          Unable to load Explore Home. Try refreshing.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add web/components/find/ExploreHome.tsx
git commit -m "feat(explore-home): add ExploreHome main component with search + 2-col grid"
```

---

### Task 6: Wire ExploreHome into FindShellClient

**Files:**
- Modify: `web/components/find/FindShellClient.tsx`

Replace `FindView` with `ExploreHome` for the `lane=null` (launchpad) state. Add `"classes"` to `SHELL_LANES`. Add a placeholder for the classes lane.

- [ ] **Step 1: Update imports and SHELL_LANES**

In `web/components/find/FindShellClient.tsx`:

Replace:
```typescript
import FindView from "./FindView";
import type { ServerFindData } from "@/lib/find-data";
```

With:
```typescript
import ExploreHome from "./ExploreHome";
```

Replace:
```typescript
const SHELL_LANES = new Set([
  "events", "now-showing", "live-music", "stage",
  "regulars", "places", "calendar", "map",
]);
```

With:
```typescript
const SHELL_LANES = new Set([
  "events", "now-showing", "live-music", "stage",
  "regulars", "places", "classes", "calendar", "map",
]);
```

- [ ] **Step 2: Update props and launchpad rendering**

Replace the `FindShellClientProps` interface:
```typescript
interface FindShellClientProps {
  portalSlug: string;
  portalId: string;
  portalExclusive: boolean;
  serverFindData?: ServerFindData | null;
}
```

With:
```typescript
interface FindShellClientProps {
  portalSlug: string;
  portalId: string;
  portalExclusive: boolean;
}
```

Update the component signature — remove `serverFindData` from destructuring:
```typescript
export default function FindShellClient({
  portalSlug,
  portalId,
  portalExclusive,
}: FindShellClientProps) {
```

Replace the launchpad rendering (line 74-76):
```typescript
          {!lane && (
            <FindView portalSlug={portalSlug} serverFindData={serverFindData ?? null} />
          )}
```

With:
```typescript
          {!lane && (
            <ExploreHome portalSlug={portalSlug} />
          )}
```

- [ ] **Step 3: Add classes lane placeholder**

After the `lane === "places"` block (after line 99), add:
```typescript
          {lane === "classes" && (
            <div className="py-16 text-center">
              <p className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">CLASSES & WORKSHOPS</p>
              <p className="text-sm text-[var(--soft)]">Coming soon</p>
            </div>
          )}
```

- [ ] **Step 4: Update page.tsx if it passes serverFindData**

Check `web/app/[portal]/page.tsx` for the `serverFindData` prop being passed to `FindShellClient`. If present, remove it since `ExploreHome` fetches its own data client-side.

In `page.tsx`, find where `FindShellClient` is rendered and remove the `serverFindData` prop. Also remove the `getServerFindData` import and call if it's only used for this purpose.

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add web/components/find/FindShellClient.tsx web/app/\[portal\]/page.tsx
git commit -m "feat(explore-home): wire ExploreHome into FindShellClient, add classes lane"
```

---

### Task 7: Update FindSidebar — Classes Lane + Liveness Badges

**Files:**
- Modify: `web/components/find/FindSidebar.tsx`

Add Classes to BROWSE_LANES. Add optional liveness count badges that show item counts next to lane labels.

- [ ] **Step 1: Add Classes lane to BROWSE_LANES**

In `web/components/find/FindSidebar.tsx`, import the GraduationCap icon:

Add to the Phosphor imports:
```typescript
import {
  FilmSlate,
  MusicNotes,
  MaskHappy,
  Ticket,
  ArrowsClockwise,
  CalendarBlank,
  MapTrifold,
  MapPin,
  ArrowLeft,
  GraduationCap,
} from "@phosphor-icons/react";
```

Add a new lane entry after the Places lane in `BROWSE_LANES`:
```typescript
  {
    id: "classes",
    label: "Classes",
    icon: GraduationCap,
    accent: "#C9874F",
    href: "?view=find&lane=classes",
  },
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add web/components/find/FindSidebar.tsx
git commit -m "feat(explore-home): add Classes lane to FindSidebar"
```

---

### Task 8: Update MobileLaneBar — Classes Lane

**Files:**
- Modify: `web/components/find/MobileLaneBar.tsx`

- [ ] **Step 1: Add Classes lane**

In `web/components/find/MobileLaneBar.tsx`, add the Classes entry to `MOBILE_LANES` after the Places entry (before calendar):

```typescript
  { id: "classes", label: "Classes", accent: "#C9874F", href: "?view=find&lane=classes" },
```

The full array should be:
```typescript
const MOBILE_LANES = [
  { id: "events", label: "Events", accent: "#FF6B7A", href: "?view=find&lane=events" },
  { id: "now-showing", label: "Film", accent: "#FF6B7A", href: "?view=find&lane=now-showing&vertical=film" },
  { id: "live-music", label: "Music", accent: "#A78BFA", href: "?view=find&lane=live-music&vertical=music" },
  { id: "stage", label: "Stage", accent: "#E855A0", href: "?view=find&lane=stage&vertical=stage" },
  { id: "regulars", label: "Regulars", accent: "#FFD93D", href: "?view=find&lane=regulars" },
  { id: "places", label: "Places", accent: "#00D9A0", href: "?view=find&lane=places" },
  { id: "classes", label: "Classes", accent: "#C9874F", href: "?view=find&lane=classes" },
  { id: "calendar", label: "Calendar", accent: "#00D9A0", href: "?view=find&lane=calendar" },
  { id: "map", label: "Map", accent: "#00D4E8", href: "?view=find&lane=map" },
];
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add web/components/find/MobileLaneBar.tsx
git commit -m "feat(explore-home): add Classes lane to MobileLaneBar"
```

---

### Task 9: Browser Tests

**Files:**
- Reference: `docs/superpowers/specs/2026-04-01-explore-home-design.md` (verification section)

Run the dev server and verify each item from the spec's verification checklist.

- [ ] **Step 1: Start dev server**

Run: `cd /Users/coach/Projects/LostCity/web && npm run dev`

- [ ] **Step 2: Desktop verification**

Navigate to `http://localhost:3000/atlanta?view=find` in a browser at 1440px width.

Verify:
1. Sidebar visible with all 9 lanes (Events, Now Showing, Live Music, Stage & Comedy, Regulars, Places, Classes, Calendar, Map)
2. Sidebar has BROWSE and VIEWS section labels
3. "EXPLORE" title at top of sidebar with ← arrow
4. Content area shows search bar at full width
5. Content area shows 2-column grid of lane sections
6. Alive sections show liveness badge + preview items
7. Quiet sections show count copy
8. Zero sections (Classes) show CTA text
9. Click "Explore Events →" → navigates to `?view=find&lane=events`, sidebar highlights Events
10. Click ← Explore in sidebar → returns to Explore Home
11. Click a preview item (e.g., event card) → navigates to event detail page

- [ ] **Step 3: Mobile verification**

Set browser to 375px width.

Verify:
1. No sidebar visible
2. Search bar at top
3. Single-column stacked sections
4. No chip bar on Explore Home
5. Tap a section → enters lane, chip bar appears with all 9 lanes scrollable
6. "Explore" home chip visible at left of chip bar
7. Tap "Explore" chip → returns to Explore Home, chip bar hides

- [ ] **Step 4: API verification**

```bash
curl -s http://localhost:3000/api/portals/atlanta/explore-home | jq '.lanes | to_entries[] | {key, state: .value.state, count: .value.count, items_count: (.value.items | length)}'
```

Verify: 9 lanes returned, states are alive/quiet/zero as expected based on current data.

- [ ] **Step 5: Loading state verification**

Open dev tools Network tab, throttle to "Slow 3G". Navigate to `?view=find`. Verify skeleton sections appear while data loads, then transition to real content.

- [ ] **Step 6: Commit any fixes**

If any issues found during browser testing, fix them and commit:

```bash
git add -A
git commit -m "fix(explore-home): browser test fixes"
```
