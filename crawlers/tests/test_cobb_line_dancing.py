from datetime import date

from sources.cobb_line_dancing import parse_days_value, parse_session


def test_parse_days_value_handles_tuesday():
    assert parse_days_value("Tue") == [1]


def test_parse_session_builds_recurring_line_dancing_class():
    session = {
        "text": "LINE DANCING (51159)",
        "registrationOver": False,
        "sessionFull": False,
        "canceled": False,
        "price": 30,
        "features": [
            {"name": "location", "value": "South Cobb Recreation Center"},
            {"name": "days", "value": "Tue"},
            {"name": "dates", "value": "04/21-05/26"},
            {"name": "times", "value": "6:30pm-8:30pm"},
        ],
    }

    parsed = parse_session(session, date(2026, 3, 10))

    assert parsed is not None
    assert parsed["title"] == "LINE DANCING at South Cobb Recreation Center"
    assert parsed["start_time"] == "18:30"
    assert parsed["end_time"] == "20:30"
    assert parsed["price_min"] == 30.0
    assert parsed["occurrences"][:3] == [
        (date(2026, 4, 21), 1),
        (date(2026, 4, 28), 1),
        (date(2026, 5, 5), 1),
    ]


def test_parse_session_skips_closed_or_unknown_location():
    closed_session = {
        "text": "LINE DANCING (51159)",
        "registrationOver": True,
        "sessionFull": False,
        "canceled": False,
        "features": [
            {"name": "location", "value": "South Cobb Recreation Center"},
            {"name": "days", "value": "Tue"},
            {"name": "dates", "value": "04/21-05/26"},
            {"name": "times", "value": "6:30pm-8:30pm"},
        ],
    }
    unknown_location = {
        "text": "LINE DANCING",
        "registrationOver": False,
        "sessionFull": False,
        "canceled": False,
        "features": [
            {"name": "location", "value": "Unknown Center"},
            {"name": "days", "value": "Tue"},
            {"name": "dates", "value": "04/21-05/26"},
            {"name": "times", "value": "6:30pm-8:30pm"},
        ],
    }

    assert parse_session(closed_session, date(2026, 3, 10)) is None
    assert parse_session(unknown_location, date(2026, 3, 10)) is None
