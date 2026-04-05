from datetime import date

from sources.gwinnett_pickleball_classes import parse_session


def test_parse_session_builds_recurring_pickleball_class_occurrences():
    session = {
        "text": "Pickleball 101",
        "price": 81,
        "features": [
            {"name": "location", "value": "Rhodes Jordan Park"},
            {"name": "days", "value": "Wed"},
            {"name": "dates", "value": "04/01-04/22"},
            {"name": "times", "value": "5pm-6pm"},
        ],
    }

    parsed = parse_session(session, date(2026, 3, 10))

    assert parsed is not None
    assert parsed["title"] == "Pickleball 101 at Rhodes Jordan Park Community Recreation Center"
    assert (
        parsed["description"]
        == "Pickleball 101 at Rhodes Jordan Park Community Recreation Center. "
        "Public pickleball class through Gwinnett County Parks & Recreation. "
        "Reserve through the official county catalog for current availability."
    )
    assert parsed["start_time"] == "17:00"
    assert parsed["end_time"] == "18:00"
    assert parsed["price_min"] == 81.0
    assert parsed["occurrences"] == [
        (date(2026, 4, 1), 2),
        (date(2026, 4, 8), 2),
        (date(2026, 4, 15), 2),
        (date(2026, 4, 22), 2),
    ]


def test_parse_session_skips_league_inventory():
    session = {
        "text": "BCP ALTA WMN SNR Pickleball League",
        "price": 161,
        "features": [
            {"name": "location", "value": "Bay Creek Park"},
            {"name": "days", "value": "Tue"},
            {"name": "dates", "value": "03/10-04/21"},
            {"name": "times", "value": "12am-12am"},
        ],
    }

    assert parse_session(session, date(2026, 3, 10)) is None
