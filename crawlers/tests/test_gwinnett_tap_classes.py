from datetime import date

from sources.gwinnett_tap_classes import parse_session


def test_parse_session_builds_tap_occurrences():
    session = {
        "text": "Tap-Intermediate",
        "price": 12,
        "features": [
            {"name": "location", "value": "Rhodes Jordan Park Community Recreation Center"},
            {"name": "ageGender", "value": "50/up"},
            {"name": "days", "value": "Tue"},
            {"name": "dates", "value": "03/31-05/05"},
            {"name": "times", "value": "12:30pm-1:30pm"},
        ],
    }

    parsed = parse_session(session, date(2026, 3, 11))

    assert parsed is not None
    assert parsed["title"] == "Tap-Intermediate at Rhodes Jordan Park Community Recreation Center"
    assert (
        parsed["description"]
        == "Tap-Intermediate at Rhodes Jordan Park Community Recreation Center. "
        "Public active-adult tap class through Gwinnett County Parks & Recreation. "
        "Reserve through the official county catalog for current availability."
    )
    assert parsed["occurrences"] == [
        (date(2026, 3, 31), 1),
        (date(2026, 4, 7), 1),
        (date(2026, 4, 14), 1),
        (date(2026, 4, 21), 1),
        (date(2026, 4, 28), 1),
        (date(2026, 5, 5), 1),
    ]
