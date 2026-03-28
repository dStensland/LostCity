from sources.grant_park_conservancy import _build_destination_envelope


def test_build_destination_envelope_for_grant_park() -> None:
    envelope = _build_destination_envelope(2101)

    assert envelope.destination_details[0]["place_id"] == 2101
    assert envelope.destination_details[0]["destination_type"] == "park"
    assert envelope.destination_details[0]["family_suitability"] == "yes"
    assert "stroller" in envelope.destination_details[0]["practical_notes"].lower()
    assert {feature["slug"] for feature in envelope.venue_features} == {
        "playgrounds-and-open-green-space",
        "walking-trails-and-family-park-loops",
        "picnic-lawns-and-family-spread-out-space",
        "flexible-free-park-reset-stop",
    }
