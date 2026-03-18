from sources.cascade_springs_preserve import _build_destination_envelope


def test_build_destination_envelope_for_cascade_springs() -> None:
    envelope = _build_destination_envelope(314)

    assert envelope.destination_details[0]["destination_type"] == "nature_preserve"
    assert envelope.destination_details[0]["parking_type"] == "free_lot"
    assert "stroller" in envelope.destination_details[0]["accessibility_notes"].lower()
    assert {feature["slug"] for feature in envelope.venue_features} == {
        "waterfall-and-forest-trails",
        "free-southwest-atlanta-nature-reset",
    }
