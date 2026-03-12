from datetime import date

from sources.gwinnett_active_adult_cardio import parse_session


def test_parse_session_builds_double_dutch_occurrences():
    session = {
        "text": "Double Dutch",
        "price": 0,
        "features": [
            {"name": "location", "value": "Rhodes Jordan Park Community Recreation Center"},
            {"name": "days", "value": "Sat"},
            {"name": "dates", "value": "03/07-03/28"},
            {"name": "times", "value": "9am-11am"},
        ],
    }

    parsed = parse_session(session, date(2026, 3, 11))

    assert parsed is not None
    assert parsed["title"] == "Double Dutch at Rhodes Jordan Park Community Recreation Center"
    assert parsed["is_free"] is True
    assert parsed["occurrences"] == [
        (date(2026, 3, 14), 5),
        (date(2026, 3, 21), 5),
        (date(2026, 3, 28), 5),
    ]
