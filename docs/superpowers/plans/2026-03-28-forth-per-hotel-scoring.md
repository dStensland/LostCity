# Plan: FORTH Per-Hotel Scoring

**Goal:** Replace FORTH's rigid `scoreDestination()` — which only knows proximity and specials state — with `scoreForConcierge()` that uses taxonomy significance signals, per-hotel category boosts, and daypart-aware weighting. Hotel guests have no social signals, so the ranking must be driven by event quality and hotel-specific proximity context instead.

**Architecture:**
- New `scoring_config` JSONB column on the `portals` table stores per-hotel weights.
- New `scoreForConcierge()` function in `web/lib/forth-scoring.ts` (separate file — keeps `forth-data.ts` focused on data fetching).
- `fetchFeedSectionsDirect()` in `web/lib/forth-data.ts` gains a scoring pass after fetching events, replacing the current no-op ordering.
- `fetchDestinationsDirect()` replaces its internal `scoreDestination()` call with `scoreForConcierge()` for venue ranking.
- The concierge orchestrated route already passes the full `Portal` object into `getForthFeed()` — no route changes needed.

**Tech Stack:** TypeScript, Supabase PostgreSQL, Next.js API Routes

---

## Task 1: Add `scoring_config` to the `portals` table

**Files:**
- `database/migrations/598_portals_scoring_config.sql` (new)
- `supabase/migrations/20260328100000_portals_scoring_config.sql` (new)
- `database/schema.sql` (update portals table definition)

**Steps:**

- [ ] Run the migration scaffolding helper:
  ```bash
  cd /Users/coach/Projects/LostCity
  python3 database/create_migration_pair.py portals_scoring_config
  ```

- [ ] Fill `database/migrations/598_portals_scoring_config.sql`:
  ```sql
  -- ============================================================
  -- MIGRATION 598: Add scoring_config to portals
  -- ============================================================
  -- Stores per-hotel scoring weights for the FORTH concierge feed.
  -- Default config matches the spec defaults; individual properties
  -- can be overridden with a direct DB UPDATE.

  ALTER TABLE portals
    ADD COLUMN IF NOT EXISTS scoring_config JSONB DEFAULT '{}';

  -- Populate existing FORTH portals with the default config.
  -- The default values match the spec:
  --   proximity.walkable=80, close=40, far=15
  --   neighborhood_boost=20
  --   category_boosts={} (neutral by default)
  --   suppress_categories=["support","religious"]
  UPDATE portals
  SET scoring_config = '{
    "proximity": { "walkable": 80, "close": 40, "far": 15 },
    "neighborhood_boost": 20,
    "category_boosts": {},
    "suppress_categories": ["support", "religious"]
  }'::jsonb
  WHERE slug IN ('forth')
    AND (scoring_config IS NULL OR scoring_config = '{}'::jsonb);

  -- DOWN
  -- ALTER TABLE portals DROP COLUMN IF EXISTS scoring_config;
  ```

- [ ] Copy the same SQL body into `supabase/migrations/20260328100000_portals_scoring_config.sql`.

- [ ] In `database/schema.sql`, find the portals `CREATE TABLE` statement (the full definition lives in `database/migrations/001_portals.sql`; add the column to the schema doc near the other JSONB config columns):
  ```sql
  scoring_config JSONB DEFAULT '{}',
  ```
  Add it after the existing `settings JSONB DEFAULT '{}'` line.

- [ ] Verify:
  ```bash
  python3 /Users/coach/Projects/LostCity/database/audit_migration_parity.py --fail-on-unmatched
  ```

---

## Task 2: Create `scoreForConcierge()` in `web/lib/forth-scoring.ts`

**Files:**
- `web/lib/forth-scoring.ts` (new file)

**Steps:**

- [ ] Create `web/lib/forth-scoring.ts`:

  ```typescript
  /**
   * Per-hotel concierge scoring for FORTH feed.
   *
   * Replaces the old proximity-only scoreDestination() with a two-tier model:
   *   Tier 1: Citywide significance signals (touring, festival, championship, etc.)
   *   Tier 2: Per-hotel proximity + category boosts from scoring_config JSONB
   *
   * Daypart weighting:
   *   Morning/Afternoon: proximity * 1.5 + significance * 0.5
   *   Evening/Late Night: significance * 1.5 + proximity * 0.5
   *
   * Editorial pins (+100) come from portal_section_items — the section
   * assembler checks those separately; this function scores unpinned events.
   */

  import type { DayPart } from "./forth-types";
  import type { ProximityTier } from "./geo";

  // ---------------------------------------------------------------------------
  // Config types
  // ---------------------------------------------------------------------------

  export interface ScoringConfigProximity {
    walkable: number;
    close: number;
    far: number;
  }

  export interface ScoringConfig {
    proximity: ScoringConfigProximity;
    neighborhood_boost: number;
    category_boosts: Record<string, number>;
    suppress_categories: string[];
  }

  const DEFAULT_SCORING_CONFIG: ScoringConfig = {
    proximity: { walkable: 80, close: 40, far: 15 },
    neighborhood_boost: 20,
    category_boosts: {},
    suppress_categories: ["support", "religious"],
  };

  export function parseScoringConfig(raw: Record<string, unknown> | null | undefined): ScoringConfig {
    if (!raw || typeof raw !== "object") return DEFAULT_SCORING_CONFIG;
    const prox = (raw.proximity && typeof raw.proximity === "object")
      ? (raw.proximity as Partial<ScoringConfigProximity>)
      : {};
    return {
      proximity: {
        walkable: typeof prox.walkable === "number" ? prox.walkable : DEFAULT_SCORING_CONFIG.proximity.walkable,
        close:    typeof prox.close    === "number" ? prox.close    : DEFAULT_SCORING_CONFIG.proximity.close,
        far:      typeof prox.far      === "number" ? prox.far      : DEFAULT_SCORING_CONFIG.proximity.far,
      },
      neighborhood_boost: typeof raw.neighborhood_boost === "number"
        ? raw.neighborhood_boost
        : DEFAULT_SCORING_CONFIG.neighborhood_boost,
      category_boosts: (raw.category_boosts && typeof raw.category_boosts === "object" && !Array.isArray(raw.category_boosts))
        ? (raw.category_boosts as Record<string, number>)
        : {},
      suppress_categories: Array.isArray(raw.suppress_categories)
        ? (raw.suppress_categories as string[])
        : DEFAULT_SCORING_CONFIG.suppress_categories,
    };
  }

  // ---------------------------------------------------------------------------
  // Scorable event shape — subset of DbEvent needed by scoring
  // ---------------------------------------------------------------------------

  export interface ScoringEvent {
    id: number;
    category_id: string | null;
    significance?: string | null;
    significance_signals?: string[] | null;
    image_url?: string | null;
    is_tentpole?: boolean | null;
    venue?: {
      neighborhood: string | null;
    } | null;
  }

  // ---------------------------------------------------------------------------
  // Tier 1: Citywide significance score
  // ---------------------------------------------------------------------------

  const SIGNAL_POINTS: Record<string, number> = {
    touring:       8,
    festival:      8,
    championship:  8,
    large_venue:   5,
    limited_run:   5,
    opening:       5,
  };

  const SIGNAL_CAP = 25;

  function significanceScore(event: ScoringEvent): number {
    let score = 0;

    if (event.significance === "high")   score += 30;
    else if (event.significance === "medium") score += 15;

    if (event.significance_signals && event.significance_signals.length > 0) {
      const signalBonus = event.significance_signals.reduce(
        (sum, signal) => sum + (SIGNAL_POINTS[signal] ?? 0),
        0,
      );
      score += Math.min(SIGNAL_CAP, signalBonus);
    }

    if (event.image_url) score += 5;

    return score;
  }

  // ---------------------------------------------------------------------------
  // Tier 2: Per-hotel proximity + category boost
  // ---------------------------------------------------------------------------

  function proximityScore(
    proximityTier: ProximityTier,
    config: ScoringConfig,
    eventNeighborhood: string | null,
    hotelNeighborhood: string,
  ): number {
    let score = 0;

    if (proximityTier === "walkable") score += config.proximity.walkable;
    else if (proximityTier === "close") score += config.proximity.close;
    else score += config.proximity.far;

    if (eventNeighborhood && eventNeighborhood === hotelNeighborhood) {
      score += config.neighborhood_boost;
    }

    return score;
  }

  function categoryBoost(event: ScoringEvent, config: ScoringConfig): number {
    if (!event.category_id) return 0;
    return config.category_boosts[event.category_id] ?? 0;
  }

  // ---------------------------------------------------------------------------
  // Public function
  // ---------------------------------------------------------------------------

  /**
   * Score an event for the FORTH concierge feed.
   *
   * @param event        - Event with significance fields.
   * @param portal       - Portal record with scoring_config, lat/lng, and neighborhood.
   * @param proximityTier - Pre-computed proximity tier from geo.ts.
   * @param daypart      - Current daypart for weighting.
   * @returns            - Numeric score. Higher = rank higher in the section.
   */
  export function scoreForConcierge(
    event: ScoringEvent,
    portal: {
      scoring_config: Record<string, unknown> | null | undefined;
      neighborhood: string;
    },
    proximityTier: ProximityTier,
    daypart: DayPart,
  ): number {
    const config = parseScoringConfig(portal.scoring_config);

    // Suppress categories entirely
    if (event.category_id && config.suppress_categories.includes(event.category_id)) {
      return -1;
    }

    const sigScore = significanceScore(event);
    const proxScore = proximityScore(
      proximityTier,
      config,
      event.venue?.neighborhood ?? null,
      portal.neighborhood,
    );
    const catBoost = categoryBoost(event, config);

    let blendedScore: number;
    if (daypart === "morning" || daypart === "afternoon") {
      // Proximity-first: guests want nearby, accessible things
      blendedScore = proxScore * 1.5 + sigScore * 0.5;
    } else {
      // Evening/late night: significance-first; big events beat distance
      blendedScore = sigScore * 1.5 + proxScore * 0.5;
    }

    return blendedScore + catBoost;
  }
  ```

- [ ] Run type check to confirm zero errors:
  ```bash
  cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit 2>&1 | head -30
  ```

---

## Task 3: Wire `scoreForConcierge()` into the FORTH feed fetcher

**Files:**
- `web/lib/forth-data.ts` (modify `fetchFeedSectionsDirect` and `fetchDestinationsDirect`)
- `web/lib/forth-types.ts` (check if `Portal` type needs `scoring_config`)

The current `fetchFeedSectionsDirect()` does not score or sort events at all — it returns events in date order. `fetchDestinationsDirect()` uses the local `scoreDestination(tier, state, confidence, lastVerifiedAt)` function at line 503, which has no knowledge of significance or category.

**Steps:**

- [ ] In `web/lib/forth-types.ts` (or wherever `Portal` is extended for FORTH), confirm `scoring_config` will be available. The `Portal` type comes from `web/lib/portal-context.ts` — check it:

  ```bash
  grep -n "scoring_config\|Portal\b" /Users/coach/Projects/LostCity/web/lib/portal-context.ts | head -20
  ```

  If `Portal` doesn't have `scoring_config`, add it as optional:
  ```typescript
  scoring_config?: Record<string, unknown> | null;
  ```

- [ ] Update `EVENT_SELECT` at line 525 of `web/lib/forth-data.ts` to include the significance fields:
  ```typescript
  // Before:
  const EVENT_SELECT = `
    id, title, start_date, start_time, end_date, is_all_day, is_free, price_min,
    category_id, image_url, description, tags, source_id,
    venue:venues(id, name, neighborhood, slug, venue_type, city)
  `;

  // After:
  const EVENT_SELECT = `
    id, title, start_date, start_time, end_date, is_all_day, is_free, price_min,
    category_id, image_url, description, tags, source_id,
    significance, significance_signals, is_tentpole,
    venue:venues(id, name, neighborhood, slug, venue_type, city)
  `;
  ```

- [ ] Update `DbEvent` type (around line 267) to include the new fields:
  ```typescript
  type DbEvent = {
    // ... existing fields ...
    significance: string | null;
    significance_signals: string[] | null;
    is_tentpole: boolean | null;
    // ... rest unchanged ...
  };
  ```

- [ ] In `fetchFeedSectionsDirect()`, add import at top of file:
  ```typescript
  import { scoreForConcierge } from "./forth-scoring";
  import { getDayPart } from "./forth-data"; // already in same file, just use directly
  import { getProximityTier, haversineDistanceKm } from "./geo";
  ```

- [ ] In `fetchFeedSectionsDirect()`, after the auto-filter section builds `events`, add a scoring sort pass before `result.push(...)` (around line 718). The portal's `geo_center` holds hotel lat/lng. Pull neighborhood from `portal.settings?.neighborhood` (or fall back to `"midtown"`):

  ```typescript
  // After "events = filtered.slice(0, limit);" and before the result.push block:
  const portalCenter = portal.filters?.geo_center as [number, number] | undefined;
  const hotelNeighborhood = (portal.settings as Record<string, unknown>)?.neighborhood as string ?? "midtown";
  const daypart = getDayPart(new Date());

  if (portalCenter && events.length > 1) {
    const scored = events.map((ev) => {
      if (!ev.venue || ev.venue.lat == null || ev.venue.lng == null) {
        return { ev, score: 0 };
      }
      const distKm = haversineDistanceKm(portalCenter[0], portalCenter[1], ev.venue.lat as unknown as number, ev.venue.lng as unknown as number);
      const tier = getProximityTier(distKm);
      const score = scoreForConcierge(
        {
          id: ev.id,
          category_id: ev.category_id,
          significance: ev.significance,
          significance_signals: ev.significance_signals,
          image_url: ev.image_url,
          is_tentpole: ev.is_tentpole,
          venue: { neighborhood: ev.venue?.neighborhood ?? null },
        },
        {
          scoring_config: (portal as Record<string, unknown>).scoring_config as Record<string, unknown> | null,
          neighborhood: hotelNeighborhood,
        },
        tier,
        daypart,
      );
      return { ev, score };
    });
    scored.sort((a, b) => b.score - a.score);
    events = scored.filter((s) => s.score >= 0).map((s) => s.ev);
  }
  ```

  Note: venue lat/lng is not currently in the `EVENT_SELECT`. If they're not available at this stage (they won't be without adding them to the select), use the proximity data already computed in `fetchDestinationsDirect` for the destination ranking instead. See note below.

  **Important caveat:** `fetchFeedSectionsDirect` fetches events for named sections (Tonight, This Weekend, etc.) but doesn't have venue lat/lng. The most impactful scoring surface is the destination list. Start there and revisit feed section scoring in a follow-up once venue coords are confirmed available.

- [ ] In `fetchDestinationsDirect()`, replace the `scoreDestination()` call at line 910:

  ```typescript
  // Before (line 910):
  const score = scoreDestination(venue.proximity_tier, state, top?.special.confidence || null, top?.special.last_verified_at || null);

  // After:
  import { scoreForConcierge, type ScoringEvent } from "./forth-scoring";

  // Build a minimal ScoringEvent from the next_event for this venue
  const nextEventForScoring: ScoringEvent | null = nextEvent
    ? {
        id: nextEvent.id,
        category_id: nextEvent.category_id,
        significance: null,      // DbNextEvent doesn't carry significance yet — acceptable for v1
        significance_signals: null,
        image_url: null,
        is_tentpole: null,
        venue: { neighborhood: venue.neighborhood },
      }
    : null;

  const hotelNeighborhood = (portal.settings as Record<string, unknown>)?.neighborhood as string ?? "midtown";
  const daypart = getDayPart(now);

  const score = nextEventForScoring
    ? scoreForConcierge(
        nextEventForScoring,
        {
          scoring_config: (portal as Record<string, unknown>).scoring_config as Record<string, unknown> | null,
          neighborhood: hotelNeighborhood,
        },
        venue.proximity_tier,
        daypart,
      )
    : // Fall back to proximity-only when no upcoming event
      (venue.proximity_tier === "walkable" ? 80 : venue.proximity_tier === "close" ? 40 : 15);
  ```

  For a cleaner v1, expand `DbNextEvent` to include `significance` and `significance_signals`:
  ```typescript
  type DbNextEvent = {
    id: number;
    title: string;
    start_date: string;
    start_time: string | null;
    venue_id: number | null;
    source_id: number | null;
    category_id: string | null;
    significance: string | null;
    significance_signals: string[] | null;
  };
  ```

  And update the next-event select at line 840:
  ```typescript
  .select("id, title, start_date, start_time, venue_id, source_id, category_id, significance, significance_signals")
  ```

- [ ] Run type check:
  ```bash
  cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit 2>&1 | head -40
  ```

- [ ] Run lint:
  ```bash
  cd /Users/coach/Projects/LostCity/web && npm run lint 2>&1 | tail -20
  ```

---

## Task 4: Confirm `portal.scoring_config` reaches `getForthFeed()`

**Files:**
- `web/lib/portal.ts` or wherever `getPortalBySlug()` is defined
- `web/lib/portal-context.ts` — `Portal` type

**Steps:**

- [ ] Verify `getPortalBySlug()` selects `scoring_config`:
  ```bash
  grep -n "scoring_config\|getPortalBySlug\|from.*portals" /Users/coach/Projects/LostCity/web/lib/portal.ts | head -20
  ```

  If the portals query omits `scoring_config`, add it to the SELECT. For example, if the query is:
  ```typescript
  .select("id, slug, name, portal_type, parent_portal_id, filters, branding, settings, plan, status")
  ```
  Add `scoring_config` to the list.

- [ ] Add `scoring_config` to the `Portal` type in `web/lib/portal-context.ts`:
  ```typescript
  scoring_config?: Record<string, unknown> | null;
  ```

- [ ] Re-run type check:
  ```bash
  cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit 2>&1 | head -20
  ```

---

## Task 5: Verify and commit

**Steps:**

- [ ] Deploy to local dev and hit the FORTH concierge feed:
  ```bash
  cd /Users/coach/Projects/LostCity/web && npm run dev &
  curl "http://localhost:3000/api/portals/forth/concierge/orchestrated" | jq '.data.destinations | .[0:3] | .[] | {name: .venue.name, tier: .proximity_tier}'
  ```

- [ ] Check that destinations are sorted: walkable venues should appear before distant ones; walkable venues with high-significance next events should rank above walkable venues with no next event.

- [ ] Check suppression: events with `category_id IN ('support', 'religious')` should not appear in destination next_event.

- [ ] Confirm no TypeScript errors and no lint warnings.

- [ ] Commit:
  ```bash
  cd /Users/coach/Projects/LostCity
  git add \
    database/migrations/598_portals_scoring_config.sql \
    supabase/migrations/20260328100000_portals_scoring_config.sql \
    database/schema.sql \
    web/lib/forth-scoring.ts \
    web/lib/forth-data.ts \
    web/lib/portal-context.ts
  git commit -m "feat(forth): per-hotel scoring with significance signals and daypart weighting"
  ```

---

## Known Limitations (v1)

- Feed section events (Tonight, This Weekend) are not proximity-scored because venue lat/lng is not in `EVENT_SELECT`. The scoring applies to the destination list and can be extended to sections once venue coords are added.
- `portal.settings.neighborhood` is used as the hotel's neighborhood string. This should be set explicitly on FORTH portals (e.g., `"old_fourth_ward"`). The fallback is `"midtown"`.
- The editorial pin (+100) bonus described in the spec is already handled by the section system's `portal_section_items` — pinned events surface at the top of curated sections naturally. No code change needed.
