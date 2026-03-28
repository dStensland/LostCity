from sources.puppetry_arts import _build_destination_envelope


def test_build_destination_envelope_for_center_for_puppetry_arts() -> None:
    envelope = _build_destination_envelope(1702)

    assert envelope.destination_details[0]["place_id"] == 1702
    assert envelope.destination_details[0]["destination_type"] == "puppetry_museum"
    assert envelope.destination_details[0]["parking_type"] == "paid_lot"
    assert "half-day indoor family outing" in envelope.destination_details[0]["practical_notes"].lower()
    assert {feature["slug"] for feature in envelope.venue_features} == {
        "jim-henson-collection-and-museum-galleries",
        "family-puppet-performances-and-workshops",
        "indoor-half-day-family-stack",
    }

