from sources.outdoor_activity_center import _build_destination_envelope


def test_build_destination_envelope_for_outdoor_activity_center() -> None:
    envelope = _build_destination_envelope(3029)

    assert envelope.destination_details[0]["destination_type"] == "nature_center"
    assert envelope.destination_details[0]["parking_type"] == "street"
    assert {feature["slug"] for feature in envelope.venue_features} == {
        "urban-forest-trails-and-nature-play",
        "outdoor-classroom-and-environmental-learning-campus",
    }
