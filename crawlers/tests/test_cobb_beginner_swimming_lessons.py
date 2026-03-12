from datetime import date

from sources.cobb_beginner_swimming_lessons import parse_days_value, parse_session


def test_parse_days_value_handles_multiple_weekdays():
    assert parse_days_value("M, W") == [0, 2]
    assert parse_days_value("TU, TH") == [1, 3]


def test_parse_session_builds_recurring_beginner_swim_class():
    session = {
        "text": "WCAC Tues/Thurs 6:10 pm Session 1 (52997)",
        "registrationOver": False,
        "sessionFull": False,
        "canceled": False,
        "price": 80,
        "features": [
            {"name": "location", "value": "West Cobb Aquatic Center"},
            {"name": "days", "value": "TU, TH"},
            {"name": "dates", "value": "03/10-03/26"},
            {"name": "times", "value": "6:10pm-7pm"},
        ],
    }

    parsed = parse_session(session, date(2026, 3, 10))

    assert parsed is not None
    assert parsed["title"] == "Beginner Swimming Lessons at West Cobb Aquatic Center"
    assert parsed["start_time"] == "18:10"
    assert parsed["end_time"] == "19:00"
    assert parsed["price_min"] == 80.0
    assert parsed["occurrences"][:4] == [
        (date(2026, 3, 10), 1),
        (date(2026, 3, 12), 3),
        (date(2026, 3, 17), 1),
        (date(2026, 3, 19), 3),
    ]


def test_parse_session_skips_closed_or_unknown_location():
    closed_session = {
        "text": "WCAC Mon/Wed 12 pm Session 2 (52990)",
        "registrationOver": True,
        "sessionFull": False,
        "canceled": False,
        "features": [
            {"name": "location", "value": "West Cobb Aquatic Center"},
            {"name": "days", "value": "M, W"},
            {"name": "dates", "value": "04/13-04/29"},
            {"name": "times", "value": "12pm-12:50pm"},
        ],
    }
    unknown_location = {
        "text": "Beginner Swimming",
        "registrationOver": False,
        "sessionFull": False,
        "canceled": False,
        "features": [
            {"name": "location", "value": "Unknown Aquatic Center"},
            {"name": "days", "value": "M, W"},
            {"name": "dates", "value": "04/13-04/29"},
            {"name": "times", "value": "12pm-12:50pm"},
        ],
    }

    assert parse_session(closed_session, date(2026, 3, 10)) is None
    assert parse_session(unknown_location, date(2026, 3, 10)) is None
