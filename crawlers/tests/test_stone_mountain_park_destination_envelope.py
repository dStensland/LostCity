from sources.stone_mountain_park import _build_destination_envelope


def test_build_destination_envelope_projects_family_regional_park_details() -> None:
    envelope = _build_destination_envelope(1604)

    assert envelope.destination_details[0]["venue_id"] == 1604
    assert envelope.destination_details[0]["destination_type"] == "regional_park"
    assert envelope.destination_details[0]["family_suitability"] == "yes"
    assert envelope.destination_details[0]["parking_type"] == "paid_lot"
    assert "full-day" in envelope.destination_details[0]["practical_notes"].lower()
    feature_slugs = {feature["slug"] for feature in envelope.venue_features}
    assert "summit-skyride-and-mountain-attractions" in feature_slugs
    assert "seasonal-family-festivals-and-holiday-programming" in feature_slugs
    assert "geyser-splash-pad-and-water-play" in feature_slugs
    assert "choose-your-range-with-rest-breaks" in feature_slugs
    assert "dinotorium-and-dinosaur-explore" in feature_slugs
    assert "scenic-railroad-and-lower-walk-family-loop" in feature_slugs
