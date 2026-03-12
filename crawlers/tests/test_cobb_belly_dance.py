from datetime import date

from sources.cobb_belly_dance import parse_days_value, parse_session


def test_parse_days_value_handles_tuesday():
    assert parse_days_value("Tue") == [1]


def test_parse_session_builds_recurring_belly_dance_class():
    session = {
        "text": "Belly Dance (52587)",
        "registrationOver": False,
        "sessionFull": False,
        "canceled": False,
        "price": 75,
        "features": [
            {"name": "location", "value": "Ron Anderson Recreation Center"},
            {"name": "days", "value": "Tue"},
            {"name": "dates", "value": "04/21-05/26"},
            {"name": "times", "value": "7pm-8pm"},
        ],
    }

    parsed = parse_session(session, date(2026, 3, 10))

    assert parsed is not None
    assert parsed["title"] == "Belly Dance at Ron Anderson Recreation Center"
    assert parsed["start_time"] == "19:00"
    assert parsed["end_time"] == "20:00"
    assert parsed["price_min"] == 75.0
    assert parsed["occurrences"][:3] == [
        (date(2026, 4, 21), 1),
        (date(2026, 4, 28), 1),
        (date(2026, 5, 5), 1),
    ]


def test_parse_session_skips_closed_or_unknown_location():
    closed_session = {
        "text": "Belly Dance (52587)",
        "registrationOver": True,
        "sessionFull": False,
        "canceled": False,
        "features": [
            {"name": "location", "value": "Ron Anderson Recreation Center"},
            {"name": "days", "value": "Tue"},
            {"name": "dates", "value": "04/21-05/26"},
            {"name": "times", "value": "7pm-8pm"},
        ],
    }
    unknown_location = {
        "text": "Belly Dance",
        "registrationOver": False,
        "sessionFull": False,
        "canceled": False,
        "features": [
            {"name": "location", "value": "Unknown Center"},
            {"name": "days", "value": "Tue"},
            {"name": "dates", "value": "04/21-05/26"},
            {"name": "times", "value": "7pm-8pm"},
        ],
    }

    assert parse_session(closed_session, date(2026, 3, 10)) is None
    assert parse_session(unknown_location, date(2026, 3, 10)) is None
