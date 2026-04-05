from datetime import date

from sources.cobb_basketball_skills import parse_days_value, parse_session


def test_parse_days_value_handles_weekday_list():
    assert parse_days_value("M, W") == [0, 2]


def test_parse_session_builds_recurring_basketball_class():
    session = {
        "text": "Successfully Learning Basketball -Skill Camp 9yrs -15yrs (53152)",
        "registrationOver": False,
        "sessionFull": False,
        "canceled": False,
        "price": 0,
        "features": [
            {"name": "location", "value": "Ward Recreation Center"},
            {"name": "days", "value": "M, W"},
            {"name": "dates", "value": "04/06-05/14"},
            {"name": "times", "value": "6pm-7:30pm"},
        ],
    }

    parsed = parse_session(session, date(2026, 3, 10))

    assert parsed is not None
    assert parsed["title"] == "Successfully Learning Basketball -Skill Camp 9yrs -15yrs at Boots Ward Recreation Center"
    assert (
        parsed["description"]
        == "Successfully Learning Basketball -Skill Camp 9yrs -15yrs at Boots Ward Recreation Center. "
        "Public youth basketball skills class through Cobb County Parks. "
        "Reserve through the official county catalog for current availability."
    )
    assert parsed["start_time"] == "18:00"
    assert parsed["end_time"] == "19:30"
    assert parsed["is_free"] is True
    assert parsed["occurrences"][:4] == [
        (date(2026, 4, 6), 0),
        (date(2026, 4, 8), 2),
        (date(2026, 4, 13), 0),
        (date(2026, 4, 15), 2),
    ]


def test_parse_session_skips_closed_or_unknown_location():
    closed_session = {
        "text": "Successfully Learning Basketball -Skill Camp 5yrs - 8yrs (53150)",
        "registrationOver": True,
        "sessionFull": False,
        "canceled": False,
        "features": [
            {"name": "location", "value": "Ward Recreation Center"},
            {"name": "days", "value": "M, W"},
            {"name": "dates", "value": "04/06-05/14"},
            {"name": "times", "value": "6pm-7:30pm"},
        ],
    }
    unknown_location = {
        "text": "Successfully Learning Basketball",
        "registrationOver": False,
        "sessionFull": False,
        "canceled": False,
        "features": [
            {"name": "location", "value": "Unknown Recreation Center"},
            {"name": "days", "value": "M, W"},
            {"name": "dates", "value": "04/06-05/14"},
            {"name": "times", "value": "6pm-7:30pm"},
        ],
    }

    assert parse_session(closed_session, date(2026, 3, 10)) is None
    assert parse_session(unknown_location, date(2026, 3, 10)) is None
