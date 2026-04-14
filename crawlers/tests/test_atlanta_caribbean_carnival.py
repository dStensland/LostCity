from datetime import date

from sources.atlanta_caribbean_carnival import _memorial_day_weekend_window, _resolve_window


def test_resolve_window_prefers_known_2026_date() -> None:
    start_date, end_date = _resolve_window(date(2026, 4, 6))
    assert start_date == "2026-05-23"
    assert end_date == "2026-05-23"


def test_memorial_day_weekend_window_uses_saturday_before_memorial_day() -> None:
    start_date, end_date = _memorial_day_weekend_window(2027)
    assert start_date == "2027-05-29"
    assert end_date == "2027-05-29"
