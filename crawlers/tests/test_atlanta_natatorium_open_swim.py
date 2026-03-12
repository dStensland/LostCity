from datetime import datetime

from sources.atlanta_natatorium_open_swim import SCHEDULES, _next_weekday


def test_schedule_templates_cover_four_city_natatoriums():
    titles = {item["title"] for item in SCHEDULES}

    assert titles == {
        "Open Swim & Lap Swim at CT Martin Recreation & Aquatic Center",
        "Open Swim & Lap Swim at MLK Jr. Recreation & Aquatic Center",
        "Open Swim & Lap Swim at Rosel Fann Recreation & Aquatic Center",
        "Open Swim & Lap Swim at Washington Park Aquatic Center",
    }


def test_next_weekday_returns_same_day_when_already_saturday():
    saturday = datetime(2026, 3, 14, 0, 0, 0)

    next_saturday = _next_weekday(saturday, 5)

    assert next_saturday == saturday
