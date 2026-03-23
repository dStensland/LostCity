# City Briefing Zone Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the top of the Atlanta feed as a unified briefing zone — signal strip (weather, moon, sunset, sports), editorial headline, condensed news digest — that sets the table for the day.

**Architecture:** CityBriefing.tsx gets three new child components (SignalStrip, NewsDigest, SummaryLine) plus a sun/moon utility. Sports tentpole data added to ResolvedHeader. TabCounts/categoryCounts passed down from CityPulseShell. TodayInAtlantaSection removed from CityPulseShell (absorbed into the briefing zone's NewsDigest).

**Tech Stack:** Next.js 16, Tailwind v4, `suncalc` npm package, existing CityPulse pipeline + weather data

**Spec:** `docs/superpowers/specs/2026-03-23-city-briefing-redesign.md`

---

## Task 1: Sun/Moon Utility + suncalc

**Purpose:** Pure functions for sunset time and moon phase. No external API — astronomical calculations from date + Atlanta coordinates.

**Files:**
- Install: `suncalc` npm package
- Create: `web/lib/sun-moon.ts`
- Create: `web/lib/__tests__/sun-moon.test.ts`

- [ ] **Step 1: Install suncalc**

```bash
cd web && npm install suncalc && npm install -D @types/suncalc
```

If `@types/suncalc` doesn't exist, create a minimal declaration file at `web/types/suncalc.d.ts`.

- [ ] **Step 2: Create sun-moon.ts**

```typescript
import SunCalc from "suncalc";

// Atlanta coordinates
const ATL_LAT = 33.749;
const ATL_LNG = -84.388;

export interface SunMoonData {
  sunset: string; // "7:41 PM"
  sunrise: string; // "7:22 AM"
  moonPhase: {
    phase: number; // 0-1 (0=new, 0.25=first quarter, 0.5=full, 0.75=last quarter)
    label: string; // "Full Moon", "Waxing Gibbous", etc.
    emoji: string; // "🌕", "🌖", etc.
    isNotable: boolean; // true for full moon and new moon only
  };
}

export function getSunMoonData(date: Date = new Date()): SunMoonData {
  const times = SunCalc.getTimes(date, ATL_LAT, ATL_LNG);
  const illumination = SunCalc.getMoonIllumination(date);

  return {
    sunset: formatTime12h(times.sunset),
    sunrise: formatTime12h(times.sunrise),
    moonPhase: {
      phase: illumination.phase,
      label: getMoonPhaseLabel(illumination.phase),
      emoji: getMoonEmoji(illumination.phase),
      isNotable: illumination.phase < 0.03 || (illumination.phase > 0.47 && illumination.phase < 0.53),
    },
  };
}

function formatTime12h(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${period}`;
}

function getMoonPhaseLabel(phase: number): string {
  if (phase < 0.03 || phase > 0.97) return "New Moon";
  if (phase < 0.22) return "Waxing Crescent";
  if (phase < 0.28) return "First Quarter";
  if (phase < 0.47) return "Waxing Gibbous";
  if (phase < 0.53) return "Full Moon";
  if (phase < 0.72) return "Waning Gibbous";
  if (phase < 0.78) return "Last Quarter";
  return "Waning Crescent";
}

function getMoonEmoji(phase: number): string {
  if (phase < 0.03 || phase > 0.97) return "🌑";
  if (phase < 0.22) return "🌒";
  if (phase < 0.28) return "🌓";
  if (phase < 0.47) return "🌔";
  if (phase < 0.53) return "🌕";
  if (phase < 0.72) return "🌖";
  if (phase < 0.78) return "🌗";
  return "🌘";
}
```

- [ ] **Step 3: Write tests**

Test: sunset format returns "H:MM PM" pattern. Moon phase label covers full range. Notable flags only on full/new.

```bash
cd web && npx vitest run lib/__tests__/sun-moon.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add web/lib/sun-moon.ts web/lib/__tests__/sun-moon.test.ts web/package.json web/package-lock.json
git commit -m "feat: add sun/moon utility for signal strip (sunset, moon phase)"
```

---

## Task 2: Sports Tentpole in ResolvedHeader

**Purpose:** Add today's sports tentpole event to the header so the signal strip can show "Braves vs Mets · 7:20".

**Files:**
- Modify: `web/lib/city-pulse/types.ts` (add `sports_tentpole` to ResolvedHeader)
- Modify: `web/lib/city-pulse/header-resolver.ts` (resolve sports tentpole from today's events)

- [ ] **Step 1: Add type**

In `web/lib/city-pulse/types.ts`, add to `ResolvedHeader`:

```typescript
sports_tentpole?: {
  title: string;
  start_time: string | null;
  venue_name?: string;
  href: string;
} | null;
```

- [ ] **Step 2: Resolve sports tentpole in header-resolver**

Read `web/lib/city-pulse/header-resolver.ts`. Find where `resolveFlagshipEvent` is called. Add a parallel function `resolveSportsTentpole`:

```typescript
function resolveSportsTentpole(todayEvents: FeedEventData[]): ResolvedHeader["sports_tentpole"] {
  // Note: verify the exact category_id for sports in the DB. It may be "sports"
  // or another value. Check: SELECT DISTINCT category_id FROM events WHERE category_id ILIKE '%sport%'
  // Use the actual value, not a hardcoded guess.
  const sports = todayEvents.find(e =>
    e.is_tentpole && (e.category === "sports" || e.category === "sport")
  );
  if (!sports) return null;
  return {
    title: sports.title,
    start_time: sports.start_time,
    venue_name: sports.venue?.name,
    href: `/events/${sports.id}`,
  };
}
```

Call it in the same place `resolveFlagshipEvent` is called and attach to the header.

- [ ] **Step 3: TypeScript check**

```bash
cd web && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add web/lib/city-pulse/types.ts web/lib/city-pulse/header-resolver.ts
git commit -m "feat: add sports tentpole to ResolvedHeader for signal strip"
```

---

## Task 3: SignalStrip Component

**Purpose:** Horizontal row of ambient context pills — weather, sunset, moon, pollen, sports, holiday.

**Files:**
- Create: `web/components/feed/SignalStrip.tsx`

- [ ] **Step 1: Create SignalStrip**

```typescript
"use client";

import { getSunMoonData } from "@/lib/sun-moon";
import type { FeedContext } from "@/lib/city-pulse/types";

interface SignalStripProps {
  context: FeedContext;
  sportsTentpole?: { title: string; start_time: string | null; href: string } | null;
}
```

Build pills conditionally:

**Always present (in relevant time slots):**
- Weather: `context.weather` → `"☀ 71° Partly Cloudy"` (always)
- Sunset: from `getSunMoonData()` → `"Sunset 7:41"` (only in afternoon/evening: time_slot = happy_hour, evening, late_night)

**Conditional:**
- Moon: from `getSunMoonData()` → `"● Full Moon"` (only when `isNotable`)
- Pollen: **deferred** — render slot but don't populate (no data source yet)
- Sports: from `sportsTentpole` prop → `"Braves vs Mets · 7:20"` in gold (only when present)
- Holiday: from `context.active_holidays[0]` → `"🎄 Juneteenth · 14 celebrations"` in vibe (only when present)
- Rain: from `context.weather?.condition` → `"🌧 Rain until 4pm"` in cyan + `"Indoor picks below ↓"` (when condition includes rain/storm)

**Visual:**
- Container: `flex gap-1.5 flex-wrap`
- Each pill: `font-mono text-2xs px-2 py-0.5 rounded-md bg-white/[0.12]` (default), accent-colored bg for notable conditions
- Tappable pills use `<Link>` wrapping to relevant filtered view

- [ ] **Step 2: Commit**

```bash
git add web/components/feed/SignalStrip.tsx
git commit -m "feat: add SignalStrip component for ambient context pills"
```

---

## Task 4: NewsDigest Component

**Purpose:** Compact 3-headline news module for the briefing zone.

**Files:**
- Create: `web/components/feed/NewsDigest.tsx`

- [ ] **Step 1: Create NewsDigest**

```typescript
"use client";

interface NewsDigestProps {
  portalSlug: string;
}
```

Self-fetching component:
- Fetches from `/api/portals/${portalSlug}/network-feed?limit=20` (no category filter — the API may only accept a single category)
- Client-side filters to culture/arts/food categories: `post.categories?.some(c => ["culture", "arts", "food", "music", "community"].includes(c))`
- Deduplicates by title (same logic as TodayInAtlantaSection)
- Takes first 3 after filtering
- Returns null if no headlines
- Uses `feed-section-enter` class for fade-in

Each headline row:
- Title: `text-xs font-medium text-[var(--cream)]` (single line, truncate)
- Source + category: `text-2xs text-[var(--muted)]`
- Row height: ~36-40px

Header: "TODAY IN ATLANTA" (mono, 2xs, uppercase, muted) + "All news →" link to `/${portalSlug}/network`

- [ ] **Step 2: Commit**

```bash
git add web/components/feed/NewsDigest.tsx
git commit -m "feat: add compact NewsDigest component for briefing zone"
```

---

## Task 5: SummaryLine Component

**Purpose:** Template-driven summary for normal days — "47 events tonight · 12 live music · Perfect patio weather"

**Files:**
- Create: `web/components/feed/SummaryLine.tsx`

- [ ] **Step 1: Create SummaryLine**

```typescript
interface SummaryLineProps {
  tabCounts?: { today: number; this_week: number; coming_up: number } | null;
  categoryCounts?: { today: Record<string, number> } | null;
  weather?: { temperature_f: number; condition: string } | null;
}
```

Builds a summary string from available data:

```typescript
const parts: string[] = [];

// Event count
const todayCount = tabCounts?.today ?? 0;
if (todayCount > 0) parts.push(`${todayCount} events tonight`);

// Top category count
const cats = categoryCounts?.today ?? {};
const topCat = Object.entries(cats).sort((a, b) => b[1] - a[1])[0];
if (topCat && topCat[1] > 3) parts.push(`${topCat[1]} ${formatCategoryLabel(topCat[0])}`);

// Weather context
if (weather) parts.push(getWeatherContext(weather));

return parts.join(" · ");
```

Weather context templates:
- Clear, 65-85°F → "Perfect patio weather"
- Clear, 55-65°F → "Beautiful evening ahead"
- Below 45°F → "Bundle up tonight"
- Rain → "Indoor day"
- Above 90°F → "Hot one today"
- Default → "Nice out"

Renders as: `text-sm text-[var(--soft)]`

- [ ] **Step 2: Commit**

```bash
git add web/components/feed/SummaryLine.tsx
git commit -m "feat: add SummaryLine component for normal-day briefing"
```

---

## Task 6: Integrate Into CityBriefing

**Purpose:** Wire SignalStrip, NewsDigest, SummaryLine into CityBriefing. Add tabCounts/categoryCounts props. Remove the old "Today in Atlanta" news rendering (already extracted in Task 5 of the feed redesign).

**Files:**
- Modify: `web/components/feed/CityBriefing.tsx`
- Modify: `web/components/feed/CityPulseShell.tsx` (pass new props, remove TodayInAtlantaSection)

- [ ] **Step 1: Read CityBriefing.tsx**

Read the full component. Understand the current hero rendering, flagship vs atmospheric split, and where new components slot in. The flagship hero binding from earlier work is already in place.

- [ ] **Step 2: Add new props to CityBriefing**

```typescript
interface CityBriefingProps {
  // ... existing props
  tabCounts?: { today: number; this_week: number; coming_up: number } | null;
  categoryCounts?: { today: Record<string, number> } | null;
}
```

- [ ] **Step 3: Add SignalStrip to the hero overlay**

Inside the hero zone (the image area with gradient overlay), add `<SignalStrip>` above the headline/title content:

```tsx
<SignalStrip
  context={context}
  sportsTentpole={header.sports_tentpole}
/>
```

Position it at the bottom of the hero image, above the headline text, within the gradient overlay area.

- [ ] **Step 4: Add SummaryLine to normal-day state**

In the atmospheric (non-flagship) rendering path, replace or augment the current weather haiku with `<SummaryLine>`:

```tsx
{!header.flagship_event && (
  <SummaryLine
    tabCounts={tabCounts}
    categoryCounts={categoryCounts}
    weather={context.weather}
  />
)}
```

- [ ] **Step 5: Add NewsDigest below the hero**

After the hero image area (but still inside CityBriefing), add the news digest:

```tsx
<NewsDigest portalSlug={portalSlug} />
```

This renders the compact 3-headline block between the hero and The Lineup.

- [ ] **Step 6: Add "THE LINEUP" boundary divider**

After the NewsDigest, add the transition marker:

```tsx
<div className="border-t border-[var(--twilight)] pt-4 mt-3">
  <span className="font-mono text-2xs uppercase tracking-[1.2px] text-[var(--muted)]">
    THE LINEUP
  </span>
</div>
```

- [ ] **Step 7: Pass new props from CityPulseShell**

In `CityPulseShell.tsx`, add `tabCounts` and `categoryCounts` to the CityBriefing render:

```tsx
<CityBriefing
  header={header}
  context={context}
  portalSlug={portalSlug}
  portalId={portal.id}
  quickLinks={quickLinks}
  tabCounts={tabCounts}
  categoryCounts={categoryCounts}
/>
```

- [ ] **Step 8: Remove TodayInAtlantaSection from CityPulseShell**

The TodayInAtlantaSection (rendered at ~line 462-465 inside a LazySection) is now absorbed into the briefing zone via NewsDigest. Remove its rendering from CityPulseShell. The component file can stay (the "All news →" link routes to `/network` which uses its own page).

- [ ] **Step 9: Browser test**

Open `http://localhost:3000/atlanta`. Verify:
- Signal strip shows weather + sunset (if afternoon/evening) + moon (if notable)
- Flagship day: event image, gold label, event title, action pills
- Normal day: city photo, "[Day] in Atlanta", summary line with counts + weather context
- 3 news headlines below the hero (culture-first)
- "THE LINEUP" divider clearly marks the transition
- Total briefing zone under ~500px on mobile
- No TodayInAtlantaSection appearing separately below The Lineup

- [ ] **Step 10: TypeScript + tests**

```bash
cd web && npx tsc --noEmit && npx vitest run
```

- [ ] **Step 11: Commit**

```bash
git add web/components/feed/CityBriefing.tsx web/components/feed/CityPulseShell.tsx
git commit -m "feat: integrate signal strip, news digest, and summary line into unified briefing zone"
```

---

## Task 7: Polish + Documentation

- [ ] **Step 1: Verify height budget**

Check mobile viewport (375px). The briefing zone (hero + signals + news) should be under 500px total. If it exceeds, reduce hero height or news row count.

- [ ] **Step 2: Test both states**

If a flagship event exists today → verify event image hero with gold label.
If not → verify atmospheric hero with summary line.

Check that the signal strip adapts to time of day (morning vs evening pills differ).

- [ ] **Step 3: Update design system rules**

Add briefing zone documentation to `web/.claude/rules/figma-design-system.md`:
- SignalStrip component and data sources
- NewsDigest component and behavior
- SummaryLine templates
- Briefing zone height budget
- "THE LINEUP" boundary pattern

- [ ] **Step 4: Commit**

```bash
git add web/.claude/rules/figma-design-system.md
git commit -m "docs: add city briefing zone patterns to design system rules"
```
