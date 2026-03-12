from datetime import date

from sources.cobb_advanced_beginner_swimming_lessons import (
    parse_days_value,
    parse_session,
)


def test_parse_days_value_handles_multiple_weekdays():
    assert parse_days_value("TU, TH") == [1, 3]
    assert parse_days_value("Fri") == [4]


def test_parse_session_builds_recurring_advanced_beginner_swim_class():
    session = {
        "text": "WCAC Tues/Thurs 1 pm Session 2 (52993)",
        "registrationOver": False,
        "sessionFull": False,
        "canceled": False,
        "price": 80,
        "features": [
            {"name": "location", "value": "West Cobb Aquatic Center"},
            {"name": "days", "value": "TU, TH"},
            {"name": "dates", "value": "04/14-04/30"},
            {"name": "times", "value": "1pm-1:50pm"},
        ],
    }

    parsed = parse_session(session, date(2026, 3, 10))

    assert parsed is not None
    assert (
        parsed["title"]
        == "Advanced Beginner Swimming Lessons at West Cobb Aquatic Center"
    )
    assert parsed["start_time"] == "13:00"
    assert parsed["end_time"] == "13:50"
    assert parsed["price_min"] == 80.0
    assert parsed["occurrences"][:4] == [
        (date(2026, 4, 14), 1),
        (date(2026, 4, 16), 3),
        (date(2026, 4, 21), 1),
        (date(2026, 4, 23), 3),
    ]


def test_parse_session_skips_closed_or_unknown_location():
    closed_session = {
        "text": "WCAC Fri 1:00 pm (53073)",
        "registrationOver": True,
        "sessionFull": False,
        "canceled": False,
        "features": [
            {"name": "location", "value": "West Cobb Aquatic Center"},
            {"name": "days", "value": "Fri"},
            {"name": "dates", "value": "03/13-05/01"},
            {"name": "times", "value": "1pm-1:50pm"},
        ],
    }
    unknown_location = {
        "text": "Advanced Beginner Swimming",
        "registrationOver": False,
        "sessionFull": False,
        "canceled": False,
        "features": [
            {"name": "location", "value": "Unknown Aquatic Center"},
            {"name": "days", "value": "Fri"},
            {"name": "dates", "value": "03/13-05/01"},
            {"name": "times", "value": "1pm-1:50pm"},
        ],
    }

    assert parse_session(closed_session, date(2026, 3, 10)) is None
    assert parse_session(unknown_location, date(2026, 3, 10)) is None
