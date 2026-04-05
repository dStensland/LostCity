from datetime import date

from sources.gwinnett_line_dancing import (
    VENUE_DATA_BY_LOCATION,
    _build_destination_envelope,
    parse_session,
)


def test_parse_session_builds_adult_line_dance_occurrences():
    session = {
        "text": "Line Dancing - Beginner",
        "price": 20,
        "features": [
            {"name": "location", "value": "George Pierce Park Community Recreation Center"},
            {"name": "ageGender", "value": "50/up"},
            {"name": "days", "value": "Tue"},
            {"name": "dates", "value": "04/14-05/19"},
            {"name": "times", "value": "12pm-1pm"},
        ],
    }

    parsed = parse_session(session, date(2026, 3, 11))

    assert parsed is not None
    assert parsed["title"] == "Line Dancing - Beginner at George Pierce Park Community Recreation Center"
    assert (
        parsed["description"]
        == "Line Dancing - Beginner at George Pierce Park Community Recreation Center. "
        "Public adult line dancing class through Gwinnett County Parks & Recreation. "
        "Reserve through the official county catalog for current availability."
    )
    assert parsed["occurrences"] == [
        (date(2026, 4, 14), 1),
        (date(2026, 4, 21), 1),
        (date(2026, 4, 28), 1),
        (date(2026, 5, 5), 1),
        (date(2026, 5, 12), 1),
        (date(2026, 5, 19), 1),
    ]


def test_build_destination_envelope_for_gwinnett_activity_buildings():
    envelope = _build_destination_envelope(
        5579,
        VENUE_DATA_BY_LOCATION["shorty howell park activity building"],
    )

    assert envelope.destination_details[0]["destination_type"] == "community_recreation_center"
    assert envelope.destination_details[0]["parking_type"] == "free_lot"
    assert {feature["slug"] for feature in envelope.venue_features} == {
        "indoor-family-recreation-space",
        "planned-class-and-activity-building",
    }
