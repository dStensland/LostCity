# Explore Home Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 12 issues found in architecture and design review of the Explore Home feature — security, data isolation, resilience, timezone correctness, visual quality, and design system compliance.

**Architecture:** Fixes are grouped into 4 clusters by dependency: (A) security, (B) data resilience, (C) design system, (D) sidebar liveness. Groups A-C can run sequentially within the same data fetcher file. Group D is a cross-cutting change.

**Tech Stack:** Next.js 16, Supabase, Tailwind v4, CSS variables

**Root cause analysis:** Each fix is informed by the detailed root-cause analysis from the architecture reviewer. Code snippets below are adapted from that analysis.

---

## File Map

| File | Action | Issues |
|------|--------|--------|
| `web/lib/explore-home-data.ts` | Modify | #1, #2, #4, #5, #6, #7, #8 |
| `web/app/api/portals/[slug]/explore-home/route.ts` | Modify | #3 |
| `web/lib/explore-lane-meta.ts` | Create | #9, #12 |
| `web/components/find/ExploreHomeSection.tsx` | Modify | #9, #10, #12 |
| `web/components/find/FindSidebar.tsx` | Modify | #9, #11, #12 |
| `web/components/find/MobileLaneBar.tsx` | Modify | #9, #12 |
| `web/components/find/FindShellClient.tsx` | Modify | #11 |
| `web/components/find/ExploreHome.tsx` | Modify | #11 |

---

### Task 1: Security — Portal-Scoped Client + Portal ID Filter + Rate Limiting

Fixes issues #1 (missing portal_id), #2 (service client on public endpoint), #3 (no rate limiting).

**Files:**
- Modify: `web/lib/explore-home-data.ts`
- Modify: `web/app/api/portals/[slug]/explore-home/route.ts`

- [ ] **Step 1: Switch data fetcher to portal-scoped client**

In `web/lib/explore-home-data.ts`, replace the service client with the portal-scoped client:

Replace the import:
```typescript
// FROM:
import { createServiceClient } from "@/lib/supabase/service";
// TO:
import { createPortalScopedClient } from "@/lib/supabase/server";
```

Replace the client creation (inside `getExploreHomeData`, after resolving the portal):
```typescript
// FROM:
const supabase = createServiceClient();
// TO:
const supabase = await createPortalScopedClient(portal.id);
```

Note: `createPortalScopedClient` is async. The caller is already in an async function.

- [ ] **Step 2: Add portal source scoping to event queries**

Check how other data fetchers scope events to a portal. Search for `getPortalSourceAccess` or `source_id` filtering patterns in:
- `web/lib/find-data.ts`
- `web/app/api/portals/[slug]/happening-now/route.ts`

If the codebase uses `getPortalSourceAccess()` + `applyManifestFederatedScopeToQuery()`, add that pattern. If it uses a simpler `source_id` filter, use that.

At minimum, after resolving the portal, fetch source IDs and add to `baseEventQuery`:
```typescript
// After portal resolution, get source access
const { sourceIds } = await getPortalSourceAccess(portal.id);

// In baseEventQuery, add source filtering if source IDs are available:
function baseEventQuery(q) {
  let query = q
    .eq("is_active", true)
    .or("is_feed_ready.eq.true,is_feed_ready.is.null")
    .is("canonical_event_id", null)
    .gte("start_date", today)
    .lte("start_date", weekEnd);
  if (sourceIds.length > 0) {
    query = query.in("source_id", sourceIds);
  }
  return query;
}
```

Also apply the same source filtering to the regulars queries (which don't use `baseEventQuery`).

If `getPortalSourceAccess` doesn't exist, check how `happening-now/route.ts` does portal scoping and follow that pattern exactly.

- [ ] **Step 3: Add rate limiting to API route**

In `web/app/api/portals/[slug]/explore-home/route.ts`:

Add imports:
```typescript
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
```

Change `_request` parameter to `request` and add rate limiting at the top of the handler:
```typescript
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request),
  );
  if (rateLimitResult) return rateLimitResult;

  // ... rest of handler
```

Check `applyRateLimit` signature in `web/lib/rate-limit.ts` — it may be sync or async. Also check if `_request` needs to be `NextRequest` type instead of `Request`.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 5: Commit**

```bash
git add web/lib/explore-home-data.ts web/app/api/portals/\[slug\]/explore-home/route.ts
git commit -m "fix(explore-home): portal-scoped client, source filtering, rate limiting"
```

---

### Task 2: Data Resilience — Promise.allSettled + Timezone Fix + Weekend Range

Fixes issues #4 (Promise.all), #5 (UTC vs ET), #8 (weekend range bug).

**Files:**
- Modify: `web/lib/explore-home-data.ts`

- [ ] **Step 1: Fix timezone — compute all times in Eastern**

Find where `currentHour` or `now.getHours()` is used in the data fetcher. Replace with an ET-aware computation:

```typescript
// Replace server-local time computation with ET-aware:
const hourEt = Number(
  new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    hour12: false,
  }).format(now),
);
const minuteEt = Number(
  new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    minute: "numeric",
  }).format(now),
);

// For getWeekendRange, use an ET-localized Date:
const etNow = new Date(
  now.toLocaleString("en-US", { timeZone: "America/New_York" })
);

// Use hourEt everywhere currentHour was used (scoring, grace cutoff)
const currentHour = hourEt;

// Grace cutoff for upcoming filter:
const graceHour = ((hourEt - 1) % 24 + 24) % 24;
const currentTimeMinusOneHour = `${String(graceHour).padStart(2, "0")}:${String(minuteEt).padStart(2, "0")}:00`;
```

- [ ] **Step 2: Fix weekend range calculation**

Replace the `getWeekendRange` function with corrected logic:

```typescript
function getWeekendRange(today: Date): { start: string; end: string } {
  const dayOfWeek = today.getDay(); // 0=Sun, 6=Sat
  const fri = new Date(today);
  const sun = new Date(today);

  if (dayOfWeek === 0) {
    // Sunday: weekend started Friday (2 days ago), ends today
    fri.setDate(fri.getDate() - 2);
  } else if (dayOfWeek === 6) {
    // Saturday: weekend started yesterday, ends tomorrow
    fri.setDate(fri.getDate() - 1);
    sun.setDate(sun.getDate() + 1);
  } else if (dayOfWeek === 5) {
    // Friday: weekend starts today, ends Sunday
    sun.setDate(sun.getDate() + 2);
  } else {
    // Mon-Thu: next weekend
    const daysToFri = 5 - dayOfWeek;
    fri.setDate(fri.getDate() + daysToFri);
    sun.setDate(sun.getDate() + daysToFri + 2);
  }

  // Use getLocalDateString helper if available, otherwise format manually
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(fri), end: fmt(sun) };
}
```

Pass `etNow` (from Step 1) to `getWeekendRange` instead of `new Date()`.

- [ ] **Step 3: Switch Promise.all to Promise.allSettled**

Find the `Promise.all([...])` call (should be around 24-28 queries). Replace with `Promise.allSettled`.

Add a helper to unwrap results:

```typescript
function unwrapSettled<T>(result: PromiseSettledResult<T>, fallback: T): T {
  if (result.status === "fulfilled") return result.value;
  console.warn("[explore-home-data] Query rejected:", result.reason);
  return fallback;
}
```

Replace the destructuring to unwrap each result:
```typescript
const settled = await Promise.allSettled([/* all queries */]);

// Count queries get a { count: null } fallback
// Preview queries get a { data: null } fallback
const eventsCount = unwrapSettled(settled[0], { count: null });
const eventsTodayCount = unwrapSettled(settled[1], { count: null });
// ... etc for each query result
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 5: Commit**

```bash
git add web/lib/explore-home-data.ts
git commit -m "fix(explore-home): ET timezone, weekend range, Promise.allSettled resilience"
```

---

### Task 3: Data Quality — Places Scoring + Image Preference

Fixes issues #6 (Places stuck in quiet) and #7 (prefer items with images).

**Files:**
- Modify: `web/lib/explore-home-data.ts`

- [ ] **Step 1: Fix scoring for non-temporal lanes**

Find the `computeLaneState` (or equivalent scoring) function. Modify it so non-temporal lanes (where both `todayCount` and `weekendCount` are null) get "alive" status when they have items above a threshold:

```typescript
function computeLaneState(
  totalCount: number,
  todayCount: number | null,
  weekendCount: number | null,
  timeSlotBoost: number,
): LaneState {
  if (totalCount === 0) return "zero";

  // Non-temporal lanes: alive when count >= threshold
  if (todayCount === null && weekendCount === null) {
    return totalCount >= 3 ? "alive" : "quiet";
  }

  // Temporal lanes: scoring-based
  let score = 0;
  if ((todayCount ?? 0) > 0) score += 3;
  if ((weekendCount ?? 0) > 0) score += 2;
  if (totalCount >= 5) score += 1;
  score += timeSlotBoost;

  return score >= 3 ? "alive" : score > 0 ? "quiet" : "zero";
}
```

Also ensure `buildLane` passes `null` (not 0) for today/weekend when the lane doesn't have those counts. Check the `places` buildLane call — it should pass `null, null` for today/weekend, and the scoring function should detect those as null.

- [ ] **Step 2: Add image preference to preview queries**

For each of the 5 event preview queries (events, film, music, stage, regulars), add an order clause that pushes null images to the end. Before the `.limit(N)` call, add:

```typescript
.order("image_url", { ascending: false, nullsFirst: false })
```

This ensures events with images appear first in the preview carousel.

The places preview query already filters `.not("image_url", "is", null)` — no change needed there.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
git add web/lib/explore-home-data.ts
git commit -m "fix(explore-home): non-temporal lane scoring, prefer items with images"
```

---

### Task 4: Design System — Shared Lane Meta + Accent Colors + Regulars Badge

Fixes issues #9 (hardcoded hex), #10 (regulars badge), #12 (accent collision).

**Files:**
- Create: `web/lib/explore-lane-meta.ts`
- Modify: `web/components/find/ExploreHomeSection.tsx`
- Modify: `web/components/find/FindSidebar.tsx`
- Modify: `web/components/find/MobileLaneBar.tsx`

- [ ] **Step 1: Create shared lane metadata file**

```typescript
// web/lib/explore-lane-meta.ts

import type { LaneSlug } from "@/lib/types/explore-home";

export interface LaneMeta {
  label: string;
  mobileLabel: string;
  accent: string;       // CSS variable reference, e.g., "var(--coral)"
  href: string;
  zeroCta: string;
  badgePrefix?: string; // Override for badge label (e.g., "TODAY" instead of "TONIGHT")
}

export const LANE_META: Record<LaneSlug, LaneMeta> = {
  events:        { label: "EVENTS",              mobileLabel: "Events",    accent: "var(--coral)",        href: "?view=find&lane=events",                    zeroCta: "" },
  "now-showing": { label: "NOW SHOWING",         mobileLabel: "Film",      accent: "var(--vibe)",         href: "?view=find&lane=now-showing&vertical=film", zeroCta: "" },
  "live-music":  { label: "LIVE MUSIC",          mobileLabel: "Music",     accent: "var(--vibe)",         href: "?view=find&lane=live-music&vertical=music", zeroCta: "" },
  stage:         { label: "STAGE & COMEDY",      mobileLabel: "Stage",     accent: "var(--neon-magenta)", href: "?view=find&lane=stage&vertical=stage",      zeroCta: "" },
  regulars:      { label: "REGULARS",            mobileLabel: "Regulars",  accent: "var(--gold)",         href: "?view=find&lane=regulars",                  zeroCta: "", badgePrefix: "TODAY" },
  places:        { label: "PLACES",              mobileLabel: "Places",    accent: "var(--neon-green)",   href: "?view=find&lane=places",                    zeroCta: "" },
  classes:       { label: "CLASSES & WORKSHOPS",  mobileLabel: "Classes",   accent: "#C9874F",             href: "?view=find&lane=classes",                   zeroCta: "Coming soon — know a great class?" },
  calendar:      { label: "CALENDAR",            mobileLabel: "Calendar",  accent: "var(--neon-green)",   href: "?view=find&lane=calendar",                  zeroCta: "" },
  map:           { label: "MAP",                 mobileLabel: "Map",       accent: "var(--neon-cyan)",    href: "?view=find&lane=map",                       zeroCta: "" },
};
```

Key changes from the original:
- Now Showing: `var(--vibe)` instead of `var(--coral)` — matches cinema convention in feed
- All hex colors replaced with CSS variables where a matching token exists
- Classes keeps hex `#C9874F` since there's no matching token (this is acceptable per design system)
- Regulars has `badgePrefix: "TODAY"` instead of the default "TONIGHT"

- [ ] **Step 2: Update ExploreHomeSection to use shared meta**

In `web/components/find/ExploreHomeSection.tsx`:

Replace the local `LANE_META` constant with an import:
```typescript
import { LANE_META } from "@/lib/explore-lane-meta";
```

Delete the local `LANE_META` definition.

Fix the 10% opacity background to use `color-mix` instead of hex+alpha:
```typescript
// Replace:
backgroundColor: `${accent}1A`,
// With:
backgroundColor: `color-mix(in srgb, ${meta.accent} 10%, transparent)`,
```

Fix badge text to use `badgePrefix` from lane meta:
```typescript
// In the badge text generation:
const prefix = meta.badgePrefix ?? "TONIGHT";
if (preview.count_today && preview.count_today > 0) {
  return `${prefix} · ${preview.count_today}`;
}
```

- [ ] **Step 3: Update FindSidebar to use shared meta**

In `web/components/find/FindSidebar.tsx`:

Import the shared meta and Phosphor icons:
```typescript
import { LANE_META } from "@/lib/explore-lane-meta";
```

Read the existing `BROWSE_LANES` and `VIEW_LANES` arrays. These include `icon` (Phosphor components) which aren't in the shared meta (icons are a rendering concern). Keep the icon imports but pull label, accent, and href from the shared meta.

Update each lane definition to reference `LANE_META[id].accent` and `LANE_META[id].href` instead of hardcoded values. The `icon` prop stays local since it requires React component imports.

Also update the accent color usage in the sidebar to use `color-mix` for backgrounds:
```typescript
// If the sidebar uses hex + alpha for active state backgrounds:
backgroundColor: `color-mix(in srgb, ${LANE_META[lane.id].accent} 15%, transparent)`,
```

- [ ] **Step 4: Update MobileLaneBar to use shared meta**

In `web/components/find/MobileLaneBar.tsx`:

Replace the local `MOBILE_LANES` array with one derived from shared meta:
```typescript
import { LANE_META, type LaneMeta } from "@/lib/explore-lane-meta";
import type { LaneSlug } from "@/lib/types/explore-home";

const MOBILE_LANE_ORDER: LaneSlug[] = [
  "events", "now-showing", "live-music", "stage",
  "regulars", "places", "classes", "calendar", "map",
];

const MOBILE_LANES = MOBILE_LANE_ORDER.map((slug) => ({
  id: slug,
  label: LANE_META[slug].mobileLabel,
  accent: LANE_META[slug].accent,
  href: LANE_META[slug].href,
}));
```

Update the active chip background to use `color-mix`:
```typescript
// Replace:
backgroundColor: `${lane.accent}20`,
// With:
backgroundColor: `color-mix(in srgb, ${lane.accent} 12%, transparent)`,
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 6: Commit**

```bash
git add web/lib/explore-lane-meta.ts web/components/find/ExploreHomeSection.tsx web/components/find/FindSidebar.tsx web/components/find/MobileLaneBar.tsx
git commit -m "fix(explore-home): shared lane meta, CSS variable accents, regulars badge"
```

---

### Task 5: Sidebar Liveness Indicators

Fixes issue #11.

**Files:**
- Modify: `web/components/find/FindShellClient.tsx`
- Modify: `web/components/find/ExploreHome.tsx`
- Modify: `web/components/find/FindSidebar.tsx`

- [ ] **Step 1: Lift explore-home data fetch to FindShellClient**

Read `web/components/find/FindShellClient.tsx` and `web/components/find/ExploreHome.tsx` to understand the current data flow.

Currently, `ExploreHome` fetches `/api/portals/{slug}/explore-home` in a `useEffect`. Move this fetch up to `FindShellClient` so the data is available to both `ExploreHome` and `FindSidebar`.

In `FindShellClient.tsx`:

Add state and fetch:
```typescript
import { useState, useEffect } from "react";
import type { ExploreHomeResponse } from "@/lib/types/explore-home";

// Inside the component:
const [exploreData, setExploreData] = useState<ExploreHomeResponse | null>(null);

useEffect(() => {
  if (lane) return; // Only fetch when on Explore Home (no lane selected)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  fetch(`/api/portals/${portalSlug}/explore-home`, { signal: controller.signal })
    .then((res) => (res.ok ? res.json() : null))
    .then((json) => setExploreData(json as ExploreHomeResponse | null))
    .catch(() => {})
    .finally(() => { clearTimeout(timeoutId); });

  return () => { controller.abort(); clearTimeout(timeoutId); };
}, [portalSlug, lane]);
```

Pass data to both children:
```typescript
<FindSidebar portalSlug={portalSlug} activeLane={lane} laneStates={exploreData?.lanes} />
// ...
{!lane && <ExploreHome portalSlug={portalSlug} data={exploreData} />}
```

- [ ] **Step 2: Update ExploreHome to accept data as prop**

In `web/components/find/ExploreHome.tsx`:

Change the component to accept `data` and `loading` state from parent instead of fetching internally:

```typescript
interface ExploreHomeProps {
  portalSlug: string;
  data: ExploreHomeResponse | null;
}
```

Remove the internal `useEffect` fetch. Derive `loading` from `data === null` (or add a `loading` prop from parent).

- [ ] **Step 3: Add liveness indicators to FindSidebar**

In `web/components/find/FindSidebar.tsx`:

Add the `laneStates` prop:
```typescript
interface FindSidebarProps {
  portalSlug: string;
  activeLane?: string | null;
  laneStates?: Record<string, { state: string; count: number; count_today: number | null }>;
}
```

In the lane rendering, show a small dot indicator when laneStates data is available:
```typescript
// Next to each lane label, when on Explore Home (no active lane):
{!activeLane && laneStates?.[lane.id] && (
  <span
    className="w-1.5 h-1.5 rounded-full ml-auto"
    style={{
      backgroundColor: laneStates[lane.id].state === "alive"
        ? LANE_META[lane.id].accent
        : laneStates[lane.id].state === "quiet"
        ? "var(--twilight)"
        : "transparent",
    }}
  />
)}
```

This shows:
- Accent-colored dot for alive lanes
- Dim dot for quiet lanes
- No dot for zero lanes

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 5: Commit**

```bash
git add web/components/find/FindShellClient.tsx web/components/find/ExploreHome.tsx web/components/find/FindSidebar.tsx
git commit -m "feat(explore-home): sidebar liveness indicators, lift data fetch to shell"
```

---

### Task 6: Final Verification

- [ ] **Step 1: Full TypeScript build**

```bash
cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit
```

- [ ] **Step 2: Browser test — Desktop**

Navigate to `http://localhost:3000/atlanta?view=find`. Verify:
1. Places section shows as "alive" with venue images (not "quiet")
2. Preview items show events with images (no blank gray cards in first positions)
3. Sidebar shows liveness dots next to lane labels
4. Accent colors are distinct (Events = coral, Now Showing = purple, Music = purple, Stage = magenta, etc.)
5. Regulars badge says "TODAY" not "TONIGHT"

- [ ] **Step 3: Browser test — Mobile (375px)**

Verify:
1. Chip bar accent colors use correct CSS variables
2. Lane sections show correct accent colors
3. No visual regressions

- [ ] **Step 4: API test**

```bash
curl -s http://localhost:3000/api/portals/atlanta/explore-home | jq '.lanes.places.state'
```

Expected: `"alive"` (not `"quiet"`)

- [ ] **Step 5: Commit any remaining fixes**

```bash
git add -A && git commit -m "fix(explore-home): browser test fixes"
```
