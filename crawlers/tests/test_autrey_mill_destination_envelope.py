from sources.autrey_mill import _build_destination_envelope


def test_build_destination_envelope_projects_family_destination_details() -> None:
    envelope = _build_destination_envelope(venue_id=2210)

    assert envelope.destination_details[0]["venue_id"] == 2210
    assert envelope.destination_details[0]["destination_type"] == "nature_preserve"
    assert envelope.destination_details[0]["commitment_tier"] == "halfday"
    assert envelope.destination_details[0]["family_suitability"] == "yes"
    assert envelope.destination_details[0]["metadata"]["trail_miles"] == 1.25
    assert envelope.destination_details[0]["metadata"]["has_farm_museum"] is True

    feature_slugs = {feature["slug"] for feature in envelope.venue_features}
    assert "woodland-trails-and-ravines" in feature_slugs
    assert "visitor-center-and-farm-museum" in feature_slugs
    assert "heritage-buildings-and-farm-history" in feature_slugs
    assert "animals-and-pollinator-gardens" in feature_slugs
