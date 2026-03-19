from sources.spelman_college import _build_destination_envelope


def test_build_destination_envelope_for_spelman_museum() -> None:
    envelope = _build_destination_envelope(852)

    assert envelope.destination_details[0]["destination_type"] == "art_museum"
    assert envelope.destination_details[0]["commitment_tier"] == "hour"
    assert envelope.destination_details[0]["family_suitability"] == "caution"
    assert {feature["slug"] for feature in envelope.venue_features} == {
        "hbcu-art-museum-and-rotating-exhibitions",
        "west-end-cultural-pairing-stop",
    }
