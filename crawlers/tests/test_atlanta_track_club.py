from datetime import datetime

from sources.atlanta_track_club import RECURRING_PROGRAMS, get_next_weekday


def test_track_club_recurring_programs_cover_group_runs():
    titles = {program["title"] for program in RECURRING_PROGRAMS}
    assert "Atlanta Track Club Club Night" in titles
    assert "Atlanta Track Club BeltLine Run Club" in titles


def test_get_next_weekday_advances_to_requested_day():
    monday = datetime(2026, 3, 9)
    assert get_next_weekday(monday, 3).strftime("%Y-%m-%d") == "2026-03-12"
