from datetime import date

from sources.gwinnett_rnb_tennis import parse_session


def test_parse_session_builds_recurring_rnb_tennis_occurrences():
    session = {
        "text": "RNB Tennis",
        "price": 81,
        "features": [
            {"name": "location", "value": "Rhodes Jordan Park"},
            {"name": "days", "value": "Fri"},
            {"name": "dates", "value": "04/03-04/24"},
            {"name": "times", "value": "6pm-7pm"},
        ],
    }

    parsed = parse_session(session, date(2026, 3, 10))

    assert parsed is not None
    assert parsed["title"] == "RNB Tennis at Rhodes Jordan Park Community Recreation Center"
    assert (
        parsed["description"]
        == "RNB Tennis at Rhodes Jordan Park Community Recreation Center. "
        "Public youth tennis class through Gwinnett County Parks & Recreation. "
        "Reserve through the official county catalog for current availability."
    )
    assert parsed["start_time"] == "18:00"
    assert parsed["end_time"] == "19:00"
    assert parsed["price_min"] == 81.0
    assert parsed["occurrences"] == [
        (date(2026, 4, 3), 4),
        (date(2026, 4, 10), 4),
        (date(2026, 4, 17), 4),
        (date(2026, 4, 24), 4),
    ]
