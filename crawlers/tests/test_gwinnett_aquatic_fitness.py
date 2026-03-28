from datetime import date

from sources.gwinnett_aquatic_fitness import (
    _build_destination_envelope,
    parse_days_value,
    parse_session,
)


def test_parse_days_value_supports_multiple_weekdays():
    assert parse_days_value("TU, TH, F") == [1, 3, 4]


def test_parse_session_builds_recurring_aquatic_fitness_occurrences():
    session = {
        "text": "Get Wet and Sweat - Deep",
        "registrationOver": False,
        "sessionFull": False,
        "price": 89,
        "features": [
            {"name": "location", "value": "Collins Hill Park Aquatic Center"},
            {"name": "days", "value": "TU, TH"},
            {"name": "dates", "value": "03/10-05/07"},
            {"name": "times", "value": "7:10pm-8pm"},
        ],
    }

    parsed = parse_session(session, date(2026, 3, 10))

    assert parsed is not None
    assert parsed["title"] == "Get Wet and Sweat - Deep at Collins Hill Park Aquatic Center"
    assert parsed["start_time"] == "19:10"
    assert parsed["end_time"] == "20:00"
    assert parsed["price_min"] == 89.0
    assert parsed["venue_data"]["slug"] == "collins-hill-park-aquatic-center"
    assert parsed["occurrences"][:4] == [
        (date(2026, 3, 10), 1),
        (date(2026, 3, 12), 3),
        (date(2026, 3, 17), 1),
        (date(2026, 3, 19), 3),
    ]


def test_parse_session_skips_full_or_closed_classes():
    session = {
        "text": "Aqua Strength",
        "registrationOver": False,
        "sessionFull": True,
        "features": [
            {"name": "location", "value": "Mountain Park Aquatic Center"},
            {"name": "days", "value": "WE"},
            {"name": "dates", "value": "03/11-04/29"},
            {"name": "times", "value": "7:10pm-8pm"},
        ],
    }

    assert parse_session(session, date(2026, 3, 10)) is None


def test_build_destination_envelope_marks_aquatic_center() -> None:
    place_data = {
        "name": "Collins Hill Park Aquatic Center",
        "slug": "collins-hill-park-aquatic-center",
        "place_type": "community_center",
    }

    envelope = _build_destination_envelope(place_data, 2202)

    assert envelope.destination_details[0]["destination_type"] == "aquatic_center"
    assert envelope.venue_features[0]["slug"] == "public-pool-and-aquatics-programs"
