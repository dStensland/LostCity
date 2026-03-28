from sources.fernbank_science_center import _build_destination_envelope


def test_build_destination_envelope_for_fernbank_science_center() -> None:
    envelope = _build_destination_envelope(2001)

    assert envelope.destination_details[0]["place_id"] == 2001
    assert envelope.destination_details[0]["destination_type"] == "science_center"
    assert envelope.destination_details[0]["parking_type"] == "free_lot"
    assert "free family education stop" in envelope.destination_details[0]["practical_notes"].lower()
    assert {feature["slug"] for feature in envelope.venue_features} == {
        "free-planetarium-and-science-hall",
        "observatory-and-free-learning-anchor",
        "free-stem-stop-with-real-depth",
    }
    assert {special["slug"] for special in envelope.venue_specials} == {
        "always-free-general-admission",
    }
