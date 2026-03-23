# Family Portal Crawler Fixes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all broken/underperforming family-relevant crawlers so the portal has clean, complete data from all sources.

**Architecture:** Seven independent crawler fixes + one data cleanup migration. Each task targets a single file or source. No cross-dependencies between tasks — they can run in any order or in parallel.

**Tech Stack:** Python 3, requests, BeautifulSoup, Supabase (via `crawlers/db.py`), pytest

---

### Task 1: Fix Forefront Arts async→sync bug

**Files:**
- Modify: `crawlers/sources/forefront_arts.py:1127` (async def crawl → def crawl)
- Modify: `crawlers/sources/forefront_arts.py:152-156` (aiohttp → requests)

**Context:** Forefront Arts is Atlanta's largest youth performing arts org (1,200+ students, 20+ locations). The crawler defines `async def crawl()` but `main.py` calls it synchronously — the coroutine is never awaited, silently returning 0 events.

- [ ] **Step 1: Run the crawler to confirm the failure**

```bash
cd crawlers && python3 main.py --source forefront-arts --dry-run 2>&1 | tail -20
```

Expected: 0 events found, or "cannot unpack non-iterable coroutine object" error.

- [ ] **Step 2: Convert crawl() from async to sync**

In `forefront_arts.py`:

1. Line 1127: Change `async def crawl(source: dict)` → `def crawl(source: dict)`
2. Remove `import aiohttp` (line 152) and any `aiohttp` usage
3. Replace `async with aiohttp.ClientSession(connector=connector) as session:` with a `requests.Session()` context
4. Replace all `async def _fetch_html(session, url)` → `def _fetch_html(session, url)` and `await session.get(url)` → `session.get(url)`
5. Remove all remaining `await` keywords
6. Remove `asyncio` import if present
7. Add `import requests` if not already imported

Key pattern change:
```python
# Before (async)
async with aiohttp.ClientSession(connector=connector) as session:
    html = await _fetch_html(session, url)

# After (sync)
with requests.Session() as session:
    session.headers.update(headers)
    html = _fetch_html(session, url)
```

For `_fetch_html`, the sync version:
```python
def _fetch_html(session: requests.Session, url: str) -> Optional[str]:
    try:
        resp = session.get(url, timeout=15)
        resp.raise_for_status()
        return resp.text
    except requests.RequestException as exc:
        logger.warning("fetch failed %s: %s", url, exc)
        return None
```

- [ ] **Step 3: Run the crawler to verify it works**

```bash
cd crawlers && python3 main.py --source forefront-arts --dry-run 2>&1 | tail -20
```

Expected: events_found > 0. If the source website structure has changed, the parse logic may need updating — but the async bug must be fixed first.

- [ ] **Step 4: Commit**

```bash
git add crawlers/sources/forefront_arts.py
git commit -m "fix(crawlers): convert forefront_arts from async to sync — was silently returning 0 events"
```

---

### Task 2: Fix Barnes & Noble content hash mismatch

**Files:**
- Modify: `crawlers/sources/barnes_noble_events.py:290-291`

**Context:** Source 1316 runs successfully (found=168) but writes 0 events to DB. The content hash is generated with `store_info.get("name")` (e.g., "Buckhead") but `find_existing_event_for_insert()` in db.py generates hash candidates using the full venue name (e.g., "Barnes & Noble Buckhead"). The mismatch causes silent insertion failures.

- [ ] **Step 1: Verify the bug**

```bash
cd crawlers && python3 -c "
from sources.barnes_noble_events import _build_venue_data
store = {'storeId': '2788', 'name': 'Buckhead', 'city': 'Atlanta'}
print('Venue name:', _build_venue_data(store)['name'])
print('Hash would use:', store.get('name', 'Barnes & Noble'))
"
```

Expected: Venue name = "Barnes & Noble Buckhead", Hash uses = "Buckhead". These don't match.

- [ ] **Step 2: Fix the hash to use the full venue name**

At line 290-291, change:
```python
# Before
venue_name = store_info.get("name", "Barnes & Noble")
content_hash = generate_content_hash(title, venue_name, start_date)

# After
venue_name = f"Barnes & Noble {store_info.get('name', '')}"
content_hash = generate_content_hash(title, venue_name, start_date)
```

This aligns the hash with what `_build_venue_data()` produces at line 140.

- [ ] **Step 3: Run the crawler to verify events are now written**

```bash
cd crawlers && python3 main.py --source barnes-noble-events --dry-run 2>&1 | tail -20
```

Expected: events_found=168, events_new > 0 (or events_updated > 0 on subsequent runs).

- [ ] **Step 4: Commit**

```bash
git add crawlers/sources/barnes_noble_events.py
git commit -m "fix(crawlers): align B&N content hash with venue name — was silently dropping all 168 events"
```

---

### Task 3: Diagnose and fix parks map crawlers

**Files:**
- Check/modify: `crawlers/sources/atlanta_parks_family_map.py`
- Check/modify: `crawlers/sources/gwinnett_parks_family_map.py`
- Check/modify: `crawlers/sources/dekalb_parks_family_map.py`
- Check/modify: `crawlers/sources/cobb_parks_family_map.py`
- Reference: `crawlers/entity_persistence.py` (current API)
- Reference: `crawlers/entity_lanes.py` (current API)

**Context:** Three of four parks map crawlers are failing. Errors suggest stale `.pyc` files or API mismatches (`is_empty()` → `has_records()`, old 2-arg `persist_typed_entity_envelope()`). The current code in the source files looks correct on read — they all use `has_records()` and 1-arg persist. This points to `.pyc` cache as the likely cause.

**Current API (for reference):**
- `TypedEntityEnvelope.has_records() -> bool` (entity_lanes.py:103)
- `persist_typed_entity_envelope(envelope) -> TypedEntityPersistResult` (entity_persistence.py:57, 1 arg)
- `TypedEntityPersistResult.persisted: dict[str, int]` (entity_persistence.py:28)

- [ ] **Step 1: Clear all .pyc caches**

```bash
cd crawlers && find . -name "*.pyc" -delete && find . -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null; echo "Cleared"
```

- [ ] **Step 2: Run each parks map crawler individually**

```bash
cd crawlers && python3 main.py --source atlanta-parks-family-map --dry-run 2>&1 | tail -20
cd crawlers && python3 main.py --source gwinnett-parks-family-map --dry-run 2>&1 | tail -20
cd crawlers && python3 main.py --source dekalb-parks-family-map --dry-run 2>&1 | tail -20
cd crawlers && python3 main.py --source cobb-parks-family-map --dry-run 2>&1 | tail -20
```

For each: note whether it succeeds or fails, and what the error is.

- [ ] **Step 3: Fix any remaining API mismatches**

If any crawler still fails after clearing caches, check for:
1. `is_empty()` → replace with `not envelope.has_records()`
2. `persist_typed_entity_envelope(source, envelope)` → replace with `persist_typed_entity_envelope(envelope)`
3. `result.counts` → replace with `result.persisted`

- [ ] **Step 4: Verify all four crawlers produce destination records**

Each should report destinations found > 0. If a crawler runs successfully but finds 0 destinations, check whether the upstream data source is still active.

- [ ] **Step 5: Commit**

```bash
git add crawlers/sources/*_parks_family_map.py
git commit -m "fix(crawlers): fix parks map crawlers — clear stale .pyc + fix API mismatches"
```

---

### Task 4: Clean age 0-0 legacy data

**Files:**
- Create: `supabase/migrations/20260322700000_clean_age_zero_zero.sql`

**Context:** 26 events have `age_min=0, age_max=0` from before the `normalize_activecommunities_age()` guard was added. The current crawler code correctly converts 0 → NULL, so this is a one-time data cleanup, not a code fix.

- [ ] **Step 1: Write the cleanup migration**

```sql
-- Clean legacy age_min=0, age_max=0 values
-- These came from ACTIVENet sources before normalization was added.
-- age_min=0 AND age_max=0 means "no age restriction" not "infant",
-- so the correct representation is NULL/NULL.

UPDATE events
SET age_min = NULL, age_max = NULL
WHERE age_min = 0 AND age_max = 0;
```

- [ ] **Step 2: Verify the migration targets the right rows**

```bash
cd crawlers && python3 -c "
from db.client import get_client
sb = get_client()
res = sb.table('events').select('id, title, source_id', count='exact').eq('age_min', 0).eq('age_max', 0).execute()
print(f'{res.count} events with age 0-0')
for r in res.data[:5]:
    print(f'  [{r[\"source_id\"]}] {r[\"title\"][:60]}')
"
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260322700000_clean_age_zero_zero.sql
git commit -m "fix(data): clean 26 events with legacy age_min=0/age_max=0 → NULL"
```

---

### Task 5: Raise Callanwolde page cap

**Files:**
- Modify: `crawlers/sources/_tribe_events_base.py:85`

**Context:** Callanwolde has 1,300+ events but `_MAX_PAGES=50` × `_PAGE_SIZE=20` = 1,000 event ceiling. ~300 events are missed.

- [ ] **Step 1: Increase _MAX_PAGES from 50 to 75**

At line 85:
```python
# Before
_MAX_PAGES = 50

# After
_MAX_PAGES = 75
```

This raises the ceiling to 75 × 20 = 1,500 events, covering Callanwolde's full catalog with headroom.

- [ ] **Step 2: Run Callanwolde to verify higher count**

```bash
cd crawlers && python3 main.py --source callanwolde --dry-run 2>&1 | tail -10
```

Expected: events_found > 1000 (was capped at 1000 before).

- [ ] **Step 3: Commit**

```bash
git add crawlers/sources/_tribe_events_base.py
git commit -m "fix(crawlers): raise Tribe Events page cap 50→75 — Callanwolde was missing ~300 events"
```

---

### Task 6: Archive stale programs

**Files:**
- Create: `supabase/migrations/20260322700001_archive_stale_programs.sql`

**Context:** 278 programs have `session_start` in the past with either `session_end < today` or `session_end IS NULL`, but are still `status='active'`. Parents would see ended programs with no way to know they're over.

- [ ] **Step 1: Write the archive migration**

```sql
-- Archive programs that have clearly ended.
-- Programs with session_end in the past are definitively over.
-- Programs with session_start in the past and no session_end are ambiguous —
-- mark them 'needs_review' rather than archiving blindly (some are rolling enrollment).

-- Phase 1: Archive definitively ended programs
UPDATE programs
SET status = 'archived'
WHERE status = 'active'
  AND session_end IS NOT NULL
  AND session_end < CURRENT_DATE;

-- Phase 2: Archive programs with no end date that started > 60 days ago
-- (These are likely stale — rolling enrollment programs should be re-crawled
-- to get fresh data rather than sitting with no end date for months.)
-- CHECK constraint only allows: 'active', 'draft', 'archived'.
UPDATE programs
SET status = 'archived'
WHERE status = 'active'
  AND session_end IS NULL
  AND session_start IS NOT NULL
  AND session_start < CURRENT_DATE - INTERVAL '60 days';
```

- [ ] **Step 2: Verify counts before applying**

```bash
cd crawlers && python3 -c "
from db.client import get_client
sb = get_client()
ended = sb.table('programs').select('id', count='exact').eq('status', 'active').lt('session_end', '2026-03-22').execute()
stale = sb.rpc('', {}).execute()  # Use raw SQL if needed
print(f'Definitively ended: {ended.count}')
"
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260322700001_archive_stale_programs.sql
git commit -m "fix(data): archive ended programs + flag stale programs for review"
```

---

### Task 7: Subscribe missing sources to family portal

**Files:**
- Create: `supabase/migrations/20260322700002_subscribe_missing_family_sources.sql`

**Context:** Two active sources with family-relevant content are not subscribed to the family portal: All Fired Up Art Studio (source 1100, 2 events) and Atlanta Science Festival (source 627).

- [ ] **Step 1: Find the family portal ID**

```bash
cd crawlers && python3 -c "
from db.client import get_client
sb = get_client()
res = sb.table('portals').select('id, slug').ilike('slug', '%famil%').execute()
for r in res.data:
    print(f'{r[\"id\"]} → {r[\"slug\"]}')
"
```

- [ ] **Step 2: Write the subscription migration**

```sql
-- Subscribe missing family-relevant sources to the family portal.
-- All Fired Up Art Studio (1100) — pottery/art classes for kids
-- Atlanta Science Festival (627) — annual STEM festival for families
-- Column names: subscriber_portal_id (not portal_id), plus subscription_scope and is_active required.

INSERT INTO source_subscriptions (subscriber_portal_id, source_id, subscription_scope, is_active)
SELECT p.id, s.id, 'full', true
FROM sources s
CROSS JOIN portals p
WHERE p.slug = 'atlanta-families'
  AND s.id IN (1100, 627)
ON CONFLICT (subscriber_portal_id, source_id) DO NOTHING;
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260322700002_subscribe_missing_family_sources.sql
git commit -m "feat(data): subscribe All Fired Up + Atlanta Science Festival to family portal"
```

---

### Task 8: Deprecate dead crawlers

**Files:**
- Create: `supabase/migrations/20260322700003_deactivate_dead_family_sources.sql`

**Context:** Three sources should be deactivated:
- `barnes-noble-atlanta` — superseded by `barnes-noble-events` (168 events/day)
- `lego-discovery-center` — Playwright scraper that never found events; `legoland-atlanta` works (2 events)
- `sealife-georgia` — placeholder for nonexistent location

- [ ] **Step 1: Write the deactivation migration**

```sql
-- Deactivate dead family sources.
-- barnes-noble-atlanta: superseded by barnes-noble-events (different API endpoint)
-- lego-discovery-center: Playwright scraper never matched site structure; legoland-atlanta works
-- sealife-georgia: no Georgia location exists
-- Uses health_tags pattern (no deactivation_reason column on sources).

UPDATE sources
SET is_active = false,
    health_tags = array_append(COALESCE(health_tags, '{}'), 'deactivated:superseded_by_barnes_noble_events')
WHERE slug = 'barnes-noble-atlanta';

UPDATE sources
SET is_active = false,
    health_tags = array_append(COALESCE(health_tags, '{}'), 'deactivated:replaced_by_legoland_atlanta')
WHERE slug = 'lego-discovery-center';

UPDATE sources
SET is_active = false,
    health_tags = array_append(COALESCE(health_tags, '{}'), 'deactivated:no_georgia_location')
WHERE slug = 'sealife-georgia';
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260322700003_deactivate_dead_family_sources.sql
git commit -m "chore(data): deactivate 3 dead family sources (superseded/broken/placeholder)"
```
