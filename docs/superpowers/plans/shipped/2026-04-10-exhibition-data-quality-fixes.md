# Exhibition Data Quality Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three systemic data quality issues: 75% of exhibitions missing exhibition_type, 27 stale exhibitions still active, and crawl metrics inflated by pre-filter counts.

**Architecture:** Code-level fixes in the crawler pipeline (no new crawlers, no schema changes). Each fix is independent.

**Tech Stack:** Python, PostgreSQL, pytest

---

### Task 1: Default exhibition_type to 'group' When NULL

**Context:** 75% of exhibition records (185/247) have `exhibition_type = NULL` because older crawlers don't set this field. The `_exhibitions_base.py` defaults to `'group'` but crawlers calling `insert_exhibition()` directly don't get that default.

**Files:**
- Modify: `crawlers/db/exhibitions.py`
- Test: `crawlers/tests/test_exhibition_dedup.py`

- [ ] **Step 1: Write the failing test**

Add to `crawlers/tests/test_exhibition_dedup.py`:

```python
def test_insert_exhibition_defaults_exhibition_type_to_group():
    """When exhibition_type is not provided, it should default to 'group'."""
    from db.exhibitions import _EXHIBITION_COLUMNS

    # The column must be in the whitelist
    assert "exhibition_type" in _EXHIBITION_COLUMNS

    # Verify the default is applied in the insert path
    import inspect
    from db.exhibitions import insert_exhibition
    source = inspect.getsource(insert_exhibition)
    assert "exhibition_type" in source and "group" in source, (
        "insert_exhibition must default exhibition_type to 'group' when not provided"
    )
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/coach/Projects/LostCity/crawlers && python -m pytest tests/test_exhibition_dedup.py::test_insert_exhibition_defaults_exhibition_type_to_group -v
```

- [ ] **Step 3: Add the default in insert_exhibition**

In `crawlers/db/exhibitions.py`, in the `insert_exhibition()` function, after the title validation and before the hash generation, add:

```python
    # Default exhibition_type if not provided
    if not exhibition_data.get("exhibition_type"):
        exhibition_data["exhibition_type"] = "group"
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/coach/Projects/LostCity/crawlers && python -m pytest tests/test_exhibition_dedup.py -v
```

- [ ] **Step 5: Backfill existing NULL records**

```sql
UPDATE exhibitions SET exhibition_type = 'group'
WHERE exhibition_type IS NULL AND is_active = true;
```

Verify: `SELECT COUNT(*) FROM exhibitions WHERE exhibition_type IS NULL AND is_active = true;` — should be 0.

- [ ] **Step 6: Commit**

```bash
cd /Users/coach/Projects/LostCity
git add crawlers/db/exhibitions.py crawlers/tests/test_exhibition_dedup.py
git commit -m "fix(pipeline): default exhibition_type to 'group' when not provided

75% of exhibition records had NULL exhibition_type because older
crawlers don't set the field. Now defaults at insert time.
Backfilled 185 existing NULL records."
```

---

### Task 2: Auto-Deactivate Stale Exhibitions

**Context:** 27 exhibitions with past closing_date are still marked `is_active = true`. The crawler skips past exhibitions during ingestion but never deactivates existing records that have expired.

**Files:**
- Create: `crawlers/scripts/deactivate_past_exhibitions.py`
- Modify: `crawlers/post_crawl_report.py` (add call to deactivation)

- [ ] **Step 1: Create the deactivation script**

Create `crawlers/scripts/deactivate_past_exhibitions.py`:

```python
"""Deactivate exhibitions whose closing_date has passed.

Run as standalone script or called from post_crawl_report.
Does NOT deactivate exhibitions with NULL closing_date (permanent/ongoing).
"""

import logging
from datetime import date

from db.client import get_client, writes_enabled

logger = logging.getLogger(__name__)


def deactivate_past_exhibitions() -> int:
    """Deactivate exhibitions where closing_date < today. Returns count deactivated."""
    if not writes_enabled():
        logger.info("[DRY RUN] Would deactivate past exhibitions")
        return 0

    client = get_client()
    today = date.today().isoformat()

    result = (
        client.table("exhibitions")
        .update({"is_active": False})
        .eq("is_active", True)
        .lt("closing_date", today)
        .execute()
    )

    count = len(result.data) if result.data else 0
    if count:
        logger.info("Deactivated %d past exhibitions (closing_date < %s)", count, today)
    return count


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    deactivated = deactivate_past_exhibitions()
    print(f"Deactivated {deactivated} past exhibitions")
```

- [ ] **Step 2: Write a test**

Create `crawlers/tests/test_deactivate_past_exhibitions.py`:

```python
"""Tests for past exhibition deactivation."""


def test_deactivate_past_exhibitions_is_importable():
    from scripts.deactivate_past_exhibitions import deactivate_past_exhibitions
    assert callable(deactivate_past_exhibitions)
```

- [ ] **Step 3: Run test**

```bash
cd /Users/coach/Projects/LostCity/crawlers && python -m pytest tests/test_deactivate_past_exhibitions.py -v
```

- [ ] **Step 4: Wire into post_crawl_report**

In `crawlers/post_crawl_report.py`, import and call the function at the end of the report generation (after all crawls complete):

```python
from scripts.deactivate_past_exhibitions import deactivate_past_exhibitions
```

Add the call in the appropriate location (after crawl summary, before final report output):

```python
    # Deactivate exhibitions past their closing date
    past_count = deactivate_past_exhibitions()
    if past_count:
        report_lines.append(f"  Deactivated {past_count} past exhibitions")
```

- [ ] **Step 5: Run the script now to clean up existing stale records**

```bash
cd /Users/coach/Projects/LostCity/crawlers && python -m scripts.deactivate_past_exhibitions
```

Expected: "Deactivated 27 past exhibitions" (approximately).

Verify: `SELECT COUNT(*) FROM exhibitions WHERE is_active = true AND closing_date < CURRENT_DATE;` — should be 0.

- [ ] **Step 6: Commit**

```bash
cd /Users/coach/Projects/LostCity
git add crawlers/scripts/deactivate_past_exhibitions.py crawlers/tests/test_deactivate_past_exhibitions.py crawlers/post_crawl_report.py
git commit -m "feat(pipeline): auto-deactivate exhibitions past their closing date

Runs after each crawl cycle. Deactivates exhibitions where
closing_date < today. Does not touch NULL closing_date (permanent).
Cleaned up 27 stale records."
```

---

### Task 3: Fix crawl_log events_found Metric Inflation

**Context:** Exhibition crawlers count exhibitions found BEFORE applying the past-show filter. Source 1918 (MOCA GA) reports `events_found=7` but inserts 0 because all 7 are past shows. This misleads health monitoring.

**Files:**
- Modify: `crawlers/sources/_exhibitions_base.py`

- [ ] **Step 1: Read the base crawler and find the counting logic**

In `crawlers/sources/_exhibitions_base.py`, find where `found` is incremented. The count should happen AFTER the past-exhibition filter, not before.

- [ ] **Step 2: Move the count to after filtering**

The `crawl()` method in `ExhibitionCrawlerBase` has a loop like:

```python
for ex in exhibitions:
    found += 1  # This counts before filtering
    if closing and closing < today:
        continue
    # ... insert
```

Change to count only non-filtered exhibitions:

```python
for ex in exhibitions:
    if closing and closing < today:
        continue
    found += 1  # Count after filtering
    # ... insert
```

- [ ] **Step 3: Run existing exhibition tests**

```bash
cd /Users/coach/Projects/LostCity/crawlers && python -m pytest tests/ -k "exhibition" -v
```

- [ ] **Step 4: Commit**

```bash
cd /Users/coach/Projects/LostCity
git add crawlers/sources/_exhibitions_base.py
git commit -m "fix(pipeline): count exhibitions after past-show filter, not before

events_found metric was inflated by past exhibitions that get skipped.
MOCA GA reported found=7 but inserted 0. Now only counts exhibitions
that pass the date filter."
```

---

## Verification

After all tasks:

```sql
-- No NULL exhibition_types
SELECT COUNT(*) FROM exhibitions WHERE exhibition_type IS NULL AND is_active = true;
-- Expected: 0

-- No stale exhibitions
SELECT COUNT(*) FROM exhibitions WHERE is_active = true AND closing_date < CURRENT_DATE;
-- Expected: 0

-- Verify exhibition_type distribution
SELECT exhibition_type, COUNT(*) FROM exhibitions WHERE is_active = true
GROUP BY exhibition_type ORDER BY count DESC;
-- Should show 'group' as most common, no NULL
```
