# Taxonomy Platform Quality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the three root causes of ongoing data quality drift in the taxonomy pipeline: (1) library crawlers using keyword matching when BiblioCommons already provides category type IDs, (2) ACTIVENet county parks crawlers pulling adult programs into family-attributed events, and (3) confidence threshold tuning after two weeks of production CLASSIFY_V2 data.

**Architecture:** All fixes are upstream (crawler layer), not downstream (DB patches or frontend workarounds). Task 1 extends `fulton_library.py`'s `determine_category()` to consume BiblioCommons `typeIds` before falling back to keyword matching. Task 2 extends `atlanta_dpr.py` (and the same pattern to other ACTIVENet crawlers) to filter adult programs using `is_family_relevant_activity()` from the existing `_activecommunities_family_filter.py`. Task 3 is data analysis + threshold adjustment.

**Tech Stack:** Python 3.12, BiblioCommons Events API, ACTIVENet REST API, Supabase SQL (for analysis), pytest

---

## Context: What already exists

- `crawlers/sources/fulton_library.py` — uses `determine_category(title, description, type_ids)` at line ~618 but the function ignores `type_ids` entirely (see line 338-357: only uses title/description keyword matching, `type_ids` parameter is unused)
- `crawlers/sources/gwinnett_library.py`, `cobb_library.py`, `dekalb_library.py` — likely same BiblioCommons pattern; audit before assuming
- BiblioCommons Events API returns `typeIds` in `defn.get("typeIds", [])` at crawl time and includes event type data in `entities.eventTypes` in the API response
- `crawlers/sources/atlanta_dpr.py` — imports `is_family_relevant_activity` from `_activecommunities_family_filter.py` (line 60-65) but check whether it actually calls it or just imports it
- `crawlers/sources/_activecommunities_family_filter.py` — `is_family_relevant_activity(name, desc_text, age_min, age_max, category, tags)` returns True when activity belongs in Family portal
- `crawlers/sources/_activecommunities_family_filter.py` — `normalize_activecommunities_age(raw)` converts ACTIVENet's `0` sentinel value to `None`
- `CLASSIFY_V2_ENABLED` env flag controls whether the classify pipeline runs — check `crawlers/classify_orchestrator.py` or similar for how this is used
- Golden test set in `crawlers/tests/` — contains manually classified events for accuracy validation

---

## Task 1: BiblioCommons type ID → category mapping in library crawlers

**Why:** BiblioCommons has its own event type taxonomy. The API returns `typeIds` per event and the full type objects in `entities.eventTypes`. Using this as a first-pass signal is higher fidelity than keyword matching on title+description, which misses cases like "Fun with Science" (Education) or "Lego Club" (Games).

**Files:**
- `crawlers/sources/fulton_library.py`
- `crawlers/sources/gwinnett_library.py`
- `crawlers/sources/cobb_library.py`
- `crawlers/sources/dekalb_library.py`

### Step 1a: Audit the other library crawlers to confirm they use the same BiblioCommons API

- [ ] Check whether the other library crawlers follow the same pattern as `fulton_library.py`:

```bash
grep -n "typeIds\|eventTypes\|bibliocommons\|BiblioCommons" \
  /Users/coach/Projects/LostCity/crawlers/sources/gwinnett_library.py \
  /Users/coach/Projects/LostCity/crawlers/sources/cobb_library.py \
  /Users/coach/Projects/LostCity/crawlers/sources/dekalb_library.py \
  2>/dev/null | head -30
```

If the other library crawlers use a different API or HTML scraping, only apply changes to `fulton_library.py` and note the discrepancy.

### Step 1b: Inspect the live BiblioCommons API response to find event type labels

- [ ] Make a test request to the Fulton library API to see what `entities.eventTypes` looks like:

```bash
curl -s "https://gateway.bibliocommons.com/v2/libraries/fulcolibrary/events?page=1&pageSize=3" \
  -H "accept: application/json" | python3 -c "
import json, sys
data = json.load(sys.stdin)
types = data.get('entities', {}).get('eventTypes', {})
print('Event type IDs and labels:')
for tid, tobj in list(types.items())[:20]:
    print(f'  {tid}: {tobj}')
"
```

Document the output. The labels will be strings like "Children's Programs", "Teens", "Story Time", "Technology", "Health & Wellness", etc.

### Step 1c: Add type ID → category mapping to fulton_library.py

- [ ] Open `crawlers/sources/fulton_library.py`. Add a new dict after `CATEGORY_MAP` (around line 166):

```python
# BiblioCommons event type name → LostCity category.
# These are the string labels returned in entities.eventTypes[id].name.
# Applied BEFORE keyword matching so source-provided type wins.
# Keys are lowercase normalized for matching.
BIBLIOCOMMONS_TYPE_MAP: dict[str, str] = {
    # Populate this after running the audit curl above.
    # Example structure — replace with actual labels from the API:
    "story time": "words",
    "storytime": "words",
    "book club": "words",
    "author": "words",
    "reading": "words",
    "literacy": "words",
    "children's programs": "education",
    "kids": "education",
    "teens": "education",
    "technology": "education",
    "computer": "education",
    "stem": "education",
    "health & wellness": "fitness",
    "fitness": "fitness",
    "arts & crafts": "workshops",
    "crafts": "workshops",
    "music": "music",
    "film": "film",
    "movies": "film",
    "game": "games",
    "games": "games",
    "civic": "civic",
    "community": "civic",
}
```

IMPORTANT: The actual keys must come from the API response you inspected in step 1b. Replace the examples above with the real labels. Do not guess.

- [ ] Modify `determine_category()` to accept and use the type entities, with type IDs as first-pass signal:

```python
def determine_category(
    title: str,
    description: str,
    type_ids: list,
    entities: dict | None = None,
) -> str:
    """
    Determine event category, checking BiblioCommons event types first.

    Priority:
    1. BiblioCommons eventTypes label → BIBLIOCOMMONS_TYPE_MAP (highest confidence)
    2. Title+description keyword matching → CATEGORY_MAP (fallback)
    3. "education" default (safest for unmatched library events)
    """
    # Step 1: Try source-provided type IDs
    if type_ids and entities:
        type_lookup = entities.get("eventTypes", {})
        for type_id in type_ids:
            type_obj = type_lookup.get(str(type_id), {})
            type_label = (type_obj.get("name") or type_obj.get("label") or "").strip().lower()
            if type_label and type_label in BIBLIOCOMMONS_TYPE_MAP:
                return BIBLIOCOMMONS_TYPE_MAP[type_label]
            # Partial match: check if any map key is a substring of the label
            for key, category in BIBLIOCOMMONS_TYPE_MAP.items():
                if key in type_label:
                    return category

    # Step 2: Keyword matching on title + description
    text = f"{title} {description}".lower()
    for keyword, category in CATEGORY_MAP.items():
        if re.search(r'\b' + re.escape(keyword) + r'\b', text):
            return category

    return "education"
```

- [ ] Update the call to `determine_category()` in the `crawl()` function (around line 618) to pass `all_entities`:

```python
category = determine_category(title, description, defn.get("typeIds", []), all_entities)
```

- [ ] Run a dry-run crawl on Fulton library to verify no crashes:

```bash
cd /Users/coach/Projects/LostCity/crawlers
source venv/bin/activate
python3 main.py --source fulton-county-library --dry-run 2>&1 | tail -20
```

- [ ] If the other library crawlers use the same BiblioCommons API (confirmed in step 1a), apply the same changes to them. If they use a different API, skip and note.

---

## Task 2: ACTIVENet audience filter — filter adult programs from family attribution

**Why:** Atlanta DPR (and other county parks ACTIVENet crawlers) pull ALL programs from the catalog, including senior fitness, adult swimming, and "Primetime" 55+ programs. These get tagged as family events because the crawler doesn't filter by audience at ingestion time.

**Files:**
- `crawlers/sources/atlanta_dpr.py`
- `crawlers/sources/_activecommunities_family_filter.py` — `is_family_relevant_activity()` already exists

### Step 2a: Audit how atlanta_dpr.py currently uses is_family_relevant_activity

- [ ] Check the actual usage in `atlanta_dpr.py`:

```bash
grep -n "is_family_relevant_activity\|age_min\|age_max\|age_min_year\|age_max_year\|audience_tags\|FAMILY" \
  /Users/coach/Projects/LostCity/crawlers/sources/atlanta_dpr.py | head -30
```

If `is_family_relevant_activity` is imported but never called, that's the bug. If it is called, check whether the result is used to gate portal attribution.

### Step 2b: Find where age fields are extracted in atlanta_dpr.py

- [ ] Read the section of `atlanta_dpr.py` that processes each activity item to understand what age fields are available:

```bash
grep -n "age_min\|age_max\|age_min_year\|age_max_year\|ages\|audience" \
  /Users/coach/Projects/LostCity/crawlers/sources/atlanta_dpr.py | head -20
```

The ACTIVENet API returns `age_min_year` and `age_max_year` per activity. The `normalize_activecommunities_age()` function in `_activecommunities_family_filter.py` converts ACTIVENet's `0` sentinel to `None`.

### Step 2c: Add family relevance filtering to the crawl loop

- [ ] Open `crawlers/sources/atlanta_dpr.py`. Find the section in the crawl loop where event records are built (the section that calls `insert_event()`). Before building the event record, add a family relevance check.

The pattern should be:

```python
# --- After extracting age_min_year and age_max_year from the activity item ---

from sources._activecommunities_family_filter import (
    is_family_relevant_activity,
    normalize_activecommunities_age,
    parse_age_from_name,
)

# Normalize ACTIVENet age sentinels (0 means "no restriction", not "infant")
raw_age_min = item.get("age_min_year")
raw_age_max = item.get("age_max_year")
age_min = normalize_activecommunities_age(raw_age_min)
age_max = normalize_activecommunities_age(raw_age_max)

# Fallback: parse age range from activity name if API didn't provide it
if age_min is None and age_max is None:
    age_min, age_max = parse_age_from_name(activity_name)

# Infer audience_tags from age range
audience_tags = []
if age_min is not None and age_max is not None:
    if age_max <= 3:
        audience_tags.append("toddler")
    elif age_max <= 5:
        audience_tags.append("preschool")
    elif age_max <= 11:
        audience_tags.append("kids")
    elif age_max <= 17:
        audience_tags.append("teen")
elif age_min is not None and age_min >= 18:
    audience_tags.append("adults")

# Determine if this activity belongs in the family portal lane
family_relevant = is_family_relevant_activity(
    name=activity_name,
    desc_text=description or "",
    age_min=age_min,
    age_max=age_max,
    category=category,
    tags=current_tags,
)

# Skip adult-only programs (age_min >= 18, or "senior"/"55+"/"adult" signals)
# from family attribution. They still get stored but portal attribution stays None.
if not family_relevant:
    # Store but don't attribute to family portal — portal_id stays as source default
    # (which is 'atlanta' for DPR, not 'family')
    pass
```

NOTE: The portal attribution mechanism in this codebase is set via `source.owner_portal_id`, not per-event. "Filtering" adult programs from the family portal means NOT tagging them with family audience tags, so the Family portal's `is_family_relevant_activity` gate in the API works correctly. The events still exist in the base Atlanta portal.

Actually set `age_min`, `age_max`, and `audience_tags` on the event record:

```python
event_record = {
    # ... existing fields ...
    "age_min": age_min,
    "age_max": age_max,
    "audience_tags": audience_tags if audience_tags else None,
}
```

- [ ] Verify `events` table has `age_min`, `age_max`, and `audience_tags` columns by checking schema.sql:

```bash
grep -n "age_min\|age_max\|audience_tags" /Users/coach/Projects/LostCity/database/schema.sql | head -10
```

If `audience_tags` column does not exist in the events table, that column was added in the Phase 1 migration (`20260326300001_taxonomy_redesign_phase1.sql`). Confirm it exists in the DB before using it.

- [ ] Run a dry-run crawl to verify the changes work without crashing:

```bash
cd /Users/coach/Projects/LostCity/crawlers
source venv/bin/activate
python3 main.py --source atlanta-dpr --dry-run 2>&1 | tail -30
```

- [ ] Audit how many adult programs get filtered. Add a log count:

```python
adult_skipped = 0
family_included = 0
# ... in the loop ...
if not family_relevant:
    adult_skipped += 1
else:
    family_included += 1
# ... after loop ...
logger.info(f"Family filter: {family_included} family-relevant, {adult_skipped} adult/non-family skipped from family attribution")
```

### Step 2d: Apply the same pattern to other ACTIVENet crawlers

- [ ] Check which other crawlers use ACTIVENet and whether they need the same treatment:

```bash
grep -rl "activecommunities\|ACTIVENet\|apm.activecommunities" \
  /Users/coach/Projects/LostCity/crawlers/sources/ 2>/dev/null | grep -v "_activecommunities"
```

For each ACTIVENet crawler found, check whether it already uses `is_family_relevant_activity`. If not, apply the same pattern from Step 2c.

---

## Task 3: Confidence threshold tuning

**Dependency:** This task requires at least 2 weeks of production data with `CLASSIFY_V2_ENABLED=1`. Do not run this task before that data exists.

**Files:**
- `crawlers/classify.py` — `CONFIDENCE_THRESHOLD = 0.7` at line 37
- `crawlers/tests/golden_set.json` (or wherever the golden test set lives — check `crawlers/tests/`)

### Step 3a: Check for production classification data

- [ ] Verify classification data exists by running this SQL in Supabase:

```sql
-- Check how many events have been classified by the v2 pipeline
SELECT
  classification_prompt_version,
  COUNT(*) as total,
  COUNT(CASE WHEN cost_tier IS NOT NULL THEN 1 END) as with_cost_tier,
  COUNT(CASE WHEN duration IS NOT NULL THEN 1 END) as with_duration,
  COUNT(CASE WHEN significance IS NOT NULL THEN 1 END) as with_significance
FROM events
WHERE classification_prompt_version IS NOT NULL
GROUP BY classification_prompt_version
ORDER BY total DESC;

-- If no rows returned, CLASSIFY_V2 hasn't run yet — stop here
```

If `classification_prompt_version IS NOT NULL` returns 0 rows, the v2 classifier has not been enabled in production. Stop and note that this task is blocked on enabling `CLASSIFY_V2_ENABLED=1`.

### Step 3b: Pull confidence score distribution from events

- [ ] This query is only meaningful if classification scores were logged. Check whether confidence scores are stored on events:

```bash
grep -n "extraction_confidence\|classification_confidence\|confidence" \
  /Users/coach/Projects/LostCity/database/schema.sql | grep "events\|event_extra" | head -10
```

The `event_extractions` table (schema line ~726) has `extraction_confidence`. Classification confidence may be stored there.

```sql
-- Distribution of extraction_confidence for v2-classified events
SELECT
  ROUND(extraction_confidence::numeric, 1) as confidence_bucket,
  COUNT(*) as event_count
FROM event_extractions ee
JOIN events e ON e.id = ee.event_id
WHERE e.classification_prompt_version IS NOT NULL
GROUP BY confidence_bucket
ORDER BY confidence_bucket;
```

### Step 3c: Sample accuracy at threshold boundaries

- [ ] Pull 50 events where confidence was near the threshold (0.65–0.75) — these are the borderline cases most likely to be wrong:

```sql
SELECT
  e.title,
  e.category_id,
  ee.extraction_confidence,
  e.classification_prompt_version,
  v.name as venue_name,
  v.venue_type
FROM events e
JOIN event_extractions ee ON ee.event_id = e.id
JOIN venues v ON v.id = e.venue_id
WHERE e.classification_prompt_version IS NOT NULL
  AND ee.extraction_confidence BETWEEN 0.65 AND 0.75
ORDER BY RANDOM()
LIMIT 50;
```

- [ ] Manually review the 50 sampled events. For each, note whether the classification looks correct. Record in a comment:
  - How many of the 50 look correct?
  - What are the most common error patterns?
  - Is the error rate acceptable (< 20%)? If yes, threshold is working. If not, raise it.

### Step 3d: Adjust threshold if needed

- [ ] If accuracy at 0.65–0.75 is < 80%, raise `CONFIDENCE_THRESHOLD` in `crawlers/classify.py`:

```python
# Before:
CONFIDENCE_THRESHOLD = 0.7

# After (example — adjust based on actual data):
CONFIDENCE_THRESHOLD = 0.75
```

- [ ] Re-run the golden test set to verify the change doesn't break known-good classifications:

```bash
cd /Users/coach/Projects/LostCity/crawlers
source venv/bin/activate
python -m pytest tests/test_classify_rules.py tests/test_classify_pipeline.py -v
```

### Step 3e: Expand golden test set with edge cases found in production

- [ ] Find the golden test set file:

```bash
find /Users/coach/Projects/LostCity/crawlers -name "golden*" -o -name "*golden*" 2>/dev/null | head -5
```

- [ ] Add 5–10 test cases based on the borderline events found in step 3c. Focus on cases where the rules layer was wrong but the LLM would get it right (these should cross the threshold). Format follows the existing test file pattern in `tests/test_classify_rules.py`:

```python
def test_borderline_case_NAME():
    """Describe what was wrong before and what's expected now."""
    result = classify_rules(
        title="...",
        description="...",
        venue_type="...",
    )
    assert result.category == "expected_category"
    assert result.confidence < CONFIDENCE_THRESHOLD  # Should route to LLM
```

---

## Task 4: Run lint and tests; commit all changes

- [ ] Run ruff on changed crawler files:

```bash
cd /Users/coach/Projects/LostCity/crawlers
source venv/bin/activate
ruff check sources/fulton_library.py sources/atlanta_dpr.py classify.py
```

Fix any lint errors before committing.

- [ ] Run the full crawler test suite:

```bash
cd /Users/coach/Projects/LostCity/crawlers
source venv/bin/activate
python -m pytest tests/ -v
```

- [ ] Run the web TypeScript check (should still be clean from other tasks):

```bash
cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit
```

- [ ] Commit library crawler changes:

```bash
cd /Users/coach/Projects/LostCity
git add crawlers/sources/fulton_library.py
# Add other library crawlers if they were updated:
# git add crawlers/sources/gwinnett_library.py crawlers/sources/cobb_library.py crawlers/sources/dekalb_library.py
git commit -m "fix(fulton-library): use BiblioCommons typeIds for category before keyword fallback

BiblioCommons returns source-provided event type labels per event.
Use these as first-pass category signal instead of falling back to
keyword matching on title+description. Reduces misclassification for
events like 'Fun with Science' (Education) or 'Lego Club' (Games)
that have ambiguous titles.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

- [ ] Commit ACTIVENet family filter changes:

```bash
cd /Users/coach/Projects/LostCity
git add crawlers/sources/atlanta_dpr.py
# Add other ACTIVENet crawlers if updated
git commit -m "fix(atlanta-dpr): filter adult programs from family attribution using age fields

ACTIVENet returns age_min_year/age_max_year per activity. Use these
with normalize_activecommunities_age() and is_family_relevant_activity()
to exclude adult/senior programs (age_min >= 18, Primetime 55+) from
family audience tags. Adult programs still store in Atlanta portal;
they just no longer get mis-attributed as family-relevant.

Sets age_min, age_max, audience_tags on event records from ACTIVENet data.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

- [ ] Commit threshold/golden set changes if Task 3 was run:

```bash
cd /Users/coach/Projects/LostCity
git add crawlers/classify.py crawlers/tests/test_classify_rules.py
git commit -m "tune: adjust confidence threshold based on 2-week production sample

[Replace with actual finding: e.g., 'Raised threshold from 0.7 to 0.75
based on 82% accuracy at 0.65-0.75 borderline — below acceptable threshold.
Added 8 new golden set test cases from production edge cases.']

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```
