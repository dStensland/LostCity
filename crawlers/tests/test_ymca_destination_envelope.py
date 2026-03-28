from sources.ymca_atlanta import _build_destination_envelope


def test_build_destination_envelope_for_ymca_branch() -> None:
    place_data = {
        "name": "Andrew and Walter Young Family YMCA",
        "slug": "ymca-andrew-young-atlanta",
        "city": "Atlanta",
    }

    envelope = _build_destination_envelope(2602, place_data)

    assert envelope.destination_details[0]["place_id"] == 2602
    assert envelope.destination_details[0]["destination_type"] == "community_center"
    assert envelope.destination_details[0]["parking_type"] == "free_lot"
    assert {feature["slug"] for feature in envelope.venue_features} == {
        "family-community-program-campus",
        "planned-ymca-day-not-drop-in-attraction",
    }
