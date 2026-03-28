from sources.cdc_museum import _build_destination_envelope


def test_build_destination_envelope_for_cdc_museum() -> None:
    envelope = _build_destination_envelope(2002)

    assert envelope.destination_details[0]["place_id"] == 2002
    assert envelope.destination_details[0]["destination_type"] == "science_museum"
    assert envelope.destination_details[0]["family_suitability"] == "caution"
    assert envelope.destination_details[0]["commitment_tier"] == "hour"
    assert {feature["slug"] for feature in envelope.venue_features} == {
        "free-public-health-exhibitions",
    }
    assert {special["slug"] for special in envelope.venue_specials} == {
        "always-free-museum-admission",
    }
