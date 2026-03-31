# Explore Page Restructure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken Explore shell (HappeningView embedded with redundant chrome) with a clean architecture where the shell owns navigation and content renderers are called directly.

**Architecture:** ExploreShell RSC fetches pulse data, renders fixed sidebar (desktop) + sticky chip bar (mobile) + content area. Content area conditionally renders headless renderers (EventsFinder, WhatsOnView, RegularsView, SpotsFinder) based on `lane` URL param. No HappeningView wrapper — renderers called directly with FindContext.Provider at the shell level.

**Tech Stack:** Next.js 16 App Router (RSC + client components), Tailwind v4, Phosphor Icons, Supabase.

**Spec:** `docs/superpowers/specs/2026-03-31-explore-page-restructure.md`

---

### Task 1: Update URL Normalization for New Lane IDs

**Files:**
- Modify: `web/lib/normalize-find-url.ts`

- [ ] **Step 1: Update SHELL_LANES set and add legacy mapping**

```typescript
// Replace the existing SHELL_LANES set and add legacy lane mapping
const SHELL_LANES = new Set(["events", "now-showing", "live-music", "stage", "regulars", "places", "calendar", "map"]);

const LEGACY_LANE_MAP: Record<string, string> = {
  film: "now-showing",
  music: "live-music",
};
```

In the early-return block for shell lanes, add legacy mapping before the check:

```typescript
// Map legacy lane IDs to new canonical IDs
const existingLane = result.get("lane");
if (existingLane && LEGACY_LANE_MAP[existingLane]) {
  result.set("lane", LEGACY_LANE_MAP[existingLane]);
}

const canonicalLane = result.get("lane");
if (view === "find" && canonicalLane && SHELL_LANES.has(canonicalLane)) {
  return result;
}
```

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: Clean build

- [ ] **Step 3: Commit**

```bash
git add web/lib/normalize-find-url.ts
git commit -m "refactor(explore): update URL normalization for new lane IDs"
```

---

### Task 2: Add WhatsOnView Single-Vertical Mode

**Files:**
- Modify: `web/components/find/WhatsOnView.tsx`

WhatsOnView reads `vertical` from `useSearchParams()`. When a lane pre-selects the vertical (e.g., `lane=now-showing` sets `vertical=film`), the Film/Music/Stage tab bar should be suppressed.

- [ ] **Step 1: Add singleVertical detection and suppress tab bar**

In WhatsOnView, after the vertical is resolved from searchParams (around line 30), detect single-vertical mode:

```typescript
// Detect single-vertical mode — when the shell pre-selects the vertical,
// suppress the Film/Music/Stage tab bar to avoid duplicating sidebar nav.
const laneParam = searchParams?.get("lane");
const isSingleVertical = Boolean(laneParam && ["now-showing", "live-music", "stage"].includes(laneParam));
```

Then wrap the tab bar JSX (the `<div role="tablist">` block around lines 42-64) in a conditional:

```typescript
{!isSingleVertical && (
  <div role="tablist" className="flex items-center gap-1.5 px-3 sm:px-0 pt-3 pb-3">
    {/* existing Film/Music/Stage tabs */}
  </div>
)}
```

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: Clean build

- [ ] **Step 3: Commit**

```bash
git add web/components/find/WhatsOnView.tsx
git commit -m "feat(explore): WhatsOnView single-vertical mode suppresses sub-tabs when lane pre-selects vertical"
```

---

### Task 3: Rebuild FindSidebar with Grouped Lanes + Active State

**Files:**
- Modify: `web/components/find/FindSidebar.tsx`

Replace the current flat BROWSE_LANES with the grouped structure: Browse (6 items) + Views (2 items). Use new lane IDs (`now-showing`, `live-music`, `stage`). Add `activeLane` highlighting. Make "Explore" title a link with arrow icon.

- [ ] **Step 1: Rewrite FindSidebar**

Replace the full `BROWSE_LANES` array with two groups:

```typescript
const BROWSE_LANES: BrowseLane[] = [
  {
    id: "events",
    label: "Events",
    icon: Ticket,
    accent: "#FF6B7A",
    href: "?view=find&lane=events",
  },
  {
    id: "now-showing",
    label: "Now Showing",
    icon: FilmSlate,
    accent: "#FF6B7A",
    href: "?view=find&lane=now-showing&vertical=film",
  },
  {
    id: "live-music",
    label: "Live Music",
    icon: MusicNotes,
    accent: "#A78BFA",
    href: "?view=find&lane=live-music&vertical=music",
  },
  {
    id: "stage",
    label: "Stage & Comedy",
    icon: MaskHappy,
    accent: "#E855A0",
    href: "?view=find&lane=stage&vertical=stage",
  },
  {
    id: "regulars",
    label: "Regulars",
    icon: ArrowsClockwise,
    accent: "#FFD93D",
    href: "?view=find&lane=regulars",
  },
  {
    id: "places",
    label: "Places",
    icon: MapPin,
    accent: "#00D9A0",
    href: "?view=find&lane=places",
  },
];

const VIEW_LANES: BrowseLane[] = [
  {
    id: "calendar",
    label: "Calendar",
    icon: CalendarBlank,
    accent: "#00D9A0",
    href: "?view=find&lane=calendar",
  },
  {
    id: "map",
    label: "Map",
    icon: MapTrifold,
    accent: "#00D4E8",
    href: "?view=find&lane=map",
  },
];
```

Add `MapPin` to the Phosphor imports. Add `ArrowLeft` for the Explore back-link.

Render two groups with separate section labels:

```tsx
{/* Title — links back to launchpad */}
<Link
  href={`/${portalSlug}?view=find`}
  className="flex items-center gap-2 text-2xl font-bold text-[var(--cream)] leading-none hover:text-[var(--coral)] transition-colors"
>
  {activeLane && <ArrowLeft size={18} weight="bold" className="text-[var(--soft)]" />}
  Explore
</Link>

{/* Browse lanes */}
<nav className="flex-1 space-y-4">
  <div>
    <p className="font-mono text-2xs font-bold tracking-[0.14em] uppercase text-[var(--muted)] mb-2">
      Browse
    </p>
    <ul className="space-y-0.5">
      {BROWSE_LANES.map((lane) => renderLane(lane))}
    </ul>
  </div>
  <div>
    <p className="font-mono text-2xs font-bold tracking-[0.14em] uppercase text-[var(--muted)] mb-2">
      Views
    </p>
    <ul className="space-y-0.5">
      {VIEW_LANES.map((lane) => renderLane(lane))}
    </ul>
  </div>
</nav>
```

Extract lane rendering to a `renderLane` helper (same JSX currently in the map callback — icon, label, badge, active state highlight).

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: Clean build

- [ ] **Step 3: Commit**

```bash
git add web/components/find/FindSidebar.tsx
git commit -m "feat(explore): rebuild sidebar with grouped lanes (Browse + Views), new lane IDs, active state"
```

---

### Task 4: Create MobileLaneBar Component

**Files:**
- Create: `web/components/find/MobileLaneBar.tsx`

Sticky horizontal chip bar for mobile. Uses same lane definitions as sidebar but with short labels. Includes "Explore" home chip as first item.

- [ ] **Step 1: Create MobileLaneBar**

```typescript
"use client";

import Link from "next/link";
import { House } from "@phosphor-icons/react";

const MOBILE_LANES = [
  { id: "events", label: "Events", accent: "#FF6B7A", href: "?view=find&lane=events" },
  { id: "now-showing", label: "Film", accent: "#FF6B7A", href: "?view=find&lane=now-showing&vertical=film" },
  { id: "live-music", label: "Music", accent: "#A78BFA", href: "?view=find&lane=live-music&vertical=music" },
  { id: "stage", label: "Stage", accent: "#E855A0", href: "?view=find&lane=stage&vertical=stage" },
  { id: "regulars", label: "Regulars", accent: "#FFD93D", href: "?view=find&lane=regulars" },
  { id: "places", label: "Places", accent: "#00D9A0", href: "?view=find&lane=places" },
  { id: "calendar", label: "Calendar", accent: "#00D9A0", href: "?view=find&lane=calendar" },
  { id: "map", label: "Map", accent: "#00D4E8", href: "?view=find&lane=map" },
];

interface MobileLaneBarProps {
  portalSlug: string;
  activeLane: string | null;
}

export function MobileLaneBar({ portalSlug, activeLane }: MobileLaneBarProps) {
  // Hidden when no lane is active (launchpad) — teasers serve as mobile nav
  if (!activeLane) return null;

  return (
    <div className="lg:hidden sticky top-[73px] z-40 bg-[var(--void)]/95 backdrop-blur-sm border-b border-[var(--twilight)]/30">
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide px-3 py-2">
        {/* Home chip — always first */}
        <Link
          href={`/${portalSlug}?view=find`}
          className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold text-[var(--soft)] hover:bg-[var(--dusk)] transition-colors"
        >
          <House size={14} weight="duotone" />
          Explore
        </Link>

        {/* Lane chips */}
        {MOBILE_LANES.map((lane) => {
          const isActive = activeLane === lane.id;
          return (
            <Link
              key={lane.id}
              href={`/${portalSlug}${lane.href}`}
              className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors whitespace-nowrap"
              style={
                isActive
                  ? { backgroundColor: `${lane.accent}20`, color: lane.accent }
                  : { color: "var(--soft)" }
              }
            >
              {lane.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: Clean build

- [ ] **Step 3: Commit**

```bash
git add web/components/find/MobileLaneBar.tsx
git commit -m "feat(explore): create MobileLaneBar sticky chip bar for mobile lane navigation"
```

---

### Task 5: Rebuild ExploreShell in page.tsx

This is the core task. Replace the current ExploreShell (which wraps HappeningView) with the new architecture: sidebar + MobileLaneBar outside Suspense, FindContext.Provider wrapping content, renderers called directly based on `lane` param.

**Files:**
- Modify: `web/app/[portal]/page.tsx`

- [ ] **Step 1: Update imports**

Add imports at the top of page.tsx:

```typescript
import { MobileLaneBar } from "@/components/find/MobileLaneBar";
import { FindContext } from "@/lib/find-context";
```

Add dynamic imports for renderers that aren't eagerly loaded:

```typescript
const WhatsOnView = dynamic(() => import("@/components/find/WhatsOnView"), {
  loading: () => <div className="py-16 text-center text-[var(--muted)] font-mono text-sm">Loading...</div>,
});
const RegularsView = dynamic(() => import("@/components/find/RegularsView"), {
  loading: () => <div className="py-16 text-center text-[var(--muted)] font-mono text-sm">Loading...</div>,
});
const PortalSpotsView = dynamic(() => import("@/components/find/SpotsFinder"), {
  loading: () => <div className="py-16 text-center text-[var(--muted)] font-mono text-sm">Loading...</div>,
});
```

Note: EventsFinder is already imported (used by 3 lanes: events, calendar, map) — keep it eagerly imported. Check if it's already imported; if not add:

```typescript
import EventsFinder from "@/components/find/EventsFinder";
```

- [ ] **Step 2: Rewrite ExploreShell**

Replace the existing `ExploreShell` async function with:

```typescript
async function ExploreShell({
  portalSlug,
  portalId,
  portalExclusive,
  lane,
  vertical,
}: {
  portalSlug: string;
  portalId: string;
  portalExclusive: boolean;
  lane: string | null;
  vertical: string | null;
}) {
  const findData = await getServerFindData(portalSlug);
  const portalConfig = { portalId, portalSlug, portalExclusive };

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* Desktop sidebar — fixed to viewport, OUTSIDE Suspense */}
      <div className="hidden lg:block fixed top-[73px] left-0 bottom-0 w-[240px] z-30 overflow-y-auto">
        <FindSidebar
          portalSlug={portalSlug}
          activeLane={lane}
          pulse={findData?.pulse}
        />
      </div>

      {/* Mobile lane bar — sticky, OUTSIDE Suspense */}
      <MobileLaneBar portalSlug={portalSlug} activeLane={lane} />

      {/* Content area — offset for sidebar on desktop */}
      <div className="lg:ml-[240px] min-w-0">
        <FindContext.Provider value={portalConfig}>
          {!lane && (
            <FindView portalSlug={portalSlug} serverFindData={findData} />
          )}
          {lane === "events" && (
            <EventsFinder
              portalId={portalId}
              portalSlug={portalSlug}
              portalExclusive={portalExclusive}
              displayMode="list"
              hasActiveFilters={false}
            />
          )}
          {lane === "now-showing" && (
            <WhatsOnView portalId={portalId} portalSlug={portalSlug} />
          )}
          {lane === "live-music" && (
            <WhatsOnView portalId={portalId} portalSlug={portalSlug} />
          )}
          {lane === "stage" && (
            <WhatsOnView portalId={portalId} portalSlug={portalSlug} />
          )}
          {lane === "regulars" && (
            <RegularsView portalId={portalId} portalSlug={portalSlug} />
          )}
          {lane === "places" && (
            <PortalSpotsView
              portalId={portalId}
              portalSlug={portalSlug}
              portalExclusive={portalExclusive}
              displayMode="list"
            />
          )}
          {lane === "calendar" && (
            <EventsFinder
              portalId={portalId}
              portalSlug={portalSlug}
              portalExclusive={portalExclusive}
              displayMode="calendar"
              hasActiveFilters={false}
            />
          )}
          {lane === "map" && (
            <EventsFinder
              portalId={portalId}
              portalSlug={portalSlug}
              portalExclusive={portalExclusive}
              displayMode="map"
              hasActiveFilters={false}
            />
          )}
        </FindContext.Provider>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Update the viewMode === "find" branch**

Replace the current `viewMode === "find"` rendering with:

```typescript
{viewMode === "find" && (() => {
  const lane = (searchParamsData.lane as string) ?? null;
  return (
    <Suspense fallback={<FindSkeleton />}>
      <ExploreShell
        portalSlug={portal.slug}
        portalId={portal.id}
        portalExclusive={isExclusive}
        lane={lane}
        vertical={vertical}
      />
    </Suspense>
  );
})()}
```

- [ ] **Step 4: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: Clean build. Fix any type mismatches — especially `EventsFinder` props (it may need `vertical` prop too).

- [ ] **Step 5: Commit**

```bash
git add web/app/[portal]/page.tsx
git commit -m "feat(explore): rebuild ExploreShell with direct renderer calls, FindContext, grouped Suspense"
```

---

### Task 6: Update RightNowSection Lane Teasers

**Files:**
- Modify: `web/components/find/RightNowSection.tsx`

Update the lane teaser hrefs to use new lane IDs.

- [ ] **Step 1: Update LANE_TEASERS hrefs and labels**

Update the `LANE_TEASERS` array to use the new lane IDs:

```typescript
const LANE_TEASERS: LaneTeaser[] = [
  {
    id: "now-showing",
    label: "Now Showing",
    icon: FilmSlate,
    accent: "#FF6B7A",
    href: "?view=find&lane=now-showing&vertical=film",
    getSubtitle: () => "Movies playing in theaters",
  },
  {
    id: "live-music",
    label: "Live Music",
    icon: MusicNotes,
    accent: "#A78BFA",
    href: "?view=find&lane=live-music&vertical=music",
    getSubtitle: (h) => (h >= 17 ? "Shows tonight" : "Upcoming shows"),
  },
  {
    id: "stage",
    label: "Stage & Comedy",
    icon: MaskHappy,
    accent: "#E855A0",
    href: "?view=find&lane=stage&vertical=stage",
    getSubtitle: (h) => (h >= 17 ? "Live tonight" : "Performances this week"),
  },
  {
    id: "events",
    label: "All Events",
    icon: Ticket,
    accent: "#FF6B7A",
    href: "?view=find&lane=events",
    getSubtitle: (h) => (h >= 17 ? "Happening tonight" : "Happening today"),
  },
  {
    id: "regulars",
    label: "Regulars",
    icon: ArrowsClockwise,
    accent: "#FFD93D",
    href: "?view=find&lane=regulars",
    getSubtitle: () => "Weekly recurring hangs",
  },
];
```

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: Clean build

- [ ] **Step 3: Commit**

```bash
git add web/components/find/RightNowSection.tsx
git commit -m "feat(explore): update RightNowSection teasers with new lane IDs"
```

---

### Task 7: Clean Up Dead Code in HappeningView URL Helpers

**Files:**
- Modify: `web/components/find/HappeningView.tsx`

The `isInExploreShell` detection and URL helper fixes we added earlier are now dead code in the shell path (since HappeningView is no longer used inside the shell). Clean up to avoid confusion. HappeningView only survives for the standalone `?view=happening` backward-compat path.

- [ ] **Step 1: Remove `isInExploreShell` detection and shell-aware URL logic**

Revert `handleContentChange` and `handleDisplayModeChange` to their original simple versions (hardcoding `view=happening`) since HappeningView is only used standalone now:

```typescript
const handleContentChange = useCallback((content: HappeningContent) => {
  const params = new URLSearchParams(searchParams?.toString() || "");
  for (const key of FIND_FILTER_RESET_KEYS) {
    params.delete(key);
  }
  params.set("view", "happening");
  if (content === "all") {
    params.delete("content");
  } else {
    params.set("content", content);
  }
  params.delete("display");
  startTransition(() => {
    router.push(`/${portalSlug}?${params.toString()}`);
  });
}, [portalSlug, router, searchParams, startTransition]);

const handleDisplayModeChange = useCallback((mode: DisplayMode) => {
  const params = new URLSearchParams(searchParams?.toString() || "");
  params.set("view", "happening");
  if (mode === "list") {
    params.delete("display");
  } else {
    params.set("display", mode);
  }
  if (mode === "calendar") {
    params.delete("date");
  }
  startTransition(() => {
    router.push(`/${portalSlug}?${params.toString()}`, { scroll: false });
  });
}, [portalSlug, router, searchParams, startTransition]);
```

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: Clean build

- [ ] **Step 3: Commit**

```bash
git add web/components/find/HappeningView.tsx
git commit -m "refactor(explore): clean up HappeningView shell-aware URL logic — now standalone only"
```

---

### Task 8: Browser Test — Desktop Lanes

**Files:** None (testing only)

- [ ] **Step 1: Test launchpad**

Navigate to `http://localhost:3000/atlanta?view=find`
Verify: Sidebar shows "Explore" title + Browse (6 lanes) + Views (2 lanes). Content shows search + teasers + spotlights.

- [ ] **Step 2: Test each lane**

Click each sidebar lane and verify:
- `Events` → EventsFinder with curated timeline, search, trending chips. NO Events/Regulars/Showtimes tabs.
- `Now Showing` → WhatsOnView with film showtimes. NO Film/Music/Stage sub-tabs (single-vertical mode).
- `Live Music` → WhatsOnView with music shows. NO sub-tabs. Genre chips present.
- `Stage & Comedy` → WhatsOnView with stage content. NO sub-tabs.
- `Regulars` → RegularsView with day/activity filters.
- `Places` → SpotsFinder/PortalSpotsView with venue listings.
- `Calendar` → EventsFinder with calendar display.
- `Map` → EventsFinder with map display.

- [ ] **Step 3: Test back navigation**

Click "Explore" title from any lane → returns to launchpad. Sidebar stays visible throughout.

- [ ] **Step 4: Test active state**

Verify active lane is highlighted with accent color in sidebar. Other lanes are dim.

---

### Task 9: Browser Test — Mobile

- [ ] **Step 1: Resize to 375px**

- [ ] **Step 2: Test launchpad**

Verify: No chip bar visible. Lane teasers visible as mobile entry points.

- [ ] **Step 3: Test lane navigation**

Click a teaser → lane content renders full-width. Chip bar appears with "Explore" home chip + lane chips. Active chip highlighted.

- [ ] **Step 4: Test lane switching**

Click different chips → content switches. Click "Explore" chip → returns to launchpad, chip bar disappears.

---

### Task 10: Backward Compatibility Test

- [ ] **Step 1: Test legacy standalone URL**

Navigate to `http://localhost:3000/atlanta?view=happening&content=showtimes&vertical=film`
Verify: Standalone HappeningView renders (with its own chrome — Events/Regulars/Showtimes tabs). NOT inside the Explore shell.

- [ ] **Step 2: Test legacy lane URL**

Navigate to `http://localhost:3000/atlanta?view=find&lane=film`
Verify: Redirects to `?view=find&lane=now-showing` via normalizer.

- [ ] **Step 3: Commit all verified work**

```bash
git add -A
git commit -m "feat(explore): complete Explore page restructure — shell owns nav, headless renderers"
```
