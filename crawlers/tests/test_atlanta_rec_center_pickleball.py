from datetime import datetime

from sources.atlanta_rec_center_pickleball import (
    SCHEDULES,
    WEEKS_AHEAD,
    build_series_title,
    get_next_weekday,
)


def test_get_next_weekday_returns_same_day_when_aligned():
    monday = datetime(2026, 3, 9)
    assert get_next_weekday(monday, 0) == monday


def test_schedule_generates_expected_weekly_event_volume():
    assert len(SCHEDULES) == 5
    assert len(SCHEDULES) * WEEKS_AHEAD == 30


def test_build_series_title_separates_multi_day_sessions():
    assert build_series_title("Indoor Pickleball at Anderson Recreation Center", 1) != (
        build_series_title("Indoor Pickleball at Anderson Recreation Center", 3)
    )
