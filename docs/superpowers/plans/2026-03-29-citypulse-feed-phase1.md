# CityPulse Feed Redesign — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the CityPulse feed from fragmented sections into a unified editorial briefing + timeline with regulars toggle, plus See Shows enrichment.

**Architecture:** Replace GreetingBar/DashboardCards/CityBriefing with a template-composed Briefing. Consolidate Lineup + Scene + PlanningHorizon into a single tabbed section with Regulars toggle. Enrich See Shows with showtime chips, urgency badges, and metadata. All structural — no new data layer dependencies (enriched cards defer to Phase 2).

**Tech Stack:** Next.js 16, React, TypeScript, Supabase, Vitest, Tailwind v4

**Spec:** `docs/superpowers/specs/2026-03-29-citypulse-feed-redesign.md`

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `web/lib/city-pulse/briefing-engine.ts` | Template composition engine — signal priority stack, 8 patterns, quiet-day collapse |
| `web/lib/city-pulse/briefing-engine.test.ts` | Unit tests for all template patterns + collapse logic |
| `web/components/feed/BriefingSection.tsx` | Briefing UI — editorial prose + context pills, fixed-height container |
| `web/components/feed/lineup/RegularsToggle.tsx` | Toggle chip + Scene mode UI (activity chips, day pills) |
| `web/components/feed/lineup/TimeFlowMarker.tsx` | "Happening Now" / "Tonight" / "On the Horizon" markers |

### Modified Files
| File | Changes |
|------|---------|
| `web/lib/city-pulse/types.ts` | Add `BriefingSignal`, `BriefingOutput`, `closingSoonExhibitions` to PhaseAEnrichments, `school_calendar` to FeedContext |
| `web/lib/city-pulse/context.ts` | Wire `school_calendar_events` query into `buildFeedContext()` |
| `web/lib/city-pulse/pipeline/fetch-enrichments.ts` | Add exhibition countdown query to Phase A |
| `web/lib/city-pulse/header-resolver.ts` | Call briefing engine from `resolveHeader()`, return `BriefingOutput` in `ResolvedHeader` |
| `web/components/feed/CityPulseShell.tsx` | Remove GreetingBar/DashboardCards/CityBriefing/TheSceneSection/PlanningHorizonSection. Wire BriefingSection + unified Lineup. Update feed block order. |
| `web/components/feed/LineupSection.tsx` | Add time flow markers, wire regulars toggle, absorb horizon tentpoles into tabs |
| `web/components/feed/lineup/RecurringStrip.tsx` | Update recurrence badges to default `EVERY MON` format |
| `web/components/feed/sections/SeeShowsSection.tsx` | Remove Clowns tab, add showtime chips, urgency badges, metadata row, festival links |
| `web/components/feed/sections/TheSceneSection.tsx` | Keep file (used by other portals) but remove from Atlanta feed shell |
| `web/components/feed/FeedPageIndex.tsx` | Update BLOCK_LABELS for new section names |
| `web/lib/city-pulse/section-builders.ts` | Export `buildRecurrenceLabel` with day-specific default, add horizon quality gate helper |
| `web/app/api/regulars/route.ts` | Extend date range cap from 7 to 30 days via `range` param for "Coming Up" tab |

---

## Task 1: Pre-Implementation Cleanup — Remove Clowns Tab

**Files:**
- Modify: `web/components/feed/sections/SeeShowsSection.tsx:11-22`

- [ ] **Step 1: Remove Clowns from ShowTab type and TABS array**

In `SeeShowsSection.tsx`, change:
```typescript
// Line 11: Remove "clowns" from union
type ShowTab = "film" | "music" | "theater";

// Lines 17-22: Remove clowns entry
const TABS = [
  { id: "film", label: "Film", accent: "var(--vibe)" },
  { id: "music", label: "Music", accent: "#E855A0" },
  { id: "theater", label: "Theater", accent: "var(--neon-cyan)" },
];
```

Also remove the Clowns tab panel rendering (likely around line 100+).

- [ ] **Step 2: Verify build**

Run: `cd web && npx tsc --noEmit`
Expected: Clean build, no type errors from removing clowns references.

- [ ] **Step 3: Commit**

```bash
git add web/components/feed/sections/SeeShowsSection.tsx
git commit -m "fix(feed): remove test 'Clowns' tab from SeeShowsSection"
```

---

## Task 2: Type Foundations

**Files:**
- Modify: `web/lib/city-pulse/types.ts`
- Modify: `web/lib/city-pulse/pipeline/fetch-enrichments.ts`

- [ ] **Step 1: Add briefing types to types.ts**

Add after the existing type definitions:

```typescript
// Briefing Engine Types
export interface BriefingSignal {
  type: "tentpole" | "holiday" | "exhibition_closing" | "school_calendar" | "weather" | "general_activity";
  priority: number; // 1 = highest
  headline: string; // e.g. "Dragon Con starts tomorrow"
  detail?: string; // e.g. "47 events across 5 hotels"
  link?: { label: string; href: string }; // for context pill
  accent?: string;
}

export interface BriefingOutput {
  prose: string; // Composed 1-2 sentence briefing
  collapsed: boolean; // true = quiet day, minimal header
  pills: Array<{ label: string; href: string; accent?: string; ariaLabel: string }>;
  dayLabel: string; // e.g. "Sunday Evening"
  weatherBadge?: { temp: string; condition: string };
}
```

- [ ] **Step 2: Extend FeedContext with school calendar**

Add to the FeedContext interface:

```typescript
school_calendar_events?: Array<{
  event_type: string; // no_school, half_day, break, holiday, early_release
  school_system: string;
  date: string;
  title: string;
}>;
```

- [ ] **Step 3: Add closingSoonExhibitions to PhaseAEnrichments**

In `web/lib/city-pulse/pipeline/fetch-enrichments.ts`, add to `PhaseAEnrichments`:

```typescript
closingSoonExhibitions: Array<{
  id: number;
  title: string;
  closing_date: string;
  venue_name?: string;
  days_remaining: number;
}>;
```

- [ ] **Step 4: Add BriefingOutput to ResolvedHeader**

In `types.ts`, add to the `ResolvedHeader` interface:

```typescript
briefing?: BriefingOutput;
```

- [ ] **Step 5: Verify build**

Run: `cd web && npx tsc --noEmit`
Expected: Clean build.

- [ ] **Step 6: Commit**

```bash
git add web/lib/city-pulse/types.ts web/lib/city-pulse/pipeline/fetch-enrichments.ts
git commit -m "feat(feed): add briefing engine types and PhaseA exhibition field"
```

---

## Task 3: Exhibition Countdown Query

**Files:**
- Modify: `web/lib/city-pulse/pipeline/fetch-enrichments.ts`
- Test: `web/lib/city-pulse/pipeline/fetch-enrichments.test.ts` (create if needed)

- [ ] **Step 1: Add exhibition countdown to Phase A fetch**

In `fetch-enrichments.ts`, inside the `fetchPhaseAEnrichments()` function, add a parallel query alongside the existing weather/specials/headers queries:

```typescript
const closingExhibitionsPromise = supabase
  .from("exhibitions")
  .select("id, title, closing_date, venue:places(name)")
  .gte("closing_date", new Date().toISOString().split("T")[0])
  .lte("closing_date", new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0])
  .order("closing_date", { ascending: true })
  .limit(5);
```

Add to the `Promise.all` and process the result:

```typescript
const closingSoonExhibitions = (closingExhibitionsResult.data ?? []).map((e) => ({
  id: e.id,
  title: e.title,
  closing_date: e.closing_date,
  venue_name: (e.venue as { name: string } | null)?.name ?? undefined,
  days_remaining: Math.ceil(
    (new Date(e.closing_date).getTime() - Date.now()) / 86400000
  ),
}));
```

Return `closingSoonExhibitions` as part of the PhaseA result.

- [ ] **Step 2: Verify build**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add web/lib/city-pulse/pipeline/fetch-enrichments.ts
git commit -m "feat(feed): add exhibition countdown query to Phase A enrichments"
```

---

## Task 4: School Calendar Context

**Files:**
- Modify: `web/lib/city-pulse/context.ts`

- [ ] **Step 1: Add school calendar query to buildFeedContext()**

In `context.ts`, add a helper function:

```typescript
async function getUpcomingSchoolEvents(
  supabase: SupabaseClient,
  now: Date
): Promise<FeedContext["school_calendar_events"]> {
  const today = now.toISOString().split("T")[0];
  const tomorrow = new Date(now.getTime() + 86400000).toISOString().split("T")[0];

  const { data } = await supabase
    .from("school_calendar_events")
    .select("event_type, school_system, date, title")
    .gte("date", today)
    .lte("date", tomorrow)
    .limit(10);

  return data ?? [];
}
```

Wire into `buildFeedContext()` — add to the parallel fetch alongside weather and festivals. Return as `school_calendar_events` on the FeedContext.

- [ ] **Step 2: Verify build**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add web/lib/city-pulse/context.ts
git commit -m "feat(feed): wire school_calendar_events into feed context"
```

---

## Task 5: Template Composition Engine

**Files:**
- Create: `web/lib/city-pulse/briefing-engine.ts`
- Create: `web/lib/city-pulse/briefing-engine.test.ts`

- [ ] **Step 1: Write failing tests for all 8 patterns + quiet-day collapse**

Create `web/lib/city-pulse/briefing-engine.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { composeBriefing, type BriefingContext } from "./briefing-engine";

function makeContext(overrides: Partial<BriefingContext> = {}): BriefingContext {
  return {
    tentpoleEvent: null,
    activeHolidays: [],
    closingSoonExhibitions: [],
    schoolCalendarEvents: [],
    weather: null,
    weatherSignal: null,
    todayEventCount: 200,
    topCategories: [],
    timeSlot: "evening",
    dayOfWeek: "sunday",
    portalSlug: "atlanta",
    ...overrides,
  };
}

describe("composeBriefing", () => {
  it("tentpole + weather", () => {
    const result = composeBriefing(makeContext({
      tentpoleEvent: { title: "Dragon Con", starts_tomorrow: true, event_count: 47, location: "Downtown" },
      weather: { temperature_f: 72, condition: "clear" },
    }));
    expect(result.collapsed).toBe(false);
    expect(result.prose).toContain("Dragon Con");
    expect(result.prose).toContain("72°");
    expect(result.pills.length).toBeGreaterThan(0);
  });

  it("tentpole + activity", () => {
    const result = composeBriefing(makeContext({
      tentpoleEvent: { title: "Dragon Con", starts_tomorrow: true, event_count: 47, location: "Downtown" },
    }));
    expect(result.collapsed).toBe(false);
    expect(result.prose).toContain("Dragon Con");
    expect(result.prose).toContain("47");
  });

  it("holiday + activity", () => {
    const result = composeBriefing(makeContext({
      activeHolidays: [{ title: "Juneteenth", slug: "juneteenth" }],
      todayEventCount: 8,
      topCategories: ["community"],
    }));
    expect(result.prose).toContain("Juneteenth");
  });

  it("exhibition closing + weather", () => {
    const result = composeBriefing(makeContext({
      closingSoonExhibitions: [{ title: "Basquiat", venue_name: "High Museum", days_remaining: 12 }],
      weather: { temperature_f: 68, condition: "clear" },
    }));
    expect(result.prose).toContain("Basquiat");
    expect(result.prose).toContain("12 days");
  });

  it("school calendar + activity", () => {
    const result = composeBriefing(makeContext({
      schoolCalendarEvents: [{ event_type: "no_school", school_system: "APS", title: "Spring Break" }],
      todayEventCount: 9,
      topCategories: ["family"],
    }));
    expect(result.prose).toContain("school");
  });

  it("weather + activity", () => {
    const result = composeBriefing(makeContext({
      weather: { temperature_f: 45, condition: "rain" },
      weatherSignal: "rain",
      todayEventCount: 14,
      topCategories: ["comedy"],
    }));
    expect(result.prose).toContain("Rain");
  });

  it("weather + outdoor", () => {
    const result = composeBriefing(makeContext({
      weather: { temperature_f: 68, condition: "clear" },
      weatherSignal: "nice",
      topCategories: ["outdoors"],
    }));
    expect(result.prose).toMatch(/sunny|clear|68/i);
  });

  it("activity only fallback", () => {
    const result = composeBriefing(makeContext({
      todayEventCount: 200,
      topCategories: ["music", "arts"],
    }));
    expect(result.collapsed).toBe(false);
    expect(result.prose.length).toBeGreaterThan(0);
  });

  it("quiet day collapse", () => {
    const result = composeBriefing(makeContext({
      todayEventCount: 15,
      topCategories: [],
      weather: { temperature_f: 62, condition: "overcast" },
      weatherSignal: null,
    }));
    expect(result.collapsed).toBe(true);
    expect(result.pills).toHaveLength(0);
    expect(result.dayLabel).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd web && npx vitest run lib/city-pulse/briefing-engine.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the briefing engine**

Create `web/lib/city-pulse/briefing-engine.ts`:

```typescript
export interface BriefingContext {
  tentpoleEvent: {
    title: string;
    starts_tomorrow?: boolean;
    event_count?: number;
    location?: string;
  } | null;
  activeHolidays: Array<{ title: string; slug: string }>;
  closingSoonExhibitions: Array<{
    title: string;
    venue_name?: string;
    days_remaining: number;
  }>;
  schoolCalendarEvents: Array<{
    event_type: string;
    school_system: string;
    title: string;
  }>;
  weather: { temperature_f: number; condition: string } | null;
  weatherSignal: string | null;
  todayEventCount: number;
  topCategories: string[];
  timeSlot: string;
  dayOfWeek: string;
  portalSlug: string;
}

interface Signal {
  priority: number;
  clause: string;
  pill?: { label: string; href: string; accent?: string; ariaLabel: string };
}

const DAY_LABELS: Record<string, string> = {
  monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday",
  thursday: "Thursday", friday: "Friday", saturday: "Saturday", sunday: "Sunday",
};

const TIME_LABELS: Record<string, string> = {
  morning: "Morning", midday: "Afternoon", happy_hour: "Afternoon",
  evening: "Evening", late_night: "Night",
};

export function composeBriefing(ctx: BriefingContext): BriefingOutput {
  const signals = gatherSignals(ctx);
  const dayLabel = `${DAY_LABELS[ctx.dayOfWeek] ?? ctx.dayOfWeek} ${TIME_LABELS[ctx.timeSlot] ?? ""}`.trim();
  const weatherBadge = ctx.weather
    ? { temp: `${Math.round(ctx.weather.temperature_f)}°`, condition: ctx.weather.condition }
    : undefined;

  if (signals.length === 0) {
    return {
      prose: "",
      collapsed: true,
      pills: [],
      dayLabel,
      weatherBadge,
    };
  }

  // Take top 2 signals by priority
  const sorted = signals.sort((a, b) => a.priority - b.priority);
  const top = sorted.slice(0, 2);
  const prose = top.map((s) => s.clause).join(" ");
  const pills = top.map((s) => s.pill).filter(Boolean) as BriefingOutput["pills"];

  return { prose, collapsed: false, pills, dayLabel, weatherBadge };
}

function gatherSignals(ctx: BriefingContext): Signal[] {
  const signals: Signal[] = [];

  // Priority 1: Tentpole
  if (ctx.tentpoleEvent) {
    const { title, starts_tomorrow, event_count, location } = ctx.tentpoleEvent;
    const when = starts_tomorrow ? "starts tomorrow" : "is happening now";
    let clause = `${title} ${when}.`;
    if (event_count && location) {
      clause += ` ${event_count} events across ${location}.`;
    }
    // If weather also available, append it
    if (ctx.weather) {
      clause += ` ${Math.round(ctx.weather.temperature_f)}° and ${ctx.weather.condition} tonight.`;
    }
    signals.push({
      priority: 1,
      clause,
      pill: { label: `${title} Preview`, href: `/${ctx.portalSlug}?view=find`, accent: "var(--gold)", ariaLabel: `See ${title} events` },
    });
  }

  // Priority 2: Holiday
  if (ctx.activeHolidays.length > 0) {
    const holiday = ctx.activeHolidays[0];
    const countClause = ctx.todayEventCount > 0
      ? ` ${ctx.todayEventCount} events today.`
      : "";
    signals.push({
      priority: 2,
      clause: `Happy ${holiday.title}!${countClause}`,
      pill: { label: holiday.title, href: `/${ctx.portalSlug}?view=find`, accent: "var(--gold)", ariaLabel: `See ${holiday.title} events` },
    });
  }

  // Priority 3: Exhibition closing
  if (ctx.closingSoonExhibitions.length > 0) {
    const ex = ctx.closingSoonExhibitions[0];
    const venue = ex.venue_name ? ` at ${ex.venue_name}` : "";
    signals.push({
      priority: 3,
      clause: `${ex.title}${venue} closes in ${ex.days_remaining} days.`,
      pill: { label: `${ex.title} — closing soon`, href: `/${ctx.portalSlug}?view=find&lane=arts`, accent: "var(--copper)", ariaLabel: `See ${ex.title} exhibition details` },
    });
  }

  // Priority 4: School calendar
  const noSchool = ctx.schoolCalendarEvents.find((e) => e.event_type === "no_school" || e.event_type === "break");
  if (noSchool) {
    signals.push({
      priority: 4,
      clause: `No school tomorrow (${noSchool.school_system} ${noSchool.title}).`,
      pill: { label: "Kid-friendly events", href: `/${ctx.portalSlug}?view=find&categories=family`, accent: "var(--neon-green)", ariaLabel: "See family-friendly events" },
    });
  }

  // Priority 5: Weather
  if (ctx.weather && ctx.weatherSignal) {
    const temp = Math.round(ctx.weather.temperature_f);
    if (ctx.weatherSignal === "rain") {
      const indoor = ctx.topCategories.includes("comedy") ? "comedy shows" : "things to do";
      signals.push({
        priority: 5,
        clause: `Rainy ${TIME_LABELS[ctx.timeSlot]?.toLowerCase() ?? "day"}. ${ctx.todayEventCount} ${indoor} indoors tonight.`,
      });
    } else if (ctx.weatherSignal === "nice") {
      signals.push({
        priority: 5,
        clause: `${temp}° and ${ctx.weather.condition}. Great ${TIME_LABELS[ctx.timeSlot]?.toLowerCase() ?? "day"} to get out.`,
      });
    }
  }

  // Priority 6: General activity (fallback)
  if (signals.length === 0 && ctx.todayEventCount > 50) {
    const catLabel = ctx.topCategories.length > 0
      ? ctx.topCategories.slice(0, 2).join(" and ")
      : "events";
    signals.push({
      priority: 6,
      clause: `${ctx.todayEventCount} ${catLabel} events happening in Atlanta today.`,
    });
  }

  return signals;
}

// Re-export the BriefingOutput type for use in types.ts
export type { BriefingOutput } from "./types";
```

Note: `BriefingOutput` is already defined in `types.ts` from Task 2. Import it in the engine or re-export. Adjust the return type annotation to reference the one from types.ts.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd web && npx vitest run lib/city-pulse/briefing-engine.test.ts`
Expected: All 9 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add web/lib/city-pulse/briefing-engine.ts web/lib/city-pulse/briefing-engine.test.ts
git commit -m "feat(feed): implement briefing template composition engine with 8 patterns"
```

---

## Task 6: Wire Briefing into Header Resolution

**Files:**
- Modify: `web/lib/city-pulse/header-resolver.ts`

- [ ] **Step 1: Import and call briefing engine from resolveHeader()**

In `header-resolver.ts`, import `composeBriefing` and `BriefingContext` from `./briefing-engine`.

Inside `resolveHeader()`, after the existing header resolution logic, build a `BriefingContext` from the available data and call `composeBriefing()`. Attach the result to the returned `ResolvedHeader` as the `briefing` field.

The context mapping:
- `tentpoleEvent` → derive from `resolveFlagshipEvent()` result (already called)
- `activeHolidays` → from `context.active_holidays`
- `closingSoonExhibitions` → from `phaseAEnrichments.closingSoonExhibitions` (pass as new param)
- `schoolCalendarEvents` → from `context.school_calendar_events`
- `weather` → from `context.weather`
- `weatherSignal` → from `context.weather_signal`
- `todayEventCount` → from `eventsPulse.total_active` (note: `EventsPulse` has `total_active`, not `today_count`)
- `topCategories` → derive from category counts if available, or pass as param
- `timeSlot` → from `context.time_slot`
- `dayOfWeek` → from `context.day_of_week`
- `portalSlug` → from `portalSlug` param

Add `closingSoonExhibitions` to the `ResolveHeaderOpts` type.

- [ ] **Step 2: Verify build**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add web/lib/city-pulse/header-resolver.ts
git commit -m "feat(feed): wire briefing engine into header resolution pipeline"
```

---

## Task 7: Briefing Section Component

**Files:**
- Create: `web/components/feed/BriefingSection.tsx`

- [ ] **Step 1: Build the BriefingSection component**

```typescript
"use client";

import type { BriefingOutput } from "@/lib/city-pulse/types";

interface BriefingSectionProps {
  briefing: BriefingOutput | undefined;
  eventCount?: number;
}

export function BriefingSection({ briefing, eventCount }: BriefingSectionProps) {
  if (!briefing) return null;

  // Fixed height container prevents CLS
  // Full mode: ~120px. Collapsed: ~40px.
  if (briefing.collapsed) {
    return (
      <div className="px-4 py-2 flex items-center gap-2 text-sm" data-feed-anchor data-index-label="Briefing" data-block-id="briefing">
        <span className="text-[var(--cream)]/60">{briefing.dayLabel}</span>
        {briefing.weatherBadge && (
          <span className="text-xs text-[var(--neon-green)] bg-[var(--neon-green)]/10 px-2 py-0.5 rounded-full">
            {briefing.weatherBadge.temp} {briefing.weatherBadge.condition}
          </span>
        )}
        {eventCount != null && (
          <span className="text-[var(--cream)]/40">{eventCount} events today</span>
        )}
      </div>
    );
  }

  return (
    <section className="px-4 pt-6 pb-4" data-feed-anchor data-index-label="The Briefing" data-block-id="briefing">
      {/* Day label + weather badge */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xs uppercase tracking-wider text-[var(--cream)]/50">
          {briefing.dayLabel}
        </span>
        {briefing.weatherBadge && (
          <span className="text-2xs text-[var(--neon-green)] bg-[var(--neon-green)]/10 px-2 py-0.5 rounded-full">
            {briefing.weatherBadge.temp} {briefing.weatherBadge.condition}
          </span>
        )}
      </div>

      {/* Editorial prose */}
      <p className="text-lg font-semibold text-[var(--cream)] leading-snug mb-1">
        {briefing.prose.split(". ").slice(0, 1).join(". ")}.
      </p>
      {briefing.prose.split(". ").length > 1 && (
        <p className="text-sm text-[var(--cream)]/70 leading-relaxed">
          {briefing.prose.split(". ").slice(1).join(". ")}
        </p>
      )}

      {/* Context pills */}
      {briefing.pills.length > 0 && (
        <div className="flex gap-1.5 mt-4 flex-wrap">
          {briefing.pills.map((pill) => (
            <a
              key={pill.label}
              href={pill.href}
              aria-label={pill.ariaLabel}
              className="text-2xs px-2.5 py-1 rounded-full border transition-colors"
              style={{
                color: pill.accent ?? "var(--cream)",
                borderColor: `color-mix(in srgb, ${pill.accent ?? "var(--cream)"} 20%, transparent)`,
                backgroundColor: `color-mix(in srgb, ${pill.accent ?? "var(--cream)"} 8%, transparent)`,
              }}
            >
              {pill.label}
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add web/components/feed/BriefingSection.tsx
git commit -m "feat(feed): add BriefingSection component with collapsed + full states"
```

---

## Task 8: Time Flow Markers

**Files:**
- Create: `web/components/feed/lineup/TimeFlowMarker.tsx`

- [ ] **Step 1: Build TimeFlowMarker component**

```typescript
interface TimeFlowMarkerProps {
  variant: "happening_now" | "tonight" | "on_the_horizon";
  label?: string; // Override label, e.g. "This Afternoon" instead of "Tonight"
}

const VARIANTS = {
  happening_now: {
    color: "var(--neon-green)",
    defaultLabel: "Happening Now",
    pulse: true,
  },
  tonight: {
    color: "var(--gold)",
    defaultLabel: "Tonight",
    pulse: false,
  },
  on_the_horizon: {
    color: "var(--gold)",
    defaultLabel: "On the Horizon",
    pulse: false,
  },
} as const;

export function TimeFlowMarker({ variant, label }: TimeFlowMarkerProps) {
  const config = VARIANTS[variant];
  const displayLabel = label ?? config.defaultLabel;

  return (
    <div className="flex items-center gap-2 my-4">
      <div
        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${config.pulse ? "animate-pulse" : ""}`}
        style={{
          backgroundColor: config.color,
          boxShadow: config.pulse ? `0 0 6px color-mix(in srgb, ${config.color} 40%, transparent)` : undefined,
        }}
      />
      <span
        className="text-2xs uppercase tracking-wider font-semibold"
        style={{ color: config.color }}
      >
        {displayLabel}
      </span>
      <div
        className="flex-1 h-px"
        style={{ backgroundColor: `color-mix(in srgb, ${config.color} 15%, transparent)` }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Add prefers-reduced-motion CSS**

In `web/app/globals.css`, add (if not already present):

```css
@media (prefers-reduced-motion: reduce) {
  .animate-pulse {
    animation: none;
  }
}
```

Check if Tailwind already handles this — if `animate-pulse` respects reduced motion out of the box, skip this step.

- [ ] **Step 3: Verify build**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add web/components/feed/lineup/TimeFlowMarker.tsx
git commit -m "feat(feed): add TimeFlowMarker component with happening-now pulse and a11y"
```

---

## Task 9: Recurrence Badge Update

**Files:**
- Modify: `web/lib/city-pulse/section-builders.ts`
- Modify: `web/components/feed/lineup/RecurringStrip.tsx`

**Note:** The existing `buildRecurrenceLabel()` already produces "Every {DayName}" by deriving from `event.start_date` (the day_of_week field is typed as `string | null` in the database, not a numeric index). Verify the current implementation already defaults to day-specific format before making changes. If it does, this task is a no-op for the builder function.

- [ ] **Step 1: Verify current buildRecurrenceLabel behavior**

Read `section-builders.ts` lines 155-182. If the function already produces "Every Monday" / "Every Tuesday" etc. as its primary output, skip to Step 3 (no builder change needed). If it defaults to "Weekly" when day data is available, update the priority to prefer the day-specific label.

- [ ] **Step 2: Update if needed**

Only if the current implementation defaults to "Weekly" when day-of-week is available: adjust the priority logic so the day-specific label comes first. Keep the `start_date`-based derivation strategy (more reliable than `series.day_of_week` which is a string).

- [ ] **Step 3: Update RecurringStrip badge rendering**

In `RecurringStrip.tsx`, ensure the recurrence label badge displays the output of `buildRecurrenceLabel()`. If badges currently show a different format, update to use the builder's output.

- [ ] **Step 4: Verify build**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 5: Commit (if any changes made)**

```bash
git add web/lib/city-pulse/section-builders.ts web/components/feed/lineup/RecurringStrip.tsx
git commit -m "feat(feed): verify recurrence badges use day-specific format (EVERY MON)"
```

---

## Task 10: Regulars Toggle Component

**Files:**
- Create: `web/components/feed/lineup/RegularsToggle.tsx`

- [ ] **Step 1: Build the RegularsToggle component**

This component manages:
- A toggle chip in the filter row
- When ON + Today tab: flat activity chips for filtering
- When ON + This Week tab: day pills + activity chips
- Day pill state resets on tab switch

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import { SCENE_ACTIVITY_TYPES, matchActivityType } from "@/lib/scene-event-routing";
import type { CityPulseEventItem } from "@/lib/city-pulse/types";

interface RegularsToggleProps {
  active: boolean;
  onToggle: (active: boolean) => void;
  activeTab: "today" | "this_week" | "coming_up";
  regularsEvents: CityPulseEventItem[];
  onFilteredEvents: (events: CityPulseEventItem[]) => void;
}

const ISO_DAY_LABELS = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function RegularsToggle({
  active,
  onToggle,
  activeTab,
  regularsEvents,
  onFilteredEvents,
}: RegularsToggleProps) {
  const [activeActivity, setActiveActivity] = useState<string>("all");
  const [activeDay, setActiveDay] = useState<number | null>(null);

  // Reset day pill on tab switch
  useEffect(() => {
    setActiveDay(null);
  }, [activeTab]);

  // Filter events when activity/day changes
  useEffect(() => {
    if (!active) return;
    let filtered = regularsEvents;
    if (activeActivity !== "all") {
      filtered = filtered.filter((e) => {
        const matched = matchActivityType(e.event);
        return matched === activeActivity;
      });
    }
    if (activeDay != null) {
      filtered = filtered.filter((e) => {
        // day_of_week is string in DB — compare as strings
        return String(e.event.series?.day_of_week) === String(activeDay);
      });
    }
    onFilteredEvents(filtered);
  }, [active, activeActivity, activeDay, regularsEvents, onFilteredEvents]);

  if (!active) return null;

  // Activity chips
  const activityCounts = new Map<string, number>();
  for (const e of regularsEvents) {
    const type = matchActivityType(e.event);
    if (type) activityCounts.set(type, (activityCounts.get(type) ?? 0) + 1);
  }

  const showDayPills = activeTab === "this_week" || activeTab === "coming_up";

  return (
    <div className="space-y-2">
      {/* Activity chips */}
      <div className="flex gap-1.5 overflow-x-auto px-4 pb-1">
        <button
          onClick={() => setActiveActivity("all")}
          className={`text-2xs px-2.5 py-1 rounded-full whitespace-nowrap transition-colors ${
            activeActivity === "all"
              ? "bg-white/10 text-white font-semibold"
              : "bg-white/[0.04] text-[var(--cream)]/50"
          }`}
        >
          All
        </button>
        {SCENE_ACTIVITY_TYPES.filter((t) => activityCounts.has(t.id)).map((type) => (
          <button
            key={type.id}
            onClick={() => setActiveActivity(type.id)}
            className="text-2xs px-2.5 py-1 rounded-full whitespace-nowrap transition-colors border"
            style={{
              color: activeActivity === type.id ? "white" : type.color,
              backgroundColor: activeActivity === type.id
                ? `color-mix(in srgb, ${type.color} 20%, transparent)`
                : `color-mix(in srgb, ${type.color} 8%, transparent)`,
              borderColor: `color-mix(in srgb, ${type.color} 20%, transparent)`,
            }}
          >
            {type.label}
          </button>
        ))}
      </div>

      {/* Day pills — only for This Week / Coming Up */}
      {showDayPills && (
        <div className="flex gap-1.5 px-4">
          {[1, 2, 3, 4, 5, 6, 7].map((isoDay) => (
            <button
              key={isoDay}
              onClick={() => setActiveDay(activeDay === isoDay ? null : isoDay)}
              className={`w-9 h-9 rounded-full flex flex-col items-center justify-center text-2xs transition-colors ${
                activeDay === isoDay
                  ? "bg-[var(--vibe)]/20 border border-[var(--vibe)]/30"
                  : "bg-white/[0.04]"
              }`}
            >
              <span className={activeDay === isoDay ? "text-white" : "text-[var(--cream)]/50"}>
                {ISO_DAY_LABELS[isoDay]}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add web/components/feed/lineup/RegularsToggle.tsx
git commit -m "feat(feed): add RegularsToggle with activity chips, day pills, and tab-scoped state"
```

---

## Task 11: Regulars Discoverability Nudge

**Files:**
- Modify: `web/components/feed/LineupSection.tsx` (will be added during shell wiring in Task 13)

- [ ] **Step 1: Add nudge logic to LineupSection**

At the bottom of the Lineup section, add a nudge component:

```typescript
function RegularsNudge({ onActivateToggle }: { onActivateToggle: () => void }) {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return true;
    const count = parseInt(localStorage.getItem("regulars_nudge_count") ?? "0", 10);
    return localStorage.getItem("regulars_nudge_dismissed") === "true" || count >= 3;
  });

  useEffect(() => {
    if (dismissed) return;
    const count = parseInt(localStorage.getItem("regulars_nudge_count") ?? "0", 10);
    localStorage.setItem("regulars_nudge_count", String(count + 1));
    if (count + 1 >= 3) {
      localStorage.setItem("regulars_nudge_dismissed", "true");
      setDismissed(true);
    }
  }, [dismissed]);

  if (dismissed) return null;

  return (
    <div className="mx-4 mt-2 mb-4 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-between">
      <span className="text-xs text-[var(--cream)]/60">
        Looking for weekly trivia, karaoke, comedy?
      </span>
      <button
        onClick={() => {
          onActivateToggle();
          localStorage.setItem("regulars_nudge_dismissed", "true");
          setDismissed(true);
        }}
        className="text-xs text-[var(--vibe)] font-medium ml-2 whitespace-nowrap"
      >
        Toggle Regulars →
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add web/components/feed/LineupSection.tsx
git commit -m "feat(feed): add regulars nudge with localStorage tracking, 3 impression limit"
```

---

## Task 12: See Shows Enrichment

**Files:**
- Modify: `web/components/feed/sections/SeeShowsSection.tsx`
- May need to modify or create sub-components for showtime chips

- [ ] **Step 1: Add showtime chip rendering**

In the film tab panel (NowShowingSection or wherever film cards render), group events by `series_id` and render showtime chips:

```typescript
// Showtime chip component
function ShowtimeChips({ times }: { times: Array<{ time: string; label?: string }> }) {
  return (
    <div className="flex gap-1 mt-1.5 flex-wrap">
      {times.map((t) => (
        <span
          key={t.time}
          className={`text-2xs px-1.5 py-0.5 rounded ${
            t.label ? "text-[var(--gold)] bg-[var(--gold)]/8" : "text-[var(--cream)]/60 bg-white/[0.06]"
          }`}
        >
          {t.label ? `${t.label} ${t.time}` : t.time}
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Add urgency badges**

```typescript
function UrgencyBadge({ type }: { type: "last_showing" | "opening_night" }) {
  const config = {
    last_showing: { label: "LAST SHOWING", color: "var(--neon-red)" },
    opening_night: { label: "OPENING NIGHT", color: "var(--gold)" },
  }[type];

  return (
    <span
      className="text-2xs px-1.5 py-0.5 rounded font-medium"
      style={{
        color: config.color,
        backgroundColor: `color-mix(in srgb, ${config.color} 10%, transparent)`,
      }}
    >
      {config.label}
    </span>
  );
}
```

- [ ] **Step 3: Add metadata row for films**

```typescript
function FilmMeta({ runtime, rating, director }: { runtime?: number; rating?: string; director?: string }) {
  const parts = [
    rating,
    runtime ? `${Math.floor(runtime / 60)}h ${runtime % 60}m` : null,
    director ? `Dir. ${director}` : null,
  ].filter(Boolean);

  if (parts.length === 0) return null;

  return (
    <span className="text-2xs text-[var(--cream)]/40">
      {parts.join(" · ")}
    </span>
  );
}
```

- [ ] **Step 4: Add festival parent link**

When an event has `festival_id`, render:
```typescript
{event.festival_name && (
  <span className="text-2xs text-[var(--gold)]">
    Part of {event.festival_name}
  </span>
)}
```

- [ ] **Step 5: Update header link with interim target**

Change the "See all" header link to use interim URL:
```typescript
const seeAllHref = `/${portalSlug}?view=happening&content=showtimes`;
```

- [ ] **Step 6: Verify build**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 7: Commit**

```bash
git add web/components/feed/sections/SeeShowsSection.tsx
git commit -m "feat(feed): enrich See Shows with showtime chips, urgency badges, metadata, festival links"
```

---

## Task 13: Shell Restructure — Wire Everything Together

**Files:**
- Modify: `web/components/feed/CityPulseShell.tsx`
- Modify: `web/components/feed/FeedPageIndex.tsx`
- Modify: `web/lib/city-pulse/types.ts` (DEFAULT_FEED_ORDER)

This is the integration task. Read the current CityPulseShell.tsx carefully before making changes.

- [ ] **Step 1: Update DEFAULT_FEED_ORDER in types.ts**

```typescript
export const DEFAULT_FEED_ORDER: FeedBlockId[] = [
  "briefing",
  "events",
  "cinema",
  "browse",
];
```

Remove: `"recurring"`, `"hangs"`, `"horizon"`. Add: `"briefing"`. The Scene is absorbed into the Lineup toggle. PlanningHorizon is absorbed into the Lineup's "On the Horizon" markers. Hangs can remain for other portals but remove from Atlanta default.

Update `ALWAYS_VISIBLE_BLOCKS` to include `"briefing"`.

Add `"briefing"` to the `FeedBlockId` union type if not already present.

- [ ] **Step 2: Update BLOCK_LABELS in FeedPageIndex.tsx**

```typescript
const BLOCK_LABELS: Record<FeedBlockId, string> = {
  briefing: "The Briefing",
  events: "The Lineup",
  cinema: "See Shows",
  browse: "Browse",
  // Keep old labels for other portals that may still use them
  hangs: "Hangs",
  recurring: "Regular Hangs",
  festivals: "The Big Stuff",
  experiences: "Things to Do",
  community: "The Network",
  horizon: "On the Horizon",
};
```

- [ ] **Step 3: Restructure CityPulseShell rendering**

In `CityPulseShell.tsx`:

1. **Remove** GreetingBar rendering. Replace with `<BriefingSection>`.
2. **Remove** DashboardCards rendering.
3. **Remove** standalone TheSceneSection import/rendering for Atlanta portal (keep for other portals with a portal check).
4. **Remove** standalone PlanningHorizonSection rendering.
5. **Add** BriefingSection at the top.
6. **Modify** LineupSection to receive regulars data and support the toggle.

The rendering order becomes:
```
BriefingSection
LineupSection (with regulars toggle + horizon tentpoles)
SeeShowsSection (lazy)
Browse (always last)
```

- [ ] **Step 4: Wire regulars pre-fetch**

In the shell, add a React Query `prefetchQuery` for regulars data at T=1s:

```typescript
useEffect(() => {
  const timer = setTimeout(() => {
    queryClient.prefetchQuery({
      queryKey: ["regulars", portalSlug],
      queryFn: () => fetch(`/api/regulars?portal=${portalSlug}`).then((r) => r.json()),
      staleTime: 3 * 60 * 1000,
    });
  }, 1000);
  return () => clearTimeout(timer);
}, [portalSlug, queryClient]);
```

- [ ] **Step 5: Wire Lineup to receive regulars + horizon data**

Pass regulars events and horizon tentpoles to LineupSection. The Lineup component needs to:
- Accept `regularsData` prop (from pre-fetch or on-demand fetch)
- Accept `horizonEvents` prop (filtered from existing horizon pool)
- Render TimeFlowMarkers at appropriate positions
- Render RegularsToggle when toggle is active
- Render RegularsNudge at section footer

- [ ] **Step 6: Verify build**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 7: Visual smoke test**

Run: `cd web && npm run dev`
Navigate to `http://localhost:3000/atlanta`
Verify:
- Briefing renders at top (or collapsed minimal header)
- Lineup shows Today / This Week / Coming Up tabs
- Regulars toggle chip appears in filter row
- Toggling Regulars ON shows activity chips
- This Week + Regulars ON shows day pills
- Day pills reset when switching tabs
- See Shows has no Clowns tab
- PlanningHorizon and TheScene are no longer standalone sections
- Browse still renders at bottom

- [ ] **Step 8: Commit**

```bash
git add web/components/feed/CityPulseShell.tsx web/components/feed/FeedPageIndex.tsx web/lib/city-pulse/types.ts web/components/feed/LineupSection.tsx
git commit -m "feat(feed): restructure shell — wire Briefing, unified Lineup, remove standalone Scene/Horizon"
```

---

## Task 14: Regulars API — Extend Date Range

**Files:**
- Modify: `web/app/api/regulars/route.ts`

- [ ] **Step 1: Add range parameter support**

In the regulars route, add support for a `range` query parameter:

```typescript
const range = searchParams.get("range"); // "7" (default) or "30"
const rangeDays = range === "30" ? 30 : 7;
```

Use `rangeDays` in the date range filter instead of the hardcoded 7-day window. This enables the "Coming Up" tab to show regulars in the 8-30 day window.

- [ ] **Step 2: Verify build**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add web/app/api/regulars/route.ts
git commit -m "feat(feed): extend regulars API with range param for Coming Up tab"
```

---

## Task 15: Final Integration Test

- [ ] **Step 1: Run all existing tests**

Run: `cd web && npx vitest run`
Expected: All existing tests pass. New briefing-engine tests pass.

- [ ] **Step 2: Run TypeScript check**

Run: `cd web && npx tsc --noEmit`
Expected: Clean build.

- [ ] **Step 3: Full visual QA**

Run dev server and verify:
1. **Briefing:** Renders editorial prose or collapsed minimal header
2. **Lineup Today:** Shows Happening Now / Tonight markers, events mixed with regulars
3. **Lineup This Week:** Shows 7-day view with horizon tentpoles at bottom
4. **Regulars Toggle OFF:** All events visible, regulars have `EVERY MON` style badges
5. **Regulars Toggle ON (Today):** Activity chips, flat list, no day pills
6. **Regulars Toggle ON (This Week):** Activity chips + day pills, day resets on tab switch
7. **Regulars Nudge:** Appears at bottom of section, dismissible, respects localStorage
8. **See Shows:** Film/Music/Theater tabs only (no Clowns), showtime chips, metadata
9. **Shell:** No standalone Scene, Horizon, or DashboardCards sections
10. **FeedPageIndex:** Shows "The Briefing", "The Lineup", "See Shows", "Browse"

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A && git commit -m "fix(feed): integration fixes from Phase 1 QA"
```
