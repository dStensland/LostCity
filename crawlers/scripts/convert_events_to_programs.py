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

Target 2: Summer camps from family sources (--camps flag)
  Criteria: title ILIKE '%camp%' AND source in approved family source list
  Program type: camp
  Grouping: (normalized_title, age_min, age_max) — same camp repeated across weeks
             collapses; different age bands stay as separate programs
  Age ranges: from existing age_min/age_max DB columns (all 10 sources have these)

Usage:
  python3 scripts/convert_events_to_programs.py --source georgia-gymnastics-academy --dry-run
  python3 scripts/convert_events_to_programs.py --source georgia-gymnastics-academy
  python3 scripts/convert_events_to_programs.py --source georgia-gymnastics-academy --deactivate

  python3 scripts/convert_events_to_programs.py --source dekalb-family-programs --camps --dry-run
  python3 scripts/convert_events_to_programs.py --source dekalb-family-programs --camps
  python3 scripts/convert_events_to_programs.py --source dekalb-family-programs --camps --deactivate
"""
from __future__ import annotations

import argparse
import logging
import os
import re
import sys
from collections import Counter, defaultdict
from datetime import date

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
# Approved camp sources (--camps mode)
# ---------------------------------------------------------------------------

CAMP_SOURCES = [
    "dekalb-family-programs",
    "woodward-summer-camps",
    "mjcca-day-camps",
    "high-museum-summer-art-camp",
    "spruill-summer-camps",
    "girl-scouts-greater-atlanta-camps",
    "trinity-summer-camps",
    "pace-summer-programs",
    "zoo-atlanta-summer-safari-camp",
    "lovett-summer-programs",
    # the-coder-school and cobb-family-programs: add in follow-up batch
]


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
# Camp title normalization
#
# Each source has a distinct title pattern. We strip:
#   1. Source-brand prefix: "Woodward Summer Camp: ", "Spruill Summer Camp: WEEK N: ", etc.
#   2. Week/session number: " Week#1", " Week 1", "WEEK 08:", " Session 1", etc.
#   3. Schedule suffix: " (AM)", " (Full Day)", " *4-Day Camp", etc.
#   4. Venue suffix: " at Woodward Academy", " at MJCCA Day Camps", etc.
#   5. Age/grade suffix: " (Ages 5-10)", " Ages TEENS", " (Grades 3-4)", etc.
#   6. Year prefix: "2026 Summer Camp(venue) " → normalize
#   7. Trailing parentheticals and whitespace
#
# Grouping key is (normalized_title, age_min, age_max) so that:
#   - "Adventure Camp Week 1 Ages 5-6" and "Adventure Camp Week 2 Ages 5-6" → same program
#   - "Adventure Camp Week 1 Ages 5-6" and "Adventure Camp Week 1 Ages 7-9" → different programs
#   (age_min/age_max already stored in the events table for all 10 sources)
# ---------------------------------------------------------------------------

# DeKalb "Year Summer Camp(VenueName) Week#N Ages X-Y" → "VenueName Summer Camp"
# e.g. "2026 Summer Camp(Lucious Sanders) Week#1 Ages 10-12" → "Lucious Sanders Summer Camp"
_DEKALB_VENUE_CAMP_RE = re.compile(
    r"^\d{4}\s+summer\s+camp\s*\(([^)]+)\)\s*.*$", re.I
)

# Strip source-brand prefixes (applied before other stripping)
_BRAND_PREFIX_RES: list[re.Pattern] = [
    # "Woodward Summer Camp: " (with optional "Woodward Summer Camp:  ")
    re.compile(r"^woodward\s+summer\s+camp\s*:\s*", re.I),
    # "High Museum Summer Art Camp: " + week token (e.g. "Week 1: ")
    re.compile(r"^high\s+museum\s+summer\s+art\s+camp\s*:\s*(?:week\s+\d+\s*:\s*)?", re.I),
    # "Spruill Summer Camp: WEEK N: " or "Spruill Summer Camp: WEEK NN: "
    re.compile(r"^spruill\s+summer\s+camp\s*:\s*week\s+\d+\s*:\s*", re.I),
    # "Pace Summer Camp: "  (hypothetical — handle gracefully)
    re.compile(r"^pace\s+summer\s+(?:camp|programs?)\s*:\s*", re.I),
    # "Trinity Summer Camp: "
    re.compile(r"^trinity\s+summer\s+camps?\s*:\s*", re.I),
    # "Zoo Atlanta Summer Safari Camp: "
    re.compile(r"^zoo\s+atlanta\s+summer\s+safari\s+camps?\s*:\s*", re.I),
    # "Exchange 2026 Summer Camp " style (DeKalb Exchange Recreation Center)
    re.compile(r"^exchange\s+\d{4}\s+summer\s+camp\s*", re.I),
    # "East Central DeKalb - " prefix
    re.compile(r"^east\s+central\s+dekalb\s*[-–]\s*", re.I),
]

# Strip week/session number tokens anywhere in string
# Covers: " Week#1", " Week 1", "Wk. #3", " Wk#3", " Session 2", "WEEK 08"
_WEEK_SESSION_RE = re.compile(
    r"\s*[-–|]?\s*\bweek\s*#?\s*\d+\b.*$"           # " Week#1 ..." or " - Week 1 ..."
    r"|\s*\bwk\.?\s*#?\s*\d+\b.*$"                   # " Wk#3 ..." or " Wk. #3 ..."
    r"|\s*\bsession\s+\d+\b(?:\s*\([^)]*\))?",       # " Session 2" or " Session 2 (AM)"
    re.I,
)

# Strip schedule/format annotations
_SCHEDULE_ANNOT_RE = re.compile(
    r"\s*\*?\s*\d+-day\s+camp\b.*$"                  # " *4-Day Camp"
    r"|\s*\([^)]*\bday\b[^)]*\)\s*$"                 # " (Full Day)" " (Half Day)" " (AM)"
    r"|\s*\(am\)\s*$"                                 # " (AM)"
    r"|\s*\(pm\)\s*$",                                # " (PM)"
    re.I,
)

# Strip venue suffix: " at [Venue Name]"
_VENUE_SUFFIX_RE = re.compile(r"\s+at\s+.+$", re.I)

# Strip age/grade suffix from title
# Handles: "(Ages 5-10)", "Ages TEENS", "(Grades 3-4)", "(Rising Kindergarten)",
#          "(5-6yrs)", " 7 - 8yrs", "Ages 11-12", "Teens", "(TEENS)"
_AGE_GRADE_SUFFIX_RE = re.compile(
    r"\s*[-–|]?\s*\(?ages?\s*\d{1,2}\s*[-–]\s*\d{1,2}\s*(?:yrs?)?\)?.*$"  # "(Ages 5-10)"
    r"|\s*[-–|]?\s*\(?ages?\s+teens?\s*\)?.*$"                              # "Ages TEENS"
    r"|\s*[-–|]?\s*\(teens?\).*$"                                            # "(TEENS)" standalone
    r"|\s*[-–|]?\s*\(?grades?\s+[k\d][-–]\d+\s*\)?.*$"                     # "(Grades 3-4)"
    r"|\s*[-–|]?\s*\(?rising\s+\w+\s*\)?.*$"                                # "(Rising Kindergarten)"
    r"|\s*\(\d{1,2}\s*[-–]\s*\d{1,2}\s*yrs?\).*$"                          # "(5-6yrs)" "(7 - 8yrs)"
    r"|\s*[-–|]?\s*\d{1,2}\s*[-–]\s*\d{1,2}\s*(?:yrs?|years?).*$",         # " 6-8 yrs"
    re.I,
)

# Strip trailing date ranges in title
_DATE_SUFFIX_RE = re.compile(
    r"\s*[-–|]?\s*\(?\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}.*$"
    r"|\s*[-–|]?\s*\(?(?:monday|tuesday|wednesday|thursday|friday),?\s+\w+\s+\d+,?\s+\d{4}\s*\)?.*$",
    re.I,
)

# Strip trailing parentheticals (safety net, applied last)
_TRAILING_PAREN_RE_CAMP = re.compile(r"\s*\([^)]*\)\s*$")


def normalize_camp_title(raw_title: str) -> str:
    """
    Normalize a camp event title to a canonical program name.

    The normalized title is used as one component of the grouping key.
    The other component is (age_min, age_max) from the DB, so age bands
    with the same camp name become separate programs.

    Examples:
      "2026 Summer Camp(Lucious Sanders) Week#1 Ages 10-12"
          → "Lucious Sanders Summer Camp"
      "Woodward Summer Camp: 1st Grade Bootcamp Session 1 (AM) at Woodward Academy"
          → "1st Grade Bootcamp"
      "High Museum Summer Art Camp: Week 1: Animals in Art (Rising Kindergarten) at High Museum of Art"
          → "Animals in Art"
      "Abrakadabra Camp at MJCCA Day Camps"
          → "Abrakadabra Camp"
      "Brownie Campfire Cooks at Camp Timber Ridge"
          → "Brownie Campfire Cooks"
      "Spruill Summer Camp: WEEK 2: Drawing Studio (Ages 11-14) at Spruill Center for the Arts"
          → "Drawing Studio"
      "Alliance Theatre Drama Camp at The Lovett School"
          → "Alliance Theatre Drama Camp"
      "East Central DeKalb - Camp Superstars 2026"
          → "Camp Superstars 2026"
      "Exchange Spring Break Camp 2026- Monday, April 6, 2026"
          → "Exchange Spring Break Camp 2026"
    """
    t = raw_title.strip()

    # 0. Special case: DeKalb "Year Summer Camp(VenueName) Week#N Ages X-Y"
    #    Extract the venue name and form "VenueName Summer Camp"
    m = _DEKALB_VENUE_CAMP_RE.match(t)
    if m:
        return m.group(1).strip() + " Summer Camp"

    # 1. Strip source-brand prefixes
    for prefix_re in _BRAND_PREFIX_RES:
        t = prefix_re.sub("", t)

    # 2. Strip week/session numbers
    t = _WEEK_SESSION_RE.sub("", t)

    # 3. Strip schedule annotations
    t = _SCHEDULE_ANNOT_RE.sub("", t)

    # 4. Strip venue suffix (" at Venue Name")
    t = _VENUE_SUFFIX_RE.sub("", t)

    # 5. Strip date suffix (e.g. "- Monday, April 6, 2026")
    t = _DATE_SUFFIX_RE.sub("", t)

    # 6. Strip age/grade suffix
    t = _AGE_GRADE_SUFFIX_RE.sub("", t)

    # 7. Strip trailing parentheticals (safety net)
    t = _TRAILING_PAREN_RE_CAMP.sub("", t)

    # 8. Clean up leftover punctuation at end (including trailing period from some DeKalb titles)
    t = re.sub(r"[\s\-–:,|.]+$", "", t)

    return t.strip() or raw_title.strip()


# ---------------------------------------------------------------------------
# Age range inference from camp titles (fallback when DB columns are empty)
# ---------------------------------------------------------------------------

_AGE_RANGE_RE = re.compile(r"ages?\s*(\d{1,2})\s*[-–]\s*(\d{1,2})", re.I)
_AGE_SINGLE_RE = re.compile(r"ages?\s*(\d{1,2})\s*\+?", re.I)


def infer_age_range_from_title(title: str) -> tuple[int | None, int | None]:
    """Extract age_min, age_max from title if present. Used as fallback."""
    m = _AGE_RANGE_RE.search(title)
    if m:
        return int(m.group(1)), int(m.group(2))
    m = _AGE_SINGLE_RE.search(title)
    if m:
        age = int(m.group(1))
        return age, age + 4  # reasonable default span for a single-age marker
    return None, None


# ---------------------------------------------------------------------------
# Core conversion: camp events → program records
# ---------------------------------------------------------------------------


def convert_camps(source_slug: str, dry_run: bool) -> tuple[int, int]:
    """
    Convert summer camp events from a single source into program records.
    Returns (events_found, programs_created).

    Grouping key: (normalized_title, age_min, age_max)
    This ensures:
      - Same camp across multiple weeks collapses to one program per age band
      - Different age bands of the same camp name become separate programs

    Criteria for events to convert:
      - is_active = true
      - title ILIKE '%camp%'
      - end_date IS NOT NULL  (can't determine session span without it)
    """
    logger.info(f"Fetching source: {source_slug}")

    sources = supabase_get(
        "sources",
        {"slug": f"eq.{source_slug}", "select": "id,owner_portal_id,name"},
    )
    if not sources:
        logger.error(f"Source '{source_slug}' not found in sources table.")
        return 0, 0

    source = sources[0]
    source_id = source["id"]
    portal_id = source.get("owner_portal_id")
    provider_name = source.get("name", source_slug)
    logger.info(f"Source ID: {source_id}, Portal ID: {portal_id}, Provider: {provider_name}")

    # Fetch camp events (title must contain 'camp', end_date must be present)
    events = supabase_get(
        "events",
        {
            "source_id": f"eq.{source_id}",
            "is_active": "eq.true",
            "title": "ilike.*camp*",
            "end_date": "not.is.null",
            "select": (
                "id,title,start_date,end_date,start_time,end_time,"
                "price_min,venue_id,source_url,tags,age_min,age_max,"
                "ticket_url"
            ),
            "order": "start_date.asc",
            "limit": "3000",
        },
    )
    logger.info(f"Found {len(events)} camp events (with end_date) from {source_slug}")

    if not events:
        return 0, 0

    # Group by (normalized_title, age_min, age_max)
    # Using age from DB columns (all 10 sources have these populated)
    programs_by_key: dict[tuple[str, int | None, int | None], list[dict]] = defaultdict(list)
    for ev in events:
        normalized = normalize_camp_title(ev["title"])
        age_min_key = ev.get("age_min")
        age_max_key = ev.get("age_max")
        key = (normalized, age_min_key, age_max_key)
        programs_by_key[key].append(ev)

    logger.info(f"Collapsed to {len(programs_by_key)} distinct programs (title × age band)")

    # Resolve venue_id — use modal venue across all events for this source
    all_venue_ids = [ev["venue_id"] for ev in events if ev.get("venue_id")]
    venue_id: int | None = None
    if all_venue_ids:
        venue_id = Counter(all_venue_ids).most_common(1)[0][0]

    converted = 0

    for (camp_name, age_min, age_max), event_instances in sorted(
        programs_by_key.items(), key=lambda x: (x[0][0], x[0][1] or 0, x[0][2] or 0)
    ):
        # Session span = earliest start_date → latest end_date across all instances
        session_start = min(ev["start_date"] for ev in event_instances)
        session_end = max(
            ev.get("end_date") or ev["start_date"] for ev in event_instances
        )
        season = infer_season(session_start)

        # If DB age columns were empty, try title inference as fallback
        if age_min is None or age_max is None:
            inferred_ages = [infer_age_range_from_title(ev["title"]) for ev in event_instances]
            inferred_mins = [a[0] for a in inferred_ages if a[0] is not None]
            inferred_maxs = [a[1] for a in inferred_ages if a[1] is not None]
            if age_min is None:
                age_min = min(inferred_mins) if inferred_mins else None
            if age_max is None:
                age_max = max(inferred_maxs) if inferred_maxs else None

        # Cost: modal price_min across instances
        prices = [ev["price_min"] for ev in event_instances if ev.get("price_min") is not None]
        cost_amount: float | None = None
        if prices:
            cost_amount = float(Counter(prices).most_common(1)[0][0])

        # Registration URL: first non-null ticket_url, fall back to source_url
        registration_url: str | None = None
        for ev in event_instances:
            if ev.get("ticket_url"):
                registration_url = ev["ticket_url"]
                break
        if not registration_url:
            for ev in event_instances:
                if ev.get("source_url"):
                    registration_url = ev["source_url"]
                    break

        # Schedule days: day-of-week distribution across instances
        dow_counts: dict[int, int] = defaultdict(int)
        for ev in event_instances:
            try:
                d = date.fromisoformat(ev["start_date"][:10])
                dow_counts[d.isoweekday()] += 1  # ISO: 1=Mon, 7=Sun
            except ValueError:
                pass
        total_instances = len(event_instances)
        schedule_days = sorted(
            day for day, count in dow_counts.items()
            if total_instances > 0 and count / total_instances >= 0.20
        ) or None

        # Build slug: source-campname[-agemin-agemax]
        age_suffix = f"-{age_min}-{age_max}" if age_min is not None else ""
        program_slug = f"{slugify(source_slug)}-{slugify(camp_name)}{age_suffix}"

        # Build description
        age_str = f"ages {age_min}–{age_max}" if age_min is not None else "all ages"
        description = (
            f"{camp_name} at {provider_name}. "
            f"{season.capitalize() if season else 'Seasonal'} camp for {age_str}. "
            f"Sessions run {session_start} through {session_end}."
        )

        program_record = {
            "portal_id": portal_id,
            "source_id": source_id,
            "place_id": venue_id,
            "name": camp_name,
            "slug": program_slug,
            "description": description,
            "program_type": "camp",
            "provider_name": provider_name,
            "age_min": age_min,
            "age_max": age_max,
            "season": season,
            "session_start": session_start,
            "session_end": session_end,
            "schedule_days": schedule_days,
            "cost_amount": cost_amount,
            "cost_period": "per_session" if cost_amount else None,
            "registration_status": "open",
            "registration_url": registration_url,
            "tags": ["camp", "kids", "summer", "family-friendly"],
            "status": "active",
        }

        age_label = f"ages {age_min}–{age_max}" if age_min is not None else "age unknown"

        if dry_run:
            logger.info(
                f"[DRY RUN] {camp_name!r} | {age_label} | "
                f"{len(event_instances)} instances | season={season} | "
                f"{session_start} → {session_end} | cost=${cost_amount}"
            )
            converted += 1
            continue

        # Check for existing program by slug (idempotent re-runs)
        existing = supabase_get("programs", {"slug": f"eq.{program_slug}", "select": "id"})
        if existing:
            logger.info(f"Already exists: {program_slug}, skipping")
            continue

        try:
            result = supabase_post("programs", program_record)
            logger.info(f"Created program {result.get('id')}: {camp_name!r} ({age_label})")
            converted += 1
        except Exception as exc:
            logger.error(f"Failed to create '{camp_name}' ({age_label}): {exc}")

    return len(events), converted


# ---------------------------------------------------------------------------
# Deactivate camp events (NOT the source — it will produce new events next year)
# ---------------------------------------------------------------------------


def deactivate_camp_events(source_slug: str, dry_run: bool) -> None:
    """
    Deactivate camp events from a source that have been converted to programs.
    Does NOT deactivate the source — it will produce new events next year.
    """
    sources = supabase_get("sources", {"slug": f"eq.{source_slug}", "select": "id"})
    if not sources:
        logger.error(f"Source '{source_slug}' not found.")
        return

    source_id = sources[0]["id"]

    if dry_run:
        logger.info(
            f"[DRY RUN] Would deactivate camp events from source {source_id} ({source_slug}). "
            f"Source itself stays active."
        )
        return

    supabase_patch(
        "events",
        {
            "source_id": f"eq.{source_id}",
            "is_active": "eq.true",
            "title": "ilike.*camp*",
        },
        {"is_active": False},
    )
    logger.info(
        f"Deactivated camp events from source {source_id} ({source_slug}). "
        f"Source remains active for future crawls."
    )


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
            "place_id": venue_id,
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
  # GGA: dry-run, convert, deactivate
  python3 scripts/convert_events_to_programs.py --source georgia-gymnastics-academy --dry-run
  python3 scripts/convert_events_to_programs.py --source georgia-gymnastics-academy
  python3 scripts/convert_events_to_programs.py --source georgia-gymnastics-academy --deactivate

  # Camps: dry-run first, then live, then deactivate events (NOT source)
  python3 scripts/convert_events_to_programs.py --source dekalb-family-programs --camps --dry-run
  python3 scripts/convert_events_to_programs.py --source dekalb-family-programs --camps
  python3 scripts/convert_events_to_programs.py --source dekalb-family-programs --camps --deactivate
        """,
    )
    parser.add_argument(
        "--source",
        choices=["georgia-gymnastics-academy"] + CAMP_SOURCES,
        help="Specific source to convert",
    )
    parser.add_argument(
        "--camps",
        action="store_true",
        help="Convert camp events (title ILIKE %%camp%%) from the specified source",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview without writing to DB",
    )
    parser.add_argument(
        "--deactivate",
        action="store_true",
        help="After conversion, deactivate camp events (not the source for camps). "
             "Must be explicit — not implied by --camps alone.",
    )
    args = parser.parse_args()

    if not args.source:
        parser.print_help()
        sys.exit(1)

    if args.source == "georgia-gymnastics-academy" and not args.camps:
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
    elif args.camps:
        if args.source not in CAMP_SOURCES:
            logger.error(f"--camps requires a source from the approved list: {CAMP_SOURCES}")
            sys.exit(1)
        found, converted = convert_camps(args.source, args.dry_run)
        mode = "would be created" if args.dry_run else "created"
        logger.info(f"Summary: {found} camp events → {converted} programs {mode}")
        if args.deactivate:
            deactivate_camp_events(args.source, args.dry_run)
        elif not args.dry_run:
            logger.info(
                "Programs created. Pass --deactivate to disable camp events "
                "after verifying program output."
            )
    else:
        logger.error("Specify --camps for camp sources, or use georgia-gymnastics-academy without --camps.")
        sys.exit(1)


if __name__ == "__main__":
    main()
