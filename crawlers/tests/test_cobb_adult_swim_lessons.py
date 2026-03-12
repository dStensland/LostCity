from datetime import date

from sources.cobb_adult_swim_lessons import parse_days_value, parse_session


def test_parse_days_value_handles_friday():
    assert parse_days_value("Fri") == [4]


def test_parse_days_value_handles_multiple_weekdays():
    assert parse_days_value("M, W") == [0, 2]
    assert parse_days_value("TU, TH") == [1, 3]


def test_parse_session_builds_recurring_adult_swim_class():
    session = {
        "text": "WCAC Fri 8:10 pm (52991)",
        "registrationOver": False,
        "sessionFull": False,
        "canceled": False,
        "price": 80,
        "features": [
            {"name": "location", "value": "West Cobb Aquatic Center"},
            {"name": "days", "value": "Fri"},
            {"name": "dates", "value": "03/13-05/01"},
            {"name": "times", "value": "8:10pm-9pm"},
        ],
    }

    parsed = parse_session(session, date(2026, 3, 10))

    assert parsed is not None
    assert parsed["title"] == "Adult Basics Swimming Lessons at West Cobb Aquatic Center"
    assert parsed["start_time"] == "20:10"
    assert parsed["end_time"] == "21:00"
    assert parsed["price_min"] == 80.0
    assert parsed["occurrences"][:3] == [
        (date(2026, 3, 13), 4),
        (date(2026, 3, 20), 4),
        (date(2026, 3, 27), 4),
    ]


def test_parse_session_skips_closed_or_unknown_location():
    closed_session = {
        "text": "WCAC Fri 8:10 pm (52991)",
        "registrationOver": True,
        "sessionFull": False,
        "canceled": False,
        "features": [
            {"name": "location", "value": "West Cobb Aquatic Center"},
            {"name": "days", "value": "Fri"},
            {"name": "dates", "value": "03/13-05/01"},
            {"name": "times", "value": "8:10pm-8:50pm"},
        ],
    }
    unknown_location = {
        "text": "Adult Swim",
        "registrationOver": False,
        "sessionFull": False,
        "canceled": False,
        "features": [
            {"name": "location", "value": "Unknown Aquatic Center"},
            {"name": "days", "value": "Fri"},
            {"name": "dates", "value": "03/13-05/01"},
            {"name": "times", "value": "8:10pm-8:50pm"},
        ],
    }

    assert parse_session(closed_session, date(2026, 3, 10)) is None
    assert parse_session(unknown_location, date(2026, 3, 10)) is None
