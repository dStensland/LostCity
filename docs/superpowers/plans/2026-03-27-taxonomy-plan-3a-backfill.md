# Taxonomy Backfill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reclassify all active/future events using the new classification engine, populating legacy_category_id for rollback and updating category_id to new taxonomy values.

**Architecture:** One-time data migration script that runs all active events through `classify_rules()` from `crawlers/classify.py`. Saves the current `category_id` to `legacy_category_id` before overwriting. Runs in batches of 100 with progress logging. Has `--dry-run` and `--source-id` flags for safe incremental testing. After validation, triggers a `refresh_feed_events_ready()` call to sync the pre-computed feed table.

**Tech Stack:** Python 3, psycopg2/Supabase postgrest client, `crawlers/classify.py` (classify_rules + classify_event), `crawlers/db/` (events module), PostgreSQL

**Spec:** `docs/superpowers/specs/2026-03-27-event-taxonomy-redesign.md`

**Depends on:** Plan 1 (schema + constants) and Plan 2 (classification engine) must be complete. The `legacy_category_id` column, the new category rows in the `categories` table, and `crawlers/classify.py` must all exist before running this backfill.

---

### Task 1: Create the backfill script

**Files:**
- Create: `crawlers/scripts/backfill_taxonomy_v2.py`

- [ ] **Step 1: Confirm prerequisites exist**

```bash
cd /Users/coach/Projects/LostCity/crawlers
python -c "from classify import classify_rules, ClassificationResult; print('classify.py OK')"
python -c "import crawlers" 2>/dev/null || echo "run from crawlers/ dir"
```

Also verify the `legacy_category_id` column exists:
```bash
PGPASSWORD=Qf0g44tG84fAdpo7 psql -h db.rtppvljfrkjtoxmaizea.supabase.co -p 5432 -U postgres -d postgres \
  -c "\d events" | grep legacy_category_id
```

Expected: Column is present. If missing, Plan 1 must be applied first.

- [ ] **Step 2: Create the script**

Create `/Users/coach/Projects/LostCity/crawlers/scripts/backfill_taxonomy_v2.py`:

```python
#!/usr/bin/env python3
"""
Taxonomy v2 backfill script.

Reclassifies all active/future events using the new classification engine.
Saves the old category_id to legacy_category_id before overwriting.

Usage:
    # Dry run — shows what would change, writes nothing
    python scripts/backfill_taxonomy_v2.py --dry-run

    # Test on a single source first (recommended)
    python scripts/backfill_taxonomy_v2.py --source-id 554 --dry-run
    python scripts/backfill_taxonomy_v2.py --source-id 554

    # Full backfill (run after dry-run review)
    python scripts/backfill_taxonomy_v2.py

    # Limit batch processing for incremental runs
    python scripts/backfill_taxonomy_v2.py --batch-size 50 --max-batches 10
"""

from __future__ import annotations

import argparse
import logging
import sys
import os
from datetime import date
from collections import defaultdict

# Add parent directory to path so we can import from crawlers/
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import SUPABASE_URL, SUPABASE_KEY
from classify import classify_rules, ClassificationResult
from supabase import create_client, Client

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Source-level defaults — skip classification for high-volume deterministic sources
# ---------------------------------------------------------------------------

SOURCE_DEFAULTS: dict[int, dict] = {
    554:  {"category": "workshops", "genres": ["painting"]},   # Painting With a Twist
    808:  {"category": "workshops", "genres": []},              # Spruill Center
    1318: {"category": "education", "genres": ["technology"]}, # theCoderSchool
}

# Callanwolde (809) is NOT in source defaults — needs per-event classification
# because it has both workshops (classes) and art (exhibitions).


def get_supabase() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def fetch_event_batch(
    client: Client,
    offset: int,
    batch_size: int,
    source_id: int | None,
    today: str,
) -> list[dict]:
    """Fetch a batch of active/future events for reclassification."""
    query = (
        client.table("events")
        .select(
            "id, title, description, category_id, genres, source_id, "
            "venue_id, venues(name, venue_type)"
        )
        .eq("is_active", True)
        .gte("start_date", today)
        .is("canonical_event_id", None)
        .order("id", desc=False)
        .range(offset, offset + batch_size - 1)
    )

    if source_id is not None:
        query = query.eq("source_id", source_id)

    result = query.execute()
    return result.data or []


def classify_event_for_backfill(
    event: dict,
) -> ClassificationResult:
    """
    Run classification on a single event.
    Uses source-level defaults first, then rules-based classification.
    Does NOT invoke the LLM — this backfill uses rules only.
    LLM classification happens on new ingestion going forward.
    """
    source_id = event.get("source_id")

    # Source-level default
    if source_id in SOURCE_DEFAULTS:
        defaults = SOURCE_DEFAULTS[source_id]
        return ClassificationResult(
            category=defaults["category"],
            genres=defaults.get("genres", []),
            confidence=1.0,
            source="source_default",
        )

    venue_data = event.get("venues") or {}
    venue_type = venue_data.get("venue_type") if isinstance(venue_data, dict) else None

    return classify_rules(
        title=event.get("title") or "",
        description=event.get("description") or "",
        venue_type=venue_type,
    )


def apply_genre_scoping(category: str, genres: list[str]) -> list[str]:
    """
    Strip genres that don't belong to the new category.
    Import GENRES_BY_CATEGORY to validate.
    """
    try:
        from genre_normalize import GENRES_BY_CATEGORY
        valid = GENRES_BY_CATEGORY.get(category, set())
        return [g for g in genres if g in valid]
    except ImportError:
        return genres


def run_backfill(
    dry_run: bool,
    source_id: int | None,
    batch_size: int,
    max_batches: int | None,
) -> None:
    client = get_supabase()
    today = date.today().isoformat()

    logger.info(
        "Starting taxonomy v2 backfill: dry_run=%s source_id=%s batch_size=%d",
        dry_run,
        source_id,
        batch_size,
    )

    total_processed = 0
    total_changed = 0
    total_unchanged = 0
    total_errors = 0
    category_before: dict[str, int] = defaultdict(int)
    category_after: dict[str, int] = defaultdict(int)
    changes_log: list[dict] = []

    batch_num = 0
    offset = 0

    while True:
        if max_batches is not None and batch_num >= max_batches:
            logger.info("Reached max_batches=%d, stopping.", max_batches)
            break

        events = fetch_event_batch(client, offset, batch_size, source_id, today)
        if not events:
            logger.info("No more events at offset=%d, done.", offset)
            break

        batch_num += 1
        logger.info(
            "Batch %d: processing %d events (offset=%d)",
            batch_num,
            len(events),
            offset,
        )

        updates: list[dict] = []

        for event in events:
            try:
                old_cat = event.get("category_id") or "unknown"
                category_before[old_cat] += 1

                result = classify_event_for_backfill(event)

                if not result.category:
                    # No classification result — leave unchanged
                    category_after[old_cat] += 1
                    total_unchanged += 1
                    continue

                new_cat = result.category
                new_genres = apply_genre_scoping(new_cat, result.genres or [])
                category_after[new_cat] += 1

                changed = new_cat != old_cat

                if changed:
                    total_changed += 1
                    change_entry = {
                        "event_id": event["id"],
                        "title": (event.get("title") or "")[:60],
                        "old_category": old_cat,
                        "new_category": new_cat,
                        "confidence": result.confidence,
                        "source": result.source,
                    }
                    changes_log.append(change_entry)
                    logger.info(
                        "  CHANGE id=%d old=%s new=%s conf=%.2f title='%s'",
                        event["id"],
                        old_cat,
                        new_cat,
                        result.confidence,
                        change_entry["title"],
                    )
                else:
                    total_unchanged += 1

                if not dry_run:
                    updates.append({
                        "id": event["id"],
                        "legacy_category_id": old_cat,
                        "category_id": new_cat,
                        "genres": new_genres,
                    })

            except Exception as e:
                logger.error("Error on event id=%s: %s", event.get("id"), e)
                total_errors += 1
                continue

        # Batch upsert
        if not dry_run and updates:
            for upd in updates:
                try:
                    client.table("events").update({
                        "legacy_category_id": upd["legacy_category_id"],
                        "category_id": upd["category_id"],
                        "genres": upd["genres"],
                    }).eq("id", upd["id"]).execute()
                except Exception as e:
                    logger.error("DB update failed for id=%s: %s", upd["id"], e)
                    total_errors += 1

        total_processed += len(events)
        offset += batch_size

        if len(events) < batch_size:
            # Last page
            break

    # Summary
    logger.info("=" * 60)
    logger.info("BACKFILL COMPLETE")
    logger.info("  Mode:        %s", "DRY RUN" if dry_run else "LIVE WRITE")
    logger.info("  Source ID:   %s", source_id or "ALL")
    logger.info("  Processed:   %d", total_processed)
    logger.info("  Changed:     %d", total_changed)
    logger.info("  Unchanged:   %d", total_unchanged)
    logger.info("  Errors:      %d", total_errors)
    logger.info("")
    logger.info("Category distribution BEFORE:")
    for cat, count in sorted(category_before.items(), key=lambda x: -x[1]):
        logger.info("  %-20s %d", cat, count)
    logger.info("")
    logger.info("Category distribution AFTER:")
    for cat, count in sorted(category_after.items(), key=lambda x: -x[1]):
        logger.info("  %-20s %d", cat, count)
    logger.info("")

    if changes_log:
        logger.info("Sample of changes (first 20):")
        for ch in changes_log[:20]:
            logger.info(
                "  [%d] %s → %s (conf=%.2f) '%s'",
                ch["event_id"],
                ch["old_category"],
                ch["new_category"],
                ch["confidence"],
                ch["title"],
            )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Backfill taxonomy v2 classifications for all active/future events."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Log what would change without writing to the database.",
    )
    parser.add_argument(
        "--source-id",
        type=int,
        default=None,
        help="Only process events from this source_id (for incremental testing).",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=100,
        help="Number of events to process per batch (default: 100).",
    )
    parser.add_argument(
        "--max-batches",
        type=int,
        default=None,
        help="Stop after N batches (for incremental runs).",
    )
    args = parser.parse_args()

    run_backfill(
        dry_run=args.dry_run,
        source_id=args.source_id,
        batch_size=args.batch_size,
        max_batches=args.max_batches,
    )


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Verify the script is importable (no syntax errors)**

```bash
cd /Users/coach/Projects/LostCity/crawlers
python -m py_compile scripts/backfill_taxonomy_v2.py && echo "Syntax OK"
```

Expected: "Syntax OK" with no errors.

---

### Task 2: Test on source 554 (Painting With a Twist) — dry run

**Files:** None (reads DB, writes nothing in dry-run)

Painting With a Twist (source_id=554) is the ideal test target: ~651 events, currently miscategorized as "art", should all become "workshops". The source default handles it at 100% confidence, so you can validate the source-default path before touching any ambiguous events.

- [ ] **Step 1: Check current state of source 554**

```bash
PGPASSWORD=Qf0g44tG84fAdpo7 psql -h db.rtppvljfrkjtoxmaizea.supabase.co \
  -p 5432 -U postgres -d postgres \
  -c "SELECT category_id, count(*) FROM events \
      WHERE source_id = 554 AND is_active = true AND start_date >= CURRENT_DATE \
      GROUP BY category_id ORDER BY count DESC;"
```

Expected: Most rows show `category_id = 'art'`. Record this count for before/after comparison.

- [ ] **Step 2: Run dry-run for source 554**

```bash
cd /Users/coach/Projects/LostCity/crawlers
python scripts/backfill_taxonomy_v2.py --source-id 554 --dry-run
```

Expected output:
- All events should show `CHANGE: old=art new=workshops conf=1.0 source=source_default`
- Summary shows 100% of events changed
- No DB writes

- [ ] **Step 3: Verify the dry-run log is correct**

Review the output. Every event should flip from `art` to `workshops`. If any show a different destination, check whether `SOURCE_DEFAULTS` in the script has source_id 554 correct.

---

### Task 3: Live run on source 554

- [ ] **Step 1: Run live for source 554**

```bash
cd /Users/coach/Projects/LostCity/crawlers
python scripts/backfill_taxonomy_v2.py --source-id 554
```

Expected: All Painting With a Twist events updated. No errors.

- [ ] **Step 2: Verify in the database**

```bash
PGPASSWORD=Qf0g44tG84fAdpo7 psql -h db.rtppvljfrkjtoxmaizea.supabase.co \
  -p 5432 -U postgres -d postgres \
  -c "SELECT category_id, legacy_category_id, count(*) \
      FROM events \
      WHERE source_id = 554 AND is_active = true AND start_date >= CURRENT_DATE \
      GROUP BY category_id, legacy_category_id;"
```

Expected: All rows have `category_id = 'workshops'` and `legacy_category_id = 'art'`.

---

### Task 4: Full backfill — dry run

- [ ] **Step 1: Run full dry-run across all active/future events**

```bash
cd /Users/coach/Projects/LostCity/crawlers
python scripts/backfill_taxonomy_v2.py --dry-run 2>&1 | tee /tmp/backfill_dryrun.log
```

This may take 5–15 minutes depending on event count. The log will be large — that's expected.

- [ ] **Step 2: Review the category distribution from the dry-run**

```bash
grep "Category distribution AFTER" -A 30 /tmp/backfill_dryrun.log
```

Cross-check against expected distribution from the spec. Key things to verify:
- `nightlife` events should mostly disappear (reclassified to music, games, theater, dance)
- `community` events should be distributed across civic, volunteer, fitness, outdoors, etc.
- `family` events should shift to workshops, words, fitness, education
- `recreation` events should shift to fitness, games, sports
- `wellness` events should shift to fitness or support
- New categories (`games`, `workshops`, `education`, `dance`, `conventions`, `support`, `religious`) should have significant counts

- [ ] **Step 3: Spot-check specific changes in the log**

```bash
grep "CHANGE" /tmp/backfill_dryrun.log | grep -E "nightlife|community|family|recreation" | head -40
```

Manually review 10–20 changes for correctness. If a batch of events looks wrong (e.g., music events going to games), that indicates a classify.py bug — fix it before proceeding. Do NOT proceed with the live run if the dry-run shows systematic misclassification.

---

### Task 5: Full backfill — live run

Only proceed after the dry-run review passes the spot-check in Task 4.

- [ ] **Step 1: Record the current category distribution before writing**

```bash
PGPASSWORD=Qf0g44tG84fAdpo7 psql -h db.rtppvljfrkjtoxmaizea.supabase.co \
  -p 5432 -U postgres -d postgres \
  -c "SELECT category_id, count(*) FROM events \
      WHERE is_active = true AND start_date >= CURRENT_DATE \
      GROUP BY category_id ORDER BY count DESC;"
```

Save this output — it's your rollback baseline.

- [ ] **Step 2: Run the full live backfill**

```bash
cd /Users/coach/Projects/LostCity/crawlers
python scripts/backfill_taxonomy_v2.py 2>&1 | tee /tmp/backfill_live.log
```

Expected: Progress logs show batches being processed. Watch for error counts > 0 — if errors exceed 1% of total events, stop and investigate.

- [ ] **Step 3: Verify the post-backfill distribution**

```bash
PGPASSWORD=Qf0g44tG84fAdpo7 psql -h db.rtppvljfrkjtoxmaizea.supabase.co \
  -p 5432 -U postgres -d postgres \
  -c "SELECT category_id, count(*) FROM events \
      WHERE is_active = true AND start_date >= CURRENT_DATE \
      GROUP BY category_id ORDER BY count DESC;"
```

Compare to the dry-run's "AFTER" distribution. They should match closely. If a dissolved category (nightlife, community, family, recreation, wellness) still has a large count, some events weren't reclassified — investigate with:

```bash
PGPASSWORD=Qf0g44tG84fAdpo7 psql -h db.rtppvljfrkjtoxmaizea.supabase.co \
  -p 5432 -U postgres -d postgres \
  -c "SELECT id, title, category_id, legacy_category_id \
      FROM events \
      WHERE is_active = true AND start_date >= CURRENT_DATE \
      AND category_id = 'nightlife' \
      LIMIT 10;"
```

---

### Task 6: Per-category spot check (minimum 20 events per category)

- [ ] **Step 1: Query 20 events per new category and manually review**

```bash
PGPASSWORD=Qf0g44tG84fAdpo7 psql -h db.rtppvljfrkjtoxmaizea.supabase.co \
  -p 5432 -U postgres -d postgres \
  -c "SELECT id, title, category_id, legacy_category_id, array_to_string(genres, ',') as genres \
      FROM events \
      WHERE is_active = true AND start_date >= CURRENT_DATE \
      AND category_id = 'games' \
      ORDER BY random() LIMIT 20;" \
  --csv
```

Run this for each new category: `games`, `workshops`, `education`, `dance`, `conventions`, `support`, `religious`, `words`, `fitness`, `civic`, `volunteer`.

For each category, check:
- Do the event titles make sense for that category?
- Are there obvious misfits (e.g., a yoga class appearing in `games`)?
- Are the genres plausible for the category?

- [ ] **Step 2: Check dissolved category remnants**

```bash
PGPASSWORD=Qf0g44tG84fAdpo7 psql -h db.rtppvljfrkjtoxmaizea.supabase.co \
  -p 5432 -U postgres -d postgres \
  -c "SELECT category_id, count(*) FROM events \
      WHERE is_active = true AND start_date >= CURRENT_DATE \
      AND category_id IN ('nightlife', 'community', 'family', 'recreation', 'wellness', 'exercise', 'learning', 'support_group') \
      GROUP BY category_id ORDER BY count DESC;"
```

Expected: All dissolved categories should have 0 or near-0 counts. The backfill reclassifies all of them. If any have significant counts, those events didn't get classified (likely null title or other data issue). Accept residual counts < 10 per dissolved category — these will be cleaned up in Phase 5.

---

### Task 7: Refresh feed_events_ready

The pre-computed `feed_events_ready` table must be refreshed after backfill so the category changes take effect in the live feed. The `feed_events_ready` table was extended in Plan 1's migration to include `duration`, `cost_tier`, `significance`, and `audience_tags` columns.

- [ ] **Step 1: Update `refresh_feed_events_ready()` to include new columns**

The current function (lines 1929–2003 of `database/schema.sql`) does not include the new Phase 1 columns. Create a migration to update it.

Create `database/migrations/599_refresh_feed_events_ready_taxonomy_v2.sql` AND `supabase/migrations/20260327210000_refresh_feed_events_ready_taxonomy_v2.sql` with the same content:

```sql
-- Taxonomy v2: Update refresh_feed_events_ready() to copy new columns
-- (duration, cost_tier, significance, audience_tags added in migration 598)

CREATE OR REPLACE FUNCTION refresh_feed_events_ready(
  p_portal_id UUID DEFAULT NULL
)
RETURNS INT AS $$
DECLARE
  v_upserted INT := 0;
BEGIN
  IF p_portal_id IS NOT NULL THEN
    DELETE FROM feed_events_ready
    WHERE portal_id = p_portal_id
      AND start_date < CURRENT_DATE - 1;
  ELSE
    DELETE FROM feed_events_ready
    WHERE start_date < CURRENT_DATE - 1;
  END IF;

  INSERT INTO feed_events_ready (
    event_id, portal_id, title, start_date, start_time, end_date, end_time,
    is_all_day, is_free, price_min, price_max, category, genres, image_url,
    featured_blurb, tags, festival_id, is_tentpole, is_featured, series_id,
    is_recurring, source_id, organization_id, importance, data_quality,
    on_sale_date, presale_date, early_bird_deadline, sellout_risk, attendee_count,
    venue_id, venue_name, venue_slug, venue_neighborhood, venue_city, venue_type,
    venue_image_url, venue_active, series_name, series_type, series_slug,
    -- New taxonomy v2 columns (added in migration 598)
    duration, cost_tier, significance, audience_tags,
    refreshed_at
  )
  SELECT
    e.id, psa.portal_id, e.title, e.start_date, e.start_time, e.end_date, e.end_time,
    COALESCE(e.is_all_day, false), COALESCE(e.is_free, false), e.price_min, e.price_max,
    e.category_id, e.genres, e.image_url, e.featured_blurb, e.tags, e.festival_id,
    COALESCE(e.is_tentpole, false), COALESCE(e.is_featured, false), e.series_id,
    COALESCE(e.is_recurring, false), e.source_id, e.organization_id, e.importance,
    e.data_quality, e.on_sale_date, e.presale_date, e.early_bird_deadline, e.sellout_risk,
    COALESCE(e.attendee_count, 0),
    v.id, v.name, v.slug, v.neighborhood, v.city, v.venue_type, v.image_url,
    COALESCE(v.active, true), s.title, s.series_type, s.slug,
    -- New taxonomy v2 columns
    e.duration, e.cost_tier, e.significance,
    COALESCE(e.audience_tags, '{}'),
    now()
  FROM events e
  INNER JOIN portal_source_access psa ON psa.source_id = e.source_id
  LEFT JOIN venues v ON v.id = e.venue_id
  LEFT JOIN series s ON s.id = e.series_id
  WHERE
    e.is_active = true
    AND e.canonical_event_id IS NULL
    AND COALESCE(e.is_class, false) = false
    AND COALESCE(e.is_sensitive, false) = false
    AND COALESCE(e.is_feed_ready, true) = true
    AND e.start_date >= CURRENT_DATE - 1
    AND e.start_date <= CURRENT_DATE + 180
    AND (p_portal_id IS NULL OR psa.portal_id = p_portal_id)
  ON CONFLICT (event_id, portal_id) DO UPDATE SET
    title = EXCLUDED.title, start_date = EXCLUDED.start_date,
    start_time = EXCLUDED.start_time, end_date = EXCLUDED.end_date,
    end_time = EXCLUDED.end_time, is_all_day = EXCLUDED.is_all_day,
    is_free = EXCLUDED.is_free, price_min = EXCLUDED.price_min,
    price_max = EXCLUDED.price_max, category = EXCLUDED.category,
    genres = EXCLUDED.genres, image_url = EXCLUDED.image_url,
    featured_blurb = EXCLUDED.featured_blurb, tags = EXCLUDED.tags,
    festival_id = EXCLUDED.festival_id, is_tentpole = EXCLUDED.is_tentpole,
    is_featured = EXCLUDED.is_featured, series_id = EXCLUDED.series_id,
    is_recurring = EXCLUDED.is_recurring, source_id = EXCLUDED.source_id,
    organization_id = EXCLUDED.organization_id, importance = EXCLUDED.importance,
    data_quality = EXCLUDED.data_quality, on_sale_date = EXCLUDED.on_sale_date,
    presale_date = EXCLUDED.presale_date,
    early_bird_deadline = EXCLUDED.early_bird_deadline,
    sellout_risk = EXCLUDED.sellout_risk, attendee_count = EXCLUDED.attendee_count,
    venue_id = EXCLUDED.venue_id, venue_name = EXCLUDED.venue_name,
    venue_slug = EXCLUDED.venue_slug, venue_neighborhood = EXCLUDED.venue_neighborhood,
    venue_city = EXCLUDED.venue_city, venue_type = EXCLUDED.venue_type,
    venue_image_url = EXCLUDED.venue_image_url, venue_active = EXCLUDED.venue_active,
    series_name = EXCLUDED.series_name, series_type = EXCLUDED.series_type,
    series_slug = EXCLUDED.series_slug,
    duration = EXCLUDED.duration, cost_tier = EXCLUDED.cost_tier,
    significance = EXCLUDED.significance, audience_tags = EXCLUDED.audience_tags,
    refreshed_at = EXCLUDED.refreshed_at;

  GET DIAGNOSTICS v_upserted = ROW_COUNT;
  RETURN v_upserted;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_feed_events_ready(UUID) IS
  'Upserts feed_events_ready for all portals (or just p_portal_id when specified). '
  'Prunes rows with start_date < CURRENT_DATE - 1. '
  'Returns the number of rows upserted. '
  'Now includes taxonomy v2 columns: duration, cost_tier, significance, audience_tags.';
```

Also update the INSERT and ON CONFLICT sections of `database/schema.sql` at lines 1945–1998 to match this new function body.

- [ ] **Step 2: Apply the migration**

```bash
PGPASSWORD=Qf0g44tG84fAdpo7 psql -h db.rtppvljfrkjtoxmaizea.supabase.co \
  -p 5432 -U postgres -d postgres \
  -f /Users/coach/Projects/LostCity/database/migrations/599_refresh_feed_events_ready_taxonomy_v2.sql
```

Expected: No errors.

- [ ] **Step 3: Run the refresh**

```bash
PGPASSWORD=Qf0g44tG84fAdpo7 psql -h db.rtppvljfrkjtoxmaizea.supabase.co \
  -p 5432 -U postgres -d postgres \
  -c "SELECT refresh_feed_events_ready();"
```

Expected: Returns a large positive integer (the number of feed rows upserted). Typical value: 5,000–30,000 rows depending on portal count and event count.

- [ ] **Step 4: Verify the refresh populated new columns**

```bash
PGPASSWORD=Qf0g44tG84fAdpo7 psql -h db.rtppvljfrkjtoxmaizea.supabase.co \
  -p 5432 -U postgres -d postgres \
  -c "SELECT category, count(*) FROM feed_events_ready GROUP BY category ORDER BY count DESC LIMIT 20;"
```

Expected: New taxonomy categories appear (games, workshops, education, etc.). Dissolved categories (nightlife, community, family) should have 0 or near-0 counts.

---

### Task 8: Rollback procedure (keep on hand, don't run unless needed)

If the backfill produces bad results, `legacy_category_id` enables full rollback:

```sql
-- ROLLBACK: Restore category_id from legacy_category_id
-- Only run this if the backfill was wrong.
UPDATE events
SET category_id = legacy_category_id,
    legacy_category_id = NULL
WHERE legacy_category_id IS NOT NULL
  AND is_active = true
  AND start_date >= CURRENT_DATE;

-- Then re-run the feed refresh
SELECT refresh_feed_events_ready();
```

---

### Task 9: Commit

- [ ] **Step 1: Commit the backfill script and migration**

```bash
cd /Users/coach/Projects/LostCity
git add crawlers/scripts/backfill_taxonomy_v2.py \
        database/migrations/599_refresh_feed_events_ready_taxonomy_v2.sql \
        supabase/migrations/20260327210000_refresh_feed_events_ready_taxonomy_v2.sql \
        database/schema.sql
git commit -m "feat(taxonomy): backfill script v2 + refresh_feed_events_ready with new columns"
```
