"""
Shared utilities for aggregator crawlers (Eventbrite, Meetup, etc.).

These helpers address systemic data quality issues that appear across every
aggregator source:

1. ``clean_aggregator_title``   — strip promotional pipe-suffixes
2. ``detect_recurring_from_title`` — detect weekly/monthly/daily patterns
3. ``override_category_from_title`` — fix wrong aggregator-supplied categories
4. ``build_series_hint_from_recurring`` — build series_hint dict for db.insert_event
"""

from __future__ import annotations

import re

# ---------------------------------------------------------------------------
# Promotional pipe-suffix stripping
# ---------------------------------------------------------------------------

# Each pattern matches everything from a pipe character to end-of-string when
# the text after the pipe is a known promotional phrase.  Patterns are anchored
# to end-of-string (re.IGNORECASE applied at call site).
#
# Design rule: only strip KNOWN phrases.  "Jazz | Blues Night" must survive
# because "Blues Night" is not a promotional phrase.  We prefer false-negatives
# (leaving noise in) over false-positives (removing real genre/sub-title info).

_PROMO_SUFFIX_PATTERNS: list[re.Pattern[str]] = [
    # --- Food / drink ---
    re.compile(
        r"\s*\|\s*Food\s*&?\s*(?:and\s+)?Drink\s+Specials?\s+All\s+Night\s*$",
        re.IGNORECASE,
    ),
    re.compile(r"\s*\|\s*(?:Happy\s+Hour\s+)?Drink\s+Specials?\s*$", re.IGNORECASE),
    re.compile(r"\s*\|\s*Happy\s+Hour\s+Specials?\s*$", re.IGNORECASE),
    # --- Ticket / RSVP ---
    re.compile(r"\s*\|\s*Tickets?\s+On\s+Sale\s*$", re.IGNORECASE),
    re.compile(r"\s*\|\s*Free\s+Entry\s*$", re.IGNORECASE),
    re.compile(r"\s*\|\s*Free\s+Admission\s*$", re.IGNORECASE),
    re.compile(r"\s*\|\s*Free\s+Parking\s*$", re.IGNORECASE),
    re.compile(r"\s*\|\s*RSVP\s+(?:Now|Today|Required)\s*$", re.IGNORECASE),
    re.compile(r"\s*\|\s*Book\s+(?:Now|Today)\s*$", re.IGNORECASE),
    re.compile(r"\s*\|\s*Get\s+Tickets?\s*$", re.IGNORECASE),
    re.compile(r"\s*\|\s*Limited\s+(?:Seats?|Availability)\s*$", re.IGNORECASE),
    # --- Sales / discounts ---
    re.compile(r"\s*\|\s*Early\s+Bird\s*$", re.IGNORECASE),
    re.compile(r"\s*\|\s*[^|]*\b(?:\d+%?\s+off|discount|promo(?:tion)?|deal)\b[^|]*$", re.IGNORECASE),
    # --- Logistics ---
    re.compile(r"\s*\|\s*New\s+Date\s*$", re.IGNORECASE),
    re.compile(r"\s*\|\s*New\s+Time\s*$", re.IGNORECASE),
    re.compile(r"\s*\|\s*New\s+Venue\s*$", re.IGNORECASE),
    re.compile(r"\s*\|\s*Doors\s+Open\s+(?:at\s+)?\S[^|]*$", re.IGNORECASE),
]

# Whitespace normalizer applied after stripping
_WS_RE = re.compile(r"\s+")


def clean_aggregator_title(title: str) -> str:
    """Strip known promotional pipe-suffixes from an aggregator event title.

    Applied iteratively so that multiple trailing promotional segments are
    all removed.  Non-promotional pipes (e.g. "Jazz | Blues Night") are left
    intact.

    Parameters
    ----------
    title:
        Raw title string from the aggregator.

    Returns
    -------
    str
        Cleaned title with normalized whitespace.  Returns ``""`` for falsy
        input.
    """
    if not title:
        return ""

    cleaned = title
    changed = True
    while changed:
        changed = False
        for pattern in _PROMO_SUFFIX_PATTERNS:
            new = pattern.sub("", cleaned)
            if new != cleaned:
                cleaned = new
                changed = True

    return _WS_RE.sub(" ", cleaned).strip()


# ---------------------------------------------------------------------------
# Recurring pattern detection
# ---------------------------------------------------------------------------

_DAY_NAMES = {
    "monday": "monday",
    "tuesday": "tuesday",
    "wednesday": "wednesday",
    "thursday": "thursday",
    "friday": "friday",
    "saturday": "saturday",
    "sunday": "sunday",
    # abbreviations
    "mon": "monday",
    "tue": "tuesday",
    "tues": "tuesday",
    "wed": "wednesday",
    "thu": "thursday",
    "thur": "thursday",
    "thurs": "thursday",
    "fri": "friday",
    "sat": "saturday",
    "sun": "sunday",
}

_DAY_PATTERN = r"(?P<day>monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)"
_ORDINAL = r"(?:1st|first|2nd|second|3rd|third|4th|fourth|5th|fifth|last)"

# Compiled patterns ordered from most-specific to least-specific
_RECURRING_PATTERNS: list[tuple[re.Pattern[str], str, bool]] = [
    # "Every Other <day>"  → biweekly
    (
        re.compile(rf"\bevery\s+other\s+{_DAY_PATTERN}\b", re.IGNORECASE),
        "biweekly",
        True,  # has day group
    ),
    # "Every <day>"  → weekly
    (
        re.compile(rf"\bevery\s+{_DAY_PATTERN}\b", re.IGNORECASE),
        "weekly",
        True,
    ),
    # "Each <day>" / "Every Week on <day>"  → weekly
    (
        re.compile(rf"\beach\s+{_DAY_PATTERN}\b", re.IGNORECASE),
        "weekly",
        True,
    ),
    # "<Ordinal> <day> of the month / each month"  → monthly
    (
        re.compile(rf"\b{_ORDINAL}\s+{_DAY_PATTERN}\b", re.IGNORECASE),
        "monthly",
        True,
    ),
    # "Biweekly" / "Bi-Weekly" / "Every Other Week"  → biweekly, no day
    # Must come BEFORE the "weekly" pattern because "bi-weekly" contains the
    # substring "\bweekly\b" (the hyphen is a non-word character so \b matches
    # there).
    (
        re.compile(r"\b(?:bi-?weekly|every\s+other\s+week)\b", re.IGNORECASE),
        "biweekly",
        False,
    ),
    # "Weekly" / "Every Week" / "Each Week"  → weekly, no day
    (
        re.compile(r"\b(?:weekly|every\s+week|each\s+week)\b", re.IGNORECASE),
        "weekly",
        False,
    ),
    # "Monthly" / "Every Month"  → monthly, no day
    (
        re.compile(r"\b(?:monthly|every\s+month)\b", re.IGNORECASE),
        "monthly",
        False,
    ),
    # "Daily" / "Every Day" / "Every Night"  → daily, no day
    (
        re.compile(r"\b(?:daily|every\s+day|every\s+night)\b", re.IGNORECASE),
        "daily",
        False,
    ),
]


def detect_recurring_from_title(title: str) -> tuple[bool, str | None, str | None]:
    """Detect recurring patterns in an event title.

    Parameters
    ----------
    title:
        Event title string.

    Returns
    -------
    tuple of (is_recurring, frequency, day_of_week)
        ``is_recurring`` is ``True`` when a pattern is found.
        ``frequency`` is one of ``"daily"``, ``"weekly"``, ``"biweekly"``,
        ``"monthly"`` or ``None``.
        ``day_of_week`` is a lowercase full day name or ``None``.
    """
    if not title:
        return False, None, None

    for pattern, frequency, has_day in _RECURRING_PATTERNS:
        match = pattern.search(title)
        if match:
            day_of_week = None
            if has_day:
                raw_day = match.group("day").lower()
                day_of_week = _DAY_NAMES.get(raw_day, raw_day)
            return True, frequency, day_of_week

    return False, None, None


# ---------------------------------------------------------------------------
# Category override from title signals
# ---------------------------------------------------------------------------

# Maps (category, list-of-title-keyword-regexes) for strong signals.
# Only overrides when current_category is NOT already the target.
_CATEGORY_OVERRIDE_RULES: list[tuple[str, re.Pattern[str]]] = [
    (
        "nightlife",
        re.compile(
            r"\b(?:karaoke|trivia|pub\s+quiz|quiz\s+night|drag\s+(?:show|brunch|bingo|queen)|bingo|open[- ]?mic)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "comedy",
        re.compile(
            r"\b(?:comedy|stand[- ]?up|standup|comedian|improv)\b",
            re.IGNORECASE,
        ),
    ),
]


def override_category_from_title(title: str, current_category: str) -> str:
    """Override an aggregator-supplied category when the title has a strong signal.

    Only overrides on a clear mismatch — if the current category already matches
    the inferred one, the input is returned unchanged.

    Parameters
    ----------
    title:
        Event title string.
    current_category:
        Category string as supplied by the aggregator.

    Returns
    -------
    str
        The (potentially overridden) category.
    """
    if not title:
        return current_category

    for target_category, pattern in _CATEGORY_OVERRIDE_RULES:
        if pattern.search(title) and current_category != target_category:
            return target_category

    return current_category


# ---------------------------------------------------------------------------
# Series hint builder
# ---------------------------------------------------------------------------

# Patterns used to strip recurring language from a title to produce the
# clean series_title.  Applied in order; first match wins.
_SERIES_STRIP_PATTERNS: list[re.Pattern[str]] = [
    # "Every Other <day>"
    re.compile(rf"\s*\bevery\s+other\s+{_DAY_PATTERN}\b\s*", re.IGNORECASE),
    # "Every <day>"
    re.compile(rf"\s*\bevery\s+{_DAY_PATTERN}\b\s*", re.IGNORECASE),
    # "Each <day>"
    re.compile(rf"\s*\beach\s+{_DAY_PATTERN}\b\s*", re.IGNORECASE),
    # "<Ordinal> <day>"
    re.compile(rf"\s*\b{_ORDINAL}\s+{_DAY_PATTERN}\b\s*", re.IGNORECASE),
    # Generic frequency words (no day)
    re.compile(
        r"\s*\b(?:weekly|every\s+week|each\s+week|bi-?weekly|every\s+other\s+week|monthly|every\s+month|daily|every\s+day|every\s+night)\b\s*",
        re.IGNORECASE,
    ),
]


def _strip_recurring_language(title: str) -> str:
    """Remove all recurring-pattern phrases from a title.

    Multiple passes are applied until no further stripping occurs.
    """
    result = title
    for pattern in _SERIES_STRIP_PATTERNS:
        result = pattern.sub(" ", result)
    return _WS_RE.sub(" ", result).strip()


def build_series_hint_from_recurring(
    title: str,
    is_recurring: bool,
    frequency: str | None,
    day_of_week: str | None,
) -> dict | None:
    """Build a ``series_hint`` dict for ``db.insert_event``.

    Returns ``None`` when ``is_recurring`` is ``False``.

    Parameters
    ----------
    title:
        Original event title (used to derive ``series_title``).
    is_recurring:
        Result from ``detect_recurring_from_title``.
    frequency:
        Result from ``detect_recurring_from_title``.
    day_of_week:
        Result from ``detect_recurring_from_title``.

    Returns
    -------
    dict or None
        ``{"series_type", "series_title", "frequency", "day_of_week"}`` or
        ``None`` if not recurring.
    """
    if not is_recurring or not title:
        return None

    series_title = _strip_recurring_language(title)

    # If stripping left us with nothing, fall back to the raw title so we
    # never produce an empty series_title.
    if not series_title:
        series_title = _WS_RE.sub(" ", title).strip()

    return {
        "series_type": "recurring_show",
        "series_title": series_title,
        "frequency": frequency,
        "day_of_week": day_of_week,
    }
