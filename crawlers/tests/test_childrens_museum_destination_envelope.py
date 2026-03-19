from sources.childrens_museum import _build_destination_envelope


def test_build_destination_envelope_for_childrens_museum() -> None:
    envelope = _build_destination_envelope(1804)

    assert envelope.destination_details[0]["venue_id"] == 1804
    assert envelope.destination_details[0]["destination_type"] == "childrens_museum"
    assert envelope.destination_details[0]["parking_type"] == "garage"
    assert "weather-proof anchor" in envelope.destination_details[0]["practical_notes"].lower()
    assert {feature["slug"] for feature in envelope.venue_features} == {
        "interactive-play-and-learning-floor",
        "downtown-younger-kid-weather-proof-anchor",
        "bathroom-and-attention-span-reset-friendly",
    }
    assert {special["slug"] for special in envelope.venue_specials} == {
        "children-under-1-free-admission",
        "museums-for-all-discount-admission",
    }
