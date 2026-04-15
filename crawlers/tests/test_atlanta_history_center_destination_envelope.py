from sources.atlanta_history_center import _build_destination_envelope


def test_build_destination_envelope_for_atlanta_history_center() -> None:
    envelope = _build_destination_envelope(1903)

    assert envelope.destination_details[0]["place_id"] == 1903
    assert envelope.destination_details[0]["destination_type"] == "history_museum"
    assert envelope.destination_details[0]["parking_type"] == "free_lot"
    assert "half-day campus outing" in envelope.destination_details[0]["practical_notes"].lower()
    assert len(envelope.venue_features) == 0
