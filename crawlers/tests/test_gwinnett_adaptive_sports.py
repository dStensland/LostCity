from datetime import date

from sources.gwinnett_adaptive_sports import parse_session


def test_parse_session_builds_public_adaptive_sports_event():
    session = {
        "text": "Adaptive Pickleball for All",
        "registrationOver": False,
        "sessionFull": False,
        "price": 1.25,
        "features": [
            {"name": "location", "value": "Bogan Park Community Recreation Center"},
            {"name": "dates", "value": "04/16/26"},
            {"name": "times", "value": "10am-11am"},
        ],
    }

    parsed = parse_session(session, date(2026, 3, 10))

    assert parsed is not None
    assert parsed["title"] == "Adaptive Pickleball for All at Bogan Park Community Recreation Center"
    assert parsed["start_date"] == "2026-04-16"
    assert parsed["start_time"] == "10:00"
    assert parsed["end_time"] == "11:00"
    assert parsed["price_min"] == 1.25
    assert parsed["venue_data"]["slug"] == "bogan-park-crc"


def test_parse_session_skips_closed_or_unknown_sessions():
    closed_session = {
        "text": "Adaptive Pickleball for All",
        "registrationOver": True,
        "features": [
            {"name": "location", "value": "Bogan Park Community Recreation Center"},
            {"name": "dates", "value": "04/16/26"},
            {"name": "times", "value": "10am-11am"},
        ],
    }
    unknown_venue_session = {
        "text": "Adaptive Pickleball for All",
        "registrationOver": False,
        "sessionFull": False,
        "features": [
            {"name": "location", "value": "Unknown Center"},
            {"name": "dates", "value": "04/16/26"},
            {"name": "times", "value": "10am-11am"},
        ],
    }

    assert parse_session(closed_session, date(2026, 3, 10)) is None
    assert parse_session(unknown_venue_session, date(2026, 3, 10)) is None
