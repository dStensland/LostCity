from sources.blue_heron_summer_camps import _build_destination_envelope


def test_build_destination_envelope_for_blue_heron() -> None:
    envelope = _build_destination_envelope(2801)

    assert envelope.destination_details[0]["place_id"] == 2801
    assert envelope.destination_details[0]["destination_type"] == "nature_preserve"
    assert envelope.destination_details[0]["parking_type"] == "free_lot"
    assert "slower buckhead outdoor stop" in envelope.destination_details[0]["practical_notes"].lower()
    assert {feature["slug"] for feature in envelope.venue_features} == {
        "wetlands-trails-and-creekside-nature-play",
        "nature-camps-and-kid-discovery-programming",
        "buckhead-outdoor-reset-with-real-nature-feel",
    }
