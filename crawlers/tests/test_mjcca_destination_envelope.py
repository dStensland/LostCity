from sources.mjcca import _build_destination_envelope


def test_build_destination_envelope_for_mjcca() -> None:
    envelope = _build_destination_envelope(2502)

    assert envelope.destination_details[0]["venue_id"] == 2502
    assert envelope.destination_details[0]["destination_type"] == "community_center"
    assert envelope.destination_details[0]["parking_type"] == "free_lot"
    assert "specific class, event, or community activity" in envelope.destination_details[0]["practical_notes"].lower()
    assert {feature["slug"] for feature in envelope.venue_features} == {
        "family-campus-program-hub",
        "indoor-community-and-cultural-flex",
        "planned-program-day-rather-than-drop-in-stop",
    }
