"""
Festival date confidence scoring.

Shared by enrich_festivals.py and check_festival_dates.py.
Classifies URLs, computes extraction confidence, and guards updates.
"""

import re
from datetime import date, datetime, timedelta
from typing import Optional
from urllib.parse import urlparse

from date_utils import MAX_FUTURE_DAYS_DEFAULT

# Domains and path patterns that indicate generic calendar/event pages
GENERIC_PATH_PATTERNS = [
    r"/calendar",
    r"/events/?$",
    r"/events/upcoming",
    r"/things-to-do",
    r"/whatson",
    r"/whats-on",
]

GENERIC_DOMAINS = [
    "discoveratlanta.com",
    "atlanta.net",
    "visitnashville.com",
    "visitmusiccity.com",
    "accessatlanta.com",
    "exploregeorgia.org",
]


def classify_url(url: str, festival_slug: str = "") -> str:
    """Classify a URL as 'dedicated' or 'generic'.

    Dedicated: festival name appears in domain, or URL is the domain root.
    Generic: /calendar, /events/, tourism board domains, city .gov sites with /events.
    """
    parsed = urlparse(url)
    domain = parsed.netloc.lower().replace("www.", "")
    path = parsed.path.lower().rstrip("/")

    # Check generic domains
    for gd in GENERIC_DOMAINS:
        if domain.endswith(gd):
            return "generic"

    # City .gov sites with event paths
    if ".gov" in domain:
        for pattern in GENERIC_PATH_PATTERNS:
            if re.search(pattern, path):
                return "generic"

    # Generic path patterns on any domain
    for pattern in GENERIC_PATH_PATTERNS:
        if re.search(pattern, path):
            # Only override to dedicated if multiple slug words match domain
            # (single word match could be a city name like "marietta")
            if festival_slug and _slug_matches_domain(festival_slug, domain, min_words=2):
                return "dedicated"
            return "generic"

    # Domain root or shallow path = dedicated
    if not path or path == "/":
        return "dedicated"

    # Festival slug words appear in domain = dedicated
    if festival_slug and _slug_matches_domain(festival_slug, domain, min_words=1):
        return "dedicated"

    # Default: dedicated (specific page on a non-generic domain)
    return "dedicated"


def compute_confidence(
    method: str,
    url_type: str,
    typical_month: Optional[int],
    extracted_month: Optional[int],
) -> int:
    """Compute a confidence score (0-100) for an extracted festival date.

    Args:
        method: Extraction method ('manual', 'migration', 'jsonld', 'time', 'meta',
                'regex-cross', 'regex-range', 'regex-single').
        url_type: 'dedicated' or 'generic' from classify_url().
        typical_month: The festival's typical_month (1-12), or None.
        extracted_month: Month from the extracted start date, or None.
    """
    if method in ("manual", "migration"):
        return 100

    # Determine month match (within +/- 1 month, wrapping Dec<->Jan)
    month_match = _months_match(typical_month, extracted_month)

    # Normalize method names
    m = method.lower().replace("-", "").replace("_", "")

    if m == "jsonld":
        if url_type == "dedicated":
            return 95 if month_match else 70
        else:
            return 55

    if m in ("time", "timeel", "meta"):
        if url_type == "dedicated":
            return 85 if month_match else 55
        else:
            return 50 if month_match else 20

    if m.startswith("regex"):
        if url_type == "generic" and not month_match:
            return 20
        if url_type == "dedicated":
            return 75 if month_match else 40
        # generic + month match
        return 45

    # Unknown method fallback
    return 30


def should_update(
    existing_source: Optional[str],
    existing_confidence: Optional[int],
    new_source: str,
    new_confidence: int,
) -> bool:
    """Determine if a new extraction should overwrite existing date data.

    Rules:
    - Never overwrite 'manual' or 'migration' source
    - Never downgrade confidence by more than 20 points
    - Always allow upgrade from lower-quality source
    """
    # No existing data — always update
    if existing_source is None or existing_confidence is None:
        return True

    # Never overwrite manual or migration entries
    if existing_source in ("manual", "migration"):
        return False

    # Never downgrade confidence by more than 20
    if new_confidence < existing_confidence - 20:
        return False

    # Allow if confidence improves or stays similar
    return True


def _slug_matches_domain(slug: str, domain: str, min_words: int = 1) -> bool:
    """Check if enough slug words appear in the domain.

    Filters out short words (<4 chars). Requires at least `min_words` matches.
    """
    slug_words = [w for w in slug.split("-") if len(w) > 3]
    if not slug_words:
        return False
    matches = sum(1 for w in slug_words if w in domain)
    return matches >= min_words


def _months_match(typical: Optional[int], extracted: Optional[int]) -> bool:
    """Check if extracted month is within +/- 1 of typical month.

    Handles Dec<->Jan wraparound. Returns True if either is None (no data to contradict).
    """
    if typical is None or extracted is None:
        return True
    diff = abs(typical - extracted)
    # Handle wraparound: Dec(12) and Jan(1) are 1 apart
    if diff > 6:
        diff = 12 - diff
    return diff <= 1


def _month_distance(a: int, b: int) -> int:
    """Circular month distance (0-6)."""
    diff = abs(a - b)
    return min(diff, 12 - diff)


def validate_festival_dates(
    start: str,
    end: Optional[str],
    typical_month: Optional[int] = None,
    typical_duration_days: Optional[int] = None,
) -> tuple[bool, str, Optional[str]]:
    """Validate and optionally heal festival dates before DB write.

    Returns (is_valid, cleaned_start, cleaned_end).
    On failure, cleaned_start is the rejection reason string.
    """
    today = date.today()
    max_future = today + timedelta(days=MAX_FUTURE_DAYS_DEFAULT)

    # 1. Parse check
    try:
        start_dt = datetime.strptime(start, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return (False, f"invalid start date: {start}", None)

    end_dt = None
    if end:
        try:
            end_dt = datetime.strptime(end, "%Y-%m-%d").date()
        except (ValueError, TypeError):
            return (False, f"invalid end date: {end}", None)

    # 2. No past-year start dates
    if start_dt.year < today.year:
        return (False, f"past-year start: {start}", None)

    # 3. No far-future dates
    if start_dt > max_future:
        return (False, f"too far future: {start} (>{MAX_FUTURE_DAYS_DEFAULT}d)", None)

    # 4. End >= start (with Dec->Jan healing)
    if end_dt and end_dt < start_dt:
        start_month = start_dt.month
        end_month = end_dt.month
        # Dec->Jan wrap: start is Nov/Dec and end is Jan/Feb
        if start_month >= 11 and end_month <= 2:
            end_dt = end_dt.replace(year=end_dt.year + 1)
            end = end_dt.isoformat()
        else:
            return (False, f"end before start: {start} to {end}", None)

    # 5. Duration sanity
    if end_dt:
        duration = (end_dt - start_dt).days
        if typical_duration_days:
            max_dur = max(typical_duration_days * 3, 30)
        else:
            max_dur = 60
        if duration > max_dur:
            return (False, f"duration {duration}d exceeds max {max_dur}d", None)

    # 6. Month sanity
    if typical_month:
        dist = _month_distance(start_dt.month, typical_month)
        if dist > 2:
            return (False, f"month {start_dt.month} too far from typical {typical_month}", None)

    return (True, start, end)
