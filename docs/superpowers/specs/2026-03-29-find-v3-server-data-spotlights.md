# Find Tab v3: Server-Side Data + Contextual Spotlights

**Date:** 2026-03-29
**Status:** Draft
**Builds on:** v1 (stream + cards, shipped), v2 (chip row routing, shipped)
**Replaces:** Client-side lane previews (6 lanes × 3 cards = 7 parallel fetches)

---

## Problem

Find v1-v2 makes 7 parallel client-side fetch calls on page load (6 lane previews + Right Now). The rate limiter kills most of them, causing the page to render empty with "Nothing nearby right now" across all lanes. Even when it works, 3 compact cards per category with just a name and type doesn't help anyone decide what to do. The architecture is fundamentally wrong — it should use server-side data like the rest of the app.

## Root Cause

The Find tab was designed component-first (Pencil mockups → expert reviews → subagent implementation) without designing the data architecture first. Each component fetches independently. The existing working pages (Feed, Happening, Places) all use server-side data passed as props — Find should too.

## Solution

### Data Architecture (the foundation)

`page.tsx` server component calls `getServerFindData(portalSlug)` — **one server-side function** that returns all the data the Find overview needs. Passed as `serverFindData` prop to FindView. Zero client-side fetches on mount. Follows the `getServerFeedData` → `CityPulseShell` pattern exactly.

```typescript
interface ServerFindData {
  rightNow: RightNowItem[];          // From get_right_now_feed RPC
  pulse: CategoryPulse[];            // Aggregate counts per category
  spotlights: FindSpotlight[];       // 2-3 contextual category spotlights with rich data
}

interface CategoryPulse {
  category: string;                  // "dining", "music", "outdoors", etc.
  label: string;                     // "Dining", "Live Music", "Outdoors"
  count: number;                     // Total active/open count
  icon: string;                      // Phosphor icon name
  color: string;                     // Accent color
  href: string;                      // Tool link with from=find
}

interface FindSpotlight {
  category: string;                  // Which category this spotlight is for
  label: string;                     // "Open for Dinner" / "Tonight's Shows" / "Get Outside"
  reason: string;                    // Why this is spotlighted: "48 open now" / "Perfect weather" / "12 shows tonight"
  color: string;                     // Accent color
  href: string;                      // "See all" link to the full tool
  items: SpotlightItem[];           // 3-5 rich items
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
  // Place-specific
  is_open?: boolean;
  closes_at?: string | null;
  price_level?: number | null;
  vibes?: string[];
  event_count?: number;
  // Event-specific
  venue_name?: string | null;
  start_time?: string | null;
  is_free?: boolean;
}
```

### Find Tab Layout (top to bottom)

```
┌──────────────────────────────────────┐
│  Search Bar (FindSearchInput)         │  ← already built, works
├──────────────────────────────────────┤
│  Tool Chip Row (time-reordered)       │  ← already built, works
├──────────────────────────────────────┤
│  City Pulse Strip                     │  ← NEW: aggregate counts
│  523 events · 48 dining · 14 shows   │
├──────────────────────────────────────┤
│  Right Now (server-rendered)          │  ← refactor: use server data
│  [rich event cards]                   │
├──────────────────────────────────────┤
│  Spotlight: Open for Dinner           │  ← NEW: replaces lane previews
│  48 open now · See all →              │
│  [3-5 rich cards with images]         │
├──────────────────────────────────────┤
│  Spotlight: Tonight's Shows           │
│  14 shows · See all →                 │
│  [3-5 rich cards with images]         │
└──────────────────────────────────────┘
```

### 1. Search Bar + Chip Row

Already built and working. No changes needed.

### 2. City Pulse Strip

A single horizontal row showing aggregate counts per category. Each count is tappable → routes to the full tool. Gives the "city is alive" signal without fetching individual place data.

Design: compact pills in a horizontal row, each showing icon + count + label. Similar to the QuickLinksBar but data-driven counts.

```
🍽 48 open · 🎵 14 tonight · 🎬 8 films · 🌿 5 parks · 🎭 3 shows · 📅 523 events
```

Each pill taps through to the relevant tool (same `from=find` routing).

Data source: `getServerFindData` runs simple count queries server-side. Fast — just `COUNT(*)` with basic filters, no full result sets.

### 3. Right Now (server-rendered)

Same concept as v1 Right Now, but data comes from the server instead of a client-side hook.

`getServerFindData` calls the `get_right_now_feed` RPC server-side and includes the results in `serverFindData.rightNow`. FindView renders them immediately — no loading state, no flickering.

Cards should be richer than the current compact cards:
- Image thumbnail (SmartImage, 64x64 or 80x80)
- Event title
- Venue name + neighborhood
- Start time
- Category icon
- Price / free badge

### 4. Contextual Spotlights (replaces lane previews)

2-3 category spotlights chosen by contextual logic (time of day + data signal). Each spotlight shows:

- **Header**: category label + reason ("Open for Dinner · 48 open now") + "See all →"
- **3-5 rich cards**: image, name, description, vibes/type, open status, event count
- Cards use `SmartImage` with graceful fallback (gradient + icon, already built)

**Spotlight selection logic** (server-side, in `getServerFindData`):

The system picks which categories to spotlight based on what has the most energy right now. Time-of-day sets the candidate pool, data picks the winners:

| Time | Candidate categories | Pick top 2-3 by count |
|---|---|---|
| Morning (6am-12pm) | outdoors, arts, dining (brunch) | Highest event/open counts win |
| Afternoon (12pm-5pm) | arts, dining, entertainment | Highest counts |
| Evening (5pm-10pm) | dining, music, nightlife, stage | Highest counts |
| Late night (10pm-6am) | nightlife, dining (late night) | Highest counts |
| Weekend any | + outdoors, festivals | Festivals always win if active |

Each spotlight fetches 5 items for its category — server-side, in the same `getServerFindData` call. Total server queries: 1 RPC (Right Now) + count queries (pulse) + 2-3 small queries (spotlight items) = ~5 queries total, all server-side, no rate limiter.

**Rich spotlight cards**: these are NOT the sparse compact cards from v1. They show:
- Hero image (140px height, SmartImage with gradient fallback)
- Name (font-semibold)
- Short description (1-2 lines, truncated)
- Metadata: type · neighborhood · open status · price
- Event count badge if relevant ("12 events today")
- Vibes pills (2-3 if available)

Similar to the expanded cards but as a horizontal scroll carousel, not a vertical list.

### 5. What Gets Deleted

- `LanePreviewSection.tsx` — replaced by spotlights
- `useLaneSpots.ts` hook — no more client-side lane fetches
- `useRightNow.ts` hook — Right Now data comes from server
- `RightNowSection.tsx` — rebuilt to accept server data as props
- All 5 compact card components (`CompactDiningCard`, etc.) — replaced by richer spotlight cards
- `DiscoveryCard.tsx` dispatcher — no longer needed

### 6. What Gets Kept

- `FindView.tsx` — the shell (refactored to accept `serverFindData` prop)
- `FindToolChipRow.tsx` — chip row (no changes)
- `FindSearchInput` integration — search (no changes)
- `FindSidebar.tsx` — desktop sidebar (no changes to lane links)
- `normalizeFinURLParams()` — URL migration (no changes)
- `from=find` navigation pattern — routing (no changes)
- Detail view refreshes from v1 — all kept

### 7. Desktop Sidebar Adaptation

The sidebar currently shows 6 lane links. With spotlights replacing lanes, the sidebar should show:
- Search
- Tool links (same as chip row but vertical: Tonight's Music, Now Showing, etc.)
- Contextual spotlight categories (highlighted based on what's spotlighted in the main content)
- Date + weather

### 8. Implementation Approach

1. Create `getServerFindData()` in `web/lib/find-data.ts` — server-side data fetcher
2. Wire into `page.tsx` — call server-side, pass as prop to FindView
3. Create `CityPulseStrip` component — aggregate count pills
4. Create `FindSpotlight` component — rich category spotlight with carousel cards
5. Refactor `RightNowSection` to accept data as props (not self-fetching)
6. Delete client-side fetch hooks and compact card components
7. Browser-test on first integration (after step 2-3, not after step 7)

### 9. Engineering Constraints

- **Zero client-side fetches on initial mount.** All data comes from the server.
- **Total server queries ≤ 6** for the entire Find overview.
- **Browser-test after step 3** — verify data loads, no flickering, cards render with real content.
- **Follow CityPulseShell pattern** — `serverFindData` prop, same hydration approach.
- **Rich cards must have images** — use SmartImage with gradient+icon fallback. No empty image frames.
