# Seasonal Attractions — Foundation Plan (Phase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the exhibitions-as-season-carrier foundation end-to-end, with Ren Fest as the first seasonal attraction visible in a new "This Season" Places to Go category, no longer duplicated in the festivals rail.

**Architecture:** Use existing `exhibitions` infrastructure (type `'seasonal'`, `opening_date`/`closing_date`) as the season carrier. Add minimal schema (`series.exhibition_id`, `exhibitions.operating_schedule`, `places.is_seasonal_only`), central helpers in `web/lib/places/seasonal.ts`, new Places to Go category that joins on active seasonal exhibitions. Ren Fest crawler converts first; cleanup of `annual_tentpoles.py` duplicate + `festivals` table row are hard sequencing gates before user-visible launch.

**Tech Stack:** Postgres (Supabase), Python crawlers (BeautifulSoup), Next.js 16 + TypeScript, Tailwind v4, vitest, pytest.

**Spec:** `docs/superpowers/specs/2026-04-17-seasonal-attractions-design.md`

**Follow-on plans (not in this plan):**
- Phase 2 — Remaining Shape A crawlers: Netherworld + haunted house trio
- Phase 3 — Complex shape crawlers: Stone Mountain triage, Southern Belle, NG State Fair
- Phase 4 — Full propagation: Shape A scoring, search_unified guard, enrichment guards, detail page polish, normalization audit

---

## File Structure

### Create
- `database/migrations/YYYYMMDD000001_seasonal_attractions_schema.sql` — schema delta
- `supabase/migrations/YYYYMMDD000001_seasonal_attractions_schema.sql` — mirror
- `web/lib/places/seasonal.ts` — season-state helpers (public API: `getActiveSeasonalExhibitions`, `getPrimarySeasonalExhibition`, `isPlaceInSeason`, `formatCadence`)
- `web/lib/places/__tests__/seasonal.test.ts` — unit tests for helpers

### Modify
- `crawlers/db/exhibitions.py:94-99` — add `operating_schedule` to `_EXHIBITION_COLUMNS`
- `crawlers/sources/georgia_ren_fest.py` — drop `scrape_season_event()`, add seasonal exhibition upsert, link themed weekends
- `crawlers/sources/annual_tentpoles.py` — remove `ga-renaissance-festival-grounds` entry
- `web/lib/places-to-go/types.ts` — add `filter?`, `seeAllHrefStrategy?` fields
- `web/lib/places-to-go/constants.ts` — add `seasonal` category entry
- `web/lib/places-to-go/callouts.ts` — add `seasonal` CALLOUT_CONFIG entry
- `web/app/api/portals/[slug]/city-pulse/places-to-go/route.ts` — handle seasonal filter, join exhibitions, single-item suppression
- `web/components/feed/sections/PlacesToGoCard.tsx` — mobile discrete callouts + event_count cap
- `crawlers/CLAUDE.md` — seasonal-destinations pattern doc

### One-time SQL (not a migration)
- `database/migrations/YYYYMMDD000002_festival_cleanup_ren_fest.sql` — NULL series.festival_id for Ren Fest festivals row, delete row
- `supabase/migrations/YYYYMMDD000002_festival_cleanup_ren_fest.sql` — mirror

---

## Phase 1: Foundation

### Task 1: Schema migration — seasonal columns

**Files:**
- Create: `database/migrations/20260417000001_seasonal_attractions_schema.sql`
- Create: `supabase/migrations/20260417000001_seasonal_attractions_schema.sql`

Three additions:
1. `series.exhibition_id` — nullable FK to `exhibitions(id)`, for Shape B recurring rituals
2. `exhibitions.operating_schedule` — nullable JSONB, per-exhibition hours schedule
3. `places.is_seasonal_only` — boolean default false, marks places that only exist during their season

- [ ] **Step 1: Write the migration SQL**

Write identical content to both paths (database parity rule).

```sql
-- Migration: seasonal attractions schema
-- Adds season-carrier hooks to exhibitions + series, and seasonal-only flag to places.
-- Keep this file mirrored in database/migrations and supabase/migrations.

BEGIN;

-- 1. series.exhibition_id — nullable FK for recurring rituals scoped to a seasonal exhibition.
ALTER TABLE series
  ADD COLUMN IF NOT EXISTS exhibition_id UUID REFERENCES exhibitions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_series_exhibition_id
  ON series(exhibition_id)
  WHERE exhibition_id IS NOT NULL;

-- 2. exhibitions.operating_schedule — JSONB per-day operating hours during the exhibition window.
-- Shape:
--   {
--     "default_hours": {"open": "17:30", "close": "21:30"},
--     "days": {"friday": {"open": "17:30", "close": "22:00"}, ...},
--     "overrides": {"2025-12-24": {"open": "17:30", "close": "20:00"}, "2025-12-25": null}
--   }
ALTER TABLE exhibitions
  ADD COLUMN IF NOT EXISTS operating_schedule JSONB;

-- 3. places.is_seasonal_only — true when the place exists ONLY as the seasonal attraction.
-- Used by search_unified() to scope off-season event suppression (Shape F persistent
-- places with seasonal overlays must remain unaffected).
ALTER TABLE places
  ADD COLUMN IF NOT EXISTS is_seasonal_only BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_places_is_seasonal_only
  ON places(is_seasonal_only)
  WHERE is_seasonal_only = true;

COMMIT;
```

- [ ] **Step 2: Apply migration locally**

Run:
```bash
cd web && npx supabase db push --local
```

Expected: `Applying migration 20260417000001_seasonal_attractions_schema.sql... done.`

- [ ] **Step 3: Verify columns exist**

Run:
```bash
cd web && npx supabase db execute --local "SELECT column_name FROM information_schema.columns WHERE table_name IN ('series','exhibitions','places') AND column_name IN ('exhibition_id','operating_schedule','is_seasonal_only') ORDER BY column_name;"
```

Expected output includes `exhibition_id`, `is_seasonal_only`, `operating_schedule`.

- [ ] **Step 4: Commit**

```bash
git add database/migrations/20260417000001_seasonal_attractions_schema.sql supabase/migrations/20260417000001_seasonal_attractions_schema.sql
git commit -m "feat(db): seasonal attractions schema — series.exhibition_id, exhibitions.operating_schedule, places.is_seasonal_only"
```

---

### Task 2: Update `_EXHIBITION_COLUMNS` in crawler DB layer

**Files:**
- Modify: `crawlers/db/exhibitions.py:94-99`

Without this update, any `operating_schedule` passed to `insert_exhibition()` is silently dropped before the DB write. This MUST land in the same commit chain as Task 1.

- [ ] **Step 1: Modify `_EXHIBITION_COLUMNS`**

Edit `crawlers/db/exhibitions.py` — locate the `_EXHIBITION_COLUMNS` set around line 94:

```python
_EXHIBITION_COLUMNS = {
    "slug", "place_id", "source_id", "portal_id", "title", "description",
    "image_url", "opening_date", "closing_date", "medium", "exhibition_type",
    "admission_type", "admission_url", "source_url", "tags", "is_active",
    "metadata", "related_feature_id", "operating_schedule",
}
```

(Only change: append `"operating_schedule"` at end of the set.)

- [ ] **Step 2: Run existing exhibitions tests**

Run:
```bash
cd crawlers && python -m pytest tests/db/test_exhibitions.py -v 2>/dev/null || python -m pytest tests/ -k exhibition -v
```

Expected: all existing tests still pass (no regression).

- [ ] **Step 3: Commit**

```bash
git add crawlers/db/exhibitions.py
git commit -m "feat(crawlers): add operating_schedule to _EXHIBITION_COLUMNS"
```

---

### Task 3: Write season-state helpers — failing tests

**Files:**
- Create: `web/lib/places/__tests__/seasonal.test.ts`

- [ ] **Step 1: Create the test file**

Write `web/lib/places/__tests__/seasonal.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import {
  getPrimarySeasonalExhibition,
  isPlaceInSeason,
  formatCadence,
  type SeasonalExhibition,
} from "../seasonal";

function ex(
  id: string,
  opening: string,
  closing: string,
  schedule?: SeasonalExhibition["operating_schedule"],
): SeasonalExhibition {
  return {
    id,
    place_id: 1,
    exhibition_type: "seasonal",
    opening_date: opening,
    closing_date: closing,
    operating_schedule: schedule ?? null,
    title: `Exhibition ${id}`,
  };
}

describe("getPrimarySeasonalExhibition", () => {
  it("returns null for empty array", () => {
    expect(getPrimarySeasonalExhibition([], new Date("2026-05-01"))).toBeNull();
  });

  it("returns the only exhibition when there's one", () => {
    const e = ex("a", "2026-04-11", "2026-06-08");
    expect(getPrimarySeasonalExhibition([e], new Date("2026-05-01"))?.id).toBe("a");
  });

  it("prefers the exhibition with the latest opening_date on overlap", () => {
    // Yule Forest: Pumpkin Oct-Nov, Christmas tree Nov-Dec, overlap week
    const pumpkin = ex("pumpkin", "2026-10-01", "2026-11-10");
    const xmas = ex("xmas", "2026-11-05", "2026-12-24");
    const result = getPrimarySeasonalExhibition(
      [pumpkin, xmas],
      new Date("2026-11-08"),
    );
    expect(result?.id).toBe("xmas");
  });

  it("breaks ties by earliest closing_date (urgency)", () => {
    const a = ex("a", "2026-04-11", "2026-06-08");
    const b = ex("b", "2026-04-11", "2026-07-15");
    const result = getPrimarySeasonalExhibition(
      [a, b],
      new Date("2026-05-01"),
    );
    expect(result?.id).toBe("a");
  });
});

describe("isPlaceInSeason", () => {
  it("returns off-season when no exhibitions", () => {
    const result = isPlaceInSeason([], new Date("2026-07-15"));
    expect(result.status).toBe("off-season");
    expect(result.activeCount).toBe(0);
    expect(result.daysToOpen).toBeNull();
  });

  it("returns active when today is within a season window", () => {
    const e = ex("a", "2026-04-11", "2026-06-08");
    const result = isPlaceInSeason([e], new Date("2026-05-01"));
    expect(result.status).toBe("active");
    expect(result.activeCount).toBe(1);
  });

  it("returns pre-open when within 28 days of opening", () => {
    const e = ex("a", "2026-04-11", "2026-06-08");
    const result = isPlaceInSeason([e], new Date("2026-03-20"));
    expect(result.status).toBe("pre-open");
    expect(result.daysToOpen).toBe(22);
  });

  it("returns off-season when more than 28 days pre-open", () => {
    const e = ex("a", "2026-04-11", "2026-06-08");
    const result = isPlaceInSeason([e], new Date("2026-01-01"));
    expect(result.status).toBe("off-season");
  });

  it("returns grace when 1-7 days post-close", () => {
    const e = ex("a", "2026-04-11", "2026-06-08");
    const result = isPlaceInSeason([e], new Date("2026-06-11"));
    expect(result.status).toBe("grace");
  });

  it("counts active exhibitions on overlap", () => {
    const pumpkin = ex("pumpkin", "2026-10-01", "2026-11-10");
    const xmas = ex("xmas", "2026-11-05", "2026-12-24");
    const result = isPlaceInSeason([pumpkin, xmas], new Date("2026-11-08"));
    expect(result.status).toBe("active");
    expect(result.activeCount).toBe(2);
  });
});

describe("formatCadence", () => {
  it("returns 'Every day' when all days have hours", () => {
    const schedule: SeasonalExhibition["operating_schedule"] = {
      days: {
        monday: { open: "10:00", close: "18:00" },
        tuesday: { open: "10:00", close: "18:00" },
        wednesday: { open: "10:00", close: "18:00" },
        thursday: { open: "10:00", close: "18:00" },
        friday: { open: "10:00", close: "18:00" },
        saturday: { open: "10:00", close: "18:00" },
        sunday: { open: "10:00", close: "18:00" },
      },
    };
    expect(formatCadence(schedule)).toBe("Every day 10–6");
  });

  it("formats weekend-only cadence", () => {
    const schedule: SeasonalExhibition["operating_schedule"] = {
      days: {
        saturday: { open: "10:30", close: "18:00" },
        sunday: { open: "10:30", close: "18:00" },
      },
    };
    expect(formatCadence(schedule)).toBe("Sat–Sun 10:30–6");
  });

  it("formats contiguous weekday range", () => {
    const schedule: SeasonalExhibition["operating_schedule"] = {
      days: {
        friday: { open: "17:30", close: "22:00" },
        saturday: { open: "17:30", close: "22:00" },
        sunday: { open: "17:30", close: "22:00" },
      },
    };
    expect(formatCadence(schedule)).toBe("Fri–Sun 5:30pm–10");
  });

  it("uses default_hours when per-day is empty", () => {
    const schedule: SeasonalExhibition["operating_schedule"] = {
      default_hours: { open: "17:30", close: "21:30" },
    };
    expect(formatCadence(schedule)).toBe("Nightly 5:30pm–9:30");
  });

  it("returns empty string when no schedule", () => {
    expect(formatCadence(null)).toBe("");
  });
});
```

- [ ] **Step 2: Run tests — expect failures**

Run:
```bash
cd web && npx vitest run lib/places/__tests__/seasonal.test.ts
```

Expected: all tests FAIL with "Cannot find module '../seasonal'".

---

### Task 4: Implement season-state helpers

**Files:**
- Create: `web/lib/places/seasonal.ts`

Implements the helpers that the test file imports. Centralizes all `exhibition_type = 'seasonal'` date math. **Lint note**: direct reads of `exhibition_type = 'seasonal'` outside this module are discouraged — add a comment at the top calling this out.

- [ ] **Step 1: Write the helper module**

Create `web/lib/places/seasonal.ts`:

```typescript
/**
 * Seasonal exhibition state helpers.
 *
 * CANONICAL SOURCE: all reads of `exhibition_type = 'seasonal'` MUST go through
 * this module. Don't inline season-date math in feed/search/detail code —
 * import `isPlaceInSeason` or `getActiveSeasonalExhibitions` instead.
 *
 * See spec: docs/superpowers/specs/2026-04-17-seasonal-attractions-design.md
 */

import { createClient as createServiceClient } from "@/lib/supabase/service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OperatingHours = { open: string; close: string };

export type OperatingSchedule = {
  default_hours?: OperatingHours;
  days?: Partial<Record<DayName, OperatingHours | null>>;
  overrides?: Record<string, OperatingHours | null>; // YYYY-MM-DD keys
};

export type DayName =
  | "monday" | "tuesday" | "wednesday" | "thursday"
  | "friday" | "saturday" | "sunday";

export interface SeasonalExhibition {
  id: string;
  place_id: number;
  exhibition_type: "seasonal";
  opening_date: string; // YYYY-MM-DD
  closing_date: string; // YYYY-MM-DD
  operating_schedule: OperatingSchedule | null;
  title: string;
}

export type SeasonStatus = "active" | "pre-open" | "grace" | "off-season";

export interface SeasonState {
  status: SeasonStatus;
  daysToOpen: number | null;
  activeCount: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRE_OPEN_WINDOW_DAYS = 28;
const GRACE_PERIOD_DAYS = 7;

// ---------------------------------------------------------------------------
// Date utilities (timezone-agnostic — spec uses calendar dates only)
// ---------------------------------------------------------------------------

function parseDate(s: string): Date {
  return new Date(s + "T00:00:00");
}

function daysBetween(from: Date, to: Date): number {
  const fromUTC = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const toUTC = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((toUTC - fromUTC) / (1000 * 60 * 60 * 24));
}

// ---------------------------------------------------------------------------
// Core helpers
// ---------------------------------------------------------------------------

/**
 * Fetch all `exhibition_type = 'seasonal'` rows for a place, regardless of date.
 * Caller filters by date via `isPlaceInSeason()` or `getPrimarySeasonalExhibition()`.
 */
export async function getSeasonalExhibitionsForPlace(
  placeId: number,
): Promise<SeasonalExhibition[]> {
  const client = createServiceClient();
  const { data } = await client
    .from("exhibitions")
    .select("id, place_id, exhibition_type, opening_date, closing_date, operating_schedule, title")
    .eq("place_id", placeId)
    .eq("exhibition_type", "seasonal")
    .eq("is_active", true);

  return (data as SeasonalExhibition[] | null) ?? [];
}

/**
 * Fetch active-OR-within-pre-open-window seasonal exhibitions for a place at a given date.
 * Returns an array — multiple can be active on overlap (Yule Forest: Pumpkin + Christmas).
 */
export async function getActiveSeasonalExhibitions(
  placeId: number,
  date: Date,
): Promise<SeasonalExhibition[]> {
  const all = await getSeasonalExhibitionsForPlace(placeId);
  return all.filter((e) => isWithinActiveOrPreOpen(e, date));
}

function isWithinActiveOrPreOpen(e: SeasonalExhibition, date: Date): boolean {
  const opening = parseDate(e.opening_date);
  const closing = parseDate(e.closing_date);
  // Active
  if (date >= opening && date <= closing) return true;
  // Pre-open
  const daysUntil = daysBetween(date, opening);
  if (daysUntil > 0 && daysUntil <= PRE_OPEN_WINDOW_DAYS) return true;
  return false;
}

/**
 * Tiebreaker for overlapping seasonal exhibitions at the same place:
 *   1. Prefer the exhibition with the LATEST opening_date (transition-forward).
 *   2. Break ties by earliest closing_date (urgency — "what closes soonest").
 */
export function getPrimarySeasonalExhibition(
  exhibitions: SeasonalExhibition[],
  date: Date,
): SeasonalExhibition | null {
  const candidates = exhibitions.filter((e) => isWithinActiveOrPreOpen(e, date));
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    if (a.opening_date !== b.opening_date) {
      return a.opening_date < b.opening_date ? 1 : -1; // desc
    }
    return a.closing_date < b.closing_date ? -1 : 1; // asc
  });

  return candidates[0];
}

/**
 * Compute season status for a place given its seasonal exhibitions and a date.
 * Pass `getSeasonalExhibitionsForPlace()` result.
 */
export function isPlaceInSeason(
  exhibitions: SeasonalExhibition[],
  date: Date,
): SeasonState {
  let activeCount = 0;
  let preOpenDaysToOpen: number | null = null;
  let inGrace = false;

  for (const e of exhibitions) {
    const opening = parseDate(e.opening_date);
    const closing = parseDate(e.closing_date);

    if (date >= opening && date <= closing) {
      activeCount++;
      continue;
    }

    const daysUntil = daysBetween(date, opening);
    if (daysUntil > 0 && daysUntil <= PRE_OPEN_WINDOW_DAYS) {
      preOpenDaysToOpen =
        preOpenDaysToOpen === null
          ? daysUntil
          : Math.min(preOpenDaysToOpen, daysUntil);
      continue;
    }

    const daysPast = daysBetween(closing, date);
    if (daysPast >= 1 && daysPast <= GRACE_PERIOD_DAYS) {
      inGrace = true;
    }
  }

  if (activeCount > 0) {
    return { status: "active", daysToOpen: null, activeCount };
  }
  if (preOpenDaysToOpen !== null) {
    return { status: "pre-open", daysToOpen: preOpenDaysToOpen, activeCount: 0 };
  }
  if (inGrace) {
    return { status: "grace", daysToOpen: null, activeCount: 0 };
  }
  return { status: "off-season", daysToOpen: null, activeCount: 0 };
}

// ---------------------------------------------------------------------------
// Cadence formatting
// ---------------------------------------------------------------------------

const DAY_ORDER: DayName[] = [
  "monday", "tuesday", "wednesday",
  "thursday", "friday", "saturday", "sunday",
];

const DAY_SHORT: Record<DayName, string> = {
  monday: "Mon", tuesday: "Tue", wednesday: "Wed",
  thursday: "Thu", friday: "Fri", saturday: "Sat", sunday: "Sun",
};

/**
 * Format an operating_schedule into a short display string.
 * Examples:
 *   "Sat–Sun 10:30–6"
 *   "Fri–Sun 5:30pm–10"
 *   "Nightly 5:30pm–9:30" (when default_hours set but no day-level detail)
 *   "Every day 10–6"
 *   "" (when schedule is null)
 */
export function formatCadence(schedule: OperatingSchedule | null): string {
  if (!schedule) return "";

  const days = schedule.days ?? {};
  const openDays = DAY_ORDER.filter((d) => days[d] != null);

  if (openDays.length === 0 && schedule.default_hours) {
    return `Nightly ${formatHourRange(schedule.default_hours)}`;
  }

  if (openDays.length === 7) {
    const sample = days[openDays[0]]!;
    return `Every day ${formatHourRange(sample)}`;
  }

  const cadenceLabel = formatDayRange(openDays);
  // Use hours from the first open day (assumes uniform hours; spec notes
  // mixed-hours fallback to just the cadence without suffix).
  const sample = days[openDays[0]];
  if (!sample) return cadenceLabel;

  const allSame = openDays.every(
    (d) =>
      days[d]?.open === sample.open &&
      days[d]?.close === sample.close,
  );
  return allSame
    ? `${cadenceLabel} ${formatHourRange(sample)}`
    : cadenceLabel;
}

function formatDayRange(days: DayName[]): string {
  if (days.length === 0) return "";
  if (days.length === 1) return DAY_SHORT[days[0]];
  const firstIdx = DAY_ORDER.indexOf(days[0]);
  const lastIdx = DAY_ORDER.indexOf(days[days.length - 1]);
  const isContiguous = lastIdx - firstIdx + 1 === days.length;
  if (isContiguous) return `${DAY_SHORT[days[0]]}–${DAY_SHORT[days[days.length - 1]]}`;
  return days.map((d) => DAY_SHORT[d]).join(", ");
}

function formatHourRange(h: OperatingHours): string {
  return `${formatHour(h.open)}–${formatHour(h.close, { stripMinutesOnEven: true })}`;
}

function formatHour(
  s: string,
  opts: { stripMinutesOnEven?: boolean } = {},
): string {
  const [hStr, mStr] = s.split(":");
  const h24 = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const isPM = h24 >= 12;
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
  const suffix = isPM ? (h24 === 12 ? "" : "pm") : "am";
  // For display compactness: "10:30–6" (drop close-hour minutes if :00)
  if (m === 0) {
    if (opts.stripMinutesOnEven) return `${h12}`;
    return `${h12}${suffix}`;
  }
  return `${h12}:${mStr}${suffix}`;
}
```

- [ ] **Step 2: Run tests — expect pass**

Run:
```bash
cd web && npx vitest run lib/places/__tests__/seasonal.test.ts
```

Expected: all tests pass.

- [ ] **Step 3: Run typecheck**

Run:
```bash
cd web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add web/lib/places/seasonal.ts web/lib/places/__tests__/seasonal.test.ts
git commit -m "feat(places): season-state helpers (isPlaceInSeason, formatCadence)"
```

---

### Task 5: Extend `PlacesToGoCategoryConfig` type

**Files:**
- Modify: `web/lib/places-to-go/types.ts`

Adds `filter?` and `seeAllHrefStrategy?` fields. Without this, the query path in the route forces `if (category.key === "seasonal")` — a portal-specific check pattern the design system rules forbid.

- [ ] **Step 1: Modify the type**

Edit `web/lib/places-to-go/types.ts` — update `PlacesToGoCategoryConfig`:

```typescript
/** Config shape for each of the 12 categories. Defined statically in constants.ts. */
export interface PlacesToGoCategoryConfig {
  key: string;
  label: string;
  placeTypes: readonly string[];
  accentColor: string;
  iconType: string;
  /** Optional: which Find tab's "see all" link should point to (e.g. "eat-drink"). */
  seeAllTab?: string;
  /**
   * Optional filter primitive. When set, the query layer uses this instead of
   * `placeTypes` to select places. Currently only `"has_active_seasonal_exhibition"`.
   */
  filter?: "has_active_seasonal_exhibition";
  /**
   * Strategy for the category's "See all" link.
   * - "placeTypes" (default): route to /{portal}/explore/places?venue_type=...
   * - "seasonal": route to /{portal}/explore/places?seasonal=true (follow-on)
   * - "none": no See all link (used when no Explore filter exists yet)
   */
  seeAllHrefStrategy?: "placeTypes" | "seasonal" | "none";
}
```

- [ ] **Step 2: Typecheck**

Run:
```bash
cd web && npx tsc --noEmit
```

Expected: no errors (existing category configs have no `filter` or `seeAllHrefStrategy` and the fields are optional).

- [ ] **Step 3: Commit**

```bash
git add web/lib/places-to-go/types.ts
git commit -m "feat(places-to-go): add filter + seeAllHrefStrategy to category config"
```

---

## Phase 2: Cleanup (sequenced before Ren Fest crawler conversion)

### Task 6: Remove Ren Fest entry from `annual_tentpoles.py`

**Files:**
- Modify: `crawlers/sources/annual_tentpoles.py`

**Must land before Task 7** (Ren Fest crawler conversion) to prevent race-upsert with the `ga-renaissance-festival-grounds` duplicate place slug.

- [ ] **Step 1: Find and remove the entry**

Run:
```bash
grep -n "ga-renaissance-festival-grounds\|renaissance" crawlers/sources/annual_tentpoles.py
```

Identify the config block matching Ren Fest (look for `_KNOWN_WINDOWS_BY_SLUG` and the Config entry with slug `ga-renaissance-festival-grounds`).

Remove:
- The entry from `_KNOWN_WINDOWS_BY_SLUG` dict.
- The Config entry (including `place_data`, hardcoded dates, `force_event_model=True`).

Leave surrounding entries intact. Preserve indentation and trailing commas.

- [ ] **Step 2: Dry-run the crawler**

Run:
```bash
cd crawlers && python3 main.py --source annual-tentpoles --dry-run 2>&1 | head -40
```

Expected: runs without error, does not reference `ga-renaissance-festival-grounds` in logs.

- [ ] **Step 3: Commit**

```bash
git add crawlers/sources/annual_tentpoles.py
git commit -m "chore(crawlers): remove Ren Fest entry from annual_tentpoles — owned by georgia_ren_fest crawler"
```

---

### Task 7: Festivals table cleanup — Ren Fest row

**Files:**
- Create: `database/migrations/20260417000002_festival_cleanup_ren_fest.sql`
- Create: `supabase/migrations/20260417000002_festival_cleanup_ren_fest.sql`

**Must land before the "This Season" Places to Go category goes user-visible** (Task 14 launch verification) — otherwise Ren Fest dual-surfaces in both festivals rail AND This Season.

Precedent: `supabase/migrations/20260329200001_festival_data_cleanup.sql`. `series.festival_id` has no declared `ON DELETE` behavior — must be NULLed explicitly before delete. `events.festival_id` is `ON DELETE SET NULL`, safe automatically.

- [ ] **Step 1: Write the cleanup migration**

Create identical content at both paths:

```sql
-- Migration: festival cleanup — remove Ren Fest row.
-- Ren Fest is a seasonal attraction, not a festival. Data now lives in
-- exhibitions (type='seasonal') linked to the Ren Fest place.
-- Keep this file mirrored in database/migrations and supabase/migrations.

BEGIN;

-- 1. NULL the series FKs first (series.festival_id has no ON DELETE behavior,
--    would FK-violate on hard-delete).
UPDATE series
  SET festival_id = NULL
  WHERE festival_id IN (
    SELECT id FROM festivals WHERE slug IN (
      'georgia-renaissance-festival',
      'ga-renaissance-festival',
      'ga-renaissance-festival-grounds'
    )
  );

-- 2. events.festival_id is ON DELETE SET NULL — safe, handled automatically.

-- 3. Delete the festival row(s). Uses slug IN to catch any duplicates from
--    the annual_tentpoles.py emitter.
DELETE FROM festivals
  WHERE slug IN (
    'georgia-renaissance-festival',
    'ga-renaissance-festival',
    'ga-renaissance-festival-grounds'
  );

COMMIT;
```

- [ ] **Step 2: Apply locally**

Run:
```bash
cd web && npx supabase db push --local
```

Expected: migration applies cleanly.

- [ ] **Step 3: Verify Ren Fest is gone from festivals table**

Run:
```bash
cd web && npx supabase db execute --local "SELECT id, slug, name FROM festivals WHERE slug ILIKE '%renaissance%' OR slug ILIKE '%ren-fest%' OR slug ILIKE '%ren_fest%';"
```

Expected: empty result set.

- [ ] **Step 4: Verify no orphaned series FKs**

Run:
```bash
cd web && npx supabase db execute --local "SELECT s.id, s.slug, s.festival_id FROM series s LEFT JOIN festivals f ON s.festival_id = f.id WHERE s.festival_id IS NOT NULL AND f.id IS NULL;"
```

Expected: empty result set (no dangling festival_id references).

- [ ] **Step 5: Commit**

```bash
git add database/migrations/20260417000002_festival_cleanup_ren_fest.sql supabase/migrations/20260417000002_festival_cleanup_ren_fest.sql
git commit -m "chore(db): hard-delete Ren Fest from festivals table (now modeled as seasonal exhibition)"
```

---

## Phase 3: Ren Fest crawler conversion

### Task 8: Convert Ren Fest crawler to emit seasonal exhibition

**Files:**
- Modify: `crawlers/sources/georgia_ren_fest.py`

Changes:
1. Drop `scrape_season_event()` function and its call in `crawl()`.
2. Add `create_seasonal_exhibition()` helper that upserts one `exhibitions` row per season with `exhibition_type = 'seasonal'`, year-scoped slug, and `operating_schedule`.
3. Mark the place `is_seasonal_only: True`.
4. Link themed-weekend events via `exhibition_id`.

- [ ] **Step 1: Add `is_seasonal_only` to PLACE_DATA**

Find the `PLACE_DATA` dict around line 55 of `crawlers/sources/georgia_ren_fest.py`. Add `"is_seasonal_only": True,`:

```python
PLACE_DATA = {
    "name": "Georgia Renaissance Festival",
    "slug": "georgia-renaissance-festival",
    "address": "6905 Virlyn B Smith Rd",
    "neighborhood": "Fairburn",
    "city": "Fairburn",
    "state": "GA",
    "zip": "30213",
    "lat": 33.5365,
    "lng": -84.5960,
    "place_type": "festival_grounds",     # was "festival"
    "spot_type": "festival_grounds",       # was "festival"
    "is_seasonal_only": True,              # new
    "website": BASE_URL,
    "vibes": [
        "family-friendly",
        "outdoor-seating",
        "good-for-groups",
        "free-parking",
        "all-ages",
    ],
}
```

- [ ] **Step 2: Replace `scrape_season_event` with `create_seasonal_exhibition`**

Delete the existing `scrape_season_event(...)` function (lines ~395-525 of the original file).

Replace with this new function:

```python
def create_seasonal_exhibition(
    session: requests.Session,
    source_id: int,
    venue_id: int,
) -> Optional[str]:
    """
    Create (or update) a seasonal exhibition for the current Ren Fest season.
    The exhibition carries the season window (opening_date, closing_date) and
    operating_schedule (Sat-Sun 10:30-18:00). Returns exhibition ID or None.
    """
    try:
        resp = session.get(THEMED_WEEKENDS_URL, timeout=20)
        resp.raise_for_status()
    except requests.RequestException as e:
        logger.warning(f"Georgia Ren Fest: could not fetch season dates: {e}")
        return None

    soup = BeautifulSoup(resp.text, "html.parser")
    page_year = _parse_season_year(soup)

    # Parse season-level start and end dates from <p class='dates'>
    dates_p = soup.find("p", class_="dates")
    season_start: Optional[str] = None
    season_end: Optional[str] = None

    if dates_p:
        dates_text = dates_p.get_text(strip=True)
        m = _SEASON_DATES_RE.search(dates_text)
        if m:
            start_month = _MONTH_MAP.get(m.group(1).lower(), 0)
            start_day = int(m.group(2))
            end_month = _MONTH_MAP.get(m.group(3).lower(), 0)
            end_day = int(m.group(4))
            year = int(m.group(5)) if m.group(5) else page_year
            if start_month and end_month:
                season_start = f"{year}-{start_month:02d}-{start_day:02d}"
                season_end = f"{year}-{end_month:02d}-{end_day:02d}"

    # Fall back to typical season window
    if not season_start:
        season_start = f"{page_year}-04-11"
    if not season_end:
        season_end = f"{page_year}-05-31"

    year = season_start[:4]
    exhibition_data = {
        "slug": f"georgia-renaissance-festival-seasonal-{year}",
        "place_id": venue_id,
        "source_id": source_id,
        "title": f"Georgia Renaissance Festival {year} Season",
        "description": (
            f"Annual spring season in Fairburn, GA (25 miles SW of Atlanta). "
            f"Running weekends {season_start[5:]} through {season_end[5:]}, "
            f"the festival features 8 themed weekends including Vikings, Celtic, "
            f"Pirates, Wizards, Cosplay, Romance, Pets, and Fae. Each open day "
            f"includes jousting, 15 live stages, an artisan market with 160+ "
            f"shoppes, food and drink, games, rides, and costume contests."
        ),
        "opening_date": season_start,
        "closing_date": season_end,
        "exhibition_type": "seasonal",
        "admission_type": "ticketed",
        "admission_url": TICKETS_URL,
        "source_url": THEMED_WEEKENDS_URL,
        "operating_schedule": {
            "days": {
                "saturday": {"open": "10:30", "close": "18:00"},
                "sunday": {"open": "10:30", "close": "18:00"},
            },
            # Memorial Day Monday handled via per-weekend event overrides
        },
        "tags": ["seasonal", "family-friendly", "outdoor", "all-ages"],
    }

    exhibition_id = insert_exhibition(exhibition_data)
    if exhibition_id:
        logger.info(
            f"Georgia Ren Fest: upserted seasonal exhibition "
            f"({season_start} to {season_end}, id={exhibition_id})"
        )
    return exhibition_id
```

Update the imports at the top of the file:

```python
from db import (
    find_event_by_hash,
    get_or_create_place,
    insert_event,
    smart_update_existing_event,
)
from db.exhibitions import insert_exhibition
from dedupe import generate_content_hash
```

- [ ] **Step 3: Update `crawl()` entry point to use the exhibition**

Find the `crawl()` function (around line 531). Replace the scrape_season_event call with the new flow:

```python
def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Georgia Renaissance Festival.
    Strategy:
    1. Upsert the place (seasonal_attraction, is_seasonal_only=True).
    2. Create/update one seasonal exhibition carrying the season window.
    3. Emit themed-weekend events linked to the exhibition via exhibition_id.
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    session = requests.Session()
    session.headers.update({
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/121.0.0.0 Safari/537.36"
        )
    })

    try:
        venue_id = get_or_create_place(PLACE_DATA)

        # 1. Seasonal exhibition (carries the season window)
        try:
            exhibition_id = create_seasonal_exhibition(session, source_id, venue_id)
        except Exception as e:
            logger.error(f"Georgia Ren Fest: error creating seasonal exhibition: {e}")
            exhibition_id = None

        # 2. Themed-weekend events (linked to exhibition via exhibition_id)
        try:
            f, n, u = scrape_themed_weekends(session, source_id, venue_id, exhibition_id)
            events_found += f
            events_new += n
            events_updated += u
        except Exception as e:
            logger.error(f"Georgia Ren Fest: error in themed weekends scraper: {e}")

        if events_found < 1:
            logger.warning(
                f"Georgia Ren Fest: only {events_found} themed-weekend events found — "
                "expected 8. Site structure may have changed."
            )

        logger.info(
            f"Georgia Ren Fest crawl complete: {events_found} found, "
            f"{events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Georgia Ren Fest: crawl failed: {e}")
        raise

    return events_found, events_new, events_updated
```

- [ ] **Step 4: Thread `exhibition_id` through `scrape_themed_weekends`**

Update the signature and body of `scrape_themed_weekends()` (around line 235) to accept and attach `exhibition_id`:

```python
def scrape_themed_weekends(
    session: requests.Session,
    source_id: int,
    venue_id: int,
    exhibition_id: Optional[str] = None,
) -> tuple[int, int, int]:
```

Inside the function where `event_record` is built, add:

```python
            event_record = {
                # ... existing fields unchanged ...
                "exhibition_id": exhibition_id,   # <-- add this line
            }
```

- [ ] **Step 5: Dry-run the crawler**

Run:
```bash
cd crawlers && python3 main.py --source georgia-ren-fest --dry-run 2>&1 | tail -30
```

Expected output includes:
- `Georgia Ren Fest: upserted seasonal exhibition (...)`
- `Georgia Ren Fest: added '...' (2026-MM-DD–2026-MM-DD)` for 8 themed weekends
- `Georgia Ren Fest crawl complete: 8 found, ...`
- No mention of `scrape_season_event` or `season event`.

- [ ] **Step 6: Run existing Ren Fest tests (if any)**

Run:
```bash
cd crawlers && python -m pytest tests/ -k "ren_fest or renaissance" -v 2>&1 | tail -20
```

Expected: all tests pass, OR "no tests ran" (if none exist).

- [ ] **Step 7: Commit**

```bash
git add crawlers/sources/georgia_ren_fest.py
git commit -m "feat(crawlers): Ren Fest emits seasonal exhibition + linked themed weekends (replaces season-window pseudo-event)"
```

---

### Task 9: Run Ren Fest crawler against local DB (data verification)

**Files:**
- None (execution only)

Verifies the exhibition actually lands, themed-weekend events link correctly, and the Ren Fest place is flagged `is_seasonal_only`.

- [ ] **Step 1: Run the crawler with writes**

Run:
```bash
cd crawlers && python3 main.py --source georgia-ren-fest --allow-production-writes 2>&1 | tail -30
```

Expected: 1 seasonal exhibition upserted + 8 themed-weekend events upserted. No errors.

- [ ] **Step 2: Verify exhibition row**

Run:
```bash
cd web && npx supabase db execute --local "SELECT id, slug, title, opening_date, closing_date, exhibition_type, operating_schedule FROM exhibitions WHERE slug LIKE 'georgia-renaissance-festival-seasonal-%' ORDER BY opening_date DESC LIMIT 1;"
```

Expected: 1 row, `exhibition_type='seasonal'`, `operating_schedule` JSON contains `saturday` and `sunday` keys, `opening_date` and `closing_date` populated with real 2026 dates.

- [ ] **Step 3: Verify themed-weekend events link to exhibition**

Run:
```bash
cd web && npx supabase db execute --local "SELECT COUNT(*) AS linked_events FROM events e JOIN exhibitions ex ON e.exhibition_id = ex.id WHERE ex.slug LIKE 'georgia-renaissance-festival-seasonal-%';"
```

Expected: `linked_events = 8` (one per themed weekend).

- [ ] **Step 4: Verify place flags**

Run:
```bash
cd web && npx supabase db execute --local "SELECT name, place_type, is_seasonal_only FROM places WHERE slug = 'georgia-renaissance-festival';"
```

Expected: `place_type = 'festival_grounds'`, `is_seasonal_only = true`.

- [ ] **Step 5: Verify Ren Fest no longer in festivals table**

Run:
```bash
cd web && npx supabase db execute --local "SELECT id, slug FROM festivals WHERE slug ILIKE '%renaissance%';"
```

Expected: empty result set (Task 7 migration ran).

- [ ] **Step 6: No commit (verification-only task)**

This task makes no code changes — it verifies Task 8's crawler conversion lands real data. Nothing to commit.

---

## Phase 4: Places to Go wire-up

### Task 10: Add `seasonal` category config

**Files:**
- Modify: `web/lib/places-to-go/constants.ts`

- [ ] **Step 1: Add category entry**

Append to the `PLACES_TO_GO_CATEGORIES` array in `web/lib/places-to-go/constants.ts`, placed near the top so active seasonal attractions get prime real estate during their window. Find the end of the array and add:

```typescript
  {
    key: "seasonal",
    label: "This Season",
    placeTypes: [],                                  // type-agnostic, filter-based
    accentColor: "#00D4E8",                           // --neon-cyan — "now" semantics
    iconType: "calendar",
    filter: "has_active_seasonal_exhibition",
    seeAllHrefStrategy: "none",                       // phase 1: no see-all link
  },
```

- [ ] **Step 2: Typecheck**

Run:
```bash
cd web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/lib/places-to-go/constants.ts
git commit -m "feat(places-to-go): add 'This Season' category config (cyan accent, filter-based)"
```

---

### Task 11: Callout rules for the seasonal category

**Files:**
- Modify: `web/lib/places-to-go/callouts.ts`
- Modify: `web/lib/places-to-go/types.ts` — add seasonal-state fields to `PlaceContext`

Adds:
- `PlaceContext.seasonalExhibition: SeasonalExhibition | null`
- `PlaceContext.seasonState: SeasonState` (from the helper)
- New `CALLOUT_CONFIG["seasonal"]` entry
- Callouts emitted as discrete strings (not joined) — per spec, mobile truncation kills only trailing callout.

- [ ] **Step 1: Extend PlaceContext in types.ts**

Edit `web/lib/places-to-go/types.ts`. Import SeasonalExhibition + SeasonState, and add fields to `PlaceContext`:

```typescript
import type { SeasonalExhibition, SeasonState } from "@/lib/places/seasonal";
```

Inside `PlaceContext`:

```typescript
  // Seasonal attraction fields (only populated when the place has an active
  // or pre-open seasonal exhibition).
  seasonalExhibition: SeasonalExhibition | null;
  seasonState: SeasonState | null;
```

- [ ] **Step 2: Write failing tests for seasonal callouts**

Create `web/lib/places-to-go/__tests__/callouts-seasonal.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { buildCallouts } from "../callouts";
import type { PlaceContext } from "../types";

function baseCtx(overrides: Partial<PlaceContext>): PlaceContext {
  return {
    weatherMatchIndoor: false,
    weatherMatchOutdoor: true,
    weatherMatch: true,
    timeOfDayMatch: false,
    seasonMatch: false,
    eventsToday: 0,
    eventsThisWeek: 0,
    hasImage: true,
    hasDescription: true,
    isFeatured: false,
    occasions: null,
    vibes: null,
    cuisine: null,
    neighborhood: "Fairburn",
    nearestMarta: null,
    difficulty: null,
    driveTimeMinutes: null,
    bestSeasons: null,
    weatherFitTags: null,
    shortDescription: null,
    libraryPass: null,
    isNew: false,
    hasActiveSpecial: false,
    specialTitle: null,
    specialTimeEnd: null,
    indoorOutdoor: "outdoor",
    createdDaysAgo: null,
    hasNewEventsThisWeek: false,
    todayEventTitle: null,
    seasonalExhibition: null,
    seasonState: null,
    ...overrides,
  };
}

describe("seasonal callouts", () => {
  it("emits cadence and 'Running through' during active season", () => {
    const ctx = baseCtx({
      seasonalExhibition: {
        id: "1",
        place_id: 1,
        exhibition_type: "seasonal",
        opening_date: "2026-04-11",
        closing_date: "2026-06-08",
        operating_schedule: {
          days: {
            saturday: { open: "10:30", close: "18:00" },
            sunday: { open: "10:30", close: "18:00" },
          },
        },
        title: "Ren Fest",
      },
      seasonState: { status: "active", daysToOpen: null, activeCount: 1 },
    });
    const callouts = buildCallouts("seasonal", ctx);
    expect(callouts[0]).toBe("Sat–Sun 10:30–6");
    expect(callouts[1]).toBe("Running through June 8");
  });

  it("emits 'Final weekend' during last 7 days", () => {
    const ctx = baseCtx({
      seasonalExhibition: {
        id: "1",
        place_id: 1,
        exhibition_type: "seasonal",
        opening_date: "2026-04-11",
        closing_date: "2026-06-08",
        operating_schedule: {
          days: {
            saturday: { open: "10:30", close: "18:00" },
            sunday: { open: "10:30", close: "18:00" },
          },
        },
        title: "Ren Fest",
      },
      seasonState: { status: "active", daysToOpen: null, activeCount: 1 },
    });
    // Mock current date = 2026-06-05 (3 days before closing)
    const callouts = buildCallouts("seasonal", ctx, new Date("2026-06-05"));
    expect(callouts[1]).toBe("Final weekend");
  });

  it("emits 'Opens X' during pre-open window", () => {
    const ctx = baseCtx({
      seasonalExhibition: {
        id: "1",
        place_id: 1,
        exhibition_type: "seasonal",
        opening_date: "2026-04-11",
        closing_date: "2026-06-08",
        operating_schedule: {
          days: {
            saturday: { open: "10:30", close: "18:00" },
            sunday: { open: "10:30", close: "18:00" },
          },
        },
        title: "Ren Fest",
      },
      seasonState: { status: "pre-open", daysToOpen: 22, activeCount: 0 },
    });
    const callouts = buildCallouts("seasonal", ctx, new Date("2026-03-20"));
    expect(callouts[0]).toBe("Sat–Sun 10:30–6");
    expect(callouts[1]).toBe("Opens April 11");
  });

  it("emits '2 seasons running' when activeCount >= 2 (Yule Forest overlap)", () => {
    const ctx = baseCtx({
      seasonalExhibition: {
        id: "xmas",
        place_id: 1,
        exhibition_type: "seasonal",
        opening_date: "2026-11-05",
        closing_date: "2026-12-24",
        operating_schedule: {
          days: {
            friday: { open: "10:00", close: "18:00" },
            saturday: { open: "10:00", close: "18:00" },
            sunday: { open: "10:00", close: "18:00" },
          },
        },
        title: "Christmas Tree",
      },
      seasonState: { status: "active", daysToOpen: null, activeCount: 2 },
    });
    const callouts = buildCallouts("seasonal", ctx, new Date("2026-11-08"));
    // Third callout signals multi-season
    expect(callouts[2]).toBe("+1 more season running");
  });
});
```

- [ ] **Step 3: Run tests — expect fail**

Run:
```bash
cd web && npx vitest run lib/places-to-go/__tests__/callouts-seasonal.test.ts
```

Expected: FAIL — `buildCallouts` does not yet accept `"seasonal"` category.

- [ ] **Step 4: Implement seasonal callout rules**

Edit `web/lib/places-to-go/callouts.ts`. At the top of the file add imports:

```typescript
import { formatCadence } from "@/lib/places/seasonal";
```

Find the `CALLOUT_CONFIG` const. The existing config uses a rule pattern keyed on categories. The `seasonal` category needs a different shape (ordered, status-driven), so extend rather than mirror.

Add to `CALLOUT_CONFIG`:

```typescript
  seasonal: {
    timeSensitive: [],
    activity: [],
    static: [],
  },
```

Then find the `buildCallouts()` function (search for `export function buildCallouts`). Add a seasonal branch at the top:

```typescript
export function buildCallouts(
  categoryKey: string,
  ctx: PlaceContext,
  today: Date = new Date(),
): string[] {
  if (categoryKey === "seasonal") {
    return buildSeasonalCallouts(ctx, today);
  }
  // ... existing logic unchanged ...
}

function buildSeasonalCallouts(ctx: PlaceContext, today: Date): string[] {
  const ex = ctx.seasonalExhibition;
  const state = ctx.seasonState;
  if (!ex || !state) return [];

  const callouts: string[] = [];

  // First callout: cadence (kept visible even under mobile truncation).
  const cadence = formatCadence(ex.operating_schedule);
  if (cadence) callouts.push(cadence);

  // Second callout: status line (may truncate).
  const closing = new Date(ex.closing_date + "T00:00:00");
  const daysToClose = Math.round(
    (closing.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (state.status === "active") {
    if (daysToClose >= 0 && daysToClose <= 7) {
      // Weekend-cadence places get "Final weekend"; others "Final week".
      const isWeekendOnly =
        cadence.includes("Sat") && !cadence.includes("Fri");
      callouts.push(isWeekendOnly ? "Final weekend" : "Final week");
    } else {
      callouts.push(`Running through ${formatMonthDay(ex.closing_date)}`);
    }
  } else if (state.status === "pre-open") {
    callouts.push(`Opens ${formatMonthDay(ex.opening_date)}`);
  }

  // Third callout: multi-season signal (optional).
  if (state.activeCount >= 2) {
    callouts.push(`+${state.activeCount - 1} more season running`);
  }

  return callouts;
}

function formatMonthDay(isoDate: string): string {
  const d = new Date(isoDate + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}
```

- [ ] **Step 5: Run tests — expect pass**

Run:
```bash
cd web && npx vitest run lib/places-to-go/__tests__/callouts-seasonal.test.ts
```

Expected: all tests pass.

- [ ] **Step 6: Run full callouts tests (regression check)**

Run:
```bash
cd web && npx vitest run lib/places-to-go/
```

Expected: all tests pass, no existing regressions.

- [ ] **Step 7: Commit**

```bash
git add web/lib/places-to-go/types.ts web/lib/places-to-go/callouts.ts web/lib/places-to-go/__tests__/callouts-seasonal.test.ts
git commit -m "feat(places-to-go): seasonal callouts — discrete cadence + status + multi-season signal"
```

---

### Task 12: Query path — join exhibitions for seasonal category

**Files:**
- Modify: `web/app/api/portals/[slug]/city-pulse/places-to-go/route.ts`

The route currently selects places by `place_type IN (...)`. For the seasonal category, it must select places that have an active-or-pre-open seasonal exhibition. Adds a parallel query branch.

- [ ] **Step 1: Add seasonal query helper**

Edit `web/app/api/portals/[slug]/city-pulse/places-to-go/route.ts`. After the existing `PLACE_SELECT` constant (around line 66), add:

```typescript
import {
  getSeasonalExhibitionsForPlace,
  isPlaceInSeason,
  getPrimarySeasonalExhibition,
} from "@/lib/places/seasonal";

/**
 * Fetch places that have an active or pre-open (<=28d) seasonal exhibition.
 * Returns rows in the same PlaceRow shape as the main query, plus the
 * primary seasonal exhibition pre-resolved.
 */
async function fetchSeasonalPlaces(
  serviceClient: SupabaseClient,
  portalId: string,
  today: Date,
): Promise<Array<PlaceRow & { _seasonalExhibition: SeasonalExhibition; _seasonState: SeasonState }>> {
  const todayStr = today.toISOString().slice(0, 10);
  const preOpenCutoff = new Date(today);
  preOpenCutoff.setDate(preOpenCutoff.getDate() + 28);
  const preOpenStr = preOpenCutoff.toISOString().slice(0, 10);

  // Subquery: exhibitions that are active OR within pre-open window
  const { data: exhibitions } = await serviceClient
    .from("exhibitions")
    .select("id, place_id, exhibition_type, opening_date, closing_date, operating_schedule, title, portal_id")
    .eq("exhibition_type", "seasonal")
    .eq("is_active", true)
    .or(`and(opening_date.lte.${todayStr},closing_date.gte.${todayStr}),and(opening_date.gt.${todayStr},opening_date.lte.${preOpenStr})`)
    .eq("portal_id", portalId);

  if (!exhibitions || exhibitions.length === 0) return [];

  // Group exhibitions by place_id
  const byPlace = new Map<number, SeasonalExhibition[]>();
  for (const ex of exhibitions as SeasonalExhibition[] & { place_id: number }[]) {
    const list = byPlace.get(ex.place_id) ?? [];
    list.push(ex);
    byPlace.set(ex.place_id, list);
  }

  const placeIds = [...byPlace.keys()];
  if (placeIds.length === 0) return [];

  // Fetch place rows using the same PLACE_SELECT shape
  const { data: places } = await serviceClient
    .from("places")
    .select(PLACE_SELECT)
    .in("id", placeIds)
    .eq("is_active", true);

  if (!places) return [];

  return (places as PlaceRow[]).flatMap((p) => {
    const exs = byPlace.get(p.id) ?? [];
    const primary = getPrimarySeasonalExhibition(exs, today);
    if (!primary) return [];
    const state = isPlaceInSeason(exs, today);
    return [{ ...p, _seasonalExhibition: primary, _seasonState: state }];
  });
}
```

- [ ] **Step 2: Branch category iteration on `filter`**

Locate the category loop. Run:
```bash
grep -n "PLACES_TO_GO_CATEGORIES" web/app/api/portals/[slug]/city-pulse/places-to-go/route.ts
```

You'll see two references — the `for (const categoryConfig of PLACES_TO_GO_CATEGORIES)` loop is the one to modify. Near the top of that loop, insert a branch:

```typescript
for (const categoryConfig of PLACES_TO_GO_CATEGORIES) {
  let places: Array<PlaceRow & { _seasonalExhibition?: SeasonalExhibition; _seasonState?: SeasonState }>;

  if (categoryConfig.filter === "has_active_seasonal_exhibition") {
    places = await fetchSeasonalPlaces(serviceClient, portalId, today);
  } else {
    // existing: filter by placeTypes
    places = allPlaces.filter((p) =>
      p.place_type !== null &&
      categoryConfig.placeTypes.includes(p.place_type),
    );
  }

  // ... continue existing scoring + card-building logic
}
```

- [ ] **Step 3: Single-item suppression**

After the category block is built (card list assembled, scored, top N selected), add:

```typescript
// Spec: single-item categories read as a mistake. Suppress when < 2.
if (categoryConfig.filter === "has_active_seasonal_exhibition" && finalCards.length < 2) {
  continue; // skip this category block entirely
}
```

- [ ] **Step 4: Populate PlaceContext with seasonal fields**

In the context-building code (where `PlaceContext` is assembled for scoring/callouts), populate seasonal fields only when the place came from the seasonal branch:

```typescript
  const ctx: PlaceContext = {
    // ... existing fields ...
    seasonalExhibition: place._seasonalExhibition ?? null,
    seasonState: place._seasonState ?? null,
  };
```

- [ ] **Step 5: Typecheck**

Run:
```bash
cd web && npx tsc --noEmit
```

Expected: no errors. If errors appear, they're likely `SupabaseClient` typing — follow the project's established pattern (see `web/CLAUDE.md` "Known Gotchas" → `as unknown as SupabaseClient<Schema>`).

- [ ] **Step 6: Commit**

```bash
git add web/app/api/portals/[slug]/city-pulse/places-to-go/route.ts
git commit -m "feat(api): Places to Go 'This Season' category — join exhibitions, single-item suppression"
```

---

### Task 13: PlacesToGoCard — discrete callouts + event_count cap

**Files:**
- Modify: `web/components/feed/sections/PlacesToGoCard.tsx`

Callouts currently render via `callouts.join(" · ")` and truncate as one string. Mobile truncation kills the whole line. Fix: render callouts as separate spans with per-span truncation, so cadence (callouts[0]) always wins. Also cap `event_count` at 9 → display "9+".

- [ ] **Step 1: Render discrete callouts**

Edit `web/components/feed/sections/PlacesToGoCard.tsx`. Find the callouts rendering block (around line 78):

```typescript
          {card.callouts.length > 0 && (
            <p className="text-xs text-[var(--muted)] truncate flex-1">
              {card.callouts.join(" · ")}
            </p>
          )}
```

Replace with:

```typescript
          {card.callouts.length > 0 && (
            <p className="text-xs text-[var(--muted)] flex-1 flex items-center gap-1 min-w-0 overflow-hidden">
              {card.callouts.map((c, i) => (
                <span key={i} className="flex items-center gap-1 min-w-0 flex-shrink-0 first:flex-shrink-[1]">
                  {i > 0 && <span className="opacity-40 flex-shrink-0">·</span>}
                  <span className={i === card.callouts.length - 1 ? "truncate" : ""}>{c}</span>
                </span>
              ))}
            </p>
          )}
```

Rationale: first callout (cadence) has `flex-shrink-[1]` so it can shrink if needed but the last callout (status) gets the `truncate` class — if space is tight, the status truncates, not the cadence.

- [ ] **Step 2: Cap event count**

Find the event_count badge:

```typescript
          {hasEventCount && (
            <span ... >
              {card.event_count}
            </span>
          )}
```

Replace `{card.event_count}` with:

```typescript
              {card.event_count > 9 ? "9+" : card.event_count}
```

- [ ] **Step 3: Verify card renders (dev server check)**

Start dev server in background:
```bash
cd web && npm run dev
```

Use the QA skill or browser automation to check `/{portal}` renders Places to Go with the new "This Season" category and that cards render without layout breakage.

- [ ] **Step 4: Commit**

```bash
git add web/components/feed/sections/PlacesToGoCard.tsx
git commit -m "feat(places-to-go): discrete callouts (mobile truncation preserves cadence), 9+ cap on event_count"
```

---

## Phase 5: Launch verification

### Task 14: Browser-test end-to-end

**Files:**
- None (verification only)

Hard sequencing gate check: Ren Fest visible in "This Season" AND absent from "The Big Stuff" festivals rail on the Atlanta feed.

- [ ] **Step 1: Start dev server**

Run:
```bash
cd web && npm run dev
```

Expected: server starts at localhost:3000 without errors.

- [ ] **Step 2: Use QA skill to verify the Atlanta feed**

Run the `qa` slash command with this scope:

> Check `/atlanta` Atlanta portal feed. Two specific checks:
> 1. The "This Season" category exists in the Places to Go section, renders with neon-cyan accent, and shows Georgia Renaissance Festival with callouts "Sat–Sun 10:30–6" and "Opens April 11" (or "Running through June 8" if today is in-season).
> 2. "The Big Stuff" festivals rail no longer includes Georgia Renaissance Festival. Confirm by reading the rail cards.

Expected: both checks pass.

- [ ] **Step 3: Check mobile viewport (375px)**

Resize browser to 375px and reload `/atlanta`. Verify:
- The "This Season" card's cadence callout ("Sat–Sun 10:30–6") is fully visible.
- If truncation happens, only the status callout ("Running through June 8") is cut off.

- [ ] **Step 4: Run full typecheck**

Run:
```bash
cd web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Run linter**

Run:
```bash
cd web && npm run lint
```

Expected: no errors.

- [ ] **Step 6: Run full test suite (regression check)**

Run:
```bash
cd web && npx vitest run && cd ../crawlers && python -m pytest tests/ -q 2>&1 | tail -20
```

Expected: all tests pass.

---

### Task 15: Update crawler docs

**Files:**
- Modify: `crawlers/CLAUDE.md`

Document the seasonal-destinations pattern so future crawlers (Netherworld, Southern Belle, state fair, etc. — Plans 2-4) can follow it.

- [ ] **Step 1: Add seasonal-destinations section**

Add a new H2 section near the "First-Pass Validation Checklist" in `crawlers/CLAUDE.md`:

```markdown
## Seasonal-only Destinations

Destinations that exist **only during their season** (haunted houses, pumpkin patches, state fairs, seasonal light shows, Ren Fest) use the exhibitions-as-season-carrier pattern:

1. **Place**: real `place_type` (`festival_grounds`, `farm`, `fairgrounds`, `haunted_attraction`). Set `is_seasonal_only: True`.
2. **Exhibition**: one row per season with `exhibition_type: "seasonal"`, `opening_date`/`closing_date` from the source site, `operating_schedule` JSON with per-day hours, year-scoped slug: `<place-slug>-seasonal-<year>` or `<place-slug>-<season-name>-<year>`.
3. **Events**: themed dated programming (themed weekends, concerts, special nights) linked via `events.exhibition_id` → the seasonal exhibition.
4. **Series** (Shape B only): recurring rituals within the season (nightly parade, fireworks) use `series.exhibition_id`.

**Never** emit a season-window pseudo-event in the `events` table. The exhibition carries the window.

### Shape taxonomy

| Shape | Examples | Structure |
|---|---|---|
| A. Continuous nightly, no sub-programming | Netherworld, Lake Lanier Lights, Callaway Lights, Burt's Pumpkin | 1 exhibition, 0 events |
| B. Season + recurring rituals | Stone Mountain Christmas | 1 exhibition + N series (via `series.exhibition_id`) |
| C. Themed dated weekends | Ren Fest, Buford Corn Maze | 1 exhibition + N events (via `events.exhibition_id`) |
| D. Fairgrounds | NG State Fair, Georgia National Fair | 1 exhibition + 50-150 events |
| E. Multi-season single place | Southern Belle, Yule Forest | N exhibitions (one per season), possibly overlapping |
| F. Persistent place + seasonal overlay | ABG + Garden Lights | `is_seasonal_only=False`, year-round place + seasonal exhibition(s) |

### Lifecycle rules

- **Year rollover**: next year's data creates a NEW exhibition row. Never overwrite last year's — historical rows are features.
- **`is_active` trap**: use `closing_date` to truncate a cancelled season mid-run; never `is_active = FALSE`. is_active is for "this row is data junk," not "the season ended early."
- **Series invariant**: when `series.exhibition_id` is set, `series.place_id` must equal `exhibitions.place_id` for the referenced exhibition.
- **Slug uniqueness**: `exhibitions.slug` is UNIQUE — year-scope all seasonal slugs.
- **Enrichment**: seasonal-only places should be excluded by `hydrate_hours_google.py` and `hydrate_venues_foursquare.py` to prevent silent NULL overwrites of season-hours-on-exhibition.

Reference implementation: `crawlers/sources/georgia_ren_fest.py`.
```

- [ ] **Step 2: Commit**

```bash
git add crawlers/CLAUDE.md
git commit -m "docs(crawlers): document seasonal-only destinations pattern"
```

---

## Launch Readiness Check

Before flipping "This Season" visible to users, confirm:

- [ ] Task 1 (schema migration) applied to production
- [ ] Task 2 (`_EXHIBITION_COLUMNS` update) deployed
- [ ] Task 4 (helpers) + Task 10 (category config) + Task 11 (callouts) + Task 12 (API route) + Task 13 (card polish) all merged
- [ ] Task 6 (annual_tentpoles.py Ren Fest removal) merged
- [ ] Task 7 (festivals table cleanup) applied to production
- [ ] Task 8-9 (Ren Fest crawler conversion + data verified) — at least one production crawl run with seasonal exhibition confirmed
- [ ] Task 14 (browser verification) passed on preview deploy
- [ ] Task 15 (docs) merged

Only after all green: this plan is complete. Remaining crawlers (Netherworld, Stone Mountain Christmas, Southern Belle, State Fair, haunted house trio) ship under Plans 2-3. Full propagation (Shape A scoring, search_unified guard, enrichment guards, detail page status strip) ships under Plan 4.
