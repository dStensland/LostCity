from sources.legoland_atlanta import _build_destination_envelope


def test_build_destination_envelope_for_legoland_atlanta() -> None:
    envelope = _build_destination_envelope(1901)

    assert envelope.destination_details[0]["venue_id"] == 1901
    assert envelope.destination_details[0]["destination_type"] == "family_attraction"
    assert envelope.destination_details[0]["parking_type"] == "garage"
    assert "younger-kid" in envelope.destination_details[0]["practical_notes"].lower()
    assert {feature["slug"] for feature in envelope.venue_features} == {
        "indoor-build-play-attraction-stack",
        "buckhead-weather-proof-younger-kid-anchor",
        "low-walking-indoor-younger-kid-reset",
    }
