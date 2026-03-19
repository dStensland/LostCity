"""
Shared family-relevance filter for broad ACTIVENet civic catalogs.
"""

from __future__ import annotations

import re
from datetime import date, datetime, timedelta
from typing import Optional

_FAMILY_SIGNAL_RE = re.compile(
    r"\bfamily\b|\byouth\b|\bkids?\b|\bchild(?:ren)?\b|\bteen\b|\btween\b|"
    r"\bjunior\b|\bpreschool\b|\btoddler\b|\bcamp\b",
    re.IGNORECASE,
)
_ADULT_SIGNAL_RE = re.compile(
    r"\badult\b|\bsenior\b|\bolder adult\b|\b55\+\b|\b50\+\b|\bprimetime\b|\bgold\b|"
    r"\bmen'?s\b|\bwomen'?s\b",
    re.IGNORECASE,
)

_MONTH_NAME_MAP = {
    "jan": 1,
    "feb": 2,
    "mar": 3,
    "apr": 4,
    "may": 5,
    "jun": 6,
    "jul": 7,
    "aug": 8,
    "sep": 9,
    "oct": 10,
    "nov": 11,
    "dec": 12,
}

_DATE_SUFFIX_RE = re.compile(
    r"\s+(?:"
    r"(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?"
    r"|(?:week\s+)?\d+(?:st|nd|rd|th)?\s+week"
    r"|\bday\s+\d+"
    r"|\bsession\s+\d+"
    r")\s*$",
    re.IGNORECASE,
)

_WEEKDAY_PATTERN = re.compile(
    r"\b(mon(?:day)?|tue(?:s|sday)?|wed(?:nesday|s)?|thu(?:r|rs|rsday|sday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b",
    re.IGNORECASE,
)
_WEEKDAY_TOKEN_MAP = {
    "mon": 1,
    "monday": 1,
    "tue": 2,
    "tues": 2,
    "tuesday": 2,
    "wed": 3,
    "weds": 3,
    "wednesday": 3,
    "thu": 4,
    "thur": 4,
    "thurs": 4,
    "thursday": 4,
    "fri": 5,
    "friday": 5,
    "sat": 6,
    "saturday": 6,
    "sun": 7,
    "sunday": 7,
}
_DATE_PREFIX_RE = re.compile(r"^(\d{4}-\d{2}-\d{2})")
_REGISTRATION_OPEN_RE = re.compile(
    r"(?:open registration|registration)\s+(?:for [^.]*)?(?:will )?(?:begin|begins|open|opens)\s+"
    r"(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?",
    re.IGNORECASE,
)
_TIME_RANGE_RE = re.compile(
    r"(?<!\d)(?P<start>\d{1,2}(?:\s*:\s*\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?)\s*(?:-|to)\s*"
    r"(?P<end>\d{1,2}(?:\s*:\s*\d{2})?\s*(?:a\.?m\.?|p\.?m\.?))(?!\d)",
    re.IGNORECASE,
)


def _parse_iso_date_prefix(raw: Optional[str]) -> Optional[date]:
    if not raw:
        return None
    match = _DATE_PREFIX_RE.match(str(raw).strip())
    if not match:
        return None
    try:
        return datetime.strptime(match.group(1), "%Y-%m-%d").date()
    except ValueError:
        return None


def _coerce_iso_date(value: Optional[date]) -> Optional[str]:
    return value.isoformat() if value else None


def _normalize_time_value(raw: Optional[str], fallback_ampm: Optional[str] = None) -> Optional[str]:
    if not raw:
        return None
    cleaned = str(raw).strip().lower().replace(".", "").replace(" ", "")
    match = re.match(r"(?P<hour>\d{1,2})(?::(?P<minute>\d{2}))?(?P<ampm>[ap]m)?", cleaned)
    if not match:
        return None

    hour = int(match.group("hour"))
    minute = int(match.group("minute") or "00")
    ampm = match.group("ampm") or (fallback_ampm.lower() if fallback_ampm else None)
    if not ampm:
        return None

    if ampm == "pm" and hour != 12:
        hour += 12
    if ampm == "am" and hour == 12:
        hour = 0
    return f"{hour:02d}:{minute:02d}:00"


def _extract_hour(raw: Optional[str]) -> Optional[int]:
    if not raw:
        return None
    match = re.match(r"\s*(\d{1,2})", str(raw))
    if not match:
        return None
    return int(match.group(1))


def normalize_activecommunities_age(raw: Optional[int]) -> Optional[int]:
    """
    Convert ACTIVENet age sentinel values to None.

    ACTIVENet returns 0 for both age_min_year and age_max_year when the
    activity has no age restriction, not to mean "infant" (age 0).
    Treat 0 as missing data so the filtering logic isn't misled.
    Also treat values > 90 as missing (API encodes "adults" as 99 or 120).
    """
    if raw is None:
        return None
    if raw == 0:
        return None
    if raw > 90:
        return None
    return raw


# Ordered from most-specific to least-specific so the first match wins.
_AGE_NAME_PATTERNS: list[re.Pattern] = [
    re.compile(r"ages?\s+(\d+)\s*[-\u2013to]+\s*(\d+)", re.IGNORECASE),
    re.compile(r"\((\d+)\s*[-\u2013]\s*(\d+)\s*(?:yr|year)", re.IGNORECASE),
    re.compile(r"(\d+)\s*[-\u2013]\s*(\d+)\s*(?:yr|year)", re.IGNORECASE),
    re.compile(r"grade[s]?\s+(\d+)\s*[-\u2013]\s*(\d+)", re.IGNORECASE),
    re.compile(r"(\d+)\s*&\s*under", re.IGNORECASE),
]


def parse_age_from_name(name: str) -> tuple[Optional[int], Optional[int]]:
    """Extract age range from program name patterns like 'Ages 5-12' or '(6-8 yrs)'.

    Called as a fallback after normalize_activecommunities_age() when both
    age_min and age_max are still None — meaning the API didn't supply age
    data but the title may contain it.

    Returns (age_min, age_max) or (None, None) if nothing parseable is found.
    Only returns ranges where 0 < age_min < age_max <= 18, to avoid treating
    adult programs (e.g. "18-65 yrs") as youth programs.
    """
    name_lower = name.lower()
    for pattern in _AGE_NAME_PATTERNS:
        m = pattern.search(name_lower)
        if m is None:
            continue
        groups = m.groups()
        if len(groups) == 2:
            a, b = int(groups[0]), int(groups[1])
            # Grade-to-age conversion: grade + 5 approximates school age
            if "grade" in pattern.pattern.lower():
                a, b = a + 5, b + 5
            if 0 < a < b <= 18:
                return a, b
        elif len(groups) == 1:
            upper = int(groups[0])
            if 0 < upper <= 18:
                return 0, upper
    return None, None


def normalize_activecommunities_session_title(name: str) -> str:
    """
    Strip trailing per-day date suffixes from ACTIVENet session titles.

    ACTIVENet lists multi-day camps as individual daily sessions:
      "Gresham 2026 Spring Break Camp Apr. 6th"
      "Gresham 2026 Spring Break Camp Apr. 7th"
    This strips the trailing date/session suffix so callers can group
    consecutive same-venue sessions into a single program record.
    """
    return _DATE_SUFFIX_RE.sub("", name).strip()


def infer_activecommunities_schedule_days(
    *,
    session_start: Optional[str],
    session_end: Optional[str],
    date_range_description: Optional[str],
    desc_text: Optional[str],
) -> Optional[list[int]]:
    combined = " ".join(part for part in (date_range_description, desc_text) if part).lower()

    if "daily during the week" in combined or "weekdays" in combined:
        return [1, 2, 3, 4, 5]
    if "daily" in combined and "week" not in combined:
        return [1, 2, 3, 4, 5, 6, 7]

    weekdays: list[int] = []
    for token in _WEEKDAY_PATTERN.findall(combined):
        day = _WEEKDAY_TOKEN_MAP.get(token.lower())
        if day and day not in weekdays:
            weekdays.append(day)
    if weekdays:
        return weekdays

    start_date = _parse_iso_date_prefix(session_start)
    end_date = _parse_iso_date_prefix(session_end)
    if start_date and end_date:
        span = (end_date - start_date).days
        if span == 0:
            return [start_date.isoweekday()]
        if 0 < span <= 6:
            return sorted(
                {
                    (start_date + timedelta(days=offset)).isoweekday()
                    for offset in range(span + 1)
                }
            )

    if start_date:
        return [start_date.isoweekday()]
    return None


def infer_activecommunities_schedule_time_range(
    *,
    date_range_description: Optional[str],
    desc_text: Optional[str],
) -> tuple[Optional[str], Optional[str]]:
    combined = " ".join(part for part in (date_range_description, desc_text) if part)
    if not combined:
        return None, None

    match = _TIME_RANGE_RE.search(combined)
    if not match:
        return None, None

    fallback_ampm_match = re.search(r"([ap])\.?m\.?", match.group("end"), re.IGNORECASE)
    fallback_ampm = f"{fallback_ampm_match.group(1)}m" if fallback_ampm_match else None
    start_fallback = fallback_ampm
    start_has_ampm = re.search(r"[ap]\.?m\.?", match.group("start"), re.IGNORECASE)
    if not start_has_ampm and fallback_ampm == "pm":
        start_hour = _extract_hour(match.group("start"))
        end_hour = _extract_hour(match.group("end"))
        if start_hour == 12:
            start_fallback = "pm"
        elif start_hour is not None and end_hour is not None:
            start_fallback = "pm" if start_hour < end_hour else "am"

    start_time = _normalize_time_value(match.group("start"), start_fallback)
    end_time = _normalize_time_value(match.group("end"))
    return start_time, end_time


def infer_activecommunities_registration_open(
    *,
    activity_online_start_time: Optional[str],
    desc_text: Optional[str],
    session_start: Optional[str],
) -> Optional[str]:
    activity_open = _parse_iso_date_prefix(activity_online_start_time)
    if activity_open:
        return _coerce_iso_date(activity_open)

    if not desc_text:
        return None

    match = _REGISTRATION_OPEN_RE.search(desc_text)
    if not match:
        return None

    session_start_date = _parse_iso_date_prefix(session_start)
    default_year = session_start_date.year if session_start_date else date.today().year
    month = _MONTH_NAME_MAP[match.group(1).lower()[:3]]
    day = int(match.group(2))
    try:
        parsed = date(default_year, month, day)
    except ValueError:
        return None
    return parsed.isoformat()


def is_family_relevant_activity(
    *,
    name: str,
    desc_text: str,
    age_min: Optional[int],
    age_max: Optional[int],
    category: str,
    tags: list[str],
    blocked_keywords: Optional[list[str]] = None,
) -> bool:
    """Return True when an ACTIVENet activity belongs in Hooky's family lane."""
    combined = f"{name} {desc_text}".lower()

    if blocked_keywords and any(keyword in combined for keyword in blocked_keywords):
        return False

    if age_min is not None and age_min >= 18:
        return False
    if age_max is not None and age_max <= 18:
        return True
    if age_min is not None and age_min < 18:
        return True

    if _ADULT_SIGNAL_RE.search(combined):
        return False

    if any(tag in tags for tag in ("kids", "preschool", "elementary", "tween", "teen")):
        return True
    if category == "family":
        return True
    if _FAMILY_SIGNAL_RE.search(combined):
        return True
    return False
