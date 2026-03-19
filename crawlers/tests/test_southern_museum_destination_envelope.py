from sources.southern_museum import _build_destination_envelope


def test_build_destination_envelope_for_southern_museum() -> None:
    envelope = _build_destination_envelope(2403)

    assert envelope.destination_details[0]["venue_id"] == 2403
    assert envelope.destination_details[0]["destination_type"] == "history_museum"
    assert envelope.destination_details[0]["parking_type"] == "free_lot"
    assert envelope.destination_details[0]["commitment_tier"] == "halfday"
    assert {feature["slug"] for feature in envelope.venue_features} == {
        "the-general-locomotive-anchor",
        "railroad-history-family-stop",
    }
