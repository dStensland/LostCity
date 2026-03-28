from sources.southern_belle_farm import _build_destination_envelope


def test_build_destination_envelope_for_southern_belle_farm() -> None:
    envelope = _build_destination_envelope(2802)

    assert envelope.destination_details[0]["place_id"] == 2802
    assert envelope.destination_details[0]["destination_type"] == "farm"
    assert envelope.destination_details[0]["parking_type"] == "free_lot"
    assert "planned seasonal outing" in envelope.destination_details[0]["practical_notes"].lower()
    assert {feature["slug"] for feature in envelope.venue_features} == {
        "u-pick-fruit-and-flower-seasons",
        "fall-festival-corn-maze-and-pumpkin-patch",
        "seasonal-farm-fun-and-holiday-return-trips",
    }
