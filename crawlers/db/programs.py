"""
Program insert/update and dedup lookups for the programs table.

Programs are structured activities with sessions, age ranges, and registration
(swim lessons, camps, classes, leagues). They sit alongside events as a
first-class entity — events answer "what's happening" while programs answer
"what can I sign up for."

Follows the same patterns as db/events.py: validate → resolve → dedupe → insert.
"""

import hashlib
import logging
import re
from datetime import date
from typing import Optional

from db.client import (
    get_client,
    retry_on_network_error,
    writes_enabled,
    _next_temp_id,
    _log_write_skip,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Program type inference
# ---------------------------------------------------------------------------

_CAMP_RE = re.compile(r"\bcamp\b|\bday camp\b|\bsummer camp\b", re.IGNORECASE)
_LEAGUE_RE = re.compile(r"\bleague\b|\btournament\b", re.IGNORECASE)
_CLASS_RE = re.compile(
    r"\bclass(?:es)?\b|\blesson(?:s)?\b|\binstruction\b|\bclinic\b",
    re.IGNORECASE,
)
_CLUB_RE = re.compile(r"\bclub\b|\bafter.?school\b", re.IGNORECASE)
_ENRICHMENT_RE = re.compile(
    r"\benrichment\b|\bworkshop\b|\bstem\b|\bcoding\b|\bart\b|\bmusic\b|\bdance\b",
    re.IGNORECASE,
)

# Rec1 registration type → program type
_REG_TYPE_TO_PROGRAM_TYPE = {
    "1": "league",       # League
    "2": "class",        # Program/Class
    "5": "rec_program",  # Drop-In
    "8": "camp",         # Camps
}


def infer_program_type(
    title: str,
    reg_type: Optional[str] = None,
    section_name: str = "",
) -> str:
    """Infer program_type from title text and optional registration type."""
    # Explicit reg_type mapping takes priority
    if reg_type and reg_type in _REG_TYPE_TO_PROGRAM_TYPE:
        return _REG_TYPE_TO_PROGRAM_TYPE[reg_type]

    combined = f"{title} {section_name}"
    if _CAMP_RE.search(combined):
        return "camp"
    if _LEAGUE_RE.search(combined):
        return "league"
    if _CLUB_RE.search(combined):
        return "club"
    if _ENRICHMENT_RE.search(combined):
        return "enrichment"
    if _CLASS_RE.search(combined):
        return "class"
    return "rec_program"


# ---------------------------------------------------------------------------
# Season inference
# ---------------------------------------------------------------------------

_SEASON_MONTH_MAP = {
    1: "winter", 2: "winter", 3: "spring", 4: "spring", 5: "spring",
    6: "summer", 7: "summer", 8: "summer", 9: "fall", 10: "fall",
    11: "fall", 12: "winter",
}

_SEASON_RE = re.compile(
    r"\b(summer|fall|autumn|spring|winter|year.?round)\b", re.IGNORECASE
)


def infer_season(
    title: str,
    session_start: Optional[date] = None,
) -> Optional[str]:
    """Infer season from title text or session start date."""
    m = _SEASON_RE.search(title)
    if m:
        raw = m.group(1).lower()
        if raw == "autumn":
            return "fall"
        if "year" in raw:
            return "year_round"
        return raw

    if session_start:
        return _SEASON_MONTH_MAP.get(session_start.month)

    return None


# ---------------------------------------------------------------------------
# Cost period inference
# ---------------------------------------------------------------------------

_COST_PERIOD_RE = {
    "per_session": re.compile(r"\bper session\b|\bper class\b|\bdrop.?in\b", re.IGNORECASE),
    "per_week": re.compile(r"\bper week\b|\bweekly\b", re.IGNORECASE),
    "per_month": re.compile(r"\bper month\b|\bmonthly\b", re.IGNORECASE),
}


def infer_cost_period(
    cost_notes: Optional[str] = None,
    reg_type: Optional[str] = None,
) -> Optional[str]:
    """Infer cost_period from notes text or registration type."""
    if cost_notes:
        for period, pattern in _COST_PERIOD_RE.items():
            if pattern.search(cost_notes):
                return period

    # Drop-in → per session
    if reg_type == "5":
        return "per_session"

    # Default for camps and multi-session programs
    return "per_season"


# ---------------------------------------------------------------------------
# Slug generation
# ---------------------------------------------------------------------------

_SLUG_RE = re.compile(r"[^a-z0-9]+")


def _generate_program_slug(
    venue_name: str,
    program_name: str,
    season: Optional[str] = None,
) -> str:
    """Generate a URL-safe slug: '{venue}-{program}-{season}', max 80 chars."""
    parts = [venue_name, program_name]
    if season:
        parts.append(season)
    raw = "-".join(parts).lower()
    slug = _SLUG_RE.sub("-", raw).strip("-")
    return slug[:80]


# ---------------------------------------------------------------------------
# Content hash for dedup
# ---------------------------------------------------------------------------


def generate_program_hash(name: str, venue_id: int, session_start: Optional[str]) -> str:
    """MD5 hash on (name, venue_id, session_start) for dedup."""
    key = f"{name.strip().lower()}|{venue_id}|{session_start or ''}"
    return hashlib.md5(key.encode()).hexdigest()


# ---------------------------------------------------------------------------
# Dedup lookup
# ---------------------------------------------------------------------------


def find_program_by_hash(content_hash: str) -> Optional[dict]:
    """Look up a program by its content hash (stored in metadata.content_hash)."""
    client = get_client()
    result = (
        client.table("programs")
        .select("id, name, venue_id, session_start, updated_at")
        .eq("metadata->>content_hash", content_hash)
        .limit(1)
        .execute()
    )
    if result.data:
        return result.data[0]
    return None


# ---------------------------------------------------------------------------
# Insert
# ---------------------------------------------------------------------------

_PROGRAM_COLUMNS = {
    "portal_id", "source_id", "venue_id", "name", "slug", "description",
    "program_type", "provider_name", "age_min", "age_max", "season",
    "session_start", "session_end", "schedule_days", "schedule_start_time",
    "schedule_end_time", "cost_amount", "cost_period", "cost_notes",
    "registration_status", "registration_opens", "registration_closes",
    "registration_url", "before_after_care", "lunch_included", "tags",
    "status", "metadata",
}


@retry_on_network_error(max_retries=4, base_delay=0.5)
def _insert_program_record(client, program_data: dict):
    """Insert program row with retries for transient network errors."""
    return client.table("programs").insert(program_data).execute()


def insert_program(program_data: dict) -> Optional[str]:
    """
    Insert a new program. Returns the program UUID, or None on skip/failure.

    Pipeline: validate → generate slug → dedupe → insert.
    """
    name = program_data.get("name", "").strip()
    if not name:
        logger.warning("Skipping program with empty name")
        return None

    venue_id = program_data.get("venue_id")
    if not venue_id:
        logger.warning("Skipping program %r — no venue_id", name)
        return None

    program_type = program_data.get("program_type")
    if not program_type:
        logger.warning("Skipping program %r — no program_type", name)
        return None

    # Generate content hash for dedup
    session_start = program_data.get("session_start")
    content_hash = generate_program_hash(name, venue_id, session_start)

    # Dedup check
    existing = find_program_by_hash(content_hash)
    if existing:
        logger.debug("Program %r already exists (id=%s), updating", name, existing["id"])
        update_program(existing["id"], program_data)
        return existing["id"]

    # Generate slug if not provided
    if not program_data.get("slug"):
        venue_name = program_data.pop("_venue_name", "") or "venue"
        season = program_data.get("season")
        program_data["slug"] = _generate_program_slug(venue_name, name, season)

    # Store content hash in metadata
    metadata = program_data.get("metadata") or {}
    metadata["content_hash"] = content_hash
    program_data["metadata"] = metadata

    # Filter to only valid columns
    filtered = {k: v for k, v in program_data.items() if k in _PROGRAM_COLUMNS}

    # Default status
    if "status" not in filtered:
        filtered["status"] = "active"

    # Default registration_status
    if "registration_status" not in filtered:
        filtered["registration_status"] = "unknown"

    if not writes_enabled():
        _log_write_skip(f"insert programs name={name[:60]}")
        return _next_temp_id()

    try:
        result = _insert_program_record(get_client(), filtered)
        program_id = result.data[0]["id"]
        logger.debug("Inserted program %r (id=%s)", name, program_id)
        return program_id
    except Exception as exc:
        # Handle unique constraint on slug — append hash suffix
        error_str = str(exc).lower()
        if "programs_slug_key" in error_str or "unique" in error_str:
            filtered["slug"] = f"{filtered['slug']}-{content_hash[:6]}"
            try:
                result = _insert_program_record(get_client(), filtered)
                program_id = result.data[0]["id"]
                logger.debug("Inserted program %r with disambiguated slug (id=%s)", name, program_id)
                return program_id
            except Exception as exc2:
                logger.error("Failed to insert program %r even with slug fix: %s", name, exc2)
                return None
        logger.error("Failed to insert program %r: %s", name, exc)
        return None


# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------


def update_program(program_id: str, updates: dict) -> None:
    """Update an existing program by ID."""
    if not writes_enabled():
        _log_write_skip(f"update programs id={program_id}")
        return

    # Filter to valid columns, excluding immutable fields
    filtered = {
        k: v for k, v in updates.items()
        if k in _PROGRAM_COLUMNS and k not in ("slug", "metadata")
    }

    # Merge metadata if provided
    if "metadata" in updates and updates["metadata"]:
        # We can't deep-merge via Supabase, so just set the whole thing
        filtered["metadata"] = updates["metadata"]

    if not filtered:
        return

    client = get_client()
    client.table("programs").update(filtered).eq("id", program_id).execute()
    logger.debug("Updated program %s", program_id)
