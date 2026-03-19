from sources.fernbank import _build_destination_envelope


def test_build_destination_envelope_for_fernbank() -> None:
    envelope = _build_destination_envelope(1803)

    assert envelope.destination_details[0]["venue_id"] == 1803
    assert envelope.destination_details[0]["destination_type"] == "natural_history_museum"
    assert envelope.destination_details[0]["parking_type"] == "free_lot"
    assert envelope.destination_details[0]["best_time_of_day"] == "morning"
    assert "half-day museum outing" in envelope.destination_details[0]["practical_notes"].lower()
    assert {feature["slug"] for feature in envelope.venue_features} == {
        "dinosaurs-and-natural-history-galleries",
        "museum-plus-outdoor-nature-flex",
        "indoor-bathroom-core-with-outdoor-bonus",
    }
    assert {special["slug"] for special in envelope.venue_specials} == {
        "children-2-and-under-free",
    }
