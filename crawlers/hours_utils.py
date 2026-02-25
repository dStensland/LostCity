"""
Shared hours normalization, validation, and formatting utilities.

All hours writers (Google, Foursquare, website scraper, social bios)
funnel through prepare_hours_update() to ensure consistent day-key
format (3-letter abbreviated: mon, tue, wed, ...), AM/PM correction
for evening venues, and source-confidence gating.
"""

import re
from typing import Optional

# Canonical day keys — the frontend (hours.ts) expects these
DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]

DAY_LABELS = {
    "mon": "Mon", "tue": "Tue", "wed": "Wed", "thu": "Thu",
    "fri": "Fri", "sat": "Sat", "sun": "Sun",
}

# Map every reasonable variant to the canonical 3-letter key
_DAY_ALIASES = {
    "monday": "mon", "mon": "mon", "mo": "mon",
    "tuesday": "tue", "tue": "tue", "tues": "tue", "tu": "tue",
    "wednesday": "wed", "wed": "wed", "we": "wed",
    "thursday": "thu", "thu": "thu", "thur": "thu", "thurs": "thu", "th": "thu",
    "friday": "fri", "fri": "fri", "fr": "fri",
    "saturday": "sat", "sat": "sat", "sa": "sat",
    "sunday": "sun", "sun": "sun", "su": "sun",
}

# Source confidence ranking — higher number wins
SOURCE_CONFIDENCE = {
    "google": 4,
    "foursquare": 3,
    "website": 2,
    "social_bio": 1,
}

# Venue types where opening times 06:00–09:59 are almost certainly PM
EVENING_VENUE_TYPES = {
    "bar", "nightclub", "sports_bar", "brewery", "distillery",
    "lounge", "winery",
}

_TIME_RE = re.compile(r"^\d{2}:\d{2}$")


def normalize_hours(hours: dict) -> Optional[dict]:
    """Convert any day-key format to canonical 3-letter abbreviated keys.

    Accepts "monday", "Mon", "thu", "TUESDAY", etc. and normalizes to
    "mon", "tue", etc.  Strips keys that don't map to a valid day.

    Returns None if no valid day entries remain.
    """
    if not hours or not isinstance(hours, dict):
        return None

    normalized = {}
    for key, value in hours.items():
        canonical = _DAY_ALIASES.get(key.strip().lower())
        if canonical and isinstance(value, dict):
            normalized[canonical] = value

    return normalized if normalized else None


def validate_hours(hours: dict, venue_type: Optional[str] = None) -> dict:
    """Validate HH:MM format and correct AM/PM errors for evening venues.

    For evening venue types (bar, nightclub, etc.), opening times in the
    06:00–09:59 range are corrected to PM by adding 12 hours.  This fixes
    the common LLM mistake of outputting "08:00" when meaning "20:00".
    """
    if not hours:
        return hours

    is_evening = venue_type in EVENING_VENUE_TYPES if venue_type else False
    validated = {}

    for day, times in hours.items():
        if not isinstance(times, dict):
            continue

        open_time = times.get("open") or ""
        close_time = times.get("close") or ""

        # Must be HH:MM format
        if not open_time or not close_time or not _TIME_RE.match(open_time) or not _TIME_RE.match(close_time):
            continue

        # Fix AM/PM error for evening venues: 06:00–09:59 open → add 12h
        if is_evening:
            hour = int(open_time[:2])
            if 6 <= hour <= 9:
                open_time = f"{hour + 12:02d}:{open_time[3:]}"

        validated[day] = {"open": open_time, "close": close_time}

    return validated


def format_hours_display(hours: dict) -> str:
    """Generate a human-readable hours display string.

    Groups consecutive days with identical hours into ranges.
    Example: "Mon-Fri: 11am-10pm, Sat: 10am-11pm, Sun: 10am-10pm"
    """
    if not hours:
        return ""

    def to_12h(t: str) -> str:
        h, m = int(t[:2]), t[3:]
        period = "am" if h < 12 else "pm"
        h = h % 12 or 12
        return f"{h}:{m}{period}" if m != "00" else f"{h}{period}"

    lines = []
    i = 0
    while i < len(DAY_ORDER):
        day = DAY_ORDER[i]
        if day not in hours:
            i += 1
            continue

        times = hours[day]
        open_val = times.get("open") if isinstance(times, dict) else None
        close_val = times.get("close") if isinstance(times, dict) else None
        if not open_val or not close_val or not _TIME_RE.match(str(open_val)) or not _TIME_RE.match(str(close_val)):
            i += 1
            continue

        start_day = day
        end_day = day

        # Find consecutive days with same hours
        j = i + 1
        while j < len(DAY_ORDER):
            next_day = DAY_ORDER[j]
            if next_day in hours and hours[next_day] == times:
                end_day = next_day
                j += 1
            else:
                break

        time_str = f"{to_12h(times['open'])}-{to_12h(times['close'])}"

        if start_day == end_day:
            lines.append(f"{DAY_LABELS[start_day]}: {time_str}")
        else:
            lines.append(f"{DAY_LABELS[start_day]}-{DAY_LABELS[end_day]}: {time_str}")

        i = j

    return ", ".join(lines)


def should_update_hours(current_source: Optional[str], new_source: str) -> bool:
    """Return True if new_source outranks (or equals) current_source.

    If current_source is None/unknown, always allow the update.
    """
    if not current_source:
        return True
    current_rank = SOURCE_CONFIDENCE.get(current_source, 0)
    new_rank = SOURCE_CONFIDENCE.get(new_source, 0)
    return new_rank >= current_rank


def prepare_hours_update(
    raw_hours: Optional[dict],
    source: str,
    venue_type: Optional[str] = None,
) -> tuple[Optional[dict], Optional[str]]:
    """Full pipeline: normalize → validate → format display.

    Single entry point for all hours writers.

    Returns:
        (hours_json, hours_display) — both None if input is invalid/empty.
    """
    if not raw_hours:
        return None, None

    hours = normalize_hours(raw_hours)
    if not hours:
        return None, None

    hours = validate_hours(hours, venue_type)
    if not hours:
        return None, None

    display = format_hours_display(hours)
    return hours, display
