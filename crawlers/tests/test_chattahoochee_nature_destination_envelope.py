from sources.chattahoochee_nature import _build_destination_envelope


def test_build_destination_envelope_for_chattahoochee_nature_center() -> None:
    envelope = _build_destination_envelope(1703)

    assert envelope.destination_details[0]["venue_id"] == 1703
    assert envelope.destination_details[0]["destination_type"] == "nature_center"
    assert envelope.destination_details[0]["parking_type"] == "free_lot"
    assert "indoor fallback" in envelope.destination_details[0]["practical_notes"].lower()
    assert {feature["slug"] for feature in envelope.venue_features} == {
        "river-trails-and-canoe-trips",
        "wildlife-exhibits-and-discovery-center",
        "short-trail-range-with-indoor-backup",
        "easy-trails-plus-indoor-fallback",
    }
