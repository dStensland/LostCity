# Find Tab v3: Server-Side Data + Contextual Spotlights

**Date:** 2026-03-29
**Status:** Approved for implementation (post expert review)
**Builds on:** v1 (stream + cards, shipped), v2 (chip row routing, shipped)
**Replaces:** Client-side lane previews (6 lanes × 3 cards = 7 parallel fetches)

---

## Problem

Find v1-v2 makes 7 parallel client-side fetch calls on page load (6 lane previews + Right Now). The rate limiter kills most of them, causing the page to render empty. Even when it works, 3 compact cards per category with just a name and type doesn't help anyone decide what to do. The architecture is fundamentally wrong — it should use server-side data like the rest of the app.

## Root Cause

The Find tab was designed component-first without designing the data architecture first. Each component fetches independently. The existing working pages (Feed, Happening, Places) all use server-side data passed as props — Find should too.

## Solution

### Data Architecture (the foundation)

**`getServerFindData(portalSlug)`** — one server-side function that returns all the data the Find overview needs. Called directly by an async wrapper RSC in `page.tsx`. Passed as `serverFindData` prop to FindView.

**Direct Supabase calls** — not fetch-to-self. The function calls Supabase directly (createClient) since the queries are simple. No internal HTTP request overhead.

**Fixed query budget: exactly 6 queries, run in parallel via `Promise.all`:**
1. Portal lookup (cached, likely already done by page.tsx)
2. Right Now RPC (`get_right_now_feed`)
3. Pulse counts (single `GROUP BY` query — all categories in one call)
4. Spotlight 1 items (3 items for the top category)
5. Spotlight 2 items (3 items for the second category)
6. Spotlight 3 items (3 items for the third category, may return empty)

**Graceful degradation:** 8-second AbortController timeout. If queries fail, FindView still renders with search bar + chip row + empty state. Matches `getServerFeedData`'s pattern.

**Architectural constraint:** FindView is a **pure presentation component**. Zero `useEffect` fetches, zero `useSWR`, zero `useQuery`. All data comes from props. If data needs refreshing, the page revalidates via ISR (`revalidate = 300`). This prevents future regression to client-side fetches.

```typescript
interface ServerFindData {
  rightNow: RightNowItem[];
  pulse: CategoryPulse[];         // From single GROUP BY query
  spotlights: FindSpotlight[];    // 2-3 contextual spotlights
}

interface CategoryPulse {
  category: string;
  label: string;
  count: number;
  icon: string;
  color: string;
  href: string;
}

interface FindSpotlight {
  category: string;
  label: string;                  // Editorial: "Open for Dinner" / "Curtain's Up Tonight"
  reason: string;                 // Editorial: "48 places ready now" / "Best weather all week"
  color: string;
  href: string;
  items: SpotlightItem[];         // Exactly 3 rich items (capped, not 5)
}

interface SpotlightItem {
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
```

### Async Wrapper in page.tsx

Can't `await` inside JSX. Following the `DefaultCityTemplate` pattern, create an async wrapper:

```typescript
async function ServerFindView({ portal, portalSlug }: { portal: Portal; portalSlug: string }) {
  const findData = await getServerFindData(portalSlug);
  return <FindView portalSlug={portalSlug} portalSettings={portal.settings} serverFindData={findData} />;
}
```

Replace `<FindView ...>` with `<ServerFindView portal={portal} portalSlug={portalSlug} />` in the `viewMode === "find"` block.

### Find Tab Layout (top to bottom)

```
┌──────────────────────────────────────┐
│  Search Bar (FindSearchInput)         │  ← already built, works
├──────────────────────────────────────┤
│  Tool Chip Row + count badges         │  ← counts merged into chips
│  [🎵 Tonight's Music 14] [🎬 Now Showing 8] ... │
├──────────────────────────────────────┤
│  Right Now (compact stream)           │  ← server data, fast-scan rows
│  Hero card if flagship event          │
│  [compact event rows × 4 max]        │
├──────────────────────────────────────┤
│  Spotlight: Curtain's Up Tonight      │  ← 2-col grid, editorial header
│  14 shows · See all →                 │
│  [3 rich cards with images, 2-col]   │
├──────────────────────────────────────┤
│  Spotlight: Open for Dinner           │
│  48 places ready now · See all →      │
│  [3 rich cards with images, 2-col]   │
└──────────────────────────────────────┘
```

**Content-first:** Search → chips with counts → content immediately. No navigation-only rows between the user and real content.

**Density contrast:** Right Now is compact/fast-scan (rows). Spotlights are wide/editorial (2-column grid with images). Visual variety, not monotony.

### 1. Chip Row with Count Badges

Already built. **Enhancement:** merge `serverFindData.pulse` counts into the chip row as badges. The `QuickLinksBar` already supports count badges via the `dashboardCards` pattern. Pass pulse data to `FindToolChipRow` and render count badges on each chip.

No standalone CityPulseStrip component — the counts live ON the chips. One fewer UI layer, zero lost information.

### 2. Right Now (server-rendered, compact)

Data from `serverFindData.rightNow`. Pure presentation — no hooks.

**Compact rows** (not the full cards from v1). Fast-scannable:
- Time + category icon + title + venue · neighborhood
- Max 4 items. Tight spacing.

**Hero moment:** If the first Right Now item is a flagship/tentpole event (`is_tentpole` or high significance), render it as a hero card (full-width, 180px image, large title) instead of a compact row. The rest stay compact below it. This gives the page a visual anchor.

**Empty state:** If Right Now has 0 items, section collapses (don't show header with no content).

### 3. Contextual Spotlights (replaces lane previews)

2-3 spotlights chosen by contextual logic. Each shows an editorial header + 3 rich cards in a **2-column grid** (not horizontal carousel — carousels hide content behind a swipe).

**Spotlight selection logic** (server-side, in `getServerFindData`):

Time-of-day sets the candidate pool. Data picks the winners (highest item count). Portal context filters the pool.

| Time | Candidate categories |
|---|---|
| Morning (6am-12pm) | outdoors, arts, dining |
| Afternoon (12pm-5pm) | arts, dining, entertainment |
| Evening (5pm-10pm) | dining, music, nightlife, stage |
| Late night (10pm-6am) | nightlife, dining |
| Weekend any | + outdoors, festivals |

**Timezone:** Portal timezone (America/New_York for Atlanta), not browser.

**Minimum threshold:** A category must have ≥3 items to qualify as a spotlight. Below that, skip it.

**Fallback:** If time-of-day candidates produce fewer than 2 qualifying spotlights, fall back to top categories by global count regardless of time.

**Tentpole override:** Active festivals always qualify as a spotlight, regardless of time or threshold.

**Portal scoping:** The candidate pool is filtered by portal vertical. HelpATL = civic + community categories only. FORTH = dining + entertainment + arts (hotel-relevant). Atlanta (root) = full pool.

**Spotlight repetition mitigation:** If the same 2 categories won last time (tracked via simple server-side state or time-based rotation), prefer the 3rd-ranked category for one slot. Prevents "dining + music every Friday forever."

**Editorial headers:** Not database output — template-driven like the feed's `editorial-templates.ts`:
- "Curtain's Up Tonight" not "14 shows tonight"
- "Open for Dinner" not "48 dining open"
- "Perfect Day for the Park" not "5 parks available"
- "See What's On View" not "3 museums open"

**Rich spotlight cards (2-column grid, 3 cards):**
- Hero image (140px height, SmartImage with gradient+icon fallback at 40px accent-colored icon)
- Name (text-base font-semibold)
- Short description (text-sm, 2-line clamp)
- Metadata row: type · neighborhood · open status · price
- Event count badge if relevant
- Vibes pills (2 max)

**Mobile (375px):** 2-column grid → each card ~170px wide. Images fill width. Third card wraps to a second row or shows as a "See all" prompt.

**Desktop:** 3-column grid for spotlights. Cards get more breathing room.

### 4. What Gets Deleted

- `LanePreviewSection.tsx` — replaced by spotlights
- `useLaneSpots.ts` hook — no more client-side lane fetches
- `useRightNow.ts` hook — Right Now data comes from server
- `RightNowSection.tsx` — rebuilt to accept data as props (not self-fetching)
- Compact card components (`CompactDiningCard`, `CompactArtsCard`, `CompactOutdoorCard`, `CompactEventCard`, `CompactNightlifeCard`) — verify they exist before deleting, may already be removed
- `DiscoveryCard.tsx` dispatcher — no longer needed
- `web/lib/types/discovery.ts` — `DiscoveryEntity` types no longer needed (keep `LANE_CONFIG`, `LANE_ICONS`, `DEFAULT_LANE_ORDER` if still used by sidebar)

### 5. What Gets Kept

- `FindView.tsx` — refactored to pure presentation with `serverFindData` prop
- `FindToolChipRow.tsx` — enhanced with count badges
- `FindSearchInput` integration — search (no changes)
- `FindSidebar.tsx` — receives `spotlights` data as prop, shows spotlight categories with counts
- `normalizeFinURLParams()` — URL migration (no changes)
- `from=find` navigation pattern — routing (no changes)
- All detail view refreshes from v1 — kept
- `get_right_now_feed` RPC — reused server-side

### 6. Desktop Sidebar

Receives `serverFindData.spotlights` as a prop from FindView. Shows:
- Search (FindSearchInput, already wired)
- Tool links (vertical layout of chip row items)
- Active spotlight categories (highlighted, with counts)
- Date + weather (real, from useWeather)

### 7. Implementation Approach

1. **Data first:** Create `getServerFindData()` with direct Supabase calls, Promise.all, 8s timeout
2. **Wire into page.tsx:** Create async `ServerFindView` wrapper, pass data as prop
3. **Browser-test immediately:** Verify data loads, no flickering — STOP if broken
4. **Refactor FindView:** Accept `serverFindData` prop, remove all hooks/fetches
5. **Build spotlight component:** 2-col grid with rich cards, editorial headers
6. **Enhance chip row:** Add count badges from pulse data
7. **Refactor Right Now:** Accept data as props, add hero card logic
8. **Delete old components:** Lane previews, client hooks, compact cards
9. **Final browser-test:** Desktop + mobile, real data, zero console errors

### 8. Engineering Constraints

- **FindView is a pure presentation component.** Zero `useEffect`, zero `useSWR`, zero `useQuery`. All data from props. No client fetches ever.
- **Exactly 6 server queries**, run in parallel via `Promise.all`.
- **Pulse counts from single GROUP BY query** — not per-category queries.
- **Spotlight item queries use joined/computed fields** for `is_open` and `event_count` — no N+1.
- **8-second timeout with graceful degradation** — if queries fail, render search + chips + empty state.
- **Browser-test after step 3** — before building any UI components.
- **Suspense fallback is a real skeleton** — search bar + chip row placeholders + spotlight placeholders. Not an empty div.
- **Consider Suspense streaming** — split Right Now (fast) from spotlights (slower) into separate boundaries for progressive rendering.

### 9. Review Log

**Expert review 2026-03-29. Three reviewers:**

**Architect:** Pattern correct. Direct Supabase calls, not fetch-to-self. Fixed 6-query budget. Single GROUP BY for counts. Async wrapper in page.tsx. Promise.all for parallel execution. Graceful degradation. "No client fetches ever" constraint. Consider streaming.

**Strategist:** Approve direction. Portal-scope spotlight categories. Minimum threshold ≥3 items. Fallback pool when candidates thin. Don't mix event/place counts. Check image coverage.

**Designer:** Kill CityPulseStrip — merge counts into chips. 2-column grid not carousel. Cap 3 cards. Hero moment for flagship events. Editorial headers. Density contrast (compact Right Now, wide spotlights). Sidebar receives spotlight data.
