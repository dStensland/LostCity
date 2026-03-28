"""
Tests for AM/PM and timezone time-parsing in the Callanwolde crawlers.

Covers the two active crawlers:
  - callanwolde_fine_arts_center.py  (iCal path)
  - sources/_tribe_events_base.py    (Tribe REST API path, shared by callanwolde.py)
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Optional
from unittest.mock import MagicMock, patch

import pytest

# ---------------------------------------------------------------------------
# Helpers imported directly from production modules (no DB calls)
# ---------------------------------------------------------------------------
from sources._tribe_events_base import _build_event_record, TribeConfig
from sources.callanwolde_fine_arts_center import _clean_callanwolde_title


# ---------------------------------------------------------------------------
# Shared Tribe config fixture (avoids real DB/network calls)
# ---------------------------------------------------------------------------

_TRIBE_VENUE = {
    "name": "Callanwolde Fine Arts Center",
    "slug": "callanwolde-fine-arts-center",
    "address": "980 Briarcliff Rd NE",
    "neighborhood": "Druid Hills",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30306",
    "lat": 33.7872,
    "lng": -84.3407,
    "venue_type": "arts_center",
    "spot_type": "arts_center",
    "website": "https://callanwolde.org",
    "vibes": ["artsy"],
}

_TRIBE_CONFIG = TribeConfig(
    base_url="https://callanwolde.org",
    place_data=_TRIBE_VENUE,
    default_category="art",
    default_tags=["arts-center"],
    future_only=False,  # disable future-only so any test date works
)


def _make_tribe_event(
    title: str,
    start_date: str,
    end_date: str = "",
    all_day: bool = False,
    cost: str = "",
) -> dict:
    """Minimal raw Tribe API event dict for testing."""
    return {
        "title": title,
        "start_date": start_date,
        "end_date": end_date,
        "all_day": all_day,
        "cost": cost,
        "description": "",
        "url": "https://callanwolde.org/events/test/",
        "website": None,
        "image": False,
        "categories": [],
        "tags": [],
    }


# ---------------------------------------------------------------------------
# Tribe path: start_time and end_time preservation
# ---------------------------------------------------------------------------


class TestTribeTimeParsing:
    """Tribe API returns local-time strings like '2026-05-08 19:30:00'."""

    def _build(self, title: str, start: str, end: str = "") -> Optional[dict]:
        raw = _make_tribe_event(title, start, end)
        result = _build_event_record(raw, source_id=1, venue_id=1, venue_name="Callanwolde Fine Arts Center", config=_TRIBE_CONFIG)
        if result is None:
            return None
        record, _ = result
        return record

    def test_standard_evening_class(self) -> None:
        r = self._build("Pottery Wheel", "2026-06-01 19:30:00", "2026-06-01 22:00:00")
        assert r is not None
        assert r["start_time"] == "19:30"
        assert r["end_time"] == "22:00"

    def test_noon_start_stored_as_1200(self) -> None:
        """12:00 PM (noon) must be stored as '12:00', never '00:00'."""
        r = self._build("Drawing Class", "2026-06-01 12:00:00", "2026-06-01 13:30:00")
        assert r is not None
        assert r["start_time"] == "12:00", "Noon must be stored as 12:00 not suppressed"
        assert r["end_time"] == "13:30"

    def test_midnight_start_stored_as_0000(self) -> None:
        """00:00 (midnight) must be stored as '00:00', not silently dropped."""
        r = self._build("Midnight Event", "2026-06-01 00:00:00", "2026-06-02 02:00:00")
        assert r is not None
        assert r["start_time"] == "00:00", "Midnight must be stored as 00:00 not None"

    def test_midnight_end_stored_as_0000(self) -> None:
        """An event ending at midnight should have end_time '00:00', not None."""
        r = self._build("Late Night Show", "2026-06-01 21:00:00", "2026-06-02 00:00:00")
        assert r is not None
        assert r["end_time"] == "00:00", "Midnight end must be stored as 00:00 not dropped"

    def test_all_day_event_has_no_times(self) -> None:
        """All-day events (all_day=True) must have start_time=None and end_time=None."""
        raw = _make_tribe_event(
            "Studio Open Day",
            "2026-06-01 00:00:00",
            "2026-06-01 00:00:00",
            all_day=True,
        )
        result = _build_event_record(raw, 1, 1, "Callanwolde Fine Arts Center", _TRIBE_CONFIG)
        assert result is not None
        record, _ = result
        assert record["start_time"] is None
        assert record["end_time"] is None

    def test_morning_class_9am(self) -> None:
        r = self._build("Yoga", "2026-06-01 09:00:00", "2026-06-01 10:30:00")
        assert r is not None
        assert r["start_time"] == "09:00"
        assert r["end_time"] == "10:30"

    def test_afternoon_class_3pm(self) -> None:
        r = self._build("Ballet Combo 1", "2026-06-01 15:30:00", "2026-06-01 16:30:00")
        assert r is not None
        assert r["start_time"] == "15:30"
        assert r["end_time"] == "16:30"


# ---------------------------------------------------------------------------
# iCal path: timezone-aware datetime handling
# ---------------------------------------------------------------------------


class TestICalTimeParsing:
    """
    callanwolde_fine_arts_center.py uses the icalendar library which returns
    timezone-aware datetime objects (tzinfo=America/New_York).
    strftime('%H:%M') on a tz-aware datetime returns the time in that tz —
    so the output is always Eastern Time regardless of server timezone.
    """

    def _format_time(self, dt: datetime) -> str:
        """Mirror the exact line in callanwolde_fine_arts_center.py."""
        return dt.strftime("%H:%M")

    def _format_date(self, dt: datetime) -> str:
        return dt.strftime("%Y-%m-%d")

    def _et_dt(self, year: int, month: int, day: int, hour: int, minute: int) -> datetime:
        """Create an America/New_York tz-aware datetime as icalendar would return."""
        try:
            import zoneinfo
            et = zoneinfo.ZoneInfo("America/New_York")
        except ImportError:
            import pytz
            et = pytz.timezone("America/New_York")
        return datetime(year, month, day, hour, minute, tzinfo=et)

    def test_evening_class_7pm(self) -> None:
        dt = self._et_dt(2026, 6, 1, 19, 30)
        assert self._format_time(dt) == "19:30"

    def test_noon_class_12pm(self) -> None:
        """12:00 PM (noon) must format to '12:00', not '00:00'."""
        dt = self._et_dt(2026, 6, 1, 12, 0)
        assert self._format_time(dt) == "12:00", "Noon in tz-aware ET must be 12:00"

    def test_midnight_class_12am(self) -> None:
        """12:00 AM (midnight) must format to '00:00', not '12:00'."""
        dt = self._et_dt(2026, 6, 1, 0, 0)
        assert self._format_time(dt) == "00:00", "Midnight in tz-aware ET must be 00:00"

    def test_morning_class_9am(self) -> None:
        dt = self._et_dt(2026, 6, 1, 9, 0)
        assert self._format_time(dt) == "09:00"

    def test_tz_aware_date_stays_in_et(self) -> None:
        """Date extraction from tz-aware datetime stays in ET, not UTC."""
        # 11 PM ET = next day UTC — date() must return the ET date
        dt = self._et_dt(2026, 6, 1, 23, 0)
        assert self._format_date(dt) == "2026-06-01"
        assert self._format_time(dt) == "23:00"


# ---------------------------------------------------------------------------
# normalize_time_format (utils.py) — the shared string parser used by
# the pipeline enrichment layer when events lack a structured time field
# ---------------------------------------------------------------------------


class TestNormalizeTimeFormat:
    """Verify the shared normalize_time_format handles all AM/PM edge cases."""

    def _norm(self, s: str) -> Optional[str]:
        from utils import normalize_time_format
        return normalize_time_format(s)

    # 12-hour format edge cases
    def test_12pm_noon(self) -> None:
        assert self._norm("12:00 PM") == "12:00"

    def test_12am_midnight(self) -> None:
        assert self._norm("12:00 AM") == "00:00"

    def test_12pm_no_space(self) -> None:
        assert self._norm("12:00PM") == "12:00"

    def test_12am_no_space(self) -> None:
        assert self._norm("12:00AM") == "00:00"

    def test_12pm_no_minutes(self) -> None:
        assert self._norm("12 PM") == "12:00"

    def test_12am_no_minutes(self) -> None:
        assert self._norm("12 AM") == "00:00"

    # Standard AM/PM cases
    def test_7pm(self) -> None:
        assert self._norm("7:00 PM") == "19:00"

    def test_7pm_lowercase(self) -> None:
        assert self._norm("7:00 pm") == "19:00"

    def test_7pm_compact(self) -> None:
        assert self._norm("7pm") == "19:00"

    def test_7am(self) -> None:
        assert self._norm("7:00 AM") == "07:00"

    def test_11am(self) -> None:
        assert self._norm("11:00 AM") == "11:00"

    def test_11pm(self) -> None:
        assert self._norm("11:00 PM") == "23:00"

    # 24-hour format (already normalized)
    def test_24h_already_correct(self) -> None:
        assert self._norm("19:30") == "19:30"

    def test_24h_zero_padded(self) -> None:
        assert self._norm("09:00") == "09:00"

    def test_24h_unpadded_hour(self) -> None:
        assert self._norm("9:30") == "09:30"

    # HH:MM:SS — strip seconds and zero-pad
    def test_hhmmss_noon(self) -> None:
        assert self._norm("12:00:00") == "12:00"

    def test_hhmmss_unpadded_hour(self) -> None:
        assert self._norm("9:30:00") == "09:30"

    def test_hhmmss_midnight(self) -> None:
        assert self._norm("00:00:00") == "00:00"


# ---------------------------------------------------------------------------
# Course code stripping (callanwolde_fine_arts_center.py)
# ---------------------------------------------------------------------------


class TestCallanwoldeTitleCleaning:
    """Verify _clean_callanwolde_title strips codes and returns clean titles."""

    def test_standard_code_colon(self) -> None:
        title, code = _clean_callanwolde_title("DAP-301: Intermediate Watercolor")
        assert title == "Intermediate Watercolor"
        assert code == "DAP-301"

    def test_code_with_space(self) -> None:
        title, code = _clean_callanwolde_title("POT 201: Wheel Throwing")
        assert title == "Wheel Throwing"
        assert code == "POT 201"

    def test_no_code(self) -> None:
        title, code = _clean_callanwolde_title("Spring Exhibition Opening")
        assert title == "Spring Exhibition Opening"
        assert code is None
