from sources.civil_rights_center import _build_destination_envelope


def test_build_destination_envelope_for_civil_rights_center() -> None:
    envelope = _build_destination_envelope(2503)

    assert envelope.destination_details[0]["place_id"] == 2503
    assert envelope.destination_details[0]["destination_type"] == "history_museum"
    assert envelope.destination_details[0]["parking_type"] == "garage"
    assert envelope.destination_details[0]["family_suitability"] == "caution"
    assert {feature["slug"] for feature in envelope.venue_features} == {
        "civil-rights-history-and-dialogue-stop",
        "school-age-history-anchor",
        "purposeful-downtown-museum-stop",
    }
