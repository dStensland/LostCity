from sources.centennial_olympic_park import _build_destination_envelope


def test_build_destination_envelope_for_centennial_olympic_park() -> None:
    envelope = _build_destination_envelope(2301)

    assert envelope.destination_details[0]["place_id"] == 2301
    assert envelope.destination_details[0]["destination_type"] == "park"
    assert envelope.destination_details[0]["family_suitability"] == "yes"
    assert envelope.destination_details[0]["parking_type"] == "garage"
    assert "downtown family stop" in envelope.destination_details[0]["practical_notes"].lower()
    assert {feature["slug"] for feature in envelope.venue_features} == {
        "fountain-rings-and-water-play",
        "free-downtown-open-lawn-and-gather-space",
        "flat-paved-downtown-stroller-loop",
        "free-water-play-downtown-reset",
    }
