from sources.exchange_recreation_center import _build_destination_envelope


def test_build_destination_envelope_for_exchange_recreation_center() -> None:
    envelope = _build_destination_envelope(86)

    assert envelope.destination_details[0]["destination_type"] == "community_recreation_center"
    assert envelope.destination_details[0]["parking_type"] == "free_lot"
    assert {feature["slug"] for feature in envelope.venue_features} == {
        "playground-trails-and-lake-loop",
        "large-gym-and-multipurpose-rec-center",
    }
