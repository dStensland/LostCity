from datetime import date

from sources.gwinnett_family_sensory_swim import parse_session


def test_parse_session_builds_public_event():
    session = {
        "text": "Family Sensory Swim",
        "registrationOver": False,
        "price": 3.25,
        "features": [
            {"name": "location", "value": "Bogan Park Aquatic Center"},
            {"name": "dates", "value": "04/24/26"},
            {"name": "times", "value": "6:30pm-8:30pm"},
        ],
    }

    parsed = parse_session(session, date(2026, 3, 10))

    assert parsed is not None
    assert parsed["title"] == "Family Sensory Swim at Bogan Park Aquatic Center"
    assert parsed["start_date"] == "2026-04-24"
    assert parsed["start_time"] == "18:30"
    assert parsed["end_time"] == "20:30"
    assert parsed["price_min"] == 3.25
    assert parsed["venue_data"]["slug"] == "bogan-park-aquatic-center"


def test_parse_session_skips_closed_registration():
    session = {
        "text": "Family Sensory Swim",
        "registrationOver": True,
        "features": [
            {"name": "location", "value": "Bogan Park Aquatic Center"},
            {"name": "dates", "value": "03/20/26"},
            {"name": "times", "value": "6:30pm-8:30pm"},
        ],
    }

    assert parse_session(session, date(2026, 3, 10)) is None


def test_parse_session_skips_unknown_venue():
    session = {
        "text": "Family Sensory Swim",
        "registrationOver": False,
        "features": [
            {"name": "location", "value": "Unknown Aquatic Center"},
            {"name": "dates", "value": "04/24/26"},
            {"name": "times", "value": "6:30pm-8:30pm"},
        ],
    }

    assert parse_session(session, date(2026, 3, 10)) is None
