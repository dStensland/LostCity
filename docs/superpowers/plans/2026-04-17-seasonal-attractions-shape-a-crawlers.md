# Seasonal Attractions — Shape A Crawlers Plan (Plan 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the four Atlanta haunted-attraction crawlers (Netherworld, Folklore, Paranoia, Nightmare's Gate) from emitting per-night event rows to emitting one seasonal exhibition row per season, per the Shape A pattern documented in Plan 1.

**Architecture:** Shape A (from spec's taxonomy) = continuous nightly run with no dated sub-programming. One place + one seasonal exhibition with `operating_schedule`; zero child events. Each crawler's existing per-night event emission collapses to ~20 lines invoking `insert_exhibition()`.

**Tech Stack:** Python crawlers (Playwright + BeautifulSoup), Supabase, existing `crawlers/db/exhibitions.py` helpers.

**Spec:** `docs/superpowers/specs/2026-04-17-seasonal-attractions-design.md`
**Parent plan:** `docs/superpowers/plans/2026-04-17-seasonal-attractions-foundation.md`
**Reference implementation:** `crawlers/sources/georgia_ren_fest.py` after Plan 1 commit `7211ee25` (Shape C — similar pattern with themed-weekend events attached)

**Dependencies:** This plan stacks on top of `feat/seasonal-attractions-foundation` branch (PR #31). The schema migration (`20260417000001`), `_EXHIBITION_COLUMNS` update, and `insert_exhibition()` helper signatures from Plan 1 are required. If PR #31 merges first, rebase this plan's branch onto `main`.

---

## File Structure

### Modify (per crawler, 4× identical pattern)
- `crawlers/sources/netherworld.py`
- `crawlers/sources/folklore_haunted.py`
- `crawlers/sources/paranoia_haunted.py`
- `crawlers/sources/nightmares_gate.py`

Each crawler:
1. Adds import: `from db.exhibitions import insert_exhibition`
2. Updates `PLACE_DATA`: add `"is_seasonal_only": True`
3. Replaces the per-night event-emission loop in `crawl()` with a single `create_seasonal_exhibition()` call
4. Drops `insert_event()` calls and all date-parsing helpers that existed purely to generate per-night rows
5. Keeps the Playwright fetch + schedule-parsing logic — instead of emitting 47 events, it extracts the season window + per-night hours and passes them to the exhibition

### Do NOT touch
- Plan 1's `georgia_ren_fest.py` — Shape C, different handling
- Plan 3/4 crawlers (`stone_mountain_park.py`, `southern_belle_farm.py`, `north_georgia_state_fair.py`)

---

## Shared crawler pattern (applies to each task)

Before each task, the implementer must understand the target crawler's current shape. The 4 crawlers are structurally similar but differ in:
- Source URL and HTML structure
- Operating hours per night of week (Netherworld: Fri–Sun early Sept, daily Oct; Folklore/Paranoia/Nightmare's Gate: Fri–Sun + select weeknight dates)
- Slug for the exhibition (year-scoped: `<place-slug>-seasonal-<year>`)

### Common `create_seasonal_exhibition()` shape

```python
def create_seasonal_exhibition(
    page_or_session,   # Playwright Page or requests.Session depending on crawler
    source_id: int,
    venue_id: int,
    season_start: str,        # "YYYY-MM-DD" — first open night
    season_end: str,          # "YYYY-MM-DD" — last open night
    operating_schedule: dict, # per-day hours dict
) -> Optional[str]:
    year = season_start[:4]
    exhibition_data = {
        "slug": f"{PLACE_DATA['slug']}-seasonal-{year}",
        "place_id": venue_id,
        "source_id": source_id,
        "title": f"{PLACE_DATA['name']} {year} Season",
        "description": "...",   # from existing crawler's description logic
        "opening_date": season_start,
        "closing_date": season_end,
        "exhibition_type": "seasonal",
        "admission_type": "ticketed",
        "admission_url": TICKETS_URL,
        "source_url": SCHEDULE_URL,
        "operating_schedule": operating_schedule,
        "tags": ["seasonal", "haunted", "halloween", "ticketed"],
    }
    return insert_exhibition(exhibition_data)
```

### Common `crawl()` reshape

```python
def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    # Stage 1: Parse schedule from site (existing Playwright/BS logic, but extract
    #          season_start, season_end, and operating_schedule instead of
    #          generating one event per night).
    try:
        season_start, season_end, operating_schedule = _parse_schedule(...)
    except Exception as e:
        logger.error(f"...: schedule parse failed: {e}")
        return 0, 0, 0

    # Stage 2: Upsert place + exhibition.
    venue_id = get_or_create_place(PLACE_DATA)
    exhibition_id = create_seasonal_exhibition(
        ..., venue_id, season_start, season_end, operating_schedule
    )

    # Stage 3: Report. Shape A has no child events.
    found = 1 if exhibition_id else 0
    new = 1 if exhibition_id else 0  # insert_exhibition handles upsert-vs-new internally
    return found, new, 0
```

### What to keep vs. drop

Keep:
- `PLACE_DATA` dict (add `is_seasonal_only: True`)
- `TICKETS_URL`, `SCHEDULE_URL` constants
- Playwright setup code if used
- Any site-specific fetch + HTML parsing that extracts dates & hours

Drop:
- Any `insert_event()` loop
- Any per-night event dedup hash generation
- Any date-range expansion into a list of nights
- Any `event_record` dict construction

---

## Phase 1: Convert Netherworld

### Task 1: Convert `netherworld.py` to Shape A

**Files:**
- Modify: `crawlers/sources/netherworld.py`
- Test: (no new tests — existing test suite regression check)

**Current behavior** (as of Plan 1 research, commit `7211ee25`): emits one event per open night via `insert_event()`. Each event has the same title+venue, differentiated only by `start_date`. Shape A target collapses these into 1 exhibition.

- [ ] **Step 1: Read current crawler**

```bash
cat crawlers/sources/netherworld.py
```

Understand:
- Where the date list is generated (expect a loop or regex that produces per-night rows)
- What operating hours look like on the source site (Fri–Sun early season, nightly October 1 through 31)
- What tags and description the current events use

- [ ] **Step 2: Rewrite `PLACE_DATA`**

Add `"is_seasonal_only": True`. Leave `place_type` as `"attraction"` — it's the correct semantic identity; `is_seasonal_only` is what signals seasonality.

```python
PLACE_DATA = {
    "name": "Netherworld Haunted House",
    "slug": "netherworld-haunted-house",
    # ... existing fields ...
    "place_type": "attraction",
    "spot_type": "attraction",
    "is_seasonal_only": True,  # new
    # ... existing fields ...
}
```

- [ ] **Step 3: Extract schedule-parse helper**

The existing crawler already parses the schedule page (however it does so). Refactor that logic into a function that returns `(season_start, season_end, operating_schedule)` instead of `List[event_record]`. Name: `_parse_schedule()`.

`operating_schedule` shape (copy into the function):

```python
operating_schedule = {
    "default_hours": {"open": "19:30", "close": "00:00"},  # if consistent nightly
    "days": {
        "monday": None,
        "tuesday": None,
        "wednesday": None,
        "thursday": {"open": "19:30", "close": "23:00"},
        "friday": {"open": "19:30", "close": "00:30"},
        "saturday": {"open": "19:30", "close": "00:30"},
        "sunday": {"open": "19:30", "close": "23:00"},
    },
    "overrides": {
        # Per-date overrides for e.g. Halloween night or closed holidays
        # "2025-10-31": {"open": "19:00", "close": "01:00"},
    },
}
```

Use actual Netherworld hours — verify against the source site. If the current crawler has per-night hours inline, extract the majority pattern into `days` and put exceptions in `overrides`.

- [ ] **Step 4: Add `insert_exhibition` import**

```python
from db.exhibitions import insert_exhibition
```

- [ ] **Step 5: Add `create_seasonal_exhibition()` function**

Follow the common shape shown in the "Shared crawler pattern" section above. Netherworld-specific values:
- `slug`: `f"netherworld-haunted-house-seasonal-{year}"`
- `title`: `f"Netherworld Haunted House {year} Season"`
- `description`: Netherworld's marketing description — 40-80 words about the 2 haunts, themed attractions, etc. Can copy from the existing crawler's event description.
- `tags`: `["seasonal", "haunted", "halloween", "ticketed", "all-ages"]` (adjust per crawler's existing tags)

- [ ] **Step 6: Rewrite `crawl()`**

Follow the common shape. Return `(1, 1, 0)` on successful upsert — insert_exhibition handles existing-row dedup internally.

- [ ] **Step 7: Delete dead code**

Remove:
- Per-night event loop
- Any `generate_content_hash()` calls that were for events
- Helpers that only existed to format per-night events
- `find_event_by_hash` / `smart_update_existing_event` / `insert_event` imports if they're no longer used (check after editing!)

- [ ] **Step 8: Dry-run**

```bash
cd crawlers && python3 main.py --source netherworld --dry-run 2>&1 | tail -20
```

Expected: 1 exhibition upsert log line, no event upsert lines, crawler completes cleanly.

- [ ] **Step 9: Regression test**

```bash
python3 -m pytest tests/ -k "netherworld" -v 2>&1 | tail -5
```

Expected: existing tests pass, OR no tests exist for this crawler.

- [ ] **Step 10: Commit**

```bash
git add crawlers/sources/netherworld.py
git commit -m "feat(crawlers): Netherworld Shape A — 1 seasonal exhibition (drops per-night events)"
```

---

## Phase 2: Convert Folklore Haunted

### Task 2: Convert `folklore_haunted.py` to Shape A

**Files:**
- Modify: `crawlers/sources/folklore_haunted.py`

Follows the exact same pattern as Task 1. Walk through the crawler's current shape, extract season window + operating_schedule, replace per-night emission with `create_seasonal_exhibition()`.

- [ ] **Step 1: Read current crawler and extract pattern**

```bash
cat crawlers/sources/folklore_haunted.py
```

- [ ] **Step 2: Apply the Shape A pattern**

Make the same 7 edits as Task 1, Steps 2–7, but with Folklore-specific values:
- `slug`: `f"folklore-haunted-house-seasonal-{year}"` (verify the actual slug used by the existing crawler)
- `title`: `f"Folklore Haunted House {year} Season"`
- Description: from the existing crawler; keep the existing voice/marketing copy
- Operating schedule: read the actual site

- [ ] **Step 3: Dry-run**

```bash
cd crawlers && python3 main.py --source folklore-haunted --dry-run 2>&1 | tail -20
```

Expected: 1 exhibition upsert, 0 event upserts.

- [ ] **Step 4: Regression test**

```bash
python3 -m pytest tests/ -k "folklore" -v 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add crawlers/sources/folklore_haunted.py
git commit -m "feat(crawlers): Folklore Haunted Shape A — 1 seasonal exhibition (drops per-night events)"
```

---

## Phase 3: Convert Paranoia Haunted

### Task 3: Convert `paranoia_haunted.py` to Shape A

**Files:**
- Modify: `crawlers/sources/paranoia_haunted.py`

Same pattern.

- [ ] **Step 1: Read and extract**

```bash
cat crawlers/sources/paranoia_haunted.py
```

- [ ] **Step 2: Apply Shape A pattern**

Paranoia-specific:
- `slug`: `f"paranoia-haunted-house-seasonal-{year}"` (verify)
- `title`: `f"Paranoia Haunted House {year} Season"`
- Description from existing crawler
- Operating schedule from source

- [ ] **Step 3: Dry-run**

```bash
cd crawlers && python3 main.py --source paranoia-haunted --dry-run 2>&1 | tail -20
```

- [ ] **Step 4: Regression test**

```bash
python3 -m pytest tests/ -k "paranoia" -v 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add crawlers/sources/paranoia_haunted.py
git commit -m "feat(crawlers): Paranoia Haunted Shape A — 1 seasonal exhibition (drops per-night events)"
```

---

## Phase 4: Convert Nightmare's Gate

### Task 4: Convert `nightmares_gate.py` to Shape A

**Files:**
- Modify: `crawlers/sources/nightmares_gate.py`

Same pattern.

- [ ] **Step 1: Read and extract**

```bash
cat crawlers/sources/nightmares_gate.py
```

- [ ] **Step 2: Apply Shape A pattern**

Nightmare's Gate-specific:
- `slug`: `f"nightmares-gate-seasonal-{year}"` (verify)
- `title`: `f"Nightmare's Gate {year} Season"`
- Description from existing crawler
- Operating schedule from source

- [ ] **Step 3: Dry-run**

```bash
cd crawlers && python3 main.py --source nightmares-gate --dry-run 2>&1 | tail -20
```

- [ ] **Step 4: Regression test**

```bash
python3 -m pytest tests/ -k "nightmare" -v 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add crawlers/sources/nightmares_gate.py
git commit -m "feat(crawlers): Nightmare's Gate Shape A — 1 seasonal exhibition (drops per-night events)"
```

---

## Phase 5: Cleanup pass

### Task 5: Remove any newly-dead imports across all 4 crawlers

After each conversion, some imports may be unused. Running a lint check catches them.

- [ ] **Step 1: Run linter**

```bash
cd crawlers
ruff check sources/netherworld.py sources/folklore_haunted.py sources/paranoia_haunted.py sources/nightmares_gate.py 2>&1 | head -20
```

If any `F401` (unused import) warnings appear, remove the dead imports.

- [ ] **Step 2: Typecheck helper signatures match**

```bash
python3 -c "from sources import netherworld, folklore_haunted, paranoia_haunted, nightmares_gate; print('OK')"
```

Expected: `OK` (no ImportError or AttributeError).

- [ ] **Step 3: Commit any lint fixes**

```bash
# Only if lint fixes were needed
git add -u
git commit -m "chore(crawlers): drop unused imports after Shape A conversion"
```

---

## Phase 6: Documentation touch-up

### Task 6: Update the Shape A crawler list in `crawlers/CLAUDE.md`

Plan 1 documented the shape taxonomy. Plan 2 implements 4 Shape A crawlers. The CLAUDE.md reference list should mention them as reference implementations.

- [ ] **Step 1: Find the seasonal destinations section**

Search `crawlers/CLAUDE.md` for "Shape A". Locate the shape taxonomy table.

- [ ] **Step 2: Update the reference line**

At the end of the "Seasonal-only Destinations" section, expand the reference line:

```markdown
Reference implementations:
- Shape A (continuous nightly): `crawlers/sources/netherworld.py`, `folklore_haunted.py`, `paranoia_haunted.py`, `nightmares_gate.py`
- Shape C (themed weekends): `crawlers/sources/georgia_ren_fest.py`
```

(Only edit if the current file has a single "Reference implementation" line; otherwise merge into existing references section.)

- [ ] **Step 3: Commit**

```bash
git add crawlers/CLAUDE.md
git commit -m "docs(crawlers): reference Shape A implementations (haunted house trio + Netherworld)"
```

---

## Launch Readiness Check

- [ ] Tasks 1–4: all four crawlers dry-run cleanly, emit 1 seasonal exhibition each, 0 event rows
- [ ] Task 5: no stale imports, all 4 crawlers importable
- [ ] Task 6: docs reference the new implementations
- [ ] Full crawlers test suite: `python3 -m pytest tests/ -q` — no regressions
- [ ] Migration parity audit: `python3 database/audit_migration_parity.py` — unchanged (no migrations in this plan)
- [ ] Branch ready for PR

This plan is complete when all 4 crawlers emit Shape A exhibitions. Verification that they surface in the "This Season" category on the feed happens in production after PR #31 (Plan 1) is merged AND the new crawlers have run. Until then, they'll emit rows, but the API only returns rows whose `portal_id` matches the query portal — verify portal attribution is correctly inherited (via `sources.owner_portal_id`).

## Out of Scope

- Per-night event rows for special nights (Netherworld "Lights On" kid-friendly, opening/closing nights). These are shape-B-like one-offs that would link via `events.exhibition_id`. Defer until there's a clear user need — for now, let the exhibition represent the season as a whole.
- Any changes to place_type beyond adding `is_seasonal_only: True`.
- New crawlers for Lake Lanier Lights, Callaway Fantasy in Lights, or Burt's Pumpkin Farm. Those were listed as follow-on in Plan 1; they'd use this same pattern but are separate work.
