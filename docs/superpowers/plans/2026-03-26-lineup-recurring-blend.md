# Lineup Recurring Blend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Blend recurring events (trivia, karaoke, comedy nights) into the Lineup's Tonight and This Week tabs with compact visual treatment, fix server/client count mismatches, and make "All" truly mean all events.

**Architecture:** Surgical refactor of the existing city-pulse pipeline — no new endpoints. Move `isSceneEvent()` filtering from client exclusion to server tagging. Add `activity_type` field to `CityPulseEventItem`. Client renders tagged recurring events via a new `RecurringStrip` component at the bottom of Tonight/This Week. Regular Hangs stays as its own section in the scroll path. On the Horizon stays as its own standalone section. Behind a launch flag for safe rollout.

**Tech Stack:** Next.js 16, Supabase, React, Tailwind v4, Phosphor icons

---

## Context: What's Wrong Today

1. **The Lineup aggressively filters OUT recurring events** (trivia, karaoke, comedy) client-side, making the Tonight tab feel thin while Regular Hangs shows the same events in a separate section
2. **Tab pill counts lie** — server counts include events the client filters out (scene events, activism, generic recurring), so "48" in the pill but only 4 events displayed
3. **"All" doesn't mean all** — it means "union of selected interest category chips." Users who select Music + Comedy see only those categories on the All tab
4. **Coming Up date boundary is off by 1 day** — server includes events at +7 days, client starts at +8 days
5. **Civic portals** have a `keepRecurring` prop that exists but is never passed as `true`, so HelpATL's weekly volunteer shifts get filtered out of the lineup

## What This Plan Does NOT Do

- Does NOT create a new API endpoint (refactors existing city-pulse pipeline)
- Does NOT remove Regular Hangs from the scroll path (it stays as its own section)
- Does NOT remove On the Horizon from the scroll path (it stays as its own section)
- Does NOT add an "Every Week" tab (expert review rejected this)
- Does NOT remove social proof, editorial, or urgency enrichments (they already work)

---

## File Map

### New files
| File | Responsibility |
|------|---------------|
| `web/components/feed/lineup/RecurringStrip.tsx` | Compact recurring event rows at bottom of Tonight/This Week tabs |

### Modified files
| File | Change |
|------|--------|
| `web/lib/city-pulse/types.ts` | Add `activity_type` field to `CityPulseEventItem` |
| `web/lib/city-pulse/section-builders.ts:52-104` | `makeEventItem()` — compute + attach `activity_type` |
| `web/lib/city-pulse/section-builders.ts:282-315` | `buildTabEventPool()` — include scene events (tagged) instead of excluding |
| `web/app/api/portals/[slug]/city-pulse/route.ts:233-248` | `excludeNonLineupRecurring()` — include scene events in counts |
| `web/components/feed/LineupSection.tsx:336-391` | `tabEventPools` — stop excluding scene events, split for RecurringStrip |
| `web/components/feed/LineupSection.tsx:404-422` | Remove union matcher from "All" chip |
| `web/components/feed/LineupSection.tsx:118-129` | Fix Coming Up date boundary (+8 → +7) |
| `web/components/feed/CityPulseShell.tsx:471-482` | Pass `keepRecurring` for civic portals |
| `web/lib/launch-flags.ts` | Add `ENABLE_LINEUP_RECURRING` flag |

---

## Tasks

### Task 1: Launch flag

**Files:**
- Modify: `web/lib/launch-flags.ts`

- [ ] **Step 1: Add the flag**

```typescript
// Add after existing flags (around line 20)
export const ENABLE_LINEUP_RECURRING =
  process.env.NEXT_PUBLIC_ENABLE_LINEUP_RECURRING === "true" ||
  process.env.ENABLE_LINEUP_RECURRING === "true";
```

- [ ] **Step 2: Verify compilation**

Run: `cd web && npx tsc --noEmit --pretty 2>&1 | head -10`
Expected: Clean

- [ ] **Step 3: Commit**

```bash
git add web/lib/launch-flags.ts
git commit -m "feat(lineup): add ENABLE_LINEUP_RECURRING launch flag"
```

---

### Task 2: Add `activity_type` to CityPulseEventItem type

**Files:**
- Modify: `web/lib/city-pulse/types.ts:99-112`

- [ ] **Step 1: Read the current type definition**

Read `web/lib/city-pulse/types.ts` lines 99-112 to see the current `CityPulseEventItem` interface.

- [ ] **Step 2: Add the `activity_type` field**

Add `activity_type` after the existing `recurrence_label` field:

```typescript
// In CityPulseEventItem interface, after recurrence_label
  /** Scene activity type for recurring events (e.g. "trivia", "karaoke"). Null for non-scene events. */
  activity_type?: string | null;
```

- [ ] **Step 3: Verify compilation**

Run: `cd web && npx tsc --noEmit --pretty 2>&1 | head -10`
Expected: Clean (new optional field is backwards-compatible)

- [ ] **Step 4: Commit**

```bash
git add web/lib/city-pulse/types.ts
git commit -m "feat(lineup): add activity_type field to CityPulseEventItem"
```

---

### Task 3: Server-side — tag scene events instead of excluding them

**Files:**
- Modify: `web/lib/city-pulse/section-builders.ts:52-104` (makeEventItem)
- Modify: `web/lib/city-pulse/section-builders.ts:282-315` (buildTabEventPool)

- [ ] **Step 1: Read the current `makeEventItem` function**

Read `web/lib/city-pulse/section-builders.ts` lines 52-104.

- [ ] **Step 2: Add activity_type computation to `makeEventItem`**

In `makeEventItem()`, after the existing `card_tier` assignment, add:

```typescript
  // Compute scene activity type for recurring events
  const activityType = (event.series_id || event.is_recurring)
    ? (matchActivityType(event as Parameters<typeof matchActivityType>[0])?.id ?? null)
    : null;
```

Then include it in the returned object:

```typescript
    activity_type: activityType,
```

The `matchActivityType` import should already exist at the top of the file (line 32-35).

- [ ] **Step 3: Read the current `buildTabEventPool` function**

Read `web/lib/city-pulse/section-builders.ts` lines 282-315.

- [ ] **Step 4: Modify `buildTabEventPool` to include scene events**

The current line 289 is:
```typescript
const nonScene = events.filter((e) => !isSceneEvent(e));
```

Change it to keep ALL events (scene events will be tagged via `makeEventItem`):
```typescript
// Scene events are no longer excluded — they render as RecurringStrip in the client.
// The activity_type field on each CityPulseEventItem signals the client to use compact treatment.
const filteredEvents = events;
```

Then update the subsequent code that references `nonScene` to use `filteredEvents` instead. The deduplication and wrapping logic stays the same — it just operates on the full event set now.

- [ ] **Step 5: Verify compilation**

Run: `cd web && npx tsc --noEmit --pretty 2>&1 | head -10`
Expected: Clean

- [ ] **Step 6: Commit**

```bash
git add web/lib/city-pulse/section-builders.ts
git commit -m "feat(lineup): tag scene events with activity_type instead of excluding from tab pool"
```

---

### Task 4: Server-side — fix tab counts to include scene events

**Files:**
- Modify: `web/app/api/portals/[slug]/city-pulse/route.ts:233-260`

- [ ] **Step 1: Read the current `excludeNonLineupRecurring` function**

Read `web/app/api/portals/[slug]/city-pulse/route.ts` lines 233-260.

- [ ] **Step 2: Modify `excludeNonLineupRecurring` to include scene events**

The function currently excludes scene events from counts. Since scene events now render in the lineup (as RecurringStrip), they should be counted.

Change the logic: scene events should PASS the filter (they count toward the tab total). Only exclude generic recurring events that don't match any activity type AND don't have premium tags:

```typescript
const excludeNonLineupRecurring = (rows: TabCountRow[]): TabCountRow[] =>
  rows.filter((row) => {
    // Non-recurring events always pass
    if (!row.series_id && !row.is_recurring) return true;

    // Build pseudo-event for scene check
    const pseudo = { /* existing pseudo-event construction */ };

    // Scene events now render in the lineup — include them in counts
    if (isSceneEvent(pseudo as Parameters<typeof isSceneEvent>[0])) return true;

    // Non-scene recurring: check for premium tags
    const tags = row.tags ?? [];
    if (tags.some((t: string) => LINEUP_PREMIUM_TAGS.has(t))) return true;

    // Generic recurring without activity type or premium tag — exclude
    return false;
  });
```

- [ ] **Step 3: Verify compilation**

Run: `cd web && npx tsc --noEmit --pretty 2>&1 | head -10`
Expected: Clean

- [ ] **Step 4: Commit**

```bash
git add web/app/api/portals/[slug]/city-pulse/route.ts
git commit -m "fix(lineup): include scene events in tab counts — they now render as RecurringStrip"
```

---

### Task 5: RecurringStrip component

**Files:**
- Create: `web/components/feed/lineup/RecurringStrip.tsx`

- [ ] **Step 1: Create the directory and component**

```typescript
// web/components/feed/lineup/RecurringStrip.tsx
"use client";

/**
 * RecurringStrip — compact rows for recurring events at the bottom of
 * Tonight / This Week tabs. Shows activity-colored dots, event title,
 * venue name, and recurrence pattern ("Every Tue · 8 PM").
 *
 * These events ALSO appear in the Regular Hangs section further down
 * the feed. The strip is contextual ("what regulars are tonight"),
 * the section is discovery ("what recurring activities exist").
 */

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";
import Dot from "@/components/ui/Dot";
import type { CityPulseEventItem } from "@/lib/city-pulse/types";
import { SCENE_ACTIVITY_TYPES } from "@/lib/scene-event-routing";

const INITIAL_SHOW = 5;

/** Map activity type ID → accent color from scene routing config */
const ACTIVITY_COLORS: Record<string, string> = {};
for (const a of SCENE_ACTIVITY_TYPES) {
  ACTIVITY_COLORS[a.id] = a.color;
}

interface RecurringStripProps {
  events: CityPulseEventItem[];
  portalSlug: string;
}

export function RecurringStrip({ events, portalSlug }: RecurringStripProps) {
  const [expanded, setExpanded] = useState(false);

  if (events.length === 0) return null;

  const visible = expanded ? events : events.slice(0, INITIAL_SHOW);
  const remaining = events.length - INITIAL_SHOW;

  return (
    <div className="mt-4 pt-3 border-t border-[var(--twilight)]/30">
      {/* Strip header */}
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-2xs font-bold uppercase tracking-wider text-[var(--vibe)]">
          Recurring tonight
        </span>
        <Link
          href={`/${portalSlug}/regulars`}
          className="flex items-center gap-0.5 text-2xs font-mono text-[var(--vibe)] opacity-70 hover:opacity-100 transition-opacity"
        >
          All regulars
          <ArrowRight weight="bold" className="w-2.5 h-2.5" />
        </Link>
      </div>

      {/* Compact event rows */}
      <div className="space-y-0.5">
        {visible.map((item) => {
          const color = ACTIVITY_COLORS[item.activity_type ?? ""] ?? "var(--vibe)";
          const venue = item.event.venue;

          return (
            <Link
              key={item.event.id}
              href={`/${portalSlug}?event=${item.event.id}`}
              className="flex items-center gap-2.5 py-1.5 px-2 -mx-2 rounded-lg hover:bg-[var(--dusk)]/40 transition-colors group"
            >
              {/* Activity type dot */}
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: color }}
              />

              {/* Title */}
              <span className="flex-1 min-w-0 text-sm text-[var(--cream)] truncate group-hover:text-[var(--soft)] transition-colors">
                {item.event.title}
              </span>

              {/* Venue + recurrence */}
              <span className="flex items-center gap-1 text-xs text-[var(--muted)] flex-shrink-0">
                {venue?.name && (
                  <span className="truncate max-w-[120px]">{venue.name}</span>
                )}
                {venue?.name && item.recurrence_label && <Dot />}
                {item.recurrence_label && (
                  <span className="font-mono text-2xs">{item.recurrence_label}</span>
                )}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Show more */}
      {remaining > 0 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1 text-xs font-mono text-[var(--vibe)] hover:opacity-80 transition-opacity"
        >
          {expanded ? "Show less" : `+${remaining} more regulars`}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify `SCENE_ACTIVITY_TYPES` is exported**

Run: `cd web && grep -n "export.*SCENE_ACTIVITY_TYPES" lib/scene-event-routing.ts`

If it's not exported, add `export` before the declaration (it's on line 31 of `scene-event-routing.ts`).

- [ ] **Step 3: Verify compilation**

Run: `cd web && npx tsc --noEmit --pretty 2>&1 | head -10`
Expected: Clean

- [ ] **Step 4: Commit**

```bash
git add web/components/feed/lineup/RecurringStrip.tsx
git commit -m "feat(lineup): RecurringStrip component for compact recurring event rows"
```

---

### Task 6: Client-side — blend recurring events into LineupSection

**Files:**
- Modify: `web/components/feed/LineupSection.tsx:336-391` (tabEventPools)
- Modify: `web/components/feed/LineupSection.tsx:404-422` (events filtering)
- Modify: `web/components/feed/LineupSection.tsx:118-129` (Coming Up date)
- Modify: `web/components/feed/LineupSection.tsx` (imports, rendering)

This is the largest task. It modifies the client-side filtering to keep scene events and render them via RecurringStrip, fixes "All" to mean all, and fixes the Coming Up date boundary.

- [ ] **Step 1: Read LineupSection.tsx fully**

Read `web/components/feed/LineupSection.tsx` — the full file, focusing on:
- Lines 336-391 (tabEventPools dedup)
- Lines 404-422 (events filtering with unionMatcher)
- Lines 118-129 (TABS Coming Up dateFilter)
- The render section at the bottom (where TieredEventList is used)

- [ ] **Step 2: Add imports**

Add to the imports section:

```typescript
import { ENABLE_LINEUP_RECURRING } from "@/lib/launch-flags";
import { RecurringStrip } from "./lineup/RecurringStrip";
```

- [ ] **Step 3: Fix Coming Up date boundary**

In the TABS config (line 118-129), change `getDatePlusDays(8)` to `getDatePlusDays(7)` to match the server:

```typescript
// OLD (line 122):
    dateFilter: (e) => {
      const weekOut = getDatePlusDays(8);
// NEW:
    dateFilter: (e) => {
      const weekOut = getDatePlusDays(7);
```

This ensures events exactly 7 days out appear in both server counts and client display.

- [ ] **Step 4: Modify `tabEventPools` to keep scene events when flag is on**

In the `tabEventPools` useMemo (lines 336-391), modify the `dedup` function's scene event filter:

```typescript
// OLD (line 341):
if (!keepRecurring && isSceneEvent(e.event as FeedEventData)) return false;

// NEW:
if (!keepRecurring && !ENABLE_LINEUP_RECURRING && isSceneEvent(e.event as FeedEventData)) return false;
```

When `ENABLE_LINEUP_RECURRING` is true, scene events pass through the dedup filter and remain in the pool. They'll be split out for RecurringStrip rendering later.

- [ ] **Step 5: Fix "All" chip to mean all events**

In the events filtering useMemo (lines 404-422), change the "all" chip behavior:

```typescript
// OLD (line 407-408):
    if (activeChipId === "all") {
      evts = evts.filter(unionMatcher);

// NEW:
    if (activeChipId === "all") {
      // "All" means all events — no category restriction
      // (unionMatcher previously filtered to only selected interest categories)
```

Remove the `evts = evts.filter(unionMatcher)` line entirely for the "all" case. The events should pass through unfiltered.

Also update the "free" chip to not apply the union matcher:

```typescript
// OLD (line 410-413):
    } else if (activeChipId === "free") {
      const freeChip = INTEREST_MAP.get("free");
      if (freeChip) {
        evts = evts.filter((e) => unionMatcher(e) && freeChip.match(e));
      }

// NEW:
    } else if (activeChipId === "free") {
      const freeChip = INTEREST_MAP.get("free");
      if (freeChip) {
        evts = evts.filter((e) => freeChip.match(e));
      }
```

- [ ] **Step 6: Split events into standard + recurring for rendering**

After the `events` useMemo, add a new useMemo that splits events by type:

```typescript
// Split events: standard (TieredEventList) vs recurring (RecurringStrip)
const { standardEvents, recurringEvents } = useMemo(() => {
  if (!ENABLE_LINEUP_RECURRING) {
    return { standardEvents: events, recurringEvents: [] };
  }
  const standard: typeof events = [];
  const recurring: typeof events = [];
  for (const e of events) {
    if (e.activity_type) {
      recurring.push(e);
    } else {
      standard.push(e);
    }
  }
  return { standardEvents: standard, recurringEvents: recurring };
}, [events]);
```

- [ ] **Step 7: Update rendering to use split events + RecurringStrip**

In the render section, find where `TieredEventList` is rendered with `visibleItems` (or `events`). Change it to use `standardEvents` and add `RecurringStrip` below:

```tsx
{/* Replace the existing TieredEventList section */}
<TieredEventList
  items={standardEvents}  {/* was: visibleItems or events */}
  portalSlug={portalSlug}
/>

{/* Recurring events — compact strip at bottom (flag-gated) */}
{ENABLE_LINEUP_RECURRING && recurringEvents.length > 0 && (
  <RecurringStrip
    events={recurringEvents}
    portalSlug={portalSlug}
  />
)}
```

- [ ] **Step 8: Fix chip counts to include recurring events**

In the `chipCounts` useMemo (around line 441-454), the counts are computed from `tabDateEvents`. Since scene events are now included in the pool, the counts will naturally include them. No code change needed — just verify.

The "all" count specifically:
```typescript
counts["all"] = tabDateEvents.filter(unionMatcher).length;
```
This should change to just `tabDateEvents.length` since "All" now means all:
```typescript
counts["all"] = tabDateEvents.length;
```

- [ ] **Step 9: Verify compilation**

Run: `cd web && npx tsc --noEmit --pretty 2>&1 | head -10`
Expected: Clean

- [ ] **Step 10: Commit**

```bash
git add web/components/feed/LineupSection.tsx
git commit -m "feat(lineup): blend recurring events into Tonight/This Week with RecurringStrip

- Scene events kept in pool (flag-gated), rendered as compact strip
- 'All' chip now means all events (no union matcher restriction)
- Fixed Coming Up date boundary (+8 → +7 to match server)
- Recurring events appear in both Lineup strip and Regular Hangs section"
```

---

### Task 7: Wire `keepRecurring` for civic portals

**Files:**
- Modify: `web/components/feed/CityPulseShell.tsx:471-482`

- [ ] **Step 1: Read the current LineupSection rendering**

Read `web/components/feed/CityPulseShell.tsx` lines 470-485 where LineupSection is rendered.

- [ ] **Step 2: Add `keepRecurring` prop for civic portals**

The `LineupSection` already accepts a `keepRecurring` prop (defaults to `false`). Pass `true` when the portal vertical is "community":

```tsx
<LineupSection
  sections={lineupSections}
  portalSlug={portalSlug}
  tabCounts={tabCounts}
  categoryCounts={categoryCounts}
  fetchTab={fetchTab}
  activeInterests={feedLayout?.interests}
  savedInterests={savedInterests}
  onInterestsChange={handleInterestsChange}
  onSaveInterests={handleSaveInterests}
  vertical={portal?.settings?.vertical}
  keepRecurring={portal?.settings?.vertical === "community"}
/>
```

- [ ] **Step 3: Verify compilation**

Run: `cd web && npx tsc --noEmit --pretty 2>&1 | head -10`
Expected: Clean

- [ ] **Step 4: Commit**

```bash
git add web/components/feed/CityPulseShell.tsx
git commit -m "fix(lineup): wire keepRecurring=true for civic portals — stops filtering volunteer shifts"
```

---

### Task 8: End-to-end verification

- [ ] **Step 1: Full TypeScript build**

Run: `cd web && npx tsc --noEmit --pretty`
Expected: Zero errors

- [ ] **Step 2: Lint check**

Run: `cd web && npm run lint 2>&1 | tail -20`
Fix any issues.

- [ ] **Step 3: Test with flag OFF (regression check)**

Set `ENABLE_LINEUP_RECURRING=false` (default). Run dev server.

Navigate to `http://localhost:3000/atlanta`:
- Lineup should behave exactly as before (scene events still filtered, union matcher still active)
- Tab counts should include scene events now (server-side change) — verify they're slightly higher than before
- Regular Hangs section still renders below
- On the Horizon still renders at bottom

This confirms the server-side changes don't break the existing behavior when the flag is off.

- [ ] **Step 4: Test with flag ON (new behavior)**

Set `ENABLE_LINEUP_RECURRING=true` in `.env.local`:
```
NEXT_PUBLIC_ENABLE_LINEUP_RECURRING=true
```

Restart dev server. Navigate to `http://localhost:3000/atlanta`:

1. **Tonight tab**: Events render with TieredEventList (hero + standard) PLUS RecurringStrip at bottom showing compact rows with colored dots
2. **"All" chip**: Shows ALL events, not just union of selected interests. Count matches displayed events.
3. **Category chips**: Music/Comedy/etc. still filter correctly
4. **Tab counts**: Numbers match actual displayed events (no more 48-vs-4 mismatch)
5. **Coming Up tab**: Events from exactly +7 days appear (previously missing)
6. **Regular Hangs section**: Still renders in scroll path below (unchanged)
7. **On the Horizon**: Still renders at bottom (unchanged)
8. **No console errors**

- [ ] **Step 5: Test civic portal**

Navigate to `http://localhost:3000/helpatl`:
- Lineup should show recurring events (volunteer shifts, meetings) in the main timeline
- No scene event filtering (keepRecurring=true)

- [ ] **Step 6: Mobile viewport check (375px)**

- RecurringStrip rows are readable
- Activity dots are visible
- Venue names truncate gracefully
- "+N more regulars" button works

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "feat(lineup): recurring blend — scene events in timeline, accurate counts, All means all

Behind ENABLE_LINEUP_RECURRING flag:
- Recurring events appear in Tonight/This Week with compact RecurringStrip
- 'All' chip shows all events (no union matcher restriction)
- Tab counts match displayed events (scene events counted server-side)
- Coming Up date boundary fixed (+7 matches server)
- Civic portals keep recurring events (keepRecurring wired)
- Regular Hangs and On the Horizon stay as separate scroll-path sections"
```

---

## Rollout Plan

1. **Merge to main with flag OFF** — zero user-visible change, server counts slightly more accurate
2. **Enable flag in preview** — QA the recurring blend on preview deploy
3. **Enable flag in production** — monitor for 1 week
4. **After 2 weeks stable**: Remove the flag and the `!ENABLE_LINEUP_RECURRING` guard paths in a cleanup PR

## What This Doesn't Cover (Future Work)

- **This Week day grouping**: Events in the This Week tab could be grouped by day ("TOMORROW", "THURSDAY") with recurring rows inline per day. The current tab renders a flat list. Day grouping is a separate enhancement.
- **Social proof on RecurringStrip**: The strip doesn't show going_count or friend avatars. These are available in the CityPulseEventItem data — adding them to the strip is straightforward but out of scope.
- **RecurringStrip label per tab**: Currently hardcoded "Recurring tonight". Should be "Recurring this week" on the This Week tab. Simple string swap based on `activeTabId`.
