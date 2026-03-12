from datetime import date

from sources.roswell365 import is_future_or_current_date


def test_is_future_or_current_date_accepts_today_and_future():
    today = date(2026, 3, 10)

    assert is_future_or_current_date("2026-03-10", today=today)
    assert is_future_or_current_date("2026-03-11", today=today)


def test_is_future_or_current_date_rejects_past_and_invalid_dates():
    today = date(2026, 3, 10)

    assert not is_future_or_current_date("2001-09-11", today=today)
    assert not is_future_or_current_date("not-a-date", today=today)
    assert not is_future_or_current_date(None, today=today)
