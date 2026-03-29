# Find v3: Server-Side Data + Contextual Spotlights — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken client-side lane fetches with server-rendered contextual spotlights. Zero client fetches on mount. FindView becomes a pure presentation component.

**Architecture:** `getServerFindData()` fetches all data server-side via direct Supabase calls (6 queries in Promise.all). Async `ServerFindView` RSC wrapper passes data as props to FindView. Spotlights are 2-3 contextual category picks with rich cards in 2-column grids. Old lane previews, compact cards, and client hooks are deleted.

**Tech Stack:** Next.js 16 RSC, Supabase direct calls, Tailwind v4

**Spec:** `docs/superpowers/specs/2026-03-29-find-v3-server-data-spotlights.md`

**CRITICAL: Browser-test after Task 2.** If the page doesn't load with real data after the server data is wired, STOP and fix the architecture before building any UI.

---

### Data Flow (read this before any task)

```
page.tsx (RSC)
  └→ ServerFindView (async RSC wrapper)
       └→ await getServerFindData(portalSlug)  ← 6 parallel Supabase queries
            ├→ Portal timezone lookup
            ├→ get_right_now_feed RPC
            ├→ Pulse counts (single GROUP BY)
            ├→ Spotlight 1 items (3 items)
            ├→ Spotlight 2 items (3 items)
            └→ Spotlight 3 items (3 items)
       └→ <FindView serverFindData={data} portalSlug={...} />  ← pure presentation
            ├→ FindToolChipRow (static + count badges from pulse)
            ├→ RightNowSection (data from props, no fetch)
            ├→ FindSpotlight × 2-3 (data from props, 2-col grid)
            └→ FindSidebar (spotlight categories from props)
```

Zero `useEffect`. Zero `useSWR`. Zero `useQuery`. All data flows down as props.

---

### Task 1: Create `getServerFindData()` — the data layer

**Files:**
- Create: `web/lib/find-data.ts`

This is THE foundation. Everything else depends on it.

- [ ] **Step 1: Create the server-side data fetcher**

```typescript
import { createClient } from "@/lib/supabase/server";

export interface RightNowItem {
  entity_type: "event" | "place";
  id: number;
  name: string;
  slug: string;
  image_url: string | null;
  place_type: string | null;
  neighborhood: string | null;
  venue_name: string | null;
  start_date: string | null;
  start_time: string | null;
  category_id: string | null;
  is_free: boolean | null;
  price_min: number | null;
  is_open: boolean | null;
  google_rating: number | null;
  short_description: string | null;
  relevance_score: number | null;
}

export interface CategoryPulse {
  category: string;
  label: string;
  count: number;
  icon: string;
  color: string;
  href: string;
}

export interface SpotlightItem {
  entity_type: "place" | "event";
  id: number;
  name: string;
  slug: string;
  image_url: string | null;
  place_type: string | null;
  neighborhood: string | null;
  short_description: string | null;
  is_open?: boolean;
  closes_at?: string | null;
  price_level?: number | null;
  vibes?: string[];
  event_count?: number;
  venue_name?: string | null;
  start_time?: string | null;
  is_free?: boolean;
}

export interface FindSpotlight {
  category: string;
  label: string;
  reason: string;
  color: string;
  href: string;
  items: SpotlightItem[];
}

export interface ServerFindData {
  rightNow: RightNowItem[];
  pulse: CategoryPulse[];
  spotlights: FindSpotlight[];
}
```

- [ ] **Step 2: Implement the data fetching function**

The function must:
1. Determine current time in portal timezone (America/New_York)
2. Determine spotlight candidate categories based on time-of-day
3. Run 6 queries in `Promise.all`:
   - `get_right_now_feed` RPC (already exists)
   - Pulse counts via single GROUP BY on events + places
   - 3 spotlight item queries (top 3 categories by count, each fetching 3 items)
4. Apply minimum threshold (≥3 items) for spotlight qualification
5. Fall back to global top categories if time-based candidates are thin
6. Return `ServerFindData` or null on error

Use an 8-second AbortController timeout on all Supabase calls. Return null on any error — FindView handles the null case gracefully.

Read `web/lib/city-pulse/server-feed.ts` for the timeout + fallback pattern. Read `web/app/api/spots/route.ts` for how spots are queried (the SELECT fields, the place_type filter, the portal scoping).

The pulse count query should be a single query like:
```sql
SELECT place_type, COUNT(*) as count
FROM places
WHERE is_active != false AND city ILIKE 'Atlanta%'
GROUP BY place_type
```

Map the raw place_type counts to the category labels, icons, and colors using a lookup table.

For spotlight items, query the `places` table with:
- `place_type IN (...)` for the spotlight's category types
- `ORDER BY event_count DESC, final_score DESC` (or whatever quality signal exists)
- `LIMIT 3`
- Join `is_open` status computed from hours + current time

- [ ] **Step 3: Run type check**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add web/lib/find-data.ts
git commit -m "feat(find): create getServerFindData — server-side data fetcher with 6 parallel queries"
```

---

### Task 2: Wire into page.tsx + refactor FindView to pure presentation

**Files:**
- Modify: `web/app/[portal]/page.tsx`
- Modify: `web/components/find/FindView.tsx`

- [ ] **Step 1: Create async ServerFindView wrapper in page.tsx**

Following the `DefaultCityTemplate` pattern (lines 76-99), add above the `PortalPage` component:

```typescript
import { getServerFindData, type ServerFindData } from "@/lib/find-data";

async function ServerFindView({ portal, portalSlug }: { portal: any; portalSlug: string }) {
  const findData = await getServerFindData(portalSlug);
  return (
    <FindView
      portalSlug={portalSlug}
      portalSettings={portal.settings as Record<string, unknown>}
      serverFindData={findData}
    />
  );
}
```

Replace the `viewMode === "find"` block (lines 495-503) with:
```tsx
{viewMode === "find" && (
  <Suspense fallback={<FindSkeleton />}>
    <ServerFindView portal={portal} portalSlug={portalSlug} />
  </Suspense>
)}
```

Create a `FindSkeleton` component inline (or import) that shows search bar + chip row placeholders.

- [ ] **Step 2: Refactor FindView props to accept serverFindData**

Add `serverFindData: ServerFindData | null` to FindViewProps. The component should render immediately from this data — no hooks, no fetches.

Remove all `useEffect` hooks and client-side fetch calls. Remove `useRightNow` import. Remove `useLaneSpots`-related imports. Remove `LanePreviewSection` rendering.

For now, just render the raw data as JSON to prove it works:
```tsx
{serverFindData && (
  <pre className="text-xs text-[var(--muted)] p-4 overflow-auto">
    {JSON.stringify({
      rightNow: serverFindData.rightNow.length,
      pulse: serverFindData.pulse,
      spotlights: serverFindData.spotlights.map(s => s.label),
    }, null, 2)}
  </pre>
)}
```

- [ ] **Step 3: BROWSER TEST — MANDATORY CHECKPOINT**

Start dev server. Navigate to `http://localhost:3000/atlanta?view=find`.

**Expected:** Page loads with search bar, chip row, and the JSON debug output showing real data counts. No flickering. No "Nothing nearby" messages. No console errors.

**If this fails: STOP. Fix the data layer before proceeding.** Do not build any UI components until real data flows from server to client on every page load.

- [ ] **Step 4: Commit**

```bash
git add web/app/[portal]/page.tsx web/components/find/FindView.tsx
git commit -m "feat(find): wire ServerFindView async wrapper — server data flows to FindView as props"
```

---

### Task 3: Build Right Now section (server-rendered, compact)

**Files:**
- Modify: `web/components/find/RightNowSection.tsx` (refactor to accept props)

- [ ] **Step 1: Refactor to pure presentation**

Remove the `useRightNow` hook. Change props to accept data directly:

```typescript
interface RightNowSectionProps {
  items: RightNowItem[];
  portalSlug: string;
}
```

Render compact rows (not the full cards). Each row: time + category icon + title + venue · neighborhood. Max 4 items. Tight spacing.

If the first item has `category_id === "festival"` or a high relevance score, render it as a hero card (full-width, image, large title). The rest as compact rows below.

If `items.length === 0`, return null.

- [ ] **Step 2: Wire into FindView**

Replace the old `<RightNowSection portalSlug={...} />` with:
```tsx
{serverFindData?.rightNow && serverFindData.rightNow.length > 0 && (
  <RightNowSection items={serverFindData.rightNow} portalSlug={portalSlug} />
)}
```

Remove the JSON debug output from Task 2.

- [ ] **Step 3: Browser-test** — verify Right Now renders with real events, no flickering.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(find): refactor RightNowSection to pure presentation with server data"
```

---

### Task 4: Build FindSpotlight component with rich cards

**Files:**
- Create: `web/components/find/FindSpotlight.tsx`

- [ ] **Step 1: Create the spotlight component**

Props:
```typescript
interface FindSpotlightProps {
  spotlight: FindSpotlight;
  portalSlug: string;
}
```

Renders:
- Editorial header: label + reason + "See all →" link (accent colored)
- 2-column grid of 3 rich cards:
  - Hero image (140px, SmartImage with gradient+icon fallback)
  - Name (text-base font-semibold)
  - Short description (text-sm, 2-line clamp)
  - Metadata: type · neighborhood · open/closed · price
  - Event count badge if > 0

Mobile: 2 columns at 375px (each ~170px). Third card on second row.
Desktop: 3 columns.

Each card links to `/${portalSlug}?spot=${slug}` (places) or `/${portalSlug}?event=${id}` (events).

- [ ] **Step 2: Wire into FindView**

```tsx
{serverFindData?.spotlights.map((spotlight) => (
  <FindSpotlight key={spotlight.category} spotlight={spotlight} portalSlug={portalSlug} />
))}
```

- [ ] **Step 3: Browser-test** — verify spotlights render with images, descriptions, correct categories.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(find): add FindSpotlight component with 2-column rich card grid"
```

---

### Task 5: Enhance chip row with count badges

**Files:**
- Modify: `web/components/find/FindToolChipRow.tsx`
- Modify: `web/components/find/FindView.tsx`

- [ ] **Step 1: Accept pulse data as prop**

Add `pulse?: CategoryPulse[]` to `FindToolChipRowProps`. Match each chip to its category in the pulse data and display a count badge (same pattern as QuickLinksBar):

```tsx
{badge && (
  <span
    className="font-mono text-2xs font-bold tabular-nums px-1.5 py-0.5 rounded-full leading-none"
    style={{ backgroundColor: `color-mix(in srgb, ${chip.accent} 25%, transparent)` }}
  >
    {badge}
  </span>
)}
```

Map chip IDs to pulse categories: "music" → music events tonight, "film" → films showing, "events" → total events today, etc.

- [ ] **Step 2: Pass pulse data from FindView**

```tsx
<FindToolChipRow portalSlug={portalSlug} pulse={serverFindData?.pulse} />
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(find): add count badges to tool chip row from server pulse data"
```

---

### Task 6: Update sidebar + delete old components

**Files:**
- Modify: `web/components/find/FindSidebar.tsx`
- Delete: `web/components/find/LanePreviewSection.tsx`
- Delete: `web/lib/hooks/useLaneSpots.ts`
- Delete: `web/lib/hooks/useRightNow.ts`
- Delete: `web/components/cards/CompactDiningCard.tsx`
- Delete: `web/components/cards/CompactArtsCard.tsx`
- Delete: `web/components/cards/CompactOutdoorCard.tsx`
- Delete: `web/components/cards/CompactEventCard.tsx`
- Delete: `web/components/cards/CompactNightlifeCard.tsx`
- Delete: `web/components/cards/DiscoveryCard.tsx`

- [ ] **Step 1: Update FindSidebar**

Accept `spotlights` as a prop. Show spotlight categories with count badges instead of static lane links. Keep search, tool links, date + weather.

- [ ] **Step 2: Verify no other imports of files to delete**

```bash
grep -r "CompactDiningCard\|CompactArtsCard\|CompactOutdoorCard\|CompactEventCard\|CompactNightlifeCard\|DiscoveryCard\|LanePreviewSection\|useLaneSpots\|useRightNow" --include="*.tsx" --include="*.ts" -l web/
```

Only the files themselves and FindView.tsx (which was already refactored) should appear.

- [ ] **Step 3: Delete all old files**

```bash
rm web/components/find/LanePreviewSection.tsx
rm web/lib/hooks/useLaneSpots.ts
rm web/lib/hooks/useRightNow.ts
rm web/components/cards/CompactDiningCard.tsx
rm web/components/cards/CompactArtsCard.tsx
rm web/components/cards/CompactOutdoorCard.tsx
rm web/components/cards/CompactEventCard.tsx
rm web/components/cards/CompactNightlifeCard.tsx
rm web/components/cards/DiscoveryCard.tsx
```

- [ ] **Step 4: Clean up discovery.ts**

Remove `DiscoveryEntity`, `DiscoveryPlaceEntity`, `DiscoveryEventEntity`, `CardFidelity` types from `web/lib/types/discovery.ts`. Keep `LANE_CONFIG`, `LANE_ICONS`, `DEFAULT_LANE_ORDER`, `VerticalLane`, `LANE_SEE_ALL_URLS` if used by the sidebar.

- [ ] **Step 5: Run type check + browser test**

Run: `cd web && npx tsc --noEmit`
Navigate to Find view — verify everything still works with the old components removed.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore(find): delete client-side lane previews, compact cards, discovery hooks — replaced by server data"
```

---

## Self-Review

**Spec coverage:**
- Data architecture → Task 1
- Async RSC wrapper → Task 2
- Browser-test checkpoint → Task 2 Step 3
- Right Now server-rendered → Task 3
- Contextual spotlights → Task 4
- Chip row count badges → Task 5
- Sidebar update → Task 6
- Delete old components → Task 6
- "No client fetches" constraint → enforced in Task 2 refactor
- Graceful degradation → Task 1 (timeout + null)

**Placeholder scan:** No TBDs. Task 1 has full type definitions. Task 4 has specific layout details.

**Type consistency:** `ServerFindData`, `RightNowItem`, `FindSpotlight`, `SpotlightItem`, `CategoryPulse` defined in Task 1, used consistently in Tasks 2-5.

**Data architecture verified:** The data flow section at the top documents exactly how data moves from server to UI. Zero client fetches. 6 parallel queries. Browser-test checkpoint at Task 2.
