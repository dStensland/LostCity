from datetime import date

from sources.cobb_adult_tennis_classes import normalize_title, parse_session


def test_normalize_title_adds_tennis_prefix_for_ambiguous_class_name():
    assert normalize_title("Adult Beginner (51719)") == "Adult Tennis Beginner"


def test_parse_session_builds_recurring_adult_tennis_class():
    session = {
        "text": "Adult Level 1 - Beginner (Keenan) (51296)",
        "price": 108,
        "features": [
            {"name": "location", "value": "Fair Oaks Tennis Center"},
            {"name": "days", "value": "Mon"},
            {"name": "dates", "value": "04/13-05/18"},
            {"name": "times", "value": "6pm-7pm"},
        ],
    }

    parsed = parse_session(session, date(2026, 3, 10))

    assert parsed is not None
    assert parsed["title"] == "Adult Tennis Level 1 - Beginner (Keenan) at Fair Oaks Tennis Center"
    assert (
        parsed["description"]
        == "Adult Tennis Level 1 - Beginner (Keenan) at Fair Oaks Tennis Center. "
        "Public adult tennis class through Cobb County Parks. "
        "Reserve through the official county catalog for current availability."
    )
    assert parsed["start_time"] == "18:00"
    assert parsed["end_time"] == "19:00"
    assert parsed["price_min"] == 108.0
    assert parsed["occurrences"][:3] == [
        (date(2026, 4, 13), 0),
        (date(2026, 4, 20), 0),
        (date(2026, 4, 27), 0),
    ]
