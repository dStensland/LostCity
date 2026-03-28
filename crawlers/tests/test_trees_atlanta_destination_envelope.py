from sources.trees_atlanta import _build_destination_envelope, build_location_venue


def test_build_destination_envelope_for_trees_atlanta_location() -> None:
    venue_dict = build_location_venue("Ashview Heights")
    envelope = _build_destination_envelope(6082, venue_dict)

    assert envelope.destination_details[0]["destination_type"] == "park"
    assert envelope.destination_details[0]["commitment_tier"] == "hour"
    assert envelope.destination_details[0]["parking_type"] == "street"
    assert {feature["slug"] for feature in envelope.venue_features} == {
        "free-neighborhood-green-space",
        "community-tree-canopy-and-outdoor-learning",
    }


def test_build_location_venue_uses_canonical_kirkwood_slug() -> None:
    venue_dict = build_location_venue("Kirkwood")
    envelope = _build_destination_envelope(2297, venue_dict)

    assert venue_dict["slug"] == "kirkwood"
    assert venue_dict["place_type"] == "park"
    assert envelope.destination_details[0]["primary_activity"] == (
        "neighborhood park and community green-space reset"
    )
    assert envelope.destination_details[0]["metadata"]["source_slug"] == "trees-atlanta"
