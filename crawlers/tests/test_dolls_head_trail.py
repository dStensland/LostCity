from sources.dolls_head_trail import _build_destination_envelope


def test_build_destination_envelope_projects_destination_details_and_feature() -> None:
    envelope = _build_destination_envelope(
        venue_id=31,
        place_data={
            "vibes": ["quirky", "folk-art", "outdoor"],
        },
    )

    assert envelope.destination_details[0]["venue_id"] == 31
    assert envelope.destination_details[0]["destination_type"] == "trail"
    assert envelope.destination_details[0]["commitment_tier"] == "hour"
    assert envelope.destination_details[0]["family_suitability"] == "caution"
    assert envelope.destination_details[0]["metadata"]["source_type"] == "destination_first_crawler"
    assert envelope.venue_features[0]["slug"] == "found-object-folk-art-installations"
    assert envelope.venue_features[0]["is_free"] is True
