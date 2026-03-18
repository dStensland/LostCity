from sources.apex_museum import _build_destination_envelope


def test_build_destination_envelope_for_apex_museum() -> None:
    envelope = _build_destination_envelope(2401)

    assert envelope.destination_details[0]["venue_id"] == 2401
    assert envelope.destination_details[0]["destination_type"] == "history_museum"
    assert envelope.destination_details[0]["parking_type"] == "street"
    assert "sweet auburn" in envelope.destination_details[0]["practical_notes"].lower()
    assert {feature["slug"] for feature in envelope.venue_features} == {
        "sweet-auburn-black-history-anchor",
        "compact-history-museum-stop",
        "stackable-sweet-auburn-cultural-stop",
    }
