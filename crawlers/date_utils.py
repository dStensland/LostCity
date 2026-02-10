"""
Shared date parsing and normalization utilities for crawler ingestion.

Primary goal: avoid bad year rollover creating far-future events.
"""

from __future__ import annotations

import re
from datetime import date, datetime, timedelta
from typing import Optional

from dateutil import parser as dateparser

MAX_FUTURE_DAYS_DEFAULT = 270
ROLLOVER_GRACE_DAYS_DEFAULT = 30

_YEAR_RE = re.compile(r"\b(19|20)\d{2}\b")


def extract_year(text: Optional[str]) -> Optional[int]:
    """Return the first 4-digit year found in text."""
    if not text:
        return None
    match = _YEAR_RE.search(text)
    if not match:
        return None
    try:
        return int(match.group(0))
    except ValueError:
        return None


def _safe_replace_year(value: date, year: int) -> Optional[date]:
    """Replace year while handling leap-day edge cases."""
    try:
        return value.replace(year=year)
    except ValueError:
        # Feb 29 in non-leap year -> clamp to Feb 28.
        if value.month == 2 and value.day == 29:
            return date(year, 2, 28)
        return None


def normalize_event_date(
    candidate: date,
    *,
    raw_text: Optional[str] = None,
    context_text: Optional[str] = None,
    today: Optional[date] = None,
    max_future_days: int = MAX_FUTURE_DAYS_DEFAULT,
    rollover_grace_days: int = ROLLOVER_GRACE_DAYS_DEFAULT,
    assume_explicit_year: Optional[bool] = None,
) -> Optional[date]:
    """
    Normalize a candidate event date and guard against year rollover bugs.

    Rules:
    - Reject dates farther than max_future_days in the future.
    - If a far-future date can be healed by subtracting one year, heal it.
    - For dates without explicit year, allow rollover to next year only when
      the next-year date falls within the future window.
    """
    ref_today = today or date.today()
    max_date = ref_today + timedelta(days=max_future_days)

    if assume_explicit_year is None:
        has_explicit_year = bool(extract_year(raw_text) or extract_year(context_text))
    else:
        has_explicit_year = assume_explicit_year

    # Hard ceiling on far-future dates, with one-year healing when plausible.
    if candidate > max_date:
        previous_year = _safe_replace_year(candidate, candidate.year - 1)
        if previous_year and ref_today <= previous_year <= max_date:
            return previous_year
        return None

    # Yearless dates in the past may refer to next year (e.g. Dec crawl sees Jan dates).
    if not has_explicit_year and candidate < ref_today - timedelta(days=rollover_grace_days):
        next_year = _safe_replace_year(candidate, candidate.year + 1)
        if next_year and ref_today <= next_year <= max_date:
            return next_year

    return candidate


def parse_human_date(
    value: Optional[str],
    *,
    context_text: Optional[str] = None,
    today: Optional[date] = None,
    max_future_days: int = MAX_FUTURE_DAYS_DEFAULT,
    rollover_grace_days: int = ROLLOVER_GRACE_DAYS_DEFAULT,
) -> Optional[str]:
    """Parse free-form date text into YYYY-MM-DD with normalization."""
    if not value:
        return None

    ref_today = today or date.today()
    inferred_year = extract_year(value) or extract_year(context_text) or ref_today.year

    default_dt = datetime(
        inferred_year,
        ref_today.month,
        ref_today.day,
        12,
        0,
        0,
    )

    try:
        parsed = dateparser.parse(value, fuzzy=True, default=default_dt)
    except Exception:
        return None
    if not parsed:
        return None

    normalized = normalize_event_date(
        parsed.date(),
        raw_text=value,
        context_text=context_text,
        today=ref_today,
        max_future_days=max_future_days,
        rollover_grace_days=rollover_grace_days,
    )
    return normalized.isoformat() if normalized else None


def normalize_iso_date(
    value: Optional[str],
    *,
    today: Optional[date] = None,
    max_future_days: int = MAX_FUTURE_DAYS_DEFAULT,
) -> Optional[str]:
    """Normalize YYYY-MM-DD date strings and heal obvious +1 year bugs."""
    if not value:
        return None
    try:
        parsed = datetime.strptime(value, "%Y-%m-%d").date()
    except (TypeError, ValueError):
        return None

    normalized = normalize_event_date(
        parsed,
        raw_text=value,
        today=today,
        max_future_days=max_future_days,
        assume_explicit_year=True,
    )
    return normalized.isoformat() if normalized else None
