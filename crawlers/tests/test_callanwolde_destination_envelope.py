from sources.callanwolde import _build_destination_envelope


def test_build_destination_envelope_for_callanwolde() -> None:
    envelope = _build_destination_envelope(2501)

    assert envelope.destination_details[0]["place_id"] == 2501
    assert envelope.destination_details[0]["destination_type"] == "arts_center"
    assert envelope.destination_details[0]["parking_type"] == "free_lot"
    assert "slower-paced arts campus stop" in envelope.destination_details[0]["practical_notes"].lower()
    assert {feature["slug"] for feature in envelope.venue_features} == {
        "historic-arts-campus-and-grounds",
        "family-classes-camps-and-arts-events",
        "slower-pace-creative-campus-stop",
    }
