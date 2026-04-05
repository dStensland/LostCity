from datetime import date

from sources.gwinnett_bachata_classes import parse_session


def test_parse_session_builds_recurring_bachata_occurrences():
    session = {
        "text": "Bachata/Salsa",
        "price": 61,
        "features": [
            {"name": "location", "value": "Rhodes Jordan Park Community Recreation Center"},
            {"name": "days", "value": "Tue"},
            {"name": "dates", "value": "04/07-04/28"},
            {"name": "times", "value": "7:30pm-8:45pm"},
        ],
    }

    parsed = parse_session(session, date(2026, 3, 10))

    assert parsed is not None
    assert parsed["title"] == "Bachata/Salsa at Rhodes Jordan Park Community Recreation Center"
    assert (
        parsed["description"]
        == "Bachata/Salsa at Rhodes Jordan Park Community Recreation Center. "
        "Public Latin dance class through Gwinnett County Parks & Recreation. "
        "Reserve through the official county catalog for current availability."
    )
    assert parsed["start_time"] == "19:30"
    assert parsed["end_time"] == "20:45"
    assert parsed["occurrences"] == [
        (date(2026, 4, 7), 1),
        (date(2026, 4, 14), 1),
        (date(2026, 4, 21), 1),
        (date(2026, 4, 28), 1),
    ]
