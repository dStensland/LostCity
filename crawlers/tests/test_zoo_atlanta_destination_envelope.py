from sources.zoo_atlanta import _build_destination_envelope


def test_build_destination_envelope_for_zoo_atlanta() -> None:
    envelope = _build_destination_envelope(1802)

    assert envelope.destination_details[0]["place_id"] == 1802
    assert envelope.destination_details[0]["destination_type"] == "zoo"
    assert envelope.destination_details[0]["parking_type"] == "paid_lot"
    assert envelope.destination_details[0]["best_time_of_day"] == "morning"
    assert "walking-heavy" in envelope.destination_details[0]["practical_notes"].lower()
    assert {feature["slug"] for feature in envelope.venue_features} == {
        "animal-habitats-and-family-walking-circuits",
        "grant-park-family-anchor",
        "shade-and-rest-break-pacing",
    }
