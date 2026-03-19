from sources.candler_park_fest import _build_destination_envelope


def test_build_destination_envelope_for_candler_park() -> None:
    envelope = _build_destination_envelope(2901)

    assert envelope.destination_details[0]["venue_id"] == 2901
    assert envelope.destination_details[0]["destination_type"] == "park"
    assert envelope.destination_details[0]["family_suitability"] == "yes"
    assert envelope.venue_features[0]["slug"] == "public-pool-and-summer-aquatics"
