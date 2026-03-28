from datetime import date

from sources.dekalb_aquatic_fitness import (
    _build_destination_envelope,
    parse_item,
    parse_schedule,
)


def test_parse_schedule_handles_multiple_days():
    html = """
    <div>Note: Class held every Mondays and Wednesdays 5:30pm - 6:30pm. Participants may attend both days.</div>
    """

    parsed = parse_schedule(html)

    assert parsed == ([0, 2], "17:30", "18:30")


def test_parse_item_builds_occurrences():
    item = {
        "name": "East Central - Water Fitness",
        "date_range_start": "2026-02-27",
        "date_range_end": "2026-04-03",
        "detail_url": "https://example.com/detail",
        "action_link": {"href": "https://example.com/enroll"},
        "location": {"label": "East Central DeKalb Cmty & Senior Ctr"},
        "desc": """
            <div>Low-impact class.</div>
            <div>Fridays 4:00pm - 5:00pm</div>
            <div>$30.00</div>
        """,
    }

    parsed = parse_item(item, date(2026, 3, 10))

    assert parsed is not None
    assert parsed["title"] == "East Central - Water Fitness at East Central DeKalb Community & Senior Center"
    assert parsed["start_time"] == "16:00"
    assert parsed["end_time"] == "17:00"
    assert parsed["price_min"] == 30.0
    assert parsed["occurrences"][:3] == [
        (date(2026, 3, 13), 4),
        (date(2026, 3, 20), 4),
        (date(2026, 3, 27), 4),
    ]


def test_build_destination_envelope_marks_aquatic_center() -> None:
    place_data = {
        "name": "East Central DeKalb Community & Senior Center",
        "slug": "east-central-dekalb-community-senior-center",
        "place_type": "community_center",
    }

    envelope = _build_destination_envelope(place_data, 2203)

    assert envelope.destination_details[0]["destination_type"] == "aquatic_center"
    assert envelope.venue_features[0]["slug"] == "public-pool-and-aquatics-programs"
