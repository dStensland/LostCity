from sources.gwinnett_ehc import _build_destination_envelope


def test_build_destination_envelope_projects_family_destination_details() -> None:
    envelope = _build_destination_envelope(venue_id=5628)

    assert envelope.destination_details[0]["place_id"] == 5628
    assert envelope.destination_details[0]["destination_type"] == "nature_center"
    assert envelope.destination_details[0]["commitment_tier"] == "halfday"
    assert envelope.destination_details[0]["family_suitability"] == "yes"
    assert envelope.destination_details[0]["parking_type"] == "free_lot"
    assert envelope.destination_details[0]["metadata"]["walking_trails_miles"] == 5

    feature_slugs = {feature["slug"] for feature in envelope.venue_features}
    assert "walking-trails-and-greenways" in feature_slugs
    assert "historic-chesser-williams-house" in feature_slugs
    assert "indoor-environmental-exhibits" in feature_slugs
    assert "wooded-picnic-pavilion" in feature_slugs
    assert {special["slug"] for special in envelope.venue_specials} == {
        "children-2-and-under-free-admission",
        "gehc-members-free-admission",
    }
