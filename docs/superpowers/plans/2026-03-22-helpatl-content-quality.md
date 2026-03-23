# HelpATL Content Quality & Root Cause Fixes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the root causes of HelpATL's content quality issues — category monotony, duplicate sources, incorrectly hidden events, and dead subscriptions — so the feed is navigable, deduplicated, and complete.

**Architecture:** Three layers of fixes: (1) taxonomy — add `civic` and `volunteer` categories to the system so civic crawlers have correct options, (2) data hygiene — deactivate duplicates, fix portal attribution, remove dead subscriptions, (3) content expansion — subscribe HelpATL to proven sources it's missing. All changes propagate through the existing pipeline with no new infrastructure.

**Tech Stack:** Python (crawlers), TypeScript (web category taxonomy), SQL migrations (Supabase)

---

## Context for Implementers

### The Problem

HelpATL has 2,279 future visible events — good volume. But 67% are categorized as "community" because there's no `civic` or `volunteer` category in the system. Government meetings, volunteer shifts, and advocacy rallies all collapse into one bucket, making filtering useless.

Additionally:
- 4 support group subscriptions contribute 0 visible events (all filtered by `is_sensitive`)
- 2 duplicate source pairs produce the same events from different crawlers
- NAMI Georgia's public training events are incorrectly hidden by a source-level `is_sensitive` flag
- `fulton-county-meetings` is attributed to the wrong portal
- `georgia-elections` is a phantom DB record with no crawler
- HelpATL is missing subscriptions to `fulton-library` (545 events) and `dekalb-library` (27 events)

### Key Files

| File | Role |
|------|------|
| `crawlers/tags.py:292-314` | `VALID_CATEGORIES` set — source of truth for category IDs |
| `crawlers/db/validation.py:511-536` | `_CATEGORY_NORMALIZATION_MAP` — maps aliases to canonical categories |
| `web/lib/event-taxonomy.ts:1-19` | `PUBLIC_EVENT_CATEGORY_OPTIONS` — web-side category list for UI |
| `web/lib/search-constants.ts:3` | `CATEGORIES` — derived from event-taxonomy, used in filter chips |
| `crawlers/tag_inference.py:883-896` | `SUPPORT_GROUP_SOURCES` set — sources that auto-flag `is_sensitive` |
| `crawlers/db/events.py:445-446` | Source-level `is_sensitive` propagation to events |
| `crawlers/db/events.py:657-659` | `infer_is_support_group` auto-categorization |

### What "community" Currently Means

Every civic crawler hardcodes `"category": "community"` because there's no better option. The tags are granular (`government`, `public-meeting`, `volunteer`, `activism`) but the category — which drives filtering — is a single bucket.

After this plan, the 67% `community` splits roughly:
- ~500 events → `volunteer` (HOA shifts, Food Bank, Open Hand, MedShare, Trees Atlanta)
- ~500 events → `civic` (government meetings, NPU meetings, school boards, elections, advocacy)
- ~500 events stay `community` (library programs, general community gatherings)

---

## Task 1: Add `civic` and `volunteer` Categories to the Taxonomy

**Files:**
- Modify: `crawlers/tags.py:292-314`
- Modify: `crawlers/db/validation.py:511-536`
- Modify: `web/lib/event-taxonomy.ts:1-19`
- Modify: `web/lib/event-taxonomy.ts:59-83`

### Why

The `VALID_CATEGORIES` set in `tags.py` has 21 categories. None of them represent civic/government events or volunteer opportunities. The normalization map in `validation.py` maps `"activism"` → `"community"`, which is wrong for civic content. The web-side taxonomy in `event-taxonomy.ts` must match or the new categories won't appear in filter UI.

- [ ] **Step 1: Add categories to `crawlers/tags.py`**

In the `VALID_CATEGORIES` set, add `"civic"` and `"volunteer"` as new entries:

```python
VALID_CATEGORIES = {
    "music",
    "film",
    "comedy",
    "theater",
    "dance",
    "art",
    "sports",
    "food_drink",
    "nightlife",
    "community",
    "civic",          # NEW — government meetings, elections, civic engagement
    "volunteer",      # NEW — volunteer shifts, service opportunities
    "fitness",  # legacy alias — normalizes to "exercise"
    "exercise",
    "recreation",
    "family",
    "learning",
    "words",
    "religious",
    "wellness",
    "support_group",
    "outdoors",
    "other",
}
```

- [ ] **Step 2: Update the normalization map in `crawlers/db/validation.py`**

Change `"activism"` mapping and add new aliases:

```python
_CATEGORY_NORMALIZATION_MAP: dict[str, str] = {
    "arts": "art",
    "activism": "civic",           # CHANGED — was "community"
    "civic_engagement": "civic",   # NEW alias
    "government": "civic",         # NEW alias
    "volunteering": "volunteer",   # NEW alias
    "service": "volunteer",        # NEW alias
    "cultural": "community",
    "tours": "learning",
    "meetup": "community",
    "gaming": "community",
    "markets": "community",
    "haunted": "nightlife",
    "eatertainment": "nightlife",
    "entertainment": "family",
    "food": "food_drink",
    "fitness": "exercise",
    "yoga": "exercise",
    "gym": "exercise",
    "workout": "exercise",
    "cooking": "learning",
    "class": "learning",
    "outdoor": "outdoors",
    "museums": "art",
    "shopping": "community",
    "education": "learning",
    "sports_recreation": "recreation",
    "health": "wellness",
    "programs": "family",
}
```

- [ ] **Step 3: Add categories to `web/lib/event-taxonomy.ts`**

Add to `PUBLIC_EVENT_CATEGORY_OPTIONS` array (insert after `community`):

```typescript
export const PUBLIC_EVENT_CATEGORY_OPTIONS = [
  { id: "music", label: "Music" },
  { id: "film", label: "Film" },
  { id: "comedy", label: "Comedy" },
  { id: "theater", label: "Theater" },
  { id: "art", label: "Art" },
  { id: "sports", label: "Sports" },
  { id: "food_drink", label: "Food & Drink" },
  { id: "nightlife", label: "Nightlife" },
  { id: "community", label: "Community" },
  { id: "civic", label: "Civic" },           // NEW
  { id: "volunteer", label: "Volunteer" },   // NEW
  { id: "recreation", label: "Recreation" },
  { id: "exercise", label: "Exercise" },
  { id: "family", label: "Family" },
  { id: "learning", label: "Learning" },
  { id: "words", label: "Words" },
  { id: "religious", label: "Religious" },
  { id: "wellness", label: "Wellness" },
  { id: "outdoors", label: "Outdoors" },
] as const;
```

Also update `LEGACY_EVENT_CATEGORY_ALIASES` (full replacement — do not truncate):

```typescript
export const LEGACY_EVENT_CATEGORY_ALIASES: Record<string, string> = {
  activism: "civic",             // CHANGED — was "community"
  civic_engagement: "civic",     // NEW
  government: "civic",           // NEW
  volunteering: "volunteer",     // NEW
  service: "volunteer",          // NEW
  arts: "art",
  class: "learning",
  cooking: "learning",
  cultural: "community",
  dance: "learning",
  education: "learning",
  "food-drink": "food_drink",
  food: "food_drink",
  gaming: "nightlife",
  health: "wellness",
  "kids-family": "family",
  markets: "food_drink",
  meetup: "learning",
  museums: "art",
  outdoor: "outdoors",
  programs: "family",
  shopping: "community",
  sports_recreation: "recreation",
  tours: "learning",
  fitness: "exercise",
  yoga: "exercise",
  gym: "exercise",
  workout: "exercise",
};
```

- [ ] **Step 4: Run TypeScript build check**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit`
Expected: PASS (no type errors)

- [ ] **Step 5: Commit**

```bash
git add crawlers/tags.py crawlers/db/validation.py web/lib/event-taxonomy.ts
git commit -m "feat: add civic and volunteer categories to event taxonomy

Adds two new categories so civic crawlers have correct options instead
of defaulting everything to 'community'. Updates normalization maps
and web-side taxonomy to match."
```

---

## Task 2: Re-categorize Civic Crawlers

**Files:**
- Modify: `crawlers/db/events.py:646-647` — `_step_infer_category()` volunteer override: `"community"` → `"volunteer"`
- Modify: `crawlers/sources/hands_on_atlanta.py:565` — `"community"` → `"volunteer"`
- Modify: `crawlers/sources/atlanta_community_food_bank.py:417` — `"community"` → `"volunteer"`
- Modify: `crawlers/sources/open_hand_atlanta.py:193` — check `_determine_category()`, update default
- Modify: `crawlers/sources/medshare.py:360,431` — `"community"` → `"volunteer"`
- Modify: `crawlers/sources/trees_atlanta.py` — volunteer events → `"volunteer"`
- Modify: `crawlers/sources/atlanta_city_meetings.py:292` — `"community"` → `"civic"`
- Modify: `crawlers/sources/atlanta_city_council.py:368` — `"community"` → `"civic"`
- Modify: `crawlers/sources/atlanta_city_planning.py` — `"community"` → `"civic"`
- Modify: `crawlers/sources/marta_board.py:428` — `"community"` → `"civic"`
- Modify: `crawlers/sources/georgia_general_assembly.py:198` — `"community"` → `"civic"`
- Modify: `crawlers/sources/georgia_elections.py:196,242` — `"community"` → `"civic"`
- Modify: `crawlers/sources/mobilize_api.py:896` — `"community"` → `"civic"`

### Why

These crawlers all hardcode `"category": "community"` because there was no better option. Now that `civic` and `volunteer` exist, each crawler gets the right category. This is the change that breaks the 67% concentration.

### Rules

- **Government meetings, elections, school boards, NPUs, advocacy/organizing** → `"civic"`
- **Volunteer shifts, food distribution, meal delivery, tree planting, animal rescue** → `"volunteer"`
- **Library programs, general community events, fundraising galas** → stay `"community"`

- [ ] **Step 1: Update volunteer crawlers**

For each file, change the `"category"` value in the event dict:

**`hands_on_atlanta.py`** — Line 565: `"community"` → `"volunteer"`

**`atlanta_community_food_bank.py`** — Line 417: `"community"` → `"volunteer"`

**`open_hand_atlanta.py`** — Check `_determine_category()` function. If it returns `"community"` for shift events, update the default return to `"volunteer"`. Training events (`"learning"`) should stay `"learning"`.

**`medshare.py`** — Lines 360 and 431: `"community"` → `"volunteer"`

**`trees_atlanta.py`** — Find the category assignment. Volunteer planting/cleanup events → `"volunteer"`. Guided tree tours → keep `"community"` or `"outdoors"`.

- [ ] **Step 2: Fix `_step_infer_category()` in `crawlers/db/events.py`**

**CRITICAL:** The insert pipeline has a function at line 642-648 that overrides volunteer events back to `"community"`:

```python
# BEFORE (line 646-647):
if _is_volunteer_event(event_data):
    event_data["category"] = "community"
    return event_data
```

Change to preserve the crawler's category (which is now `"volunteer"`):

```python
# AFTER:
if _is_volunteer_event(event_data):
    event_data["category"] = "volunteer"
    return event_data
```

Without this fix, every volunteer crawler change in Step 1 is silently overridden at insert time.

- [ ] **Step 3: Update civic/government crawlers**

**`atlanta_city_meetings.py`** — Line 292: `"community"` → `"civic"`

**`atlanta_city_council.py`** — Line 368: `"community"` → `"civic"`

**`atlanta_city_planning.py`** — Find category assignment, change to `"civic"`

**`marta_board.py`** — Line 428: `"community"` → `"civic"`

**`georgia_general_assembly.py`** — Line 198: `"community"` → `"civic"`

**`georgia_elections.py`** — Lines 196 and 242: `"community"` → `"civic"`

**`mobilize_api.py`** — Line 896: `"community"` → `"civic"`. Note: Mobilize events are primarily civic organizing/activism, which maps to `civic`.

- [ ] **Step 4: Verify with dry run on one crawler from each category**

Run: `cd /Users/coach/Projects/LostCity/crawlers && python3 main.py --source hands-on-atlanta --dry-run 2>&1 | tail -5`
Expected: Runs without error, events show `category: volunteer`

Run: `python3 main.py --source atlanta-city-council --dry-run 2>&1 | tail -5`
Expected: Runs without error, events show `category: civic`

- [ ] **Step 5: Commit**

```bash
git add crawlers/db/events.py crawlers/sources/hands_on_atlanta.py crawlers/sources/atlanta_community_food_bank.py \
  crawlers/sources/open_hand_atlanta.py crawlers/sources/medshare.py crawlers/sources/trees_atlanta.py \
  crawlers/sources/atlanta_city_meetings.py crawlers/sources/atlanta_city_council.py \
  crawlers/sources/atlanta_city_planning.py crawlers/sources/marta_board.py \
  crawlers/sources/georgia_general_assembly.py crawlers/sources/georgia_elections.py \
  crawlers/sources/mobilize_api.py
git commit -m "feat: re-categorize civic crawlers to use civic/volunteer categories

Government meetings, elections, school boards → civic
Volunteer shifts, food distribution, animal rescue → volunteer
Breaks the 67% community concentration in HelpATL feed."
```

---

## Task 3: Write Migration to Backfill Existing Events

**Files:**
- Create: `supabase/migrations/20260322820000_add_civic_volunteer_categories.sql`

### Why

Tasks 1-2 fix new events going forward. But there are ~2,200 existing future events in HelpATL still categorized as `community`. This migration re-categorizes them based on their source, matching the crawler changes in Task 2. Also adds `civic` and `volunteer` to the `categories` table if it uses an enum or reference table.

- [ ] **Step 1: Write the migration**

```sql
-- Backfill existing events: re-categorize civic and volunteer events
-- that were previously bucketed as "community" due to missing categories.
--
-- First inserts the new categories into the categories table (FK target),
-- then re-categorizes events by source.

-- Insert new categories (required before FK-constrained UPDATE)
INSERT INTO categories (id, name, display_order, icon, color)
VALUES
  ('civic',     'Civic',     10.5, 'Bank',      '#4A9E8A'),
  ('volunteer', 'Volunteer', 11,   'HandHeart', '#6ABF69')
ON CONFLICT (id) DO NOTHING;

-- Volunteer sources
UPDATE events
SET category_id = 'volunteer'
WHERE category_id = 'community'
  AND source_id IN (
    SELECT id FROM sources WHERE slug IN (
      'hands-on-atlanta',
      'atlanta-community-food-bank',
      'open-hand-atlanta',
      'medshare',
      'trees-atlanta',
      'concrete-jungle',
      'habitat-for-humanity-atlanta',
      'park-pride',
      'lifeline-animal-project',
      'furkids',
      'atlanta-humane-society',
      'big-brothers-big-sisters-atl',
      'pebble-tossers',
      'food-well-alliance',
      'city-of-refuge'
    )
  )
  AND is_active = true;

-- Civic sources
UPDATE events
SET category_id = 'civic'
WHERE category_id = 'community'
  AND source_id IN (
    SELECT id FROM sources WHERE slug IN (
      'atlanta-city-meetings',
      'atlanta-city-council',
      'atlanta-city-planning',
      'marta-board',
      'georgia-general-assembly',
      'georgia-elections-calendar',
      'georgia-elections',
      'georgia-ethics-commission',
      'mobilize-us',
      'atlanta-dsa',
      'indivisible-atl',
      'aclu-georgia',
      'common-cause-georgia',
      'fair-count',
      'lwv-atlanta',
      'civic-innovation-atl',
      'georgia-equality',
      'marta-army',
      'atlanta-public-schools-board',
      'dekalb-county-schools-board',
      'fulton-county-schools-board',
      'cobb-county-schools-board',
      'gwinnett-county-schools-board',
      'cherokee-county-schools-board',
      'clayton-county-schools-board',
      'dekalb-county-meetings',
      'fulton-county-meetings',
      'eventbrite-civic'
    )
  )
  AND is_active = true;
```

- [ ] **Step 2: Push migration**

Run: `cd /Users/coach/Projects/LostCity && npx supabase db push --linked`
Expected: Migration applies cleanly

- [ ] **Step 3: Verify category distribution**

Run a quick query to confirm the split:
```sql
SELECT category_id, COUNT(*)
FROM events
WHERE source_id IN (SELECT id FROM sources WHERE owner_portal_id = (SELECT id FROM portals WHERE slug = 'helpatl'))
  AND is_active = true AND start_date >= CURRENT_DATE
GROUP BY category_id ORDER BY count DESC;
```
Expected: `community` drops from ~67% to under 30%. `civic` and `volunteer` each have 400+ events.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260322820000_add_civic_volunteer_categories.sql
git commit -m "migrate: backfill civic and volunteer categories on existing events"
```

---

## Task 4: Fix NAMI Georgia Sensitivity

**Files:**
- Modify: `crawlers/tag_inference.py:883-896` — remove `nami-georgia` from `SUPPORT_GROUP_SOURCES`
- Modify: `crawlers/sources/nami_georgia.py` — add event-level `is_sensitive` for support groups only
- Create: `supabase/migrations/20260322820001_fix_nami_georgia_sensitivity.sql`

### Why

NAMI Georgia runs two types of events: (1) peer support groups (sensitive), and (2) public trainings, advocacy events, volunteer orientations (not sensitive). Currently `nami-georgia` is in `SUPPORT_GROUP_SOURCES`, which makes ALL events `is_sensitive=True`. This hides NAMI's public events from HelpATL (~9 events filtered out that should be visible).

The fix: remove `nami-georgia` from the blanket source list. Instead, the `infer_is_support_group()` function will still catch actual support group events via keyword matching (NAMI support group titles contain "Support Group"). Public trainings like "Adult Mental Health First Aid" won't match and will stay visible.

- [ ] **Step 1: Remove `nami-georgia` from `SUPPORT_GROUP_SOURCES`**

In `crawlers/tag_inference.py`, remove `"nami-georgia"` from the `SUPPORT_GROUP_SOURCES` set:

```python
SUPPORT_GROUP_SOURCES = {
    "griefshare-atlanta",
    "griefshare",
    "celebrate-recovery",
    "na-georgia",
    "aa-atlanta",
    "metro-atl-aa",
    "divorcecare-atlanta",
    "ridgeview-institute",
    "ga-council-recovery",
    "ga-harm-reduction",
    # "nami-georgia" REMOVED — has mix of sensitive and public events
    "atlanta-mission",
}
```

- [ ] **Step 2: Verify keyword matching catches NAMI support groups**

The `infer_is_support_group()` function checks `SUPPORT_GROUP_KEYWORDS` which includes `"nami"`. The word-boundary check (`\bnami\b`) will match titles like "NAMI Georgia Support Group" but also "NAMI Family-to-Family". Check the NAMI crawler output to verify:

Run: `cd /Users/coach/Projects/LostCity/crawlers && python3 main.py --source nami-georgia --dry-run 2>&1 | grep -i "support_group\|sensitive\|category"`
Expected: Support group events still get `is_sensitive=True`, training events don't.

**Important:** If the keyword `"nami"` in `SUPPORT_GROUP_KEYWORDS` causes false positives on non-support events (like "NAMI Walk" or "Mental Health First Aid"), the fix is to remove `"nami"` from `SUPPORT_GROUP_KEYWORDS` and rely on the longer patterns like `"support group"` which match the actual support group event titles. Check the crawler output carefully.

- [ ] **Step 3: Write migration to un-hide NAMI public events**

```sql
-- Fix NAMI Georgia: un-hide public training/advocacy events.
-- Support group events stay hidden (matched by infer_is_support_group keyword check).
--
-- Strategy: first clear source-level flag (stops future propagation),
-- then un-hide existing events using POSITIVE matching on known-safe types.
-- Negative matching ("NOT ILIKE support group") is fragile — a title like
-- "NAMI Peer-to-Peer" would slip through.

-- Clear source-level is_sensitive flag first (stops future auto-propagation)
UPDATE sources
SET is_sensitive = false
WHERE slug = 'nami-georgia';

-- Un-hide events that are clearly public (positive match on known-safe patterns)
UPDATE events
SET is_sensitive = false
WHERE source_id = (SELECT id FROM sources WHERE slug = 'nami-georgia')
  AND is_active = true
  AND start_date >= CURRENT_DATE
  AND (
    title ILIKE '%first aid%'
    OR title ILIKE '%training%'
    OR title ILIKE '%walk%'
    OR title ILIKE '%awareness%'
    OR title ILIKE '%advocacy%'
    OR title ILIKE '%volunteer%'
    OR title ILIKE '%gala%'
    OR title ILIKE '%fundrais%'
    OR title ILIKE '%conference%'
    OR title ILIKE '%workshop%'
    OR title ILIKE '%speaker%'
    OR title ILIKE '%town hall%'
    OR title ILIKE '%screening%'
  );

-- Leave all other NAMI events as-is (still is_sensitive=true).
-- The crawler re-run (after removing nami-georgia from SUPPORT_GROUP_SOURCES)
-- will correctly flag only keyword-matched support groups going forward.
```

- [ ] **Step 4: Push migration**

Run: `cd /Users/coach/Projects/LostCity && npx supabase db push --linked`

- [ ] **Step 5: Commit**

```bash
git add crawlers/tag_inference.py crawlers/sources/nami_georgia.py \
  supabase/migrations/20260322820001_fix_nami_georgia_sensitivity.sql
git commit -m "fix: NAMI Georgia public events incorrectly hidden by source-level is_sensitive

Remove nami-georgia from SUPPORT_GROUP_SOURCES blanket list. Support
group events still caught by keyword matching. Public trainings and
advocacy events now visible in HelpATL feed."
```

---

## Task 5: Deactivate Duplicates and Dead Subscriptions

**Files:**
- Create: `supabase/migrations/20260322820002_helpatl_source_cleanup.sql`

### Why

Seven cleanup items, all in one migration:

1. **`georgia-elections`** — phantom DB record (no crawler file, never ran, 0 events). Duplicate of working `georgia-elections-calendar`.
2. **`atlanta-city-meetings`** — Playwright scraper producing duplicates of `atlanta-city-council` (HTTP/RSS). Deactivate the inferior source.
3. **4 support subscriptions** (DBSA, GriefShare, DivorceCare, NAMI) — HelpATL subscribes to these atlanta-support sources but ALL events are `is_sensitive=True`, contributing 0 visible events. Dead weight.
4. **`fulton-county-meetings` portal fix** — currently attributed to `atlanta` portal, should be `helpatl`.

- [ ] **Step 1: Write the migration**

```sql
-- HelpATL source cleanup: deactivate duplicates, remove dead subscriptions,
-- fix portal attribution.

DO $$
DECLARE
  helpatl_id UUID;
BEGIN
  SELECT id INTO helpatl_id FROM portals WHERE slug = 'helpatl';

  -- 1. Deactivate georgia-elections phantom record (no crawler, never ran)
  UPDATE sources SET is_active = false,
    health_tags = array_append(COALESCE(health_tags, '{}'), 'deactivated:phantom_duplicate')
  WHERE slug = 'georgia-elections' AND is_active = true;

  -- 2. Deactivate atlanta-city-meetings (Playwright scraper, duplicates atlanta-city-council RSS)
  UPDATE sources SET is_active = false,
    health_tags = array_append(COALESCE(health_tags, '{}'), 'deactivated:duplicate_of_atlanta-city-council')
  WHERE slug = 'atlanta-city-meetings' AND is_active = true;

  -- Deactivate future events from deactivated sources
  UPDATE events SET is_active = false
  WHERE source_id IN (
    SELECT id FROM sources WHERE slug IN ('georgia-elections', 'atlanta-city-meetings')
  )
  AND start_date >= CURRENT_DATE AND is_active = true;

  -- 3. Remove 4 dead support subscriptions from HelpATL
  -- These sources are all is_sensitive=true, contributing 0 visible events.
  UPDATE source_subscriptions SET is_active = false
  WHERE subscriber_portal_id = helpatl_id
    AND source_id IN (
      SELECT id FROM sources WHERE slug IN (
        'dbsa-atlanta',
        'griefshare-atlanta',
        'divorcecare-atlanta',
        'nami-georgia'
      )
    )
    AND is_active = true;

  -- 4. Fix fulton-county-meetings portal attribution (atlanta → helpatl)
  UPDATE sources SET owner_portal_id = helpatl_id
  WHERE slug = 'fulton-county-meetings'
    AND owner_portal_id = (SELECT id FROM portals WHERE slug = 'atlanta');

  -- Re-attribute fulton-county-meetings events to helpatl
  UPDATE events SET portal_id = helpatl_id
  WHERE source_id = (SELECT id FROM sources WHERE slug = 'fulton-county-meetings')
    AND portal_id = (SELECT id FROM portals WHERE slug = 'atlanta');

  -- Refresh materialized view
  REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
END $$;
```

- [ ] **Step 2: Push migration**

Run: `cd /Users/coach/Projects/LostCity && npx supabase db push --linked`

- [ ] **Step 3: Verify**

Check that `georgia-elections` and `atlanta-city-meetings` are inactive.
Check that HelpATL no longer subscribes to the 4 support sources.
Check that `fulton-county-meetings` is now owned by helpatl.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260322820002_helpatl_source_cleanup.sql
git commit -m "fix: deactivate duplicate sources, remove dead subscriptions, fix portal attribution

- georgia-elections: phantom record, no crawler
- atlanta-city-meetings: duplicate of atlanta-city-council RSS
- Remove 4 support subscriptions contributing 0 visible events
- Fix fulton-county-meetings attribution from atlanta → helpatl"
```

---

## Task 6: Subscribe HelpATL to Missing Library Sources

**Files:**
- Create: `supabase/migrations/20260322820003_helpatl_library_subscriptions.sql`

### Why

HelpATL already subscribes to `fulton-library` (545 events, via `atlanta` portal). But it's missing `dekalb-library` (27 events, via `atlanta-support` portal). Library events — ESL classes, financial literacy, civic workshops, teen programs — are genuinely civic content.

Also move `dekalb-library` ownership from `atlanta-support` to `atlanta` (same pattern as the BeltLine/YMCA move earlier — general community content, not support services).

- [ ] **Step 1: Write the migration**

```sql
-- Subscribe HelpATL to DeKalb Library and move ownership to atlanta portal.

DO $$
DECLARE
  helpatl_id UUID;
  atlanta_id UUID;
  support_id UUID;
  src RECORD;
BEGIN
  SELECT id INTO helpatl_id FROM portals WHERE slug = 'helpatl';
  SELECT id INTO atlanta_id FROM portals WHERE slug = 'atlanta';
  SELECT id INTO support_id FROM portals WHERE slug = 'atlanta-support';

  -- Move dekalb-library from atlanta-support to atlanta
  UPDATE sources SET owner_portal_id = atlanta_id
  WHERE slug = 'dekalb-library' AND owner_portal_id = support_id;

  UPDATE events SET portal_id = atlanta_id
  WHERE source_id = (SELECT id FROM sources WHERE slug = 'dekalb-library')
    AND portal_id = support_id;

  -- Ensure sharing rule exists for dekalb-library
  INSERT INTO source_sharing_rules (source_id, owner_portal_id, share_scope)
  SELECT id, atlanta_id, 'all'
  FROM sources WHERE slug = 'dekalb-library'
  ON CONFLICT (source_id) DO UPDATE SET share_scope = 'all', owner_portal_id = atlanta_id;

  -- Subscribe HelpATL to dekalb-library
  FOR src IN SELECT id FROM sources WHERE slug = 'dekalb-library'
  LOOP
    INSERT INTO source_subscriptions (subscriber_portal_id, source_id, subscription_scope, is_active)
    VALUES (helpatl_id, src.id, 'all', true)
    ON CONFLICT (subscriber_portal_id, source_id) DO UPDATE SET
      subscription_scope = 'all', is_active = true;
  END LOOP;

  -- Refresh materialized view
  REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
END $$;
```

- [ ] **Step 2: Push migration**

Run: `cd /Users/coach/Projects/LostCity && npx supabase db push --linked`

- [ ] **Step 3: Verify HelpATL now sees DeKalb Library events**

Query to confirm subscription is active and events are accessible.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260322820003_helpatl_library_subscriptions.sql
git commit -m "feat: subscribe HelpATL to DeKalb Library, move to atlanta portal

DeKalb Library events (ESL, financial literacy, civic workshops) are
civic content. Moves ownership from atlanta-support to atlanta and
subscribes HelpATL."
```

---

## Task 7: Permanently Deactivate Dead Immigration/Workforce Sources

**Files:**
- Create: `supabase/migrations/20260322820004_deactivate_dead_sources_permanent.sql`

### Why

Three sources were investigated by the crawler team and confirmed permanently dead:
- `irc-atlanta` — IRC national site has no local Atlanta event calendar
- `new-american-pathways` — Tribe Events API returns 404, plugin removed
- `worksource-atlanta` — Google Calendar abandoned since mid-2024

These should be permanently deactivated with clear health tags so no future agent re-activates them.

- [ ] **Step 1: Write the migration**

```sql
-- Permanently deactivate sources confirmed dead by crawler investigation 2026-03-22.

UPDATE sources SET is_active = false,
  health_tags = array_append(COALESCE(health_tags, '{}'), 'deactivated:permanently_dead')
WHERE slug IN (
  'irc-atlanta',              -- IRC national site, no local events page
  'new-american-pathways',    -- Tribe Events API 404, plugin removed
  'worksource-atlanta'        -- Google Calendar abandoned since mid-2024
) AND is_active = true;

-- Deactivate any future events
UPDATE events SET is_active = false
WHERE source_id IN (
  SELECT id FROM sources WHERE slug IN (
    'irc-atlanta', 'new-american-pathways', 'worksource-atlanta'
  )
) AND start_date >= CURRENT_DATE AND is_active = true;
```

- [ ] **Step 2: Push migration**

Run: `cd /Users/coach/Projects/LostCity && npx supabase db push --linked`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260322820004_deactivate_dead_sources_permanent.sql
git commit -m "fix: permanently deactivate 3 dead sources (IRC, New American Pathways, WorkSource)

Confirmed dead by crawler investigation: no crawlable event calendars
exist at these URLs. Tagged deactivated:permanently_dead to prevent
re-activation."
```

---

## Verification Checklist

After all tasks complete, verify the full impact:

- [ ] **Category distribution**: `community` dropped from 67% to under 30%. `civic` and `volunteer` each have 400+ events.
- [ ] **Duplicate sources**: `georgia-elections` and `atlanta-city-meetings` are inactive.
- [ ] **Dead subscriptions**: HelpATL no longer subscribes to DBSA, GriefShare, DivorceCare.
- [ ] **NAMI visibility**: NAMI Georgia public training events are visible (not `is_sensitive`). Support groups remain hidden.
- [ ] **Portal attribution**: `fulton-county-meetings` is owned by helpatl.
- [ ] **Library content**: DeKalb Library events visible in HelpATL feed.
- [ ] **TypeScript builds**: `npx tsc --noEmit` passes.
- [ ] **No regression**: Dry-run a few crawlers to confirm they still produce events with correct categories.

## What This Plan Does NOT Cover (Deferred)

- **HOA crawler error handling** — highest-leverage reliability fix, but separate concern. Track separately.
- **Venue image enrichment** — 34% is near ceiling for civic venues. Defer.
- **Cross-venue dedup** (Mobilize/Indivisible overlap) — needs pipeline-level fix to content hash, not a quick migration.
- **Latin American Association crawler rebuild** — only viable new immigration source, needs Playwright rewrite. Separate plan.
- **Senior services** — wrong portal audience per business strategy review.
- **Atlanta Housing Authority** — too few events (~3/year) to justify a source.
