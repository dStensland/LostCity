# Find v2: Deep-Dive Tool Routing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Find tab from a shallow stream into a routing layer that funnels users to existing deep-dive tools (WhatsOnView, EventsFinder, PortalSpotsView, RegularsView, CalendarView, Map) via a time-aware chip row and lane "See all" links.

**Architecture:** Single scrollable chip row (QuickLinksBar pattern) at top of Find, time-of-day reordered. All navigation uses `from=find` breadcrumb — tools own their URL, zero modifications to existing tools. A "← Find" back link appears when `from=find` is present in the portal layout. Lane "See all →" links navigate to existing tool URLs. LaneView/LaneFilterBar/ExpandedPlaceCard deleted.

**Tech Stack:** Next.js 16, React, Tailwind v4, existing components (QuickLinksBar pattern, FindSearchInput, PortalSpotsView, WhatsOnView)

**Spec:** `docs/superpowers/specs/2026-03-29-find-tab-v2-deep-dive-routing.md`

---

### Task 1: Create FindToolChipRow component

**Files:**
- Create: `web/components/find/FindToolChipRow.tsx`

- [ ] **Step 1: Create the chip row component**

```tsx
"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  MusicNotes,
  FilmSlate,
  MaskHappy,
  Ticket,
  ArrowsClockwise,
  CalendarBlank,
  MapTrifold,
} from "@phosphor-icons/react";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";

interface ToolChip {
  id: string;
  label: string;
  icon: PhosphorIcon;
  accent: string;
  href: string;
}

const ALL_CHIPS: ToolChip[] = [
  { id: "music", label: "Tonight's Music", icon: MusicNotes, accent: "#A78BFA", href: "?view=happening&content=showtimes&vertical=music&from=find" },
  { id: "film", label: "Now Showing", icon: FilmSlate, accent: "#FF6B7A", href: "?view=happening&content=showtimes&vertical=film&from=find" },
  { id: "stage", label: "Stage & Comedy", icon: MaskHappy, accent: "#E855A0", href: "?view=happening&content=showtimes&vertical=stage&from=find" },
  { id: "events", label: "All Events", icon: Ticket, accent: "#FF6B7A", href: "?view=happening&from=find" },
  { id: "regulars", label: "Regulars", icon: ArrowsClockwise, accent: "#FFD93D", href: "?view=happening&content=regulars&from=find" },
  { id: "calendar", label: "Calendar", icon: CalendarBlank, accent: "#00D9A0", href: "?view=happening&display=calendar&from=find" },
  { id: "map", label: "Map", icon: MapTrifold, accent: "#00D4E8", href: "?view=happening&display=map&from=find" },
];

/** Time-of-day chip ordering. First 2-3 chips shift to match the moment. */
function getTimeBasedOrder(): string[] {
  // Use Atlanta timezone (portal timezone)
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
  const hour = now.getHours();
  const isWeekend = now.getDay() === 0 || now.getDay() === 6;

  if (hour >= 17) {
    // Evening: music + film first
    return ["music", "film", "stage", "events", "regulars", "calendar", "map"];
  } else if (hour >= 22 || hour < 9) {
    // Late night: film + regulars first
    return ["film", "regulars", "music", "stage", "events", "calendar", "map"];
  } else if (isWeekend && hour < 14) {
    // Weekend morning: events + film first
    return ["events", "film", "music", "stage", "regulars", "calendar", "map"];
  } else {
    // Daytime weekday: film + events first
    return ["film", "events", "music", "stage", "regulars", "calendar", "map"];
  }
}

interface FindToolChipRowProps {
  portalSlug: string;
}

export function FindToolChipRow({ portalSlug }: FindToolChipRowProps) {
  const orderedChips = useMemo(() => {
    const order = getTimeBasedOrder();
    const chipMap = new Map(ALL_CHIPS.map((c) => [c.id, c]));
    return order.map((id) => chipMap.get(id)!).filter(Boolean);
  }, []);

  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4 py-2">
      {orderedChips.map((chip, i) => {
        const Icon = chip.icon;
        const staggerClass = `stagger-${Math.min(i + 1, 6)}`;
        return (
          <Link
            key={chip.id}
            href={`/${portalSlug}${chip.href}`}
            className={`animate-fade-in ${staggerClass} shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-full text-sm font-semibold border transition-colors hover:brightness-125 active:brightness-90`}
            style={{
              color: chip.accent,
              borderColor: `color-mix(in srgb, ${chip.accent} 35%, transparent)`,
              backgroundColor: `color-mix(in srgb, ${chip.accent} 14%, transparent)`,
            }}
          >
            <Icon weight="duotone" className="w-5 h-5" />
            {chip.label}
          </Link>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Run type check**

Run: `cd web && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add web/components/find/FindToolChipRow.tsx
git commit -m "feat(find): create FindToolChipRow with time-of-day reordering"
```

---

### Task 2: Wire FindToolChipRow + FindSearchInput into FindView

**Files:**
- Modify: `web/components/find/FindView.tsx`

- [ ] **Step 1: Replace the read-only search stub with FindSearchInput**

Import `FindSearchInput`:
```typescript
import FindSearchInput from "@/components/find/FindSearchInput";
```

Replace the read-only search `<div>` (around lines 137-155) with the real component:
```tsx
<div className="px-4 pt-2 pb-1">
  <FindSearchInput portalSlug={portalSlug} placeholder="Search places, events, artists..." />
</div>
```

Remove the `lg:hidden` class so search shows on both mobile and desktop. The sidebar search can be removed or kept as a secondary entry point.

- [ ] **Step 2: Add FindToolChipRow below search, above Right Now**

Import:
```typescript
import { FindToolChipRow } from "./FindToolChipRow";
```

Add between the search bar and `<RightNowSection>`:
```tsx
<FindToolChipRow portalSlug={portalSlug} />
```

- [ ] **Step 3: Remove the LaneView drill-in path**

Delete the `laneParam` check that renders `<LaneView>` (around lines 101-118). The `if (laneParam && laneParam in LANE_CONFIG)` block should be removed entirely. Also remove the `LaneView` dynamic import at the top.

Keep the `regularsParam` check — RegularsView is still rendered inside FindView.

- [ ] **Step 4: Run type check**

Run: `cd web && npx tsc --noEmit`
Expected: PASS (LaneView import removed, no broken references)

- [ ] **Step 5: Commit**

```bash
git add web/components/find/FindView.tsx
git commit -m "feat(find): wire FindSearchInput + FindToolChipRow, remove LaneView drill-in"
```

---

### Task 3: Update lane "See all →" links to route to existing tools

**Files:**
- Modify: `web/components/find/LanePreviewSection.tsx`

- [ ] **Step 1: Change lane href patterns to route to existing tool views**

Replace the `seeAllHref` construction. Instead of `?view=find&lane=${lane}`, route to the appropriate existing tool URL with `&from=find`.

Add a lane-to-URL mapping:

```typescript
const LANE_SEE_ALL_URLS: Record<VerticalLane, string> = {
  arts: "?view=places&tab=things-to-do&venue_type=museum,gallery,arts_center,theater&from=find",
  dining: "?view=places&tab=eat-drink&from=find",
  nightlife: "?view=places&tab=nightlife&from=find",
  outdoors: "?view=places&tab=things-to-do&venue_type=park,trail,recreation,viewpoint,landmark&from=find",
  music: "?view=happening&content=showtimes&vertical=music&from=find",
  entertainment: "?view=places&tab=things-to-do&venue_type=arcade,attraction,entertainment,escape_room,bowling,zoo,aquarium,cinema&from=find",
};
```

Update the "See all →" link:
```tsx
const seeAllHref = `/${portalSlug}${LANE_SEE_ALL_URLS[lane]}`;
```

- [ ] **Step 2: Handle empty lanes — show text instead of collapsing**

Change the empty guard from `if (!loading && items.length === 0) return null` to render the header + an empty state message:

```tsx
if (!loading && items.length === 0) {
  return (
    <section className="px-4 pb-2 pt-4">
      <div className="flex items-center">
        {/* Same header as populated state */}
        <div className="flex items-center gap-2">
          {LaneIcon && <LaneIcon size={16} style={{ color: config.color }} weight="duotone" />}
          <h2 className="font-mono text-xs font-bold uppercase tracking-wider" style={{ color: config.color }}>{config.label}</h2>
        </div>
        <div className="flex-1" />
        <Link href={seeAllHref} className="text-xs" style={{ color: config.color }}>See all →</Link>
      </div>
      <p className="mt-3 text-sm text-[var(--muted)]">Nothing nearby right now</p>
    </section>
  );
}
```

- [ ] **Step 3: Run type check**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add web/components/find/LanePreviewSection.tsx
git commit -m "feat(find): route lane See All to existing tools with from=find breadcrumb"
```

---

### Task 4: Add "← Find" back link when `from=find` is present

**Files:**
- Modify: `web/app/[portal]/page.tsx`

- [ ] **Step 1: Add `from` to PortalSearchParams type**

In the `PortalSearchParams` type (around lines 143-189), add:
```typescript
from?: string;
```

- [ ] **Step 2: Read `from` param and render back link**

In the rendering section, before the `viewMode === "happening"` and `viewMode === "places"` blocks, read the `from` param:

```typescript
const fromParam = normalizedParams.get("from");
const showFindBackLink = fromParam === "find" && viewMode !== "find";
```

Then, inside the `happening` and `places` view blocks, add the back link above the component:

```tsx
{viewMode === "happening" && (
  <Suspense fallback={<div data-skeleton-route="happening-view" />}>
    {showFindBackLink && (
      <div className="px-4 pt-3 pb-1">
        <Link href={`/${portalSlug}?view=find`} className="inline-flex items-center gap-1.5 text-sm text-[var(--soft)] hover:text-[var(--cream)] transition-colors">
          <ArrowLeft size={16} />
          <span>Find</span>
        </Link>
      </div>
    )}
    <HappeningView ... />
  </Suspense>
)}
```

Same pattern for the `places` block. Import `ArrowLeft` from Phosphor and `Link` from next/link at the top.

- [ ] **Step 3: Preserve `from` in normalizeFinURLParams**

In `web/lib/normalize-find-url.ts`, ensure the `from` param is not stripped during normalization. The function only touches params in specific sets — verify `from` is not in any of the delete/transform lists. If it's being cleaned up, add it to a passthrough list.

- [ ] **Step 4: Run type check**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add web/app/[portal]/page.tsx web/lib/normalize-find-url.ts
git commit -m "feat(find): add from=find back link on Happening and Places views"
```

---

### Task 5: Delete unused components

**Files:**
- Delete: `web/components/find/LaneView.tsx`
- Delete: `web/components/find/LaneFilterBar.tsx`
- Delete: `web/components/cards/ExpandedPlaceCard.tsx`

- [ ] **Step 1: Verify no other imports**

```bash
cd web && grep -r "LaneView\|LaneFilterBar\|ExpandedPlaceCard" --include="*.tsx" --include="*.ts" -l
```

Expected: Only the files themselves + `FindView.tsx` (which we already removed the LaneView import from in Task 2). If other files import these, update them first.

- [ ] **Step 2: Delete the files**

```bash
rm web/components/find/LaneView.tsx
rm web/components/find/LaneFilterBar.tsx
rm web/components/cards/ExpandedPlaceCard.tsx
```

- [ ] **Step 3: Remove useLaneSpots 60-item mode**

In `web/lib/hooks/useLaneSpots.ts`, the `limit` param defaults to 3 (preview mode). If there's any code path that calls it with `limit=60` (the LaneView mode), remove that code path. The hook should only support the 3-item preview mode now.

- [ ] **Step 4: Run type check**

Run: `cd web && npx tsc --noEmit`
Expected: PASS — no broken imports

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(find): delete LaneView, LaneFilterBar, ExpandedPlaceCard — replaced by routing to existing tools"
```

---

### Task 6: Update FindSidebar for tool-aware state

**Files:**
- Modify: `web/components/find/FindSidebar.tsx`

- [ ] **Step 1: Update sidebar search to use FindSearchInput**

Replace the sidebar's read-only search stub with `FindSearchInput` (same as mobile). The sidebar search should work identically.

- [ ] **Step 2: Show "← Back to Find" when on a tool page**

The sidebar renders inside FindView, which only shows when `viewMode === "find"`. When the user navigates to a tool (`?view=happening&from=find`), they leave FindView entirely — the sidebar is gone. This is correct behavior. No sidebar changes needed for the `from=find` case.

However, the sidebar's lane items should link to the same `from=find` URLs as the lane "See all →" links. Update each lane's click handler to use the `LANE_SEE_ALL_URLS` pattern from Task 3.

Import the URL map:
```typescript
import { LANE_SEE_ALL_URLS } from "./LanePreviewSection";
```

Or define it in `discovery.ts` and import from there (cleaner — it's used in two files now).

- [ ] **Step 3: Run type check**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add web/components/find/FindSidebar.tsx web/lib/types/discovery.ts
git commit -m "feat(find): update sidebar search and lane links with from=find routing"
```

---

### Task 7: Update normalizeFinURLParams for new routing patterns

**Files:**
- Modify: `web/lib/normalize-find-url.ts`
- Modify: `web/lib/__tests__/normalize-find-url.test.ts`

- [ ] **Step 1: Add tests for new patterns**

```typescript
it("preserves from=find param through redirects", () => {
  const result = normalizeFinURLParams(new URLSearchParams("view=happening&from=find"));
  expect(result.get("from")).toBe("find");
});

it("does not add from param when not present", () => {
  const result = normalizeFinURLParams(new URLSearchParams("view=happening"));
  expect(result.has("from")).toBe(false);
});

it("redirects ?view=find&lane=dining to ?view=places&tab=eat-drink&from=find", () => {
  const result = normalizeFinURLParams(new URLSearchParams("view=find&lane=dining"));
  expect(result.get("view")).toBe("places");
  expect(result.get("tab")).toBe("eat-drink");
  expect(result.get("from")).toBe("find");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd web && npx vitest run lib/__tests__/normalize-find-url.test.ts`
Expected: New tests FAIL (lane→places redirect not implemented yet)

- [ ] **Step 3: Update normalizeFinURLParams**

Add lane-to-tool redirects. When `?view=find&lane=X` is present, redirect to the appropriate tool URL with `from=find`:

```typescript
// Lane → tool redirects (when view=find and lane is set)
if (result.get("view") === "find" && result.has("lane")) {
  const lane = result.get("lane")!;
  const LANE_REDIRECTS: Record<string, { view: string; tab?: string; content?: string; vertical?: string; venue_type?: string }> = {
    dining: { view: "places", tab: "eat-drink" },
    nightlife: { view: "places", tab: "nightlife" },
    arts: { view: "places", tab: "things-to-do", venue_type: "museum,gallery,arts_center,theater" },
    outdoors: { view: "places", tab: "things-to-do", venue_type: "park,trail,recreation,viewpoint,landmark" },
    music: { view: "happening", content: "showtimes", vertical: "music" },
    entertainment: { view: "places", tab: "things-to-do", venue_type: "arcade,attraction,entertainment,escape_room,bowling,zoo,aquarium,cinema" },
  };
  const redirect = LANE_REDIRECTS[lane];
  if (redirect) {
    result.set("view", redirect.view);
    result.delete("lane");
    if (redirect.tab) result.set("tab", redirect.tab);
    if (redirect.content) result.set("content", redirect.content);
    if (redirect.vertical) result.set("vertical", redirect.vertical);
    if (redirect.venue_type) result.set("venue_type", redirect.venue_type);
    result.set("from", "find");
  }
}
```

- [ ] **Step 4: Run tests**

Run: `cd web && npx vitest run lib/__tests__/normalize-find-url.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add web/lib/normalize-find-url.ts web/lib/__tests__/normalize-find-url.test.ts
git commit -m "feat(routing): add lane→tool redirects and from=find preservation to URL normalizer"
```

---

## Self-Review

**Spec coverage:**
- Section 1 (Search bar) → Task 2
- Section 2 (Tool chip row) → Task 1
- Section 3 (Right Now stream) → unchanged, no task needed
- Section 4 (Lane previews → tools) → Task 3
- Section 5 (Navigation with `from=find`) → Task 4
- Section 6 (What gets removed) → Task 5
- Section 7 (What gets kept) → verified, no task needed
- Section 8 (Implementation approach) → Tasks 1-7 cover all 8 steps
- Section 9 (Scope boundaries) → no out-of-scope items in any task

**Placeholder scan:** No TBDs, TODOs, or vague steps. All tasks have specific code.

**Type consistency:** `VerticalLane`, `LANE_CONFIG`, `LANE_SEE_ALL_URLS` are consistent across tasks. `FindToolChipRow` props match usage in Task 2. `from` param handled consistently in Tasks 3, 4, 7.
