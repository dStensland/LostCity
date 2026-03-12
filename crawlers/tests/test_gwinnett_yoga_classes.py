from datetime import date

from sources.gwinnett_yoga_classes import parse_session


def test_parse_session_builds_bethesda_yoga_occurrences():
    session = {
        "text": "Yoga",
        "price": 15,
        "features": [
            {"name": "location", "value": "Bethesda Park Senior Center"},
            {"name": "days", "value": "Thu"},
            {"name": "dates", "value": "04/16-05/21"},
            {"name": "times", "value": "2pm-3pm"},
        ],
    }

    parsed = parse_session(session, date(2026, 3, 11))

    assert parsed is not None
    assert parsed["title"] == "Yoga at Bethesda Park Senior Center"
    assert parsed["start_time"] == "14:00"
    assert parsed["end_time"] == "15:00"
    assert parsed["occurrences"] == [
        (date(2026, 4, 16), 3),
        (date(2026, 4, 23), 3),
        (date(2026, 4, 30), 3),
        (date(2026, 5, 7), 3),
        (date(2026, 5, 14), 3),
        (date(2026, 5, 21), 3),
    ]
