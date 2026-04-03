# Find View Remediation — Polish Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all issues found in the post-remediation audit — 2 critical bugs, 4 major issues, 3 polish items.

**Architecture:** Targeted fixes, no structural changes. All work builds on the feature/find-view-remediation branch.

**Tech Stack:** Next.js 16, React, TypeScript, Tailwind CSS, Phosphor Icons

---

## Task 1: Fix hasActiveFilters in Events Lane

**Files:**
- Modify: `web/components/find/FindShellClient.tsx:170-180`

The Events lane `EventsFinder` is hardcoded with `hasActiveFilters={false}`. This suppresses the ActiveFiltersRow (no "Clear filters" escape hatch) and the active-filters badge. The fix: derive it from URL search params.

- [ ] **Step 1: Read FindShellClient.tsx to find the events lane EventsFinder callsite**

Find where `lane === "events"` renders `<EventsFinder>` with `hasActiveFilters={false}`.

- [ ] **Step 2: Derive hasActiveFilters from searchParams**

`FindShellClient` is a client component that already uses `useSearchParams()`. Add logic to detect active filters by checking for any filter-related params:

```typescript
const searchParams = useSearchParams(); // already exists in the component

const hasActiveFilters = !!(
  searchParams?.get("search") ||
  searchParams?.get("categories") ||
  searchParams?.get("date") ||
  searchParams?.get("genres") ||
  searchParams?.get("tags") ||
  searchParams?.get("vibes") ||
  searchParams?.get("price") ||
  searchParams?.get("free")
);
```

Pass this to the events lane EventsFinder instead of `false`. Keep calendar/map at `false` since they pass `showFilters={false}` anyway.

- [ ] **Step 3: Run tsc**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add web/components/find/FindShellClient.tsx
git commit -m "fix: derive hasActiveFilters from URL params in Events lane

Was hardcoded false, suppressing ActiveFiltersRow and Clear Filters
escape hatch. Users could apply filters with no visual feedback."
```

---

## Task 2: Fix Sidebar Search Button Behavior

**Files:**
- Modify: `web/components/find/FindSidebar.tsx:173-182`

The search button navigates to Explore Home. It should navigate to `?view=find` AND signal the search input to focus. Since the sidebar and ExploreHome are in different component trees, the simplest approach: navigate with a `?focus=search` param that ExploreHome reads to auto-focus.

- [ ] **Step 1: Update sidebar search button to add focus param**

In `FindSidebar.tsx`, find the search button onClick handler. Change it to:

```typescript
onClick={() => router.push(`/${portalSlug}?view=find&focus=search`)}
```

- [ ] **Step 2: Read the focus param in ExploreHome and auto-focus FindSearchInput**

In `ExploreHome.tsx`, add a ref-based focus trigger. FindSearchInput exposes an input element — check if it accepts a ref or has an `autoFocus` prop. If not, use a simpler approach: add `autoFocus` to the `FindSearchInput` when `searchParams.get("focus") === "search"`.

Read `FindSearchInput.tsx` to determine the best approach. Options:
- If FindSearchInput accepts `autoFocus` prop → pass it
- If not → add `autoFocus` prop support to FindSearchInput (it wraps an `<input>`)
- Simplest fallback: use `useEffect` with a ref to focus the input on mount when the param is present

- [ ] **Step 3: Run tsc**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add web/components/find/FindSidebar.tsx web/components/find/ExploreHome.tsx web/components/find/FindSearchInput.tsx
git commit -m "fix: sidebar search button focuses search input instead of just navigating home"
```

---

## Task 3: Fix Typography — text-2xs Violations

**Files:**
- Modify: `web/components/find/ExploreHome.tsx:75`

The "EXPLORE ATLANTA" eyebrow uses `text-2xs` (10px). Design system minimum for standalone readable text is `text-xs` (11px).

- [ ] **Step 1: Fix ExploreHome eyebrow**

In `ExploreHome.tsx`, find the eyebrow `<p>` with `text-2xs font-mono uppercase`. Change `text-2xs` to `text-xs`:

```typescript
<p className="text-xs font-mono uppercase tracking-[0.14em] text-[var(--muted)] mb-3">
```

- [ ] **Step 2: Commit**

```bash
git add web/components/find/ExploreHome.tsx
git commit -m "fix: use text-xs for Explore eyebrow label (text-2xs below design system floor)"
```

---

## Task 4: Fix Duplicate Accent Colors for Calendar/Map

**Files:**
- Modify: `web/lib/explore-lane-meta.ts`

Calendar uses `--neon-green` (same as Places). Map uses `--neon-cyan` (same as Game Day). Give each a unique accent.

- [ ] **Step 1: Update accent values**

In `explore-lane-meta.ts`, update:

```typescript
// calendar: accent: "var(--soft)"       (was var(--neon-green), same as Places)
// map: accent: "var(--neon-magenta)"    (was var(--neon-cyan), same as Game Day)
```

Note: Calendar and Map are utility links in ExploreHome (not in the lane tile grid), but their accents still appear as sidebar dots and mobile lane bar chips. Each needs a unique color.

Check that `--soft` and `--neon-magenta` exist as CSS variables in the design system. If not, pick from existing vars. Read `web/app/globals.css` to see what's available.

- [ ] **Step 2: Run tsc**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add web/lib/explore-lane-meta.ts
git commit -m "fix: unique accent colors for Calendar and Map (were duplicating Places and Game Day)"
```

---

## Task 5: Add Icons to Mobile Lane Bar

**Files:**
- Modify: `web/components/find/MobileLaneBar.tsx`

Mobile lane bar is text-only. Desktop sidebar has icons. Add lane icons to mobile chips.

- [ ] **Step 1: Import LANE_ICONS and add to lane chips**

In `MobileLaneBar.tsx`:

```typescript
import { BROWSE_LANES, VIEW_LANES, LANE_META, LANE_ICONS } from "@/lib/explore-lane-meta";
```

In the lane chip render, add the icon before the label:

```typescript
const Icon = LANE_ICONS[slug];
// Inside the chip:
<Icon size={12} weight="duotone" />
{meta.mobileLabel}
```

Match the existing pattern from the Home chip which already renders `<House size={14} weight="duotone" />`.

- [ ] **Step 2: Commit**

```bash
git add web/components/find/MobileLaneBar.tsx
git commit -m "feat: add lane icons to mobile lane bar chips"
```

---

## Task 6: Fix Shows Tab State Persistence

**Files:**
- Modify: `web/components/find/ShowsView.tsx`

Shows tab is `useState` — doesn't update when URL `?tab=` changes from outside. Should derive from `useSearchParams`.

- [ ] **Step 1: Read ShowsView.tsx to understand current tab state**

Find where `activeTab` is defined. It should be `useState(initialTab)` seeded from URL on mount. The fix: replace local state with URL-derived state.

- [ ] **Step 2: Replace useState with useSearchParams-derived tab**

```typescript
const searchParams = useSearchParams();
const activeTab = searchParams?.get("tab") || "film"; // default to film

// Replace handleTabChange to use router.push or replaceState consistently
function handleTabChange(tab: string) {
  const params = new URLSearchParams(searchParams?.toString() || "");
  params.set("tab", tab);
  window.history.replaceState(null, "", `?${params.toString()}`);
}
```

Wait — `window.history.replaceState` won't trigger a React re-render from `useSearchParams`. The correct approach: use `router.replace` from `next/navigation` to update the URL, which will cause `useSearchParams` to re-render.

Read the file first to understand the exact current pattern before implementing.

- [ ] **Step 3: Run tsc**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add web/components/find/ShowsView.tsx
git commit -m "fix: derive Shows tab from URL params for proper back-button support"
```

---

## Task 7: Polish — Tile Hover, Container Width, Utility Link Contrast

**Files:**
- Modify: `web/components/find/ExploreHome.tsx`

Three polish fixes in one commit:

- [ ] **Step 1: Increase lane tile hover visibility**

Find the lane tile `<a>` className. The hover state border goes from `twilight/30` to `twilight/60`. Also the accent background is 6%. Update:

```typescript
// Rest state: border-[var(--twilight)]/30
// Hover state: border-[var(--twilight)]/60 → change to hover:border-[var(--twilight)]/80
// Add hover background boost: add hover style to bump accent from 6% to 12%
```

For the hover background boost, since it's inline `style={{ background }}`, the simplest approach is a CSS class or adding a `hover:bg-` Tailwind class. But since the accent is dynamic via inline style, consider using a `group-hover` pattern or just increasing the rest-state accent to 8% (small baseline boost).

- [ ] **Step 2: Widen ExploreHome container**

Change `max-w-lg` to `max-w-xl` (576px → more breathing room on wide screens):

```typescript
<div className="flex flex-col gap-6 max-w-xl mx-auto px-4 py-8">
```

- [ ] **Step 3: Fix utility link contrast**

Change Calendar/Map utility links from `text-[var(--muted)]` to `text-[var(--soft)]`:

```typescript
className="flex items-center gap-1.5 text-sm text-[var(--soft)]
  hover:text-[var(--cream)] transition-colors"
```

- [ ] **Step 4: Commit**

```bash
git add web/components/find/ExploreHome.tsx
git commit -m "polish: improve tile hover, widen container, fix utility link contrast"
```

---

## Task 8: Verification

- [ ] **Step 1: Run tsc**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 2: Visual check — Explore home**

- Search button in sidebar focuses the search input
- Lane tiles have visible hover states
- "Explore Atlanta" eyebrow is readable
- Calendar/Map utility links are readable
- Container doesn't look tiny on wide screen

- [ ] **Step 3: Visual check — Events lane**

- Apply a category filter → ActiveFiltersRow appears with "Clear filters"
- Clear filters → row disappears

- [ ] **Step 4: Visual check — Mobile (375px)**

- Lane bar chips have icons
- All chips scannable without squinting

- [ ] **Step 5: Visual check — Shows lane**

- Navigate to `?view=find&lane=shows&tab=music` → Music tab active
- Navigate away and back → tab persists
