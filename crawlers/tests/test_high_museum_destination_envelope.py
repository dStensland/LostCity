from sources.high_museum import _build_destination_envelope


def test_build_destination_envelope_for_high_museum() -> None:
    envelope = _build_destination_envelope(1701)

    assert envelope.destination_details[0]["place_id"] == 1701
    assert envelope.destination_details[0]["destination_type"] == "art_museum"
    assert envelope.destination_details[0]["parking_type"] == "garage"
    assert "free second sunday" in envelope.destination_details[0]["fee_note"].lower()
    feature_slugs = {feature["slug"] for feature in envelope.venue_features}
    assert "family-art-making-and-kids-programs" in feature_slugs
    assert "weather-proof-midtown-family-culture-stop" in feature_slugs
    assert "easy-museum-breaks-and-resets" in feature_slugs
    assert {special["slug"] for special in envelope.venue_specials} == {
        "children-5-and-under-free",
        "free-second-sunday-admission",
    }
