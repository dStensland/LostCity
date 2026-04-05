from datetime import date

from sources.cobb_basketball_training_rarc import parse_days_value, parse_session


def test_parse_days_value_handles_weekday_list():
    assert parse_days_value("M, W") == [0, 2]


def test_parse_session_builds_recurring_basketball_training_class():
    session = {
        "text": "Monster Like Sports (52932)",
        "registrationOver": False,
        "sessionFull": False,
        "canceled": False,
        "price": 225,
        "features": [
            {"name": "location", "value": "Ron Anderson Recreation Center"},
            {"name": "days", "value": "M, W"},
            {"name": "dates", "value": "04/20-06/01"},
            {"name": "times", "value": "6pm-8:30pm"},
            {"name": "ageGender", "value": "7-15"},
        ],
    }

    parsed = parse_session(session, date(2026, 3, 10))

    assert parsed is not None
    assert parsed["title"] == "Youth Basketball Training at Ron Anderson Recreation Center"
    assert (
        parsed["description"]
        == "Youth Basketball Training at Ron Anderson Recreation Center. "
        "Public youth basketball training through Cobb County Parks. "
        "Reserve through the official county catalog for current availability."
    )
    assert parsed["start_time"] == "18:00"
    assert parsed["end_time"] == "20:30"
    assert parsed["price_min"] == 225.0
    assert parsed["occurrences"][:4] == [
        (date(2026, 4, 20), 0),
        (date(2026, 4, 22), 2),
        (date(2026, 4, 27), 0),
        (date(2026, 4, 29), 2),
    ]


def test_parse_session_skips_closed_or_unknown_location():
    closed_session = {
        "text": "Monster Like Sports (52932)",
        "registrationOver": True,
        "sessionFull": False,
        "canceled": False,
        "features": [
            {"name": "location", "value": "Ron Anderson Recreation Center"},
            {"name": "days", "value": "M, W"},
            {"name": "dates", "value": "04/20-06/01"},
            {"name": "times", "value": "6pm-8:30pm"},
        ],
    }
    unknown_location = {
        "text": "Monster Like Sports",
        "registrationOver": False,
        "sessionFull": False,
        "canceled": False,
        "features": [
            {"name": "location", "value": "Unknown Recreation Center"},
            {"name": "days", "value": "M, W"},
            {"name": "dates", "value": "04/20-06/01"},
            {"name": "times", "value": "6pm-8:30pm"},
        ],
    }

    assert parse_session(closed_session, date(2026, 3, 10)) is None
    assert parse_session(unknown_location, date(2026, 3, 10)) is None
