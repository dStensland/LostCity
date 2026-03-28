"""
Convert events that are really programs into the programs table.

Audit results (2026-03-27):
  - Georgia Gymnastics Academy: 770 active events, 47 distinct title variants
    collapse to ~9 program records by normalized class code.
    Title patterns observed: "TT3", "TT3 - Tues 5:30", "K1 (don't w/l)",
    "K1-1:15pm", "Nov1y - Thurs 4:20 (do not wl)", "Advanced - Tues 5:30"
    Registration URL: https://app.jackrabbitclass.com/regv2.asp?id=509235 (all same)

  Top summer camp sources (events WHERE title ILIKE '%camp%', future, active):
    dekalb-family-programs: 289
    woodward-summer-camps: 249
    mjcca-day-camps: 181
    the-coder-school: 179
    girl-scouts-greater-atlanta-camps: 89
    cobb-family-programs: 74
    trinity-summer-camps: 45
    high-museum-summer-art-camp: 41
    spruill-summer-camps: 41
    pace-summer-programs: 39
  Camp events: 1,982 total, 89% have end_date, 70% have price_min.

Target 1: Georgia Gymnastics Academy — JackRabbit class sessions
  Source slug: georgia-gymnastics-academy
  Program type: class
  Grouping: normalize internal codes (TT2→TumbleTykes 2-3yr, K1→Kindergarten, etc.)
  Age ranges decoded from class code patterns
  Season: derived from session_start date

Target 2: Summer camps from family sources (--camps flag, scaffolded for future use)
  Criteria: title ILIKE '%camp%' AND source in approved family source list
  Program type: camp
  Age ranges: from existing age_min/age_max columns if set

Usage:
  python3 scripts/convert_events_to_programs.py --source georgia-gymnastics-academy --dry-run
  python3 scripts/convert_events_to_programs.py --source georgia-gymnastics-academy
  python3 scripts/convert_events_to_programs.py --source georgia-gymnastics-academy --deactivate
"""
from __future__ import annotations

import argparse
import logging
import os
import re
import sys
from datetime import date
from collections import defaultdict
from typing import Optional

import requests

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

SUPABASE_URL = os.environ["SUPABASE_URL"]
# Prefer service role key for write access; fall back to anon key
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ["SUPABASE_KEY"]
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
# GGA title normalization
#
# Observed title variants that must collapse to the same program:
#   "TT3"  "TT3 - Tues 5:30"  "TT3 - Thur 5:30"  "TT3 - Tues 5:30 (don't w/l)"
#   "K1"   "K1 - Thurs 5:30"  "K1 (don't w/l)"   "K1-1:15pm"  "K1-1:15pm (don't w/l)"
#   "Nov1y"  "Nov1y - Thurs 4:20"  "Nov1y - Tues 4:20 (do not wl)"
#   "Advanced - Tues 5:30"
#
# Strategy:
#   1. Strip " (don't w/l)" / "(don't W/l)" / "(don't w/l)" / "(do not wl)" suffixes
#   2. Strip day-of-week + time suffix: " - Mon 5:30", " Thur 5:30", "-1:15pm" etc.
#   3. Strip any remaining trailing parenthetical
#   4. Strip trailing whitespace
# ---------------------------------------------------------------------------

# Step 1: strip waitlist notes (case-insensitive)
_WL_RE = re.compile(r"\s*\(don'?t\s+w/?l\)|\s*\(do\s+not\s+wl?\)|\s*\(don'?t\s+wait\s*list\)", re.I)

# Step 2: strip " - Day HH:MM" or " Day HH:MM" or "-HH:MMam/pm" suffixes
# Covers: " - Thurs 5:30", " - Tues 3:30 (don't w/l)", "-1:15pm", " Thur 5:30"
_DAY_TIME_RE = re.compile(
    r"[\s\-]+(?:mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)\w*\s+\d{1,2}:\d{2}.*$"
    r"|[\s\-]+\d{1,2}:\d{2}(?:am|pm).*$",
    re.I,
)

# Step 3: strip trailing parentheticals (safety net)
_TRAILING_PAREN_RE = re.compile(r"\s*\([^)]*\)\s*$")


def normalize_gga_title(raw_title: str) -> str:
    """
    Normalize a GGA class session title to a canonical program name.

    Examples:
      "TT3 - Tues 5:30 (don't w/l)"  → "TT3"
      "K1-1:15pm (don't w/l)"         → "K1"
      "Nov1y - Thurs 4:20"             → "Nov1y"
      "Nov2am"                          → "Nov2am"  (keep "am" — distinct from Nov2)
      "Advanced - Tues 5:30"           → "Advanced"
      "Intermediate"                    → "Intermediate"
      "Mommy & Me"                      → "Mommy & Me"
    """
    t = raw_title.strip()
    t = _WL_RE.sub("", t)
    t = _DAY_TIME_RE.sub("", t)
    t = _TRAILING_PAREN_RE.sub("", t)
    return t.strip()


# ---------------------------------------------------------------------------
# GGA class code → human-readable name and age range
#
# Decoded from crawler comments + JackRabbit class listing:
#   TT2 / TT2y = TumbleTykes® 2–3yr  (y = younger cohort of same age band)
#   TT3 / TT3y = TumbleTykes® 3–4yr
#   TT4 / TT4y = TumbleTykes® 4–5yr
#   K1         = Kindergarten/1st Grade class (ages 5–6)
#   Nov1 / Nov1y = Novice 1 / Novice 1 Young (ages 5–8; y = younger section)
#   Nov2 / Nov2y = Novice 2 (ages 6–10)
#   Nov2am       = Novice 2 morning section (same level, different schedule slot)
#   Nov3         = Novice 3 (ages 8–12)
#   Intermediate = Intermediate level (ages 9–14)
#   Advanced     = Advanced / Pre-team (ages 10–18)
#   Mommy & Me   = Parent/child introductory class (ages 1.5–3)
# ---------------------------------------------------------------------------

_GGA_CLASS_DECODE: dict[str, tuple[str, int, int]] = {
    # code_lower: (human_name, age_min, age_max)
    "mommy & me": ("Mommy & Me (Parent + Toddler)", 1, 3),
    "tt2":        ("TumbleTykes 2–3yr", 2, 3),
    "tt2y":       ("TumbleTykes 2–3yr (Young)", 2, 3),
    "tt3":        ("TumbleTykes 3–4yr", 3, 4),
    "tt3y":       ("TumbleTykes 3–4yr (Young)", 3, 4),
    "tt4":        ("TumbleTykes 4–5yr", 4, 5),
    "tt4y":       ("TumbleTykes 4–5yr (Young)", 4, 5),
    "k1":         ("Kindergarten / 1st Grade", 5, 6),
    "nov1":       ("Novice 1", 5, 8),
    "nov1y":      ("Novice 1 Young", 5, 7),
    "nov2":       ("Novice 2", 7, 10),
    "nov2y":      ("Novice 2 Young", 6, 9),
    "nov2am":     ("Novice 2 (Morning)", 7, 10),
    "nov3":       ("Novice 3", 9, 12),
    "intermediate": ("Intermediate", 9, 14),
    "advanced":   ("Advanced / Pre-Team", 11, 18),
}


def decode_gga_class(normalized_title: str) -> tuple[str, int | None, int | None]:
    """
    Return (human_name, age_min, age_max) for a normalized GGA class code.
    Falls back to title itself if not recognized.
    """
    key = normalized_title.strip().lower()
    if key in _GGA_CLASS_DECODE:
        name, age_min, age_max = _GGA_CLASS_DECODE[key]
        return name, age_min, age_max
    # Unrecognized code — return as-is with no age bounds
    logger.warning(f"Unrecognized GGA class code: '{normalized_title}'")
    return normalized_title, None, None


# ---------------------------------------------------------------------------
# Season inference from session dates
# ---------------------------------------------------------------------------


def infer_season(session_start: str | None) -> str | None:
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
    """
    Convert Georgia Gymnastics Academy class session events to programs.
    Returns (events_found, programs_created).

    Groups 770 daily class session events into ~9 program records by
    normalized class code. Each program represents one class offering,
    covering its full session span (earliest to latest event date).
    """
    logger.info("Fetching Georgia Gymnastics Academy source...")

    sources = supabase_get(
        "sources",
        {"slug": "eq.georgia-gymnastics-academy", "select": "id,owner_portal_id"},
    )
    if not sources:
        logger.error("Source 'georgia-gymnastics-academy' not found in sources table.")
        return 0, 0

    source = sources[0]
    source_id = source["id"]
    portal_id = source.get("owner_portal_id")
    logger.info(f"Source ID: {source_id}, Portal ID: {portal_id}")

    # Fetch all active events from this source (up to 2000 — well above 770)
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

    # Normalize titles and group by canonical program code
    programs_by_code: dict[str, list[dict]] = defaultdict(list)
    unrecognized_codes: set[str] = set()

    for ev in events:
        normalized = normalize_gga_title(ev["title"])
        programs_by_code[normalized].append(ev)
        if normalized.strip().lower() not in _GGA_CLASS_DECODE:
            unrecognized_codes.add(normalized)

    logger.info(f"Grouped into {len(programs_by_code)} distinct program codes")
    if unrecognized_codes:
        logger.warning(f"Unrecognized class codes (will still be converted): {sorted(unrecognized_codes)}")

    # GGA enrollment URL — same for all classes (org-level JackRabbit page)
    enrollment_url = "https://app.jackrabbitclass.com/regv2.asp?id=509235"

    # Resolve venue_id from the first event
    all_venue_ids = {ev["venue_id"] for ev in events if ev.get("venue_id")}
    venue_id = next(iter(all_venue_ids)) if all_venue_ids else None

    converted = 0
    for code, event_instances in sorted(programs_by_code.items()):
        human_name, age_min, age_max = decode_gga_class(code)
        session_start = min(ev["start_date"] for ev in event_instances)
        session_end = max(
            ev.get("end_date") or ev["start_date"] for ev in event_instances
        )
        season = infer_season(session_start)

        # Use modal price (most common price_min across instances)
        prices = [ev["price_min"] for ev in event_instances if ev.get("price_min") is not None]
        cost_amount: float | None = None
        if prices:
            # most common price
            from collections import Counter
            price_counter = Counter(prices)
            cost_amount = float(price_counter.most_common(1)[0][0])

        full_name = f"Georgia Gymnastics Academy — {human_name}"
        program_slug = f"gga-{slugify(human_name)}"

        if age_min is not None and age_max is not None:
            description = (
                f"Gymnastics class for ages {age_min}–{age_max} at Georgia Gymnastics Academy "
                f"in Suwanee, GA. Sessions run through the {season or 'current'} season. "
                f"Enrollment via JackRabbit online portal."
            )
        else:
            description = (
                f"Gymnastics class at Georgia Gymnastics Academy in Suwanee, GA. "
                f"Sessions run through the {season or 'current'} season. "
                f"Enrollment via JackRabbit online portal."
            )

        program_record = {
            "portal_id": portal_id,
            "source_id": source_id,
            "venue_id": venue_id,
            "name": full_name,
            "slug": program_slug,
            "description": description,
            "program_type": "class",
            "provider_name": "Georgia Gymnastics Academy",
            "age_min": age_min,
            "age_max": age_max,
            "season": season,
            "session_start": session_start,
            "session_end": session_end,
            "cost_amount": cost_amount,
            "cost_period": "per_session" if cost_amount else None,
            "registration_status": "open",
            "registration_url": enrollment_url,
            "tags": ["gymnastics", "kids", "class", "family-friendly"],
            "status": "active",
        }

        if dry_run:
            age_str = f"ages {age_min}–{age_max}" if age_min is not None else "age unknown"
            logger.info(
                f"[DRY RUN] Would create program: '{full_name}' | "
                f"{age_str} | {len(event_instances)} sessions | "
                f"season={season} | {session_start} → {session_end} | "
                f"cost=${cost_amount}"
            )
            converted += 1
            continue

        # Check for existing program (avoid duplicate slugs on re-run)
        existing = supabase_get("programs", {"slug": f"eq.{program_slug}", "select": "id"})
        if existing:
            logger.info(f"Program already exists: {program_slug}, skipping")
            continue

        try:
            result = supabase_post("programs", program_record)
            logger.info(f"Created program: {result.get('id')} — {full_name}")
            converted += 1
        except Exception as exc:
            logger.error(f"Failed to create program '{full_name}': {exc}")

    return len(events), converted


# ---------------------------------------------------------------------------
# Deactivate Georgia Gymnastics Academy source + events
# ---------------------------------------------------------------------------


def deactivate_georgia_gymnastics(dry_run: bool) -> None:
    """Deactivate the source and all its active events."""
    sources = supabase_get("sources", {"slug": "eq.georgia-gymnastics-academy", "select": "id"})
    if not sources:
        logger.error("Source 'georgia-gymnastics-academy' not found.")
        return

    source_id = sources[0]["id"]

    if dry_run:
        logger.info(f"[DRY RUN] Would deactivate source ID {source_id} and all its active events")
        return

    # Deactivate source
    supabase_patch("sources", {"id": f"eq.{source_id}"}, {"is_active": False})
    logger.info(f"Deactivated source ID {source_id} (georgia-gymnastics-academy)")

    # Deactivate all active events from this source
    supabase_patch(
        "events",
        {"source_id": f"eq.{source_id}", "is_active": "eq.true"},
        {"is_active": False},
    )
    logger.info(f"Deactivated all active events from source {source_id}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Convert events that are really programs into the programs table.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Dry-run — preview without writing
  python3 scripts/convert_events_to_programs.py --source georgia-gymnastics-academy --dry-run

  # Convert events to programs
  python3 scripts/convert_events_to_programs.py --source georgia-gymnastics-academy

  # Convert AND deactivate source + events
  python3 scripts/convert_events_to_programs.py --source georgia-gymnastics-academy --deactivate
        """,
    )
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
        help="After conversion, deactivate source and its events. "
             "Not implied by --source alone — must be explicit.",
    )
    args = parser.parse_args()

    if not args.source:
        parser.print_help()
        sys.exit(1)

    if args.source == "georgia-gymnastics-academy":
        found, converted = convert_georgia_gymnastics(args.dry_run)
        mode = "would be created" if args.dry_run else "created"
        logger.info(f"Summary: {found} events found → {converted} programs {mode}")

        if args.deactivate:
            deactivate_georgia_gymnastics(args.dry_run)
        elif not args.dry_run:
            logger.info(
                "Programs created. Pass --deactivate to disable the source and its events "
                "after verifying program output."
            )


if __name__ == "__main__":
    main()
