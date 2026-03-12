from datetime import date

from sources.cobb_pickleball_classes import parse_days_value, parse_session


def test_parse_days_value_handles_rec1_abbreviations():
    assert parse_days_value("Mon, Thu") == [0, 3]


def test_parse_session_builds_recurring_pickleball_class():
    session = {
        "id": 51294,
        "text": "Pickleball Level 1 - Beginner (Keenan) (51294)",
        "registrationOver": False,
        "sessionFull": False,
        "canceled": False,
        "price": 72,
        "features": [
            {"name": "location", "value": "Fair Oaks Tennis Center"},
            {"name": "days", "value": "Tue"},
            {"name": "dates", "value": "04/14-05/19"},
            {"name": "times", "value": "6pm-7pm"},
        ],
    }

    parsed = parse_session(session, date(2026, 3, 10))

    assert parsed is not None
    assert parsed["title"] == "Pickleball Level 1 - Beginner (Keenan) at Fair Oaks Tennis Center"
    assert parsed["start_time"] == "18:00"
    assert parsed["end_time"] == "19:00"
    assert parsed["price_min"] == 72.0
    assert parsed["occurrences"][:3] == [
        (date(2026, 4, 14), 1),
        (date(2026, 4, 21), 1),
        (date(2026, 4, 28), 1),
    ]


def test_parse_session_skips_closed_or_unknown_venue():
    closed_session = {
        "id": 52783,
        "text": "Pickleball Machine Bootcamp Session I (52783)",
        "registrationOver": False,
        "sessionFull": True,
        "canceled": False,
        "features": [
            {"name": "location", "value": "Ward Recreation Center"},
            {"name": "days", "value": "Thu"},
            {"name": "dates", "value": "03/05-04/16"},
            {"name": "times", "value": "8:30am-9:30am"},
        ],
    }
    unknown_venue_session = {
        "id": 99999,
        "text": "Pickleball Workshop",
        "registrationOver": False,
        "sessionFull": False,
        "canceled": False,
        "features": [
            {"name": "location", "value": "Unknown Tennis Center"},
            {"name": "days", "value": "Tue"},
            {"name": "dates", "value": "04/14-05/19"},
            {"name": "times", "value": "6pm-7pm"},
        ],
    }

    assert parse_session(closed_session, date(2026, 3, 10)) is None
    assert parse_session(unknown_venue_session, date(2026, 3, 10)) is None
