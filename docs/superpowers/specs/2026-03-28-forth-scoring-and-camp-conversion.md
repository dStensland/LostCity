# FORTH Per-Hotel Scoring + Summer Camp Conversion

## Problem

### FORTH Scoring
FORTH hotel concierge portals use the same rigid scoring function as all other portals. Hotel guests have no personalization signals (no friends, no follows, no preference history), so the social-heavy scoring produces near-random rankings. The taxonomy redesign added significance signals and derived attributes to every event, but FORTH doesn't consume them yet. Each hotel property has different proximity needs (Midtown vs airport) but scoring is one-size-fits-all.

### Summer Camps
~2,000 summer camp events remain in the events table categorized as `workshops` (legacy `family`). These are programs — multi-session structured activities with registration, age ranges, and enrollment deadlines — not one-time events. The programs table and API already exist with 4,789 programs. The conversion script pattern is proven (Georgia Gymnastics Academy successfully converted). The top sources (DeKalb Family Programs, Woodward, MJCCA) need source-by-source conversion.

## Design

### FORTH: Two-Tier Scoring Model

**Tier 1: Citywide signals (shared across all FORTH properties)**

| Signal | Points | Notes |
|---|---|---|
| significance = "high" | +30 | Touring acts, major festivals, championship games |
| significance = "medium" | +15 | Notable local events |
| Signal: touring | +8 | Nationally/internationally touring act |
| Signal: festival | +8 | Multi-act, multi-day event |
| Signal: championship | +8 | Playoff, rivalry, championship |
| Signal: large_venue | +5 | Venue capacity above threshold |
| Signal: limited_run | +5 | One night only, closing weekend |
| Signal: opening | +5 | Opening night, premiere |
| Editorial pin (all properties) | +100 | FORTH admin pinned to all hotels |
| Editorial pin (this property) | +100 | FORTH admin pinned to this hotel |
| Image present | +5 | Events with images rank higher |

Signal bonuses capped at +25 total.

**Tier 2: Per-hotel signals (stored on portal record as `scoring_config` JSONB)**

| Signal | Default | Configurable | Notes |
|---|---|---|---|
| Proximity: walkable (<1mi) | +80 | Yes | Hotel-specific — Midtown hotel scores Midtown events |
| Proximity: close (1-3mi) | +40 | Yes | |
| Proximity: far (3+mi) | +15 | Yes | Still shown — tentpoles transcend distance |
| Same neighborhood | +20 | Yes | Events in the hotel's neighborhood |
| Category boost | +0 | Yes | Per-category multiplier (e.g., arts hotel boosts art +15) |

**Default `scoring_config` JSON:**

```json
{
  "proximity": { "walkable": 80, "close": 40, "far": 15 },
  "neighborhood_boost": 20,
  "category_boosts": {},
  "suppress_categories": ["support", "religious"]
}
```

Overridable per property. A boutique arts hotel:

```json
{
  "proximity": { "walkable": 80, "close": 40, "far": 15 },
  "neighborhood_boost": 20,
  "category_boosts": { "art": 15, "theater": 10, "dance": 10 },
  "suppress_categories": ["support", "religious", "volunteer", "civic"]
}
```

### Daypart Ranking Behavior

| Daypart | Primary sort | Secondary sort | What guests see |
|---|---|---|---|
| Morning | proximity + duration (short/medium) | cost_tier | "Coffee at Octane (5 min walk) · Chamber music at High Museum ($$, 2hrs)" |
| Afternoon | proximity + duration | significance | "Botanical Garden (half day) · Food festival at Piedmont Park (free)" |
| Evening | significance + citywide signals | proximity | "Hayley Williams at Tabernacle · Blues at Northside Tavern (walkable)" |
| Late Night | significance | proximity | "DJ at MJQ · Late night oysters at BeetleCat" |

Implementation: `scoreForConcierge(event, portal, daypart)` applies Tier 1 + Tier 2 with daypart-specific weighting:
- Morning/Afternoon: `proximityScore * 1.5 + significanceScore * 0.5`
- Evening/Late Night: `significanceScore * 1.5 + proximityScore * 0.5`

### Editorial Override

Uses existing `portal_section_items` table for curated placements. FORTH admin can:
- Pin an event to a specific daypart section for all properties
- Pin an event to a specific hotel's feed
- Suppress an event from FORTH entirely

No new tables needed — this is already supported by the section system.

### Database Change

Add `scoring_config` JSONB column to `portals` table:

```sql
ALTER TABLE portals ADD COLUMN IF NOT EXISTS scoring_config JSONB DEFAULT '{}';
```

Populate for existing FORTH properties with the default config.

### Function Signature

```typescript
function scoreForConcierge(
  event: ForthEvent,
  portal: { scoring_config: ScoringConfig; lat: number; lng: number; neighborhood: string },
  daypart: "morning" | "afternoon" | "evening" | "late_night"
): number
```

Replaces current `scoreDestination()` in `forth-data.ts`.

---

## Summer Camp Conversion

### Approach

Source-by-source conversion using the proven pattern from Georgia Gymnastics Academy. Each source has different title conventions, so normalization is per-source.

### Sources to Convert (priority order)

| Source | Events | Notes |
|---|---|---|
| DeKalb Family Programs | 289 | Largest. ACTIVENet API. |
| Woodward Summer Camps | 213 | Private school. Structured naming. |
| MJCCA Day Camps | 113 | Jewish community center. Age-banded. |
| High Museum Summer Art Camp | 41 | Art museum. Clear age groups. |
| Spruill Summer Camps | 40 | Arts center. Class-style. |
| Girl Scouts Greater Atlanta Camps | 33 | Outdoor/adventure. |
| Trinity Summer Camps | 32 | Private school. |
| Pace Summer Programs | 28 | Private school. |
| Zoo Atlanta Summer Safari Camp | 28 | Zoo. Clear age groups. |
| Lovett Summer Programs | 25 | Private school. |

### Conversion Script Enhancement

Extend `convert_events_to_programs.py` with `--camps` mode:

1. Query events WHERE `category_id = 'workshops' AND legacy_category_id = 'family' AND title ILIKE '%camp%' AND source_id = ?`
2. Group by normalized title (strip date/session suffixes)
3. For each group:
   - Create program record with `program_type = 'camp'`
   - Infer `age_min`/`age_max` from event `age_min`/`age_max` columns or title patterns
   - Set `season` from date range (June-August = summer)
   - Set `session_start`/`session_end` from min/max event dates in the group
   - Set `cost_amount` from modal `price_min`
   - Set `registration_url` from first event's `ticket_url`
   - Set `schedule_days` from event day-of-week distribution
4. After conversion, deactivate source events (not the source — camps are seasonal, source will produce new events next year)

### What NOT to convert

- Events without "camp" in the title — these are individual workshops, classes, or activities that belong as events
- Sources with < 5 camp events — not worth the overhead
- Events where `end_date` is NULL — can't determine session span

### Verification

After each source conversion:
- Query `/api/programs?portal=atlanta-families&source=<slug>` — programs appear
- Query events table — camp events deactivated
- Spot-check 5 programs for correct age_min, age_max, season, cost

## Out of Scope

- FORTH admin UI for managing editorial pins (uses existing portal_section_items)
- FORTH admin UI for configuring scoring weights (direct DB updates for now)
- Camp-to-program conversion for non-camp sources (gymnastics already done, other class types TBD)
- Per-hotel onboarding flow for scoring config
