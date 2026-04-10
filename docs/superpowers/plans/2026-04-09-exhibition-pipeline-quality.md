# Exhibition Pipeline Quality Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 6 exhibition data quality issues as prerequisites before expanding the exhibition system to museums, zoos, and attractions.

**Architecture:** All changes are in the crawler pipeline layer — no schema migrations, no web UI changes. Each fix targets a specific source crawler or the shared exhibitions DB module. Fixes are independent and can be done in any order.

**Tech Stack:** Python, pytest, Supabase (PostgreSQL), BeautifulSoup/Playwright

**Spec:** `docs/superpowers/specs/2026-04-09-exhibition-system-expansion-design.md` — "Existing Data Quality Fixes" section

---

### Task 1: Fix Atlanta History Center 3x Duplication

**Root cause:** `atlanta_history_center.py` line 399 sets `start_date` to `today` (the current date). This flows to `build_exhibition_record()` at line 554 as `opening_date=record["start_date"]`. The content hash is generated from `(title, venue_id, opening_date)` — so each new crawl day produces a new hash, creating a duplicate row.

**Files:**
- Modify: `crawlers/sources/atlanta_history_center.py:399`
- Modify: `crawlers/sources/atlanta_history_center.py:554`
- Test: `crawlers/tests/test_atlanta_history_center.py`

- [ ] **Step 1: Write the failing test**

Add to `crawlers/tests/test_atlanta_history_center.py`:

```python
def test_parse_exhibition_record_does_not_use_today_as_start_date():
    """Exhibition start_date should come from the page, not today's date.

    Bug: start_date was set to `today` causing a new content hash each day,
    producing duplicate exhibition records on every crawl run.
    """
    html = """
    <html>
      <head><title>Test Exhibition | Atlanta History Center</title></head>
      <body>
        <main>
          <article>
            <h1>Cyclorama: The Big Picture</h1>
            <p>Through December 31, 2027</p>
            <p>Experience the fully restored 1886 painting of the Battle of Atlanta.</p>
          </article>
        </main>
      </body>
    </html>
    """
    soup = BeautifulSoup(html, "html.parser")

    record = _parse_exhibition_record(
        "https://www.atlantahistorycenter.com/explore/exhibitions/cyclorama/",
        soup,
        source_id=105,
        venue_id=211,
    )

    assert record is not None
    # start_date should NOT be today — it should be None or parsed from page
    assert record.get("start_date") != date.today(), (
        "start_date should not default to today — this causes daily hash collisions"
    )
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd crawlers && python -m pytest tests/test_atlanta_history_center.py::test_parse_exhibition_record_does_not_use_today_as_start_date -v`
Expected: FAIL — `start_date` currently equals `date.today()`

- [ ] **Step 3: Fix the start_date assignment**

In `crawlers/sources/atlanta_history_center.py`, change line 399 from:

```python
        "start_date": today,
```

to:

```python
        "start_date": None,
```

The `end_date` (closing date) already comes from page parsing. The opening date should be parsed from the page too, or left as `None` — the dedup hash will use `(title, venue_id, None)` which is stable across crawl runs.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd crawlers && python -m pytest tests/test_atlanta_history_center.py -v`
Expected: ALL PASS

- [ ] **Step 5: Clean up duplicate records in database**

Run this SQL against the database to deactivate duplicates, keeping the most recent record per title:

```sql
WITH ranked AS (
  SELECT id, title, created_at,
    ROW_NUMBER() OVER (PARTITION BY title ORDER BY created_at DESC) AS rn
  FROM exhibitions
  WHERE source_id = 105 AND is_active = true
)
UPDATE exhibitions SET is_active = false
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
```

Verify: `SELECT title, COUNT(*) FROM exhibitions WHERE source_id = 105 AND is_active = true GROUP BY title HAVING COUNT(*) > 1;` — should return 0 rows.

- [ ] **Step 6: Commit**

```bash
git add crawlers/sources/atlanta_history_center.py crawlers/tests/test_atlanta_history_center.py
git commit -m "fix(crawler): stop AHC exhibition 3x duplication

start_date was set to today on every crawl, causing a new content hash
each day and creating duplicate exhibition records. Set to None so the
hash is stable across runs."
```

---

### Task 2: Fix Kai Lin Junk Titles + Add Exhibition Title Validation

**Root cause:** The Kai Lin crawler's title extraction at line 125-128 grabs image button labels ("View fullsize") as titles. The `_JUNK_TITLE_RE` in `db/exhibitions.py` already blocks these on insert, but 19 existing records need cleanup. The crawler should also filter junk titles before attempting to build exhibition records.

**Files:**
- Modify: `crawlers/sources/kai_lin_art.py:125-128`
- Test: `crawlers/tests/test_exhibition_dedup.py` (existing tests already cover `_JUNK_TITLE_RE`)

- [ ] **Step 1: Write the failing test**

Add to `crawlers/tests/test_exhibition_dedup.py`:

```python
def test_junk_title_regex_catches_view_fullsize_variations():
    """Ensure all View Fullsize variations are caught by the junk filter."""
    from db.exhibitions import _JUNK_TITLE_RE

    junk = [
        "View Fullsize",
        "view fullsize",
        "VIEW FULLSIZE",
        "View  fullsize",  # double space
    ]
    for title in junk:
        assert _JUNK_TITLE_RE.match(title.strip()), f"Should catch {title!r}"
```

- [ ] **Step 2: Run test to verify it passes**

Run: `cd crawlers && python -m pytest tests/test_exhibition_dedup.py::test_junk_title_regex_catches_view_fullsize_variations -v`
Expected: PASS — the existing `_JUNK_TITLE_RE` already catches these (pattern starts with `view\s+fullsize`)

- [ ] **Step 3: Add crawler-side title filtering in Kai Lin**

In `crawlers/sources/kai_lin_art.py`, add an import at the top of the file:

```python
from db.exhibitions import _JUNK_TITLE_RE
```

Then after the title extraction block (after line 128, where `title = check_line` and `break`), add a guard:

```python
                            if title and _JUNK_TITLE_RE.match(title.strip()):
                                logger.debug("Skipping junk title: %s", title)
                                title = None
```

This filters junk titles at the crawler level before they reach `build_exhibition_record`.

- [ ] **Step 4: Clean up existing junk records**

```sql
UPDATE exhibitions SET is_active = false
WHERE title ILIKE 'View fullsize%' OR title ILIKE 'view  fullsize%';
```

Verify: `SELECT COUNT(*) FROM exhibitions WHERE title ILIKE '%view fullsize%' AND is_active = true;` — should return 0.

- [ ] **Step 5: Run full test suite**

Run: `cd crawlers && python -m pytest tests/test_exhibition_dedup.py -v`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add crawlers/sources/kai_lin_art.py crawlers/tests/test_exhibition_dedup.py
git commit -m "fix(crawler): filter Kai Lin junk titles at crawler level

Add _JUNK_TITLE_RE check after title extraction so 'View fullsize'
image button labels are skipped before reaching the exhibitions pipeline.
Deactivated 19 existing junk records."
```

---

### Task 3: Create High Museum Exhibitions Source Record

**Context:** `crawlers/sources/high_museum_exhibitions.py` is a complete, working crawler. It auto-discovers as slug `high-museum-exhibitions`. It just has no source record in the database, so it never runs.

**Files:**
- No code changes needed — just a database insert

- [ ] **Step 1: Verify the crawler file works with a dry run**

```bash
cd crawlers && python main.py --source high-museum-exhibitions --dry-run
```

If this fails with "source not found", the source record doesn't exist yet (expected). Proceed to step 2.

- [ ] **Step 2: Create the source record**

```sql
INSERT INTO sources (slug, name, url, is_active, crawl_frequency)
VALUES (
  'high-museum-exhibitions',
  'High Museum of Art (Exhibitions)',
  'https://high.org/exhibitions/',
  true,
  'weekly'
);
```

- [ ] **Step 3: Dry-run the crawler**

```bash
cd crawlers && python main.py --source high-museum-exhibitions --dry-run
```

Expected: Should report exhibitions found (likely 4-8). Verify the output shows proper titles, dates, and no junk (tours, programs, etc.).

- [ ] **Step 4: Production write run**

```bash
cd crawlers && python main.py --source high-museum-exhibitions --allow-production-writes
```

Verify: `SELECT title, opening_date, closing_date FROM exhibitions WHERE source_id = (SELECT id FROM sources WHERE slug = 'high-museum-exhibitions') AND is_active = true;`

- [ ] **Step 5: Commit** (no code changes, but document the activation)

```bash
git commit --allow-empty -m "ops: activate High Museum exhibitions source

Created source record for high-museum-exhibitions. Crawler file
already existed — just needed the DB registration to start running."
```

---

### Task 4: Suspend Whitespace Gallery No-Op Crawler

**Context:** `crawlers/sources/whitespace_gallery.py` is a documented no-op — the site uses ArtCloud (React-only), and the crawler always returns `(0, 0, 0)`. It runs twice weekly, logs success, and contributes nothing. Source ID 155.

**Files:**
- No code changes — database update only

- [ ] **Step 1: Confirm the no-op behavior**

```bash
cd crawlers && python main.py --source whitespace-gallery --dry-run
```

Expected: `found=0, new=0, updated=0` with a log message about ArtCloud.

- [ ] **Step 2: Deactivate the source**

```sql
UPDATE sources SET is_active = false WHERE id = 155;
```

- [ ] **Step 3: Verify**

```bash
cd crawlers && python main.py --source whitespace-gallery --dry-run
```

Expected: Should skip with "source is inactive" or similar message.

- [ ] **Step 4: Commit**

```bash
git commit --allow-empty -m "ops: deactivate Whitespace Gallery no-op crawler

Source 155 uses ArtCloud (React-only rendering). Crawler has always
returned (0,0,0). Deactivating to stop masking a coverage gap with
false success logs. Needs Playwright conversion to actually crawl."
```

---

### Task 5: Activate SCAD FASH Exhibition Crawler

**Context:** `crawlers/sources/scad_fash.py` has a complete Playwright-based crawler with PLACE_DATA. Source ID 399, currently `is_active = false`. Uses Playwright + Cloudflare fallback.

**Files:**
- No code changes expected — activation + validation

- [ ] **Step 1: Dry-run the crawler**

```bash
cd crawlers && python main.py --source scad-fash --dry-run
```

If source is inactive, temporarily activate:

```sql
UPDATE sources SET is_active = true WHERE id = 399;
```

Then re-run the dry run.

- [ ] **Step 2: Evaluate the output**

Check:
- Are exhibition titles real? (not junk/navigation text)
- Are dates parsed correctly?
- Does it produce > 0 results?

If Cloudflare blocks Playwright, the crawler should fall back to a catalog/PDF path. Verify the fallback works.

- [ ] **Step 3: Fix any issues found during dry run**

If the crawler errors or produces junk, fix the specific issue. If it works, proceed.

- [ ] **Step 4: Production write run (if dry run is clean)**

```bash
cd crawlers && python main.py --source scad-fash --allow-production-writes
```

- [ ] **Step 5: Commit any fixes**

```bash
git add crawlers/sources/scad_fash.py
git commit -m "fix(crawler): activate SCAD FASH exhibition crawler

Source 399 was inactive despite having a complete Playwright-based
crawler. [describe any fixes applied during activation]."
```

---

### Task 6: Activate Remaining Gallery Crawlers (ABV, Mint)

**Context:** ABV Gallery (source 156) and Mint Gallery (source 455) both have Playwright-based crawler files. Both are inactive. Poem88 (source 235) has a dead domain and should remain inactive.

**Files:**
- Possibly modify: `crawlers/sources/abv_gallery.py`, `crawlers/sources/mint_gallery.py`

- [ ] **Step 1: Dry-run ABV Gallery**

```sql
UPDATE sources SET is_active = true WHERE id = 156;
```

```bash
cd crawlers && python main.py --source abv-gallery --dry-run
```

Evaluate output — are exhibitions found? Are titles/dates valid?

- [ ] **Step 2: Fix ABV issues if any, then production write**

```bash
cd crawlers && python main.py --source abv-gallery --allow-production-writes
```

- [ ] **Step 3: Dry-run Mint Gallery**

```sql
UPDATE sources SET is_active = true WHERE id = 455;
```

```bash
cd crawlers && python main.py --source mint-gallery --dry-run
```

- [ ] **Step 4: Fix Mint issues if any, then production write**

```bash
cd crawlers && python main.py --source mint-gallery --allow-production-writes
```

- [ ] **Step 5: Confirm Poem88 stays inactive**

Poem88's domain has an SSL error and appears sold. Do NOT activate. Verify:

```sql
SELECT is_active FROM sources WHERE id = 235;
-- Should be false
```

- [ ] **Step 6: Commit**

```bash
git add crawlers/sources/abv_gallery.py crawlers/sources/mint_gallery.py
git commit -m "fix(crawler): activate ABV Gallery and Mint Gallery crawlers

Both had complete Playwright-based crawler files but were inactive.
Poem88 remains deactivated (domain SSL error, likely sold)."
```

---

### Task 7: Add `feature_type` Validation to `upsert_venue_feature`

**Root cause:** `upsert_venue_feature()` in `crawlers/db/places.py` accepts any string for `feature_type`. 26 records have `feature_type = 'space'` which isn't in the TypeScript union, causing raw "space" badges in the UI.

**Files:**
- Modify: `crawlers/db/places.py:1021-1037`
- Modify: `web/lib/place-features.ts:5-10`
- Test: new test in `crawlers/tests/test_entity_persistence.py` or dedicated test file

- [ ] **Step 1: Write the failing test**

Create `crawlers/tests/test_venue_feature_validation.py`:

```python
"""Tests for venue feature type validation."""

from db.places import upsert_venue_feature


def test_upsert_venue_feature_rejects_unknown_type_gracefully():
    """Unknown feature_type should default to 'attraction', not pass through."""
    # We can't easily test the DB write without mocking, but we can test
    # that the validation logic exists by checking the constant
    from db.places import _VALID_FEATURE_TYPES

    assert "attraction" in _VALID_FEATURE_TYPES
    assert "exhibition" in _VALID_FEATURE_TYPES
    assert "collection" in _VALID_FEATURE_TYPES
    assert "experience" in _VALID_FEATURE_TYPES
    assert "amenity" in _VALID_FEATURE_TYPES
    assert "space" not in _VALID_FEATURE_TYPES, "space is not a valid feature type"


def test_valid_feature_types_matches_typescript_union():
    """Python validation set must match TypeScript FeatureType union."""
    from db.places import _VALID_FEATURE_TYPES

    expected = {"attraction", "exhibition", "collection", "experience", "amenity"}
    assert _VALID_FEATURE_TYPES == expected
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd crawlers && python -m pytest tests/test_venue_feature_validation.py -v`
Expected: FAIL — `_VALID_FEATURE_TYPES` doesn't exist yet

- [ ] **Step 3: Add validation constant and logic**

In `crawlers/db/places.py`, add the constant near the top of the file (after imports):

```python
_VALID_FEATURE_TYPES = {"attraction", "exhibition", "collection", "experience", "amenity"}
```

Then in `upsert_venue_feature()`, before line 1021 (the `row = {` line), add:

```python
    feature_type = feature_data.get("feature_type", "attraction")
    if feature_type not in _VALID_FEATURE_TYPES:
        logger.warning(
            "upsert_venue_feature: unknown feature_type '%s' for '%s', defaulting to 'attraction'",
            feature_type, title,
        )
        feature_type = "attraction"
```

Then change line 1025 from:

```python
        "feature_type": feature_data.get("feature_type", "attraction"),
```

to:

```python
        "feature_type": feature_type,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd crawlers && python -m pytest tests/test_venue_feature_validation.py -v`
Expected: ALL PASS

- [ ] **Step 5: Fix existing `space` records**

```sql
UPDATE venue_features SET feature_type = 'amenity' WHERE feature_type = 'space';
```

Verify: `SELECT feature_type, COUNT(*) FROM venue_features GROUP BY feature_type ORDER BY count DESC;` — no `space` entries.

- [ ] **Step 6: Commit**

```bash
git add crawlers/db/places.py crawlers/tests/test_venue_feature_validation.py
git commit -m "fix(pipeline): add feature_type validation to upsert_venue_feature

Unknown feature_type values now default to 'attraction' with a warning.
Fixed 26 existing 'space' records to 'amenity'. Valid types match the
TypeScript FeatureType union: attraction, exhibition, collection,
experience, amenity."
```

---

### Task 8: Activate MOCA GA Exhibition Crawler

**Context:** MOCA GA (source 158) is Atlanta's dedicated contemporary art museum. The main crawler says "MOCA no longer maintains a usable /events page." There's also `exhibitions_moca_ga.py` (source 1918, if exists) targeting yearly exhibition pages. Need to determine which path works.

**Files:**
- Possibly modify: `crawlers/sources/exhibitions_moca_ga.py` or `crawlers/sources/moca_ga.py`
- Test: `crawlers/tests/test_moca_ga.py` (exists)

- [ ] **Step 1: Check which sources exist**

```sql
SELECT id, slug, name, is_active, crawl_frequency
FROM sources
WHERE slug ILIKE '%moca%';
```

- [ ] **Step 2: Dry-run the exhibitions crawler**

```bash
cd crawlers && python main.py --source exhibitions-moca-ga --dry-run
```

If this doesn't exist as a source, try:

```bash
cd crawlers && python main.py --source moca-ga --dry-run
```

- [ ] **Step 3: Evaluate and fix**

If the crawler returns 0 results:
- Check if `mocaga.org/2026-exhibitions/` is the correct URL pattern
- Try alternative paths (`/exhibitions/`, `/current-exhibitions/`)
- If the site requires Playwright, convert the crawler

If it works but the source is inactive:

```sql
UPDATE sources SET is_active = true WHERE slug = 'exhibitions-moca-ga';
```

- [ ] **Step 4: Production write run (if dry run is clean)**

```bash
cd crawlers && python main.py --source exhibitions-moca-ga --allow-production-writes
```

- [ ] **Step 5: Run existing tests**

```bash
cd crawlers && python -m pytest tests/test_moca_ga.py -v
```

- [ ] **Step 6: Commit**

```bash
git add crawlers/sources/exhibitions_moca_ga.py crawlers/sources/moca_ga.py
git commit -m "fix(crawler): activate MOCA GA exhibition crawler

[describe what was needed — activation only, or URL fix, or Playwright conversion]"
```

---

## Verification

After all tasks are complete, run these queries to verify the overall state:

```sql
-- Active exhibition count by source (should show new sources)
SELECT s.name, COUNT(e.id) as exhibitions
FROM exhibitions e
JOIN sources s ON e.source_id = s.id
WHERE e.is_active = true
GROUP BY s.name
ORDER BY exhibitions DESC;

-- No more AHC duplicates
SELECT title, COUNT(*) FROM exhibitions
WHERE source_id = 105 AND is_active = true
GROUP BY title HAVING COUNT(*) > 1;
-- Expected: 0 rows

-- No junk titles
SELECT COUNT(*) FROM exhibitions
WHERE title ILIKE '%view fullsize%' AND is_active = true;
-- Expected: 0

-- No invalid feature_types
SELECT feature_type, COUNT(*) FROM venue_features
WHERE feature_type NOT IN ('attraction', 'exhibition', 'collection', 'experience', 'amenity')
GROUP BY feature_type;
-- Expected: 0 rows

-- Whitespace inactive, SCAD FASH + ABV + Mint active
SELECT slug, is_active FROM sources
WHERE slug IN ('whitespace-gallery', 'scad-fash', 'abv-gallery', 'mint-gallery');
```

Run all crawler tests to confirm nothing is broken:

```bash
cd crawlers && python -m pytest tests/ -v --timeout=30
```
