from datetime import date

from sources.gwinnett_adult_swim_lessons import parse_days_value, parse_session


def test_parse_days_value_expands_weekday_range():
    assert parse_days_value("M-TH") == [0, 1, 2, 3]


def test_parse_session_builds_unique_time_specific_swim_title():
    session = {
        "text": "Adult 1,2 (LPP33409)",
        "price": 61,
        "features": [
            {"name": "location", "value": "Lenora Park Pool"},
            {"name": "days", "value": "M-TH"},
            {"name": "dates", "value": "07/06-07/16"},
            {"name": "times", "value": "10am-10:30am"},
        ],
    }

    parsed = parse_session(session, date(2026, 3, 10))

    assert parsed is not None
    assert parsed["title"] == "Adult Swim Lessons (10:00 AM) at Lenora Park Pool"
    assert (
        parsed["description"]
        == "Adult Swim Lessons (10:00 AM) at Lenora Park Pool. "
        "Public adult swim lessons through Gwinnett County Parks & Recreation. "
        "Reserve through the official county catalog for current availability."
    )
    assert parsed["start_time"] == "10:00"
    assert parsed["end_time"] == "10:30"
    assert parsed["occurrences"][:4] == [
        (date(2026, 7, 6), 0),
        (date(2026, 7, 7), 1),
        (date(2026, 7, 8), 2),
        (date(2026, 7, 9), 3),
    ]
