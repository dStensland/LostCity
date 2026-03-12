from datetime import date, timedelta

from sources.atlanta_rec_center_open_gym import (
    WEEKS_AHEAD,
    build_series_title,
    extract_schedule_from_description,
    iter_occurrence_dates,
    parse_open_gym_item,
    parse_schedule_line,
)


def test_parse_schedule_line_handles_comma_separated_days():
    parsed = parse_schedule_line("Mon, Tues, Thurs, Fri - 10:00a.m. - 2:00p.m.")
    assert parsed == ([0, 1, 3, 4], "10:00", "14:00")


def test_parse_schedule_line_handles_day_ranges():
    parsed = parse_schedule_line("Tuesdays-Thursday - 11:00a.m. - 2:00p.m.")
    assert parsed == ([1, 2, 3], "11:00", "14:00")


def test_extract_schedule_from_description_finds_open_gym_schedule():
    html = (
        "Come join us!<div>When: February 23 - May 29, 2026</div>"
        "<div>Mon - Sat - 10:00a.m. - 2:00p.m.</div><div>Cost: $5</div>"
    )
    assert extract_schedule_from_description(html) == ([0, 1, 2, 3, 4, 5], "10:00", "14:00")


def test_parse_open_gym_item_extracts_public_play_template():
    item = {
        "name": "Open Gym @ Dunbar",
        "date_range_start": "2026-02-03",
        "date_range_end": "2026-04-30",
        "desc": (
            "Come join us for Open Gym at Dunbar!"
            "<div>Open Gym is a structured activity time where the gymnasium is "
            "available for students, families, and community members to play "
            "pick-up basketball for fun.</div>"
            "<div>Tuesdays-Thursday - 11:00a.m. - 2:00p.m.</div>"
            "<div>Cost: $0</div>"
        ),
        "detail_url": "https://example.com/open-gym-dunbar",
        "enroll_now": {"href": "https://example.com/enroll"},
        "location": {"label": "Dunbar Park Recreation Center"},
        "age_min_year": 18,
    }

    parsed = parse_open_gym_item(item, date(2026, 3, 10))

    assert parsed is not None
    assert parsed["weekdays"] == [1, 2, 3]
    assert parsed["start_time"] == "11:00"
    assert parsed["end_time"] == "14:00"
    assert parsed["venue_data"]["slug"] == "dunbar-park-recreation-center"
    assert parsed["ticket_url"] == "https://example.com/enroll"
    assert parsed["is_free"] is True
    assert "basketball" in parsed["tags"]
    assert "public-play" in parsed["tags"]


def test_iter_occurrence_dates_caps_horizon_and_expands_weekdays():
    occurrences = iter_occurrence_dates(
        start_date=date(2026, 2, 23),
        end_date=date(2026, 5, 29),
        weekdays=[0, 5],
        today=date(2026, 3, 10),
    )

    assert occurrences[0] == (date(2026, 3, 14), 5)
    assert occurrences[1] == (date(2026, 3, 16), 0)
    assert occurrences[-1][0] <= date(2026, 3, 10) + timedelta(weeks=WEEKS_AHEAD)


def test_build_series_title_separates_weekly_open_gym_series():
    assert build_series_title("Open Gym @ Grove Park", 0) != build_series_title(
        "Open Gym @ Grove Park", 5
    )
