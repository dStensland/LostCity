from sources.museum_of_illusions import _build_destination_envelope


def test_build_destination_envelope_for_museum_of_illusions() -> None:
    envelope = _build_destination_envelope(1902)

    assert envelope.destination_details[0]["place_id"] == 1902
    assert envelope.destination_details[0]["destination_type"] == "interactive_museum"
    assert envelope.destination_details[0]["commitment_tier"] == "hour"
    assert "shorter downtown family stop" in envelope.destination_details[0]["practical_notes"].lower()
    assert {feature["slug"] for feature in envelope.venue_features} == {
        "interactive-photo-illusion-galleries",
        "short-downtown-family-reset-stop",
        "predictable-short-stop-indoor-novelty",
    }
