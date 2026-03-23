# Event Data Quality Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the P0 and P1 data quality issues found during the 2026-03-23 audit — feed pollution, invalid dates, cross-source dupes, missing geocoding, and stale event accumulation.

**Architecture:** All fixes are at the ingestion/validation layer (`crawlers/db/`) or the feed query layer (`web/lib/city-pulse/`). No schema changes. Migrations handle backfills. Geocoding is a one-time script run.

**Tech Stack:** Python (crawlers), TypeScript/Next.js (web), PostgreSQL (Supabase), pytest, vitest

---

## Context: What the Audit Found

The 2026-03-23 data quality audit of 30,066 active future events surfaced:

- **77.8% of "art" events were false positives** — ALREADY FIXED this session (substring→regex in 25 crawlers + migration)
- **5,348 support_group events (AA/NA)** not excluded from consumer feed
- **284 cross-source duplicate events** (venue crawler + Ticketmaster producing same event twice)
- **92 events with raw HTML in descriptions** — `sanitize_text()` exists but these predate it or bypassed it
- **20 events with end_date < start_date** (Laughing Skull, Zoo Atlanta, Kai Lin Art)
- **3,418 events at venues with no coordinates** (220 venues with addresses but no geocoding)
- **3,451 stale non-recurring past events still active** (some from 2016)
- **~100 theater events miscategorized by Ticketmaster** (comedy/music tagged as theater)
- **~600 community events that belong in more specific categories**
- **140 events with price_min=0 but is_free=false**

## File Map

| File | Responsibility | Tasks |
|------|---------------|-------|
| `web/lib/city-pulse/pipeline/fetch-events.ts` | Feed query filters | 1 |
| `crawlers/db/validation.py` | Event validation rules | 2 |
| `crawlers/db/events.py` | Event insert/update pipeline | 3, 5, 7 |
| `crawlers/geocode_venues.py` | Venue geocoding script | 4 |
| `database/migrations/` + `supabase/migrations/` | Backfill migrations | 6 |

---

### Task 1: Exclude support_group and religious from consumer feed

AA/NA meetings (5,348 events) are the largest category. They are NOT excluded from the main feed query. A hotel guest should never see "Narcotics Anonymous Meeting" in their lineup.

**Files:**
- Modify: `web/lib/city-pulse/pipeline/fetch-events.ts`

- [ ] **Step 1: Find all instances of the category exclusion**

Search for every instance of `"(recreation,unknown)"` in `fetch-events.ts`. There are exactly 4 locations in the query builders:
- `buildEventQuery()` (~line 265) — main today pool
- `buildInterestQueries()` (~line 305)
- Evening supplemental query (~line 368)
- Trending query (~line 389)

Change each from:
```typescript
.not("category_id", "in", "(recreation,unknown)")
```
to:
```typescript
.not("category_id", "in", "(recreation,unknown,support_group,religious)")
```

- [ ] **Step 2: Check fetchNewFromSpots()**

`fetchNewFromSpots()` (~line 494) has NO category exclusion at all. If a user follows a venue that hosts AA meetings, those events would appear in "New from spots you follow". Add the same exclusion there:
```typescript
.not("category_id", "in", "(recreation,unknown,support_group,religious)")
```

- [ ] **Step 3: Verify TypeScript builds**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit`
Expected: Clean build

- [ ] **Step 4: Commit**

```bash
git add web/lib/city-pulse/pipeline/fetch-events.ts
git commit -m "fix: exclude support_group and religious events from consumer feed queries"
```

**NOTE:** Do NOT add `civic` or `volunteer` — those are legitimate for the main feed. `support_group` and `religious` are the only categories that should never appear in entertainment discovery.

---

### Task 2: Add end_date < start_date validation

20 events have impossible date ranges. Laughing Skull stores registration close dates as end_date. Zoo Atlanta carries forward prior-year end dates.

**Files:**
- Modify: `crawlers/db/validation.py` — `validate_event()` function

- [ ] **Step 1: Add fix inside the existing end_date try block**

In `validate_event()`, there's already a try block at lines 192-210 that parses `end_date_str` into `end_date_obj` and checks span > 30 days. Add the `end_date < start_date` fix INSIDE this existing try block (before the span check), reusing the already-parsed `end_date_obj`:

```python
    end_date_str = event_data.get("end_date")
    if end_date_str:
        try:
            end_date_obj = datetime.strptime(end_date_str, "%Y-%m-%d")
            # Auto-fix impossible range: end before start
            if end_date_obj.date() < event_date:
                event_data["end_date"] = start_date
                warnings.append(
                    f"Fixed end_date < start_date: was {end_date_str}, set to {start_date}"
                )
                _validation_stats.record_warning("end_date_before_start_fixed")
            else:
                # Existing span check (only when end_date is valid)
                span_days = (end_date_obj.date() - event_date).days
                # ... existing span > 30 check ...
        except (ValueError, TypeError):
            pass
```

We auto-fix rather than reject because the events are real (Laughing Skull comedy shows) — just the end_date is wrong.

- [ ] **Step 2: Run crawler tests**

Run: `cd /Users/coach/Projects/LostCity/crawlers && python -m pytest tests/ -x -q 2>&1 | tail -20`
Expected: All pass

- [ ] **Step 3: Commit**

```bash
git add crawlers/db/validation.py
git commit -m "fix: auto-correct end_date < start_date instead of storing impossible ranges"
```

---

### Task 3: Backfill HTML descriptions + add duplicate-title check

The audit found 92 events with raw HTML in descriptions. `sanitize_text()` already exists at `validation.py:60` and IS called on descriptions at `validation.py:315-319`. These 92 events either predate the sanitization code or were inserted via a path that bypassed `validate_event()`.

**Files:**
- Modify: `crawlers/db/validation.py` — add title-equals-description check
- Migration: backfill re-sanitize existing dirty descriptions

- [ ] **Step 1: Verify sanitize_text() is called on descriptions**

Read `crawlers/db/validation.py` lines 310-320. Confirm description sanitization already exists. If confirmed, the 92 dirty events are legacy data — fix via migration, not code change.

- [ ] **Step 2: Add description-equals-title check**

In `validate_event()`, after the description sanitization block (~line 319), add:

```python
    # Don't store description that's just the title repeated
    if description and sanitized_desc:
        if sanitized_desc.strip().lower() == title.strip().lower():
            event_data["description"] = None
            warnings.append("Cleared description identical to title")
            _validation_stats.record_warning("description_equals_title")
```

- [ ] **Step 3: Create backfill migration to re-sanitize existing dirty descriptions**

```bash
cd /Users/coach/Projects/LostCity
python3 database/create_migration_pair.py resanitize_html_descriptions
```

Write SQL that strips HTML from existing descriptions:

```sql
-- Re-sanitize descriptions containing HTML tags
UPDATE events
SET
  description = regexp_replace(
    regexp_replace(description, '<[^>]+>', ' ', 'g'),
    '\s+', ' ', 'g'
  ),
  updated_at = NOW()
WHERE description ~ '<[a-zA-Z/][^>]*>'
  AND is_active = true;
```

- [ ] **Step 4: Run tests + commit**

```bash
cd /Users/coach/Projects/LostCity/crawlers && python -m pytest tests/ -x -q
git add crawlers/db/validation.py database/migrations/ supabase/migrations/
git commit -m "fix: add description-equals-title check + backfill HTML descriptions"
```

---

### Task 4: Run geocoding on 220 venues with addresses but no coordinates

3,418 events are at venues with known addresses but no lat/lng — invisible on maps.

**Files:**
- Run: `crawlers/geocode_venues.py`

- [ ] **Step 1: Check how many venues need geocoding**

```bash
cd /Users/coach/Projects/LostCity/crawlers && source venv/bin/activate
python3 -c "
from db import get_client
client = get_client()
r = client.table('venues').select('id', count='exact').is_('lat', 'null').neq('address', '').execute()
print(f'Venues needing geocoding: {r.count}')
"
```

- [ ] **Step 2: Review geocoding script for city-center fallback**

Read `geocode_venues.py` lines 52-71. The script falls back to city center coordinates when an address fails. This is WORSE than NULL — it places venues at the wrong location on the map. Either disable the fallback or log which venues got city-center coords so they can be reviewed.

- [ ] **Step 3: Run geocoding script**

```bash
python3 geocode_venues.py
```

- [ ] **Step 4: Verify results**

```bash
python3 -c "
from db import get_client
client = get_client()
r = client.table('venues').select('id', count='exact').is_('lat', 'null').neq('address', '').execute()
print(f'Remaining venues without coords: {r.count}')
"
```

- [ ] **Step 5: No code commit needed (database-only change)**

---

### Task 5: Fix is_free normalization for price_min=0 events

140 events have `price_min=0` but `is_free=false`. Root cause: `_infer_is_free()` at line 810 returns the crawler's explicit `is_free` value first — if a crawler sets `is_free=False` explicitly while also setting `price_min=0`, the inference never reaches the `price_min==0` check at line 817.

**Files:**
- Modify: `crawlers/db/events.py` — `_step_set_flags()` post-processing (~lines 914-918)

- [ ] **Step 1: Add final is_free override after inference**

At lines 914-918 in `_step_set_flags()`, replace the existing price_min override logic with:

```python
    # Final is_free normalization — price_min=0 with no paid tiers is definitively free,
    # even if the crawler explicitly said is_free=False (common crawler default bug)
    if event_data.get("price_min") is not None:
        pm = float(event_data["price_min"])
        if pm == 0 and not event_data.get("price_max"):
            event_data["is_free"] = True
        elif pm > 0:
            event_data["is_free"] = False
    elif event_data.get("is_free") is False and event_data.get("price_min") is None:
        # is_free=False with no price data → unknown, not definitively paid
        event_data["is_free"] = None
```

- [ ] **Step 2: Run tests**

Run: `cd /Users/coach/Projects/LostCity/crawlers && python -m pytest tests/ -x -q 2>&1 | tail -20`

- [ ] **Step 3: Commit**

```bash
git add crawlers/db/events.py
git commit -m "fix: price_min=0 with no paid tiers forces is_free=true regardless of crawler setting"
```

---

### Task 6: Backfill migration — clean up existing bad data

Fix data already in the database. Run this BEFORE the pipeline fixes so verification queries show clean results.

**Files:**
- Create: new migration pair

- [ ] **Step 1: Create the cleanup migration**

```bash
cd /Users/coach/Projects/LostCity
python3 database/create_migration_pair.py data_quality_backfill
```

Write the migration:

```sql
-- ==========================================================================
-- Data Quality Backfill — 2026-03-23 audit findings
-- ==========================================================================

-- 1. Fix end_date < start_date (set end_date = start_date)
UPDATE events
SET end_date = start_date, updated_at = NOW()
WHERE end_date IS NOT NULL
  AND end_date < start_date
  AND is_active = true;

-- 2. Deactivate stale non-recurring events older than 7 days
--    Exclude multi-day events whose end_date is still in the future
UPDATE events
SET is_active = false, updated_at = NOW()
WHERE start_date < CURRENT_DATE - INTERVAL '7 days'
  AND is_active = true
  AND (is_recurring IS NULL OR is_recurring = false)
  AND series_id IS NULL
  AND (end_date IS NULL OR end_date < CURRENT_DATE);

-- 3. Deactivate cross-source duplicates
--    Keep venue-crawler copy, deactivate Ticketmaster/Eventbrite copy.
--    Only match titles >10 chars to avoid false matches on generic short titles.
--    Use explicit source priority (not ID ordering).
WITH dupes AS (
  SELECT DISTINCT ON (
    CASE WHEN s1.source_type = 'venue' THEN e2.id ELSE e1.id END
  )
    CASE WHEN s1.source_type = 'venue' THEN e1.id ELSE e2.id END as keep_id,
    CASE WHEN s1.source_type = 'venue' THEN e2.id ELSE e1.id END as dupe_id
  FROM events e1
  JOIN events e2 ON lower(e1.title) = lower(e2.title)
    AND e1.venue_id = e2.venue_id
    AND e1.start_date = e2.start_date
    AND COALESCE(e1.start_time, '00:00') = COALESCE(e2.start_time, '00:00')
    AND e1.id != e2.id
    AND e1.is_active AND e2.is_active
    AND e1.source_id != e2.source_id
    AND LENGTH(e1.title) > 10
  JOIN sources s1 ON e1.source_id = s1.id
  JOIN sources s2 ON e2.source_id = s2.id
  WHERE (s1.source_type = 'venue' AND s2.slug IN ('ticketmaster', 'ticketmaster-nashville', 'eventbrite', 'eventbrite-nashville'))
     OR (s2.source_type = 'venue' AND s1.slug IN ('ticketmaster', 'ticketmaster-nashville', 'eventbrite', 'eventbrite-nashville'))
)
UPDATE events
SET is_active = false, canonical_event_id = dupes.keep_id, updated_at = NOW()
FROM dupes
WHERE events.id = dupes.dupe_id;

-- 4. Fix Ticketmaster theater miscategorization → music
UPDATE events
SET category_id = 'music', updated_at = NOW()
WHERE source_id IN (SELECT id FROM sources WHERE slug LIKE 'ticketmaster%')
  AND category_id = 'theater'
  AND is_active = true
  AND (
    title ~* '\m(concert|symphony|orchestra|philharmonic|live music|country|bluegrass|jazz|rock|hip.hop|rap|r&b|reggae|edm|dj)\M'
    OR venue_id IN (SELECT id FROM venues WHERE venue_type IN ('music_venue', 'arena', 'amphitheater'))
  );

-- 5. Fix Ticketmaster theater miscategorization → comedy
UPDATE events
SET category_id = 'comedy', updated_at = NOW()
WHERE source_id IN (SELECT id FROM sources WHERE slug LIKE 'ticketmaster%')
  AND category_id = 'theater'
  AND is_active = true
  AND title ~* '\m(comedy|comedian|stand.up|standup|improv|funny|laugh)\M';

-- 6. Fix is_free for price_min=0 events
UPDATE events
SET is_free = true, updated_at = NOW()
WHERE price_min = 0
  AND (price_max IS NULL OR price_max = 0)
  AND is_free = false
  AND is_active = true;
```

- [ ] **Step 2: Mirror to supabase migrations**

Copy the same SQL to the supabase migrations file.

- [ ] **Step 3: Run the migration**

Execute via the Supabase client, verifying row counts for each UPDATE.

- [ ] **Step 4: Commit**

```bash
git add database/migrations/ supabase/migrations/
git commit -m "fix: data quality backfill — stale events, cross-source dupes, theater miscat, end_date, is_free"
```

---

### Task 7: Strengthen stale event rejection in pipeline

Prevent future accumulation of stale events. Currently `_step_check_past_date()` marks past events as inactive but still inserts them.

**Files:**
- Modify: `crawlers/db/events.py` — `_step_check_past_date()`

- [ ] **Step 1: Read the existing implementation**

Read `_step_check_past_date()` (~lines 386-399). Understand the current behavior and what `InsertContext` has available (does it have `series_hint`?).

- [ ] **Step 2: Strengthen with hard rejection for very stale events**

```python
def _step_check_past_date(event_data: dict, ctx: InsertContext) -> dict:
    start_date = event_data.get("start_date")
    if not start_date:
        return event_data
    try:
        event_date = datetime.strptime(start_date, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return event_data

    today = datetime.now().date()

    # Hard reject events more than 14 days old (unless recurring/series)
    # Use 14 days (not 7) to give crawlers slack for weekly recrawl cycles
    if event_date < today - timedelta(days=14):
        is_recurring = event_data.get("is_recurring", False)
        series_id = event_data.get("series_id")
        has_series_hint = ctx.series_hint is not None if hasattr(ctx, 'series_hint') else False
        # Also check content_hash for existing events (allow updates to old events)
        existing = find_event_by_hash(event_data.get("content_hash")) if event_data.get("content_hash") else None
        if not is_recurring and not series_id and not has_series_hint and not existing:
            raise ValueError(
                f"Rejecting stale event (start_date={start_date}, "
                f">14 days in past): {event_data.get('title', 'untitled')[:60]}"
            )

    # Mark yesterday/today-past as inactive (existing behavior)
    if event_date < today:
        event_data["is_active"] = False

    return event_data
```

Key safeguards:
- 14-day threshold (not 7) for crawler cycle slack
- Allows updates to existing events (`find_event_by_hash` check)
- Allows recurring events and events with series_hint
- Only rejects genuinely new stale inserts

- [ ] **Step 3: Run tests**

Run: `cd /Users/coach/Projects/LostCity/crawlers && python -m pytest tests/ -x -q 2>&1 | tail -20`

- [ ] **Step 4: Commit**

```bash
git add crawlers/db/events.py
git commit -m "fix: hard-reject non-recurring events >14 days in the past at insert time"
```

---

## Execution Order

**Wave 1 (immediate — user-facing, run migration first):**
- Task 6: Backfill migration (cleans existing data)
- Task 1: support_group exclusion from feed (web)
- Task 4: Geocoding run (database)

**Wave 2 (pipeline hardening — prevents recurrence):**
- Task 2: end_date validation
- Task 3: HTML description backfill + title-equals-description check
- Task 5: is_free normalization
- Task 7: stale event rejection

Wave 1 tasks are independent and can run in parallel.
Wave 2 tasks are independent and can run in parallel.
Wave 2 depends on Wave 1 (migration should land before pipeline fixes so verification is clean).

---

## Verification

After all tasks complete, re-run the audit queries:

```bash
cd /Users/coach/Projects/LostCity/crawlers && source venv/bin/activate
python3 -c "
from db import get_client
from datetime import date
client = get_client()
today = date.today().isoformat()

# end_date < start_date
r = client.table('events').select('id', count='exact').lt('end_date', 'start_date').eq('is_active', True).execute()
print(f'end_date < start_date: {r.count} (target: 0)')

# Stale non-recurring events (>7 days old)
r = client.table('events').select('id', count='exact').lt('start_date', '2026-03-16').eq('is_active', True).eq('is_recurring', False).is_('series_id', 'null').execute()
print(f'Stale non-recurring events: {r.count} (target: 0)')

# Venues without coords
r = client.table('venues').select('id', count='exact').is_('lat', 'null').neq('address', '').execute()
print(f'Venues without coords: {r.count} (target: <50)')

# is_free consistency
r = client.table('events').select('id', count='exact').eq('price_min', 0).is_('price_max', 'null').eq('is_free', False).eq('is_active', True).execute()
print(f'price_min=0 but is_free=false: {r.count} (target: 0)')
"
```

## Deferred (not in this plan)

- **Community category tightening** — The `community` catch-all problem is spread across ~80 per-crawler `categorize_event()` functions, not a single fallback in `tag_inference.py`. A targeted migration + post-classification check in `_step_normalize_category()` (events.py ~line 320) would work, but needs more investigation to avoid reclassifying legitimate community events. Defer to a separate plan.
- **Painting With a Twist source-level category override** — All 554 events are legitimate art but titles don't say "art". Needs `default_category` config on the source record.
- **Cinema description enrichment** — 105 film events missing descriptions. TMDB/OMDB pipeline gap. Separate from this data quality plan.
