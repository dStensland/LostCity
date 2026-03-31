# CityPulse Feed Redesign — Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Neighborhood Pulse section to the feed — a horizontal scroll of neighborhood cards showing geographic activity density, linking into Find filtered by neighborhood.

**Architecture:** New self-fetching lazy-loaded section using the existing `get_neighborhood_activity` RPC. New API endpoint returns top neighborhoods with event counts and category breakdowns. Component renders horizontal scroll of cards with sparkline bars and category labels.

**Tech Stack:** Next.js 16, React, TypeScript, Supabase, Tailwind v4

**Spec:** `docs/superpowers/specs/2026-03-29-citypulse-feed-redesign.md` (Section 5: Neighborhood Pulse)

**Data density validation:** PASSED. 12 neighborhoods with 5+ events on Sunday March 29. Buckhead (60), Midtown (45), College Park (44), Cabbagetown (36), Poncey-Highland (31). Gate required 4+.

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `web/app/api/portals/[slug]/neighborhoods/pulse/route.ts` | Neighborhood pulse API — top neighborhoods with counts and category breakdown |
| `web/components/feed/sections/NeighborhoodPulseSection.tsx` | Self-fetching section with horizontal scroll of neighborhood cards |

### Modified Files
| File | Changes |
|------|---------|
| `web/components/feed/CityPulseShell.tsx` | Wire NeighborhoodPulseSection as lazy-loaded section |

---

## Task 1: Neighborhood Pulse API Endpoint

**Files:**
- Create: `web/app/api/portals/[slug]/neighborhoods/pulse/route.ts`

- [ ] **Step 1: Build the endpoint**

```typescript
// GET /api/portals/[slug]/neighborhoods/pulse
// Returns: { neighborhoods: NeighborhoodPulseItem[] }
```

The existing `get_neighborhood_activity` RPC (used by `/api/neighborhoods/activity`) returns per-neighborhood data. This endpoint wraps it with filtering and formatting for the feed section.

**Strategy:**
1. Resolve portal to get city
2. Call the existing `/api/neighborhoods/activity` internally or query the `get_neighborhood_activity` RPC directly via Supabase
3. Filter: only neighborhoods with `eventsTodayCount >= 3`
4. Filter: exclude generic neighborhood names ("Atlanta") — use `neighborhood-index.ts` canonical names
5. Sort by `eventsTodayCount` descending
6. Return top 8

**Response shape:**
```typescript
interface NeighborhoodPulseItem {
  name: string;
  slug: string;
  tier: number;  // 1=major, 2=notable, 3=emerging
  eventsTodayCount: number;
  eventsWeekCount: number;
  topCategories: string[];  // top 3 categories
  accentColor: string;  // derived from position (cycle through accent palette)
}
```

**Accent colors:** Cycle through `["var(--vibe)", "var(--coral)", "var(--neon-green)", "var(--gold)", "var(--neon-cyan)", "var(--neon-magenta)", "var(--neon-red)", "var(--gold)"]` by index.

**Cache:** 10 minutes (`s-maxage=600, stale-while-revalidate=1200`).

**Rate limit:** `RATE_LIMITS.read`.

- [ ] **Step 2: Verify build**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 3: Test with curl**

Run: `curl -s http://localhost:3000/api/portals/atlanta/neighborhoods/pulse | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'{len(d[\"neighborhoods\"])} neighborhoods'); [print(f'  {n[\"name\"]}: {n[\"eventsTodayCount\"]} today') for n in d['neighborhoods'][:5]]"`

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(feed): add neighborhood pulse API endpoint"
```

---

## Task 2: NeighborhoodPulseSection Component

**Files:**
- Create: `web/components/feed/sections/NeighborhoodPulseSection.tsx`

- [ ] **Step 1: Build the component**

Self-fetching lazy-loaded section with horizontal scroll of neighborhood cards.

### Props
```typescript
interface NeighborhoodPulseSectionProps {
  portalSlug: string;
}
```

### Structure
1. **Header:** Use `<FeedSectionHeader>` with:
   - title: "Neighborhood Pulse"
   - subtitle: "Where Atlanta is alive tonight" (or "today" before 2pm)
   - accent: `var(--coral)`
   - seeAllHref: `/${portalSlug}?view=find` (interim until map view)

2. **Horizontal scroll:** Cards in a `flex gap-2.5 overflow-x-auto scrollbar-hide snap-x snap-mandatory px-4`

### Neighborhood Card Design
Each card is ~140px wide, flex-shrink-0, snap-start:

```
┌─────────────────┐
│ Midtown          │  ← name (text-sm font-semibold)
│   45             │  ← count (text-2xl font-bold, accent color)
│ events tonight   │  ← label (text-2xs text-[var(--muted)])
│ ▊▌█▎▊            │  ← sparkline bars (4-5 bars, relative heights)
│ Music · Arts     │  ← top categories (text-2xs text-[var(--muted)])
└─────────────────┘
```

- Container: `min-w-[140px] rounded-lg p-3.5` with gradient background derived from accent color at ~10-15% opacity, 1px border at ~15-20% opacity
- Name: `text-sm font-semibold text-[var(--cream)]`
- Count: `text-2xl font-bold` in accent color
- Label: `text-2xs text-[var(--muted)]` — "events tonight" (after 2pm) or "events today" (before 2pm)
- Sparkline: 4-5 small vertical bars using accent color at varying heights. Heights derived from category distribution (top category = tallest). Each bar: `w-1 rounded-sm` with height 8-20px.
- Categories: `text-2xs text-[var(--muted)]` — top 2-3 categories joined with " · "

Card links to: `/${portalSlug}?view=find&neighborhoods=${slug}`

### Data Fetching
Fetch from `/api/portals/${portalSlug}/neighborhoods/pulse` on mount with AbortController.

### Empty State
Return null if fewer than 3 neighborhoods in response.

### Loading State
Show 4 skeleton cards (shimmer placeholders matching card dimensions).

### Design System
- `"use client"` directive
- Named export
- All colors from CSS variable tokens — NEVER hardcoded hex
- Use `color-mix(in srgb, ...)` for gradient backgrounds from accent color
- Use standard Tailwind text classes
- `<FeedSectionHeader>` for the header

- [ ] **Step 2: Verify build**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(feed): add NeighborhoodPulseSection with horizontal scroll cards"
```

---

## Task 3: Wire into CityPulseShell

**Files:**
- Modify: `web/components/feed/CityPulseShell.tsx`

- [ ] **Step 1: Add dynamic import and render**

```typescript
const NeighborhoodPulseSection = dynamic(
  () => import("./sections/NeighborhoodPulseSection").then(m => ({ default: m.NeighborhoodPulseSection })),
  { ssr: false }
);
```

Render after DestinationsSectionV2 and before the Browse section, wrapped in LazySection:

```tsx
<LazySection minHeight={200}>
  <NeighborhoodPulseSection portalSlug={portalSlug} />
</LazySection>
```

- [ ] **Step 2: Verify build**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(feed): wire NeighborhoodPulseSection into shell"
```

---

## Task 4: Final Verification

- [ ] **Step 1: TypeScript check**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 2: Test suite**

Run: `cd web && npx vitest run`
Expected: No regressions.

- [ ] **Step 3: Visual smoke test**

Start dev server, navigate to `http://localhost:3000/atlanta`, scroll to Neighborhood Pulse section:
1. Section renders with horizontal scroll of neighborhood cards
2. Cards show real neighborhood names, event counts, category labels
3. Cards have sparkline bars with varying heights
4. Tapping a card navigates to Find filtered by neighborhood
5. Console: zero errors

- [ ] **Step 4: Commit any fixes**

```bash
git commit -m "fix(feed): Phase 3 integration fixes"
```
