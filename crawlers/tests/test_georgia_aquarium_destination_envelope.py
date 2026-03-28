from sources.georgia_aquarium import _build_destination_envelope


def test_build_destination_envelope_for_georgia_aquarium() -> None:
    envelope = _build_destination_envelope(1801)

    assert envelope.destination_details[0]["place_id"] == 1801
    assert envelope.destination_details[0]["destination_type"] == "aquarium"
    assert envelope.destination_details[0]["parking_type"] == "garage"
    assert "timed-entry mindset" in envelope.destination_details[0]["practical_notes"].lower()
    assert {feature["slug"] for feature in envelope.venue_features} == {
        "weather-proof-marine-galleries",
        "stroller-friendly-downtown-anchor",
        "easy-bathroom-and-cool-down-resets",
    }
    assert {special["slug"] for special in envelope.venue_specials} == {
        "children-2-and-under-free",
        "community-access-discount-admission",
    }
