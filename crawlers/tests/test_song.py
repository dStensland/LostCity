from datetime import date

from sources.song import parse_date


def test_parse_date_preserves_explicit_past_year():
    assert (
        parse_date(
            "November 13, 2025 @ 10:00 am - November 16, 2025 @ 9:00 pm",
            today=date(2026, 3, 10),
        )
        == "2025-11-13"
    )


def test_parse_date_keeps_recent_yearless_past_dates_in_current_year():
    assert parse_date("January 5", today=date(2026, 3, 10)) == "2026-01-05"


def test_parse_date_rolls_far_past_yearless_dates_forward():
    assert parse_date("January 5", today=date(2026, 12, 20)) == "2027-01-05"
