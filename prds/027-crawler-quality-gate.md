# PRD 027: Event Quality Gate

**Status:** Approved v3
**Created:** 2026-03-04
**Updated:** 2026-03-04 (post-review corrections)
**Problem:** Every `insert_event()` goes straight to production. There's no quality gate between crawl and feed. We play whack-a-mole fixing bad data after users see it.

---

## The Problem

Today's pipeline: **Crawler → validate_event() → insert_event() → LIVE IN FEED**

The validation layer catches obviously broken data (missing title, bad dates, junk titles). But it can't catch **mediocre** data — events with no description, no time, no image, wrong category, fabricated prices. Those pass validation and go straight to the feed.

Result: every data quality issue is a regression visible to users. The audit found:
- ~80 crawlers with hardcoded start_time values
- ~142 crawlers with filler descriptions ("Event at [Venue]")
- ~15 crawlers with fabricated prices
- ~35 static schedule generators with no HTTP requests
- 100+ "Happy Hour" events with no description scoring 55-63/100
- Month-abbreviation titles ("MAR", "APR") scoring 55/100
- 491 skeleton events (no description AND no image) across all sources

---

## Why Score-Based Threshold Doesn't Work

We initially planned a weighted completeness score (the `data_quality` column, 0-100) with a feed threshold. Simulation against production data proved this ineffective:

**The baseline is too high.** Nearly every event has `venue_id` (15) + `category_id` (10) + `source_url` (5) + `is_free` (5) = **35 points** before any content fields. These are infrastructure fields crawlers always set.

| Threshold | Events held | % of 18,815 |
|-----------|------------|-------------|
| 35 | **2** | 0.0% |
| 50 | 527 | 2.8% |
| 60 | 921 | 4.9% |

**Known-bad events score well:** "Happy Hour" (no description) scores 55-63. "MAR"/"APR" score 55. The scoring measures field presence, not field quality.

---

## Design: Two-Layer Gate (Rules + Score)

### Layer 1: Rule-Based Feed Gate (DB trigger → `is_feed_ready` boolean)

Hard rules that block events from feed queries. Computed by a Postgres trigger on INSERT/UPDATE, stored as a boolean column.

| Rule | Pattern | What it catches | Action |
|------|---------|----------------|--------|
| Skeleton event | No description AND no image AND no series_id | Events with only a title | Hold from feed |
| Generic title, no context | Title in GENERIC_TITLES AND no description AND no series_id | "Happy Hour", "Open Mic" etc. with no detail | Hold from feed |
| Decontextualized title | Title matches `^(Round\|Game\|Match)\s+\d+$` AND no description | Sports without context | Hold from feed |
| Month-only title | Title matches `^(JAN\|FEB\|...)$` | Parser artifacts | Reject at insert |
| Date-range title | Title matches `^\w+ \d+, \d{4} to \w+` | MDA-style junk | Reject at insert |

**GENERIC_TITLES set** (events that are only useful with a description):
```
happy hour, open mic, trivia, trivia night, karaoke, karaoke night,
bingo, dj night, live music, brunch, sunday brunch, weekend brunch,
sunday brunch buffet, bottomless brunch, bottomless mimosa brunch,
jazz brunch, ladies night, wine night, date night, wing deal,
all day happy hour, oyster happy hour, taco tuesday,
tuesday dance night, drag nite, meditation
```

**Critical: `series_id IS NULL` guard.** Events with a `series_id` are structured recurring events (from Venue Specials Scraper, etc.) that were deliberately created. The Regular Hangs feature depends on these. Holding them would silently regress that feature. The `series_id` guard ensures only orphan generic-title events are held.

### Layer 2: Completeness Score (for ordering, not gating)

Keep the existing `data_quality` column (0-100) for **feed ranking** — higher-quality events sort earlier in each section. Not used as a pass/fail gate.

Compute inline at insert time using adjusted `EVENT_WEIGHTS`:

| Field | Points | Notes |
|-------|--------|-------|
| description (>10 chars) | 25 | Most impactful for UX (raised from 20) |
| image_url | 15 | Visual quality (lowered from 20) |
| venue_id | 15 | Must have a real venue |
| category_id | 10 | Must be categorized |
| start_time | 8 | When does it start? |
| price_min | 7 | What does it cost? |
| source_url | 5 | Link to original |
| is_free | 5 | Free or not? |
| end_date | 5 | Duration info |
| end_time | 5 | Duration info |
| **Total** | **100** | |

Penalty deductions for known-bad patterns:

| Penalty | Deduction | Detection |
|---------|-----------|-----------|
| Junk description | -20 | `is_junk_description()` match |
| Duplicate description (5+ events same source) | -10 | Hash + count |

---

## Where the Gate Lives

### Insert-time rejections (`db.py` → `validate_event_title()`)

New hard rejections — unambiguously junk, zero false positive risk:

```python
# Month-only titles ("MAR", "APR", etc.)
if re.match(r'^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)$', title, re.IGNORECASE):
    return False
# Date-range titles ("Apr 16, 2026 to Apr 19, 2026")
if re.match(r'^\w+ \d+,?\s*\d{4}\s+to\s+\w+ \d+', title, re.IGNORECASE):
    return False
# Parser artifacts ("Recurring", "1 event,12")
if re.match(r'^Recurring$', title, re.IGNORECASE):
    return False
if re.match(r'^\d+ events?,\d+$', title, re.IGNORECASE):
    return False
```

### DB trigger (`is_feed_ready` column)

A Postgres trigger computes `is_feed_ready` on `BEFORE INSERT OR UPDATE OF title, description, image_url, series_id`. The boolean column is the single filter for all feed queries.

### Shared feed query builder (API layer)

**Not per-route patches.** A shared `feedEventQuery()` function that every feed route uses:

```typescript
// lib/event-query.ts
export function applyFeedGate(query: SupabaseQuery): SupabaseQuery {
  return query
    .eq('is_feed_ready', true)
    .is('canonical_event_id', null)
    .or('is_class.eq.false,is_class.is.null')
    .or('is_sensitive.eq.false,is_sensitive.is.null');
}
```

Applied in all feed-facing routes (~20 routes, not 6 as originally estimated).

---

## Implementation Plan

### Phase 1: Harden insert-time rejections

**File:** `crawlers/db.py` → `validate_event_title()`

Add month-only, date-range, "Recurring", and numeric-event title rejection patterns.

**Impact:** ~25 events rejected at next crawl. Zero feed disruption.

### Phase 2: Add `is_feed_ready` column + trigger

**Migration:**

```sql
-- Column
ALTER TABLE events ADD COLUMN is_feed_ready BOOLEAN DEFAULT TRUE;

-- Partial index for feed queries
CREATE INDEX CONCURRENTLY idx_events_feed_ready_start_date
  ON events(start_date) WHERE is_feed_ready = true;

-- Trigger function
CREATE OR REPLACE FUNCTION compute_is_feed_ready() RETURNS TRIGGER AS $$
BEGIN
  -- Skeleton: no description AND no image AND no series → not ready
  IF NEW.description IS NULL AND NEW.image_url IS NULL AND NEW.series_id IS NULL THEN
    NEW.is_feed_ready := FALSE;
    RETURN NEW;
  END IF;

  -- Generic title with no description AND no series → not ready
  IF NEW.description IS NULL AND NEW.series_id IS NULL AND LOWER(TRIM(NEW.title)) IN (
    'happy hour', 'open mic', 'trivia', 'trivia night', 'karaoke', 'karaoke night',
    'bingo', 'dj night', 'live music', 'brunch', 'sunday brunch', 'weekend brunch',
    'sunday brunch buffet', 'bottomless brunch', 'bottomless mimosa brunch',
    'jazz brunch', 'ladies night', 'wine night', 'date night', 'wing deal',
    'all day happy hour', 'oyster happy hour', 'taco tuesday',
    'tuesday dance night', 'drag nite', 'meditation'
  ) THEN
    NEW.is_feed_ready := FALSE;
    RETURN NEW;
  END IF;

  -- Decontextualized title (Round N, Game N) with no description
  IF NEW.description IS NULL AND NEW.title ~* '^(Round|Game|Match)\s+\d+$' THEN
    NEW.is_feed_ready := FALSE;
    RETURN NEW;
  END IF;

  NEW.is_feed_ready := TRUE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on relevant columns (including series_id for the carve-out)
CREATE TRIGGER trg_compute_feed_ready
  BEFORE INSERT OR UPDATE OF title, description, image_url, series_id
  ON events FOR EACH ROW
  EXECUTE FUNCTION compute_is_feed_ready();

-- Backfill: let the trigger evaluate all future events
UPDATE events SET title = title WHERE start_date >= CURRENT_DATE;
```

**Impact:** ~595 events marked `is_feed_ready = FALSE`. Self-healing — when crawlers add descriptions/images, trigger auto-promotes on next update.

### Phase 3: Shared feed query builder + API wiring

**Create `web/lib/event-query.ts`** with `applyFeedGate()`.

Wire into all feed-facing routes. Key insertion points:
1. `buildEventQuery()` in `city-pulse/route.ts`
2. `baseFilters()` in `tonight/route.ts`
3. `applySearchFilters()` in `lib/search.ts` (covers Find + Timeline)
4. Happening Now in `happening-now/route.ts`
5. `search_events_ranked` RPC — add unconditional `AND (e.is_feed_ready IS NULL OR e.is_feed_ready = true)` inside the function
6. All other feed routes (legacy feed, trending, regulars, around-me, RSS, explore, outing-suggestions, playbook, PDF digest, showtimes, spots, venue events)

**NOT filtered:** Event detail page (`/event/[slug]`), admin views, crawler logs.

### Phase 4: Score at insert time

Compute `data_quality` inline in `insert_event()` after enrichment. Currently 79.3% of events have NULL scores — this fixes ordering for the entire corpus.

### Phase 5: Source quality dashboard + alerting

Dashboard query showing held events by source. Alert when a source's held% exceeds 30% — prevents the gate from silently hiding broken crawlers forever.

---

## Expected Impact (Verified Against Production Data)

| Rule | Events held | Sources affected |
|------|------------|-----------------|
| Skeleton (no desc + no image + no series) | 491 | Ticketmaster (265), Warrior Alliance (18), Trees Atlanta (16), + 38 others |
| Generic title + no desc + no series | 103 | Venue Specials Scraper (100), others |
| Round/Game/Match N + no desc | 1 | Monster Energy Supercross |
| **Total unique held** | **~595** | **~3.2% of 18,815 future events** |

**Zero false positives verified.** Every held event is genuinely information-free.
**Happy Hour with series_id: NOT held.** Regular Hangs feature preserved.

### Known False Negatives (out of scope, tracked separately)

- 874 events with boilerplate descriptions (Ticketmaster "X is a live music event" pattern)
- 9,108 events with no price data (60% of corpus)
- 153 events with suspicious midnight times
- Fabricated start_times from ~80 crawlers

These require crawler-by-crawler fixes, prioritized by the Phase 5 source dashboard.

---

## Execution Order

1. **Phase 1** (title rejections) — immediate, zero risk
2. **Phase 2** (is_feed_ready + trigger + backfill) — migration, zero app breakage
3. **Phase 3** (shared query builder + API wiring) — events start being filtered
4. **Phase 5** (source dashboard) — prioritized fix list for crawlers
5. **Phase 4** (score at insert) — ordering improvement

## Risks

- **Trigger column list is a contract.** `UPDATE OF title, description, image_url, series_id` — if future rules depend on other columns, they must be added to this list. Document this constraint.
- **Generic titles list lives in SQL trigger AND Python.** Must stay in sync manually. Acceptable for ~27 entries.
- **Gate hides broken crawlers.** Without Phase 5 alerting, held events accumulate silently. Phase 5 must follow Phase 3 closely.
