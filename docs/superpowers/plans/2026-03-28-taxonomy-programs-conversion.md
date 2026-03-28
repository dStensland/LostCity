# Taxonomy Programs Conversion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert events that are really programs (summer camps, gymnastics class sessions, rec center structured classes) from the events table into first-class program entities, then deactivate the Georgia Gymnastics Academy source whose JackRabbit class schedules have zero consumer-facing discovery value.

**Architecture:** The `programs` table already exists (schema.sql lines 656-703) with `program_type`, `age_min`, `age_max`, `season`, `session_start/end`, `schedule_days`, `cost_amount`, `registration_url`, `tags`, and `status` columns. The programs API at `/api/programs` is already live and portal-scoped. The Family portal programs page at `/[portal]/programs/` is already built. This plan writes a Python conversion script, runs it, and deactivates the source.

**Tech Stack:** Python 3.12, Supabase/PostgreSQL, direct psycopg2 via Supabase REST

---

## Context: What already exists

- `programs` table: `id` (UUID), `portal_id`, `source_id`, `venue_id`, `name`, `slug`, `description`, `program_type` (`camp | enrichment | league | club | class | rec_program`), `age_min`, `age_max`, `season` (`summer | fall | spring | winter | year_round`), `session_start` (DATE), `session_end` (DATE), `schedule_days` (INT[]), `cost_amount` (NUMERIC), `cost_notes`, `registration_status`, `registration_url`, `tags` (TEXT[]), `status` (`active | draft | archived`)
- `web/app/api/programs/route.ts` — portal-scoped, supports `type`, `season`, `age`, `registration`, `tag`, `active=true` filters
- `web/app/[portal]/programs/page.tsx` — Family portal programs listing page
- `crawlers/sources/georgia_gymnastics_academy.py` — JackRabbit source, ~1,400 class session events
- Georgia Gymnastics Academy produces class session events with titles like "Novice 1 Young Mon 5:30-6:15pm" — internal scheduling codes, not discoverable by the public
- Summer camp candidates: search events WHERE title ILIKE '%camp%' AND source produces family-relevant content

---

## Task 1: Audit events to be converted

Before writing the conversion script, understand the actual data.

- [ ] Run these queries directly in the Supabase SQL editor (or via the Supabase CLI) to understand the scope:

```sql
-- Count Georgia Gymnastics Academy events
SELECT COUNT(*) FROM events e
JOIN sources s ON s.id = e.source_id
WHERE s.slug = 'georgia-gymnastics-academy'
  AND e.is_active = true;

-- Sample Georgia Gymnastics titles to understand patterns
SELECT e.title, e.start_date, e.start_time, e.end_time, e.price_min, e.tags
FROM events e
JOIN sources s ON s.id = e.source_id
WHERE s.slug = 'georgia-gymnastics-academy'
  AND e.is_active = true
ORDER BY e.start_date
LIMIT 20;

-- Count summer camp events from known family sources
SELECT s.slug, COUNT(*) as cnt
FROM events e
JOIN sources s ON s.id = e.source_id
WHERE e.title ILIKE '%camp%'
  AND e.is_active = true
  AND e.start_date >= CURRENT_DATE
GROUP BY s.slug
ORDER BY cnt DESC
LIMIT 20;

-- Sample summer camp titles and dates
SELECT s.slug, e.title, e.start_date, e.end_date, e.price_min, e.tags
FROM events e
JOIN sources s ON s.id = e.source_id
WHERE e.title ILIKE '%camp%'
  AND e.is_active = true
  AND e.start_date >= CURRENT_DATE
ORDER BY e.start_date
LIMIT 30;
```

- [ ] Document the results in a comment at the top of the conversion script before writing it. Specifically note:
  - Total Georgia Gymnastics Academy active event count
  - Top 5 source slugs producing camp-titled events and their counts
  - Whether camp events have `end_date` set (needed for `session_end`)
  - Whether camp events have `price_min` set (needed for `cost_amount`)

---

## Task 2: Create conversion script

**Files:**
- `crawlers/scripts/convert_events_to_programs.py` (new file)

- [ ] Verify the `crawlers/scripts/` directory exists:

```bash
ls /Users/coach/Projects/LostCity/crawlers/scripts/ 2>/dev/null || echo "does not exist"
```

If it does not exist, create it:

```bash
mkdir -p /Users/coach/Projects/LostCity/crawlers/scripts
```

- [ ] Create `crawlers/scripts/convert_events_to_programs.py`:

```python
"""
Convert events that are really programs into the programs table.

Target 1: Georgia Gymnastics Academy — JackRabbit class sessions
  Source slug: georgia-gymnastics-academy
  Program type: class
  Age ranges extracted from title patterns ("Novice 1 Young", "TumbleTykes 2-3yr", etc.)
  Season: derived from session_start date

Target 2: Summer camps from family sources (optional, --camps flag)
  Criteria: title ILIKE '%camp%' AND source in approved family source list
  Program type: camp
  Age ranges: from existing age_min/age_max columns if set

Usage:
  python3 scripts/convert_events_to_programs.py --dry-run
  python3 scripts/convert_events_to_programs.py --source georgia-gymnastics-academy --dry-run
  python3 scripts/convert_events_to_programs.py --source georgia-gymnastics-academy
  python3 scripts/convert_events_to_programs.py --camps --dry-run
"""
from __future__ import annotations

import argparse
import logging
import os
import re
import sys
from datetime import date
from typing import Optional

import requests

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}


# ---------------------------------------------------------------------------
# Supabase REST helpers
# ---------------------------------------------------------------------------

def supabase_get(path: str, params: dict | None = None) -> list[dict]:
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    resp = requests.get(url, headers=HEADERS, params=params, timeout=30)
    resp.raise_for_status()
    return resp.json()


def supabase_post(path: str, payload: dict) -> dict:
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    resp = requests.post(url, headers=HEADERS, json=payload, timeout=30)
    resp.raise_for_status()
    result = resp.json()
    return result[0] if isinstance(result, list) else result


def supabase_patch(path: str, params: dict, payload: dict) -> None:
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    resp = requests.patch(url, headers=HEADERS, params=params, json=payload, timeout=30)
    resp.raise_for_status()


# ---------------------------------------------------------------------------
# Age inference from Georgia Gymnastics title patterns
# ---------------------------------------------------------------------------

_GGA_AGE_PATTERNS: list[tuple[re.Pattern, int, int]] = [
    (re.compile(r"mommy\s*&\s*me|mommy\s+and\s+me", re.I), 0, 2),
    (re.compile(r"tumblet[yi]kes.*?2.?3", re.I), 2, 3),
    (re.compile(r"tumblet[yi]kes.*?3.?4", re.I), 3, 4),
    (re.compile(r"tumblet[yi]kes.*?4.?5", re.I), 4, 5),
    (re.compile(r"\bk\s*/\s*1st\b|kindergarten.*?1st", re.I), 5, 6),
    (re.compile(r"novice.*?young|young.*?novice", re.I), 5, 7),
    (re.compile(r"novice\s+[123]", re.I), 6, 12),
    (re.compile(r"\bintermediate\b", re.I), 8, 14),
    (re.compile(r"\badvanced\b|\bteam\b", re.I), 10, 18),
]


def infer_age_from_gga_title(title: str) -> tuple[Optional[int], Optional[int]]:
    """Infer age_min, age_max from Georgia Gymnastics Academy class title."""
    for pattern, age_min, age_max in _GGA_AGE_PATTERNS:
        if pattern.search(title):
            return age_min, age_max
    # Also try generic "ages X-Y" patterns
    m = re.search(r"ages?\s+(\d+)\s*[-–]\s*(\d+)", title, re.I)
    if m:
        return int(m.group(1)), int(m.group(2))
    return None, None


# ---------------------------------------------------------------------------
# Season inference from session dates
# ---------------------------------------------------------------------------

def infer_season(session_start: Optional[str]) -> Optional[str]:
    """Infer season from session start date."""
    if not session_start:
        return None
    try:
        d = date.fromisoformat(session_start[:10])
    except ValueError:
        return None
    month = d.month
    if month in (6, 7, 8):
        return "summer"
    if month in (9, 10, 11):
        return "fall"
    if month in (12, 1, 2):
        return "winter"
    return "spring"


# ---------------------------------------------------------------------------
# Title normalization for program names
# ---------------------------------------------------------------------------

# Strip day-of-week and time suffixes from GGA class titles:
# "Novice 1 Young Mon 5:30-6:15pm" → "Novice 1 Young"
_GGA_TITLE_SUFFIX_RE = re.compile(
    r"\s+(mon|tue|wed|thu|fri|sat|sun)\w*\s+\d{1,2}:\d{2}.*$",
    re.I,
)


def normalize_gga_title(title: str) -> str:
    return _GGA_TITLE_SUFFIX_RE.sub("", title).strip()


# ---------------------------------------------------------------------------
# Slugify
# ---------------------------------------------------------------------------

def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text)
    return text[:80]


# ---------------------------------------------------------------------------
# Core conversion: Georgia Gymnastics Academy
# ---------------------------------------------------------------------------

def convert_georgia_gymnastics(dry_run: bool) -> tuple[int, int]:
    """Convert Georgia Gymnastics Academy events to programs. Returns (found, converted)."""
    logger.info("Fetching Georgia Gymnastics Academy source ID...")

    sources = supabase_get("sources", {"slug": "eq.georgia-gymnastics-academy", "select": "id,owner_portal_id"})
    if not sources:
        logger.error("Source georgia-gymnastics-academy not found in sources table.")
        return 0, 0

    source = sources[0]
    source_id = source["id"]
    portal_id = source.get("owner_portal_id")
    logger.info(f"Source ID: {source_id}, Portal ID: {portal_id}")

    # Fetch all active events from this source
    events = supabase_get(
        "events",
        {
            "source_id": f"eq.{source_id}",
            "is_active": "eq.true",
            "select": "id,title,start_date,end_date,start_time,end_time,price_min,venue_id,source_url,tags",
            "order": "start_date.asc",
            "limit": "2000",
        },
    )
    logger.info(f"Found {len(events)} active events from Georgia Gymnastics Academy")

    if not events:
        return 0, 0

    # Group by normalized title (same class name = one program record)
    from collections import defaultdict
    programs_by_name: dict[str, list[dict]] = defaultdict(list)
    for ev in events:
        normalized = normalize_gga_title(ev["title"])
        programs_by_name[normalized].append(ev)

    logger.info(f"Grouped into {len(programs_by_name)} distinct program names")

    converted = 0
    for program_name, event_instances in programs_by_name.items():
        # Use first instance for shared metadata
        first = event_instances[0]
        session_start = min(ev["start_date"] for ev in event_instances)
        session_end = max(ev.get("end_date") or ev["start_date"] for ev in event_instances)
        age_min, age_max = infer_age_from_gga_title(program_name)
        season = infer_season(session_start)
        cost_amount = first.get("price_min")
        venue_id = first["venue_id"]
        registration_url = first.get("source_url")

        program_slug = f"gga-{slugify(program_name)}"

        program_record = {
            "portal_id": portal_id,
            "source_id": source_id,
            "venue_id": venue_id,
            "name": f"Georgia Gymnastics Academy — {program_name}",
            "slug": program_slug,
            "description": f"Gymnastics class for ages {age_min}–{age_max}. Offered at Georgia Gymnastics Academy in Suwanee, GA." if age_min and age_max else f"Gymnastics class at Georgia Gymnastics Academy, Suwanee, GA.",
            "program_type": "class",
            "age_min": age_min,
            "age_max": age_max,
            "season": season,
            "session_start": session_start,
            "session_end": session_end,
            "cost_amount": float(cost_amount) if cost_amount is not None else None,
            "cost_period": "per_session",
            "registration_status": "open",
            "registration_url": registration_url,
            "tags": ["gymnastics", "kids", "class", "family-friendly"],
            "status": "active",
        }

        if dry_run:
            logger.info(f"[DRY RUN] Would create program: {program_record['name']} "
                       f"(age {age_min}-{age_max}, {len(event_instances)} sessions, "
                       f"season={season})")
            converted += 1
            continue

        # Check for existing program (avoid duplicate slugs)
        existing = supabase_get("programs", {"slug": f"eq.{program_slug}", "select": "id"})
        if existing:
            logger.info(f"Program already exists: {program_slug}, skipping")
            continue

        try:
            result = supabase_post("programs", program_record)
            logger.info(f"Created program: {result.get('id')} — {program_name}")
            converted += 1
        except Exception as e:
            logger.error(f"Failed to create program '{program_name}': {e}")

    return len(events), converted


# ---------------------------------------------------------------------------
# Deactivate Georgia Gymnastics Academy source + events
# ---------------------------------------------------------------------------

def deactivate_georgia_gymnastics(dry_run: bool) -> None:
    """Deactivate the source and all its events."""
    sources = supabase_get("sources", {"slug": "eq.georgia-gymnastics-academy", "select": "id"})
    if not sources:
        logger.error("Source georgia-gymnastics-academy not found.")
        return

    source_id = sources[0]["id"]

    if dry_run:
        logger.info(f"[DRY RUN] Would deactivate source ID {source_id} and all its events")
        return

    # Deactivate source
    supabase_patch("sources", {"id": f"eq.{source_id}"}, {"is_active": False})
    logger.info(f"Deactivated source {source_id} (georgia-gymnastics-academy)")

    # Deactivate all events from this source
    supabase_patch("events", {"source_id": f"eq.{source_id}", "is_active": "eq.true"}, {"is_active": False})
    logger.info(f"Deactivated all active events from source {source_id}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Convert events to programs")
    parser.add_argument(
        "--source",
        choices=["georgia-gymnastics-academy"],
        help="Specific source to convert",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview without writing to DB",
    )
    parser.add_argument(
        "--deactivate",
        action="store_true",
        help="After conversion, deactivate source and events (not implied by --source alone)",
    )
    args = parser.parse_args()

    if not args.source:
        parser.print_help()
        sys.exit(1)

    if args.source == "georgia-gymnastics-academy":
        found, converted = convert_georgia_gymnastics(args.dry_run)
        logger.info(f"Result: {found} events found, {converted} programs {'would be' if args.dry_run else ''} created")

        if args.deactivate:
            deactivate_georgia_gymnastics(args.dry_run)
        else:
            logger.info("Pass --deactivate to disable the source and its events after verifying program output")


if __name__ == "__main__":
    main()
```

---

## Task 3: Run conversion in dry-run mode

- [ ] Activate the crawlers virtualenv and run the dry-run:

```bash
cd /Users/coach/Projects/LostCity/crawlers
source venv/bin/activate
python3 scripts/convert_events_to_programs.py --source georgia-gymnastics-academy --dry-run
```

- [ ] Review the output. Verify:
  - Program names look correct (day/time suffix stripped: "Novice 1 Young" not "Novice 1 Young Mon 5:30-6:15pm")
  - Age ranges are assigned to the right program types
  - Session start/end dates look right (session_start = earliest event date, session_end = latest)
  - Season assignment looks right

- [ ] If the dry-run output looks wrong, fix the script. Specific issues to watch for:
  - If `normalize_gga_title` isn't stripping suffixes correctly, adjust `_GGA_TITLE_SUFFIX_RE`
  - If age inference is wrong for a program type, adjust `_GGA_AGE_PATTERNS`

---

## Task 4: Run conversion and deactivate source

Only run this after the dry-run output is verified correct.

- [ ] Run the real conversion:

```bash
cd /Users/coach/Projects/LostCity/crawlers
source venv/bin/activate
python3 scripts/convert_events_to_programs.py --source georgia-gymnastics-academy
```

- [ ] Verify programs were created. Run in the Supabase SQL editor:

```sql
SELECT id, name, program_type, age_min, age_max, season, session_start, session_end, registration_status
FROM programs
WHERE source_id = (SELECT id FROM sources WHERE slug = 'georgia-gymnastics-academy')
ORDER BY name
LIMIT 30;
```

- [ ] If program records look correct, deactivate the source:

```bash
python3 scripts/convert_events_to_programs.py --source georgia-gymnastics-academy --deactivate
```

- [ ] Verify deactivation. Run in Supabase SQL editor:

```sql
-- Source should now be inactive
SELECT slug, is_active FROM sources WHERE slug = 'georgia-gymnastics-academy';

-- Events should now be deactivated
SELECT COUNT(*) FROM events e
JOIN sources s ON s.id = e.source_id
WHERE s.slug = 'georgia-gymnastics-academy'
  AND e.is_active = true;
-- Should return 0
```

---

## Task 5: Verify programs appear in Family portal API

- [ ] Start the web dev server:

```bash
cd /Users/coach/Projects/LostCity/web && npm run dev
```

- [ ] Hit the programs API:

```bash
curl "http://localhost:3000/api/programs?portal=atlanta-families&type=class&active=true" | python3 -m json.tool | head -60
```

- [ ] Verify the response contains Georgia Gymnastics Academy program records with `age_min`, `age_max`, `session_start`, `session_end`, and `registration_url` populated.

- [ ] Load the Family portal programs page in a browser:

```
http://localhost:3000/family/programs
```

Verify the programs appear with correct age ranges and enrollment links.

---

## Task 6: Commit

- [ ] Run the TypeScript check to confirm no regressions:

```bash
cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit
```

- [ ] Commit:

```bash
cd /Users/coach/Projects/LostCity
git add crawlers/scripts/convert_events_to_programs.py
git commit -m "feat: programs conversion script — Georgia Gymnastics Academy

Converts JackRabbit class session events to first-class program entities.
Groups 1,400+ daily class events into ~20 program records by class name.
Infers age_min/age_max from class title patterns (TumbleTykes, Novice, etc.)
Deactivates source after conversion — class codes have no consumer value.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Notes for future camp conversion

The `--camps` flag is scaffolded but not implemented in this plan. Summer camp conversion is a separate workstream because:

1. Camp events span many sources (YMCA, Atlanta DPR, Cobb Parks, etc.) with different patterns
2. Camp grouping logic requires matching session titles across date ranges, which varies by source
3. Summer 2026 is the target season — timing matters

When ready to implement camp conversion, extend this script with a `convert_camps(source_slug, dry_run)` function that:
- Fetches events WHERE `title ILIKE '%camp%'` for the specified source
- Groups by stripped title (remove date/session suffixes)
- Uses `start_date` + `end_date` for `session_start` + `session_end`
- Sets `program_type = "camp"`, `season = "summer"`
- Uses existing `price_min` for `cost_amount` and `ticket_url` for `registration_url`
