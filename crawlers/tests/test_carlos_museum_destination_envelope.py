from sources.carlos_museum import _build_destination_envelope


def test_build_destination_envelope_for_carlos_museum() -> None:
    envelope = _build_destination_envelope(2402)

    assert envelope.destination_details[0]["venue_id"] == 2402
    assert envelope.destination_details[0]["destination_type"] == "art_museum"
    assert envelope.destination_details[0]["parking_type"] == "paid_lot"
    assert envelope.destination_details[0]["family_suitability"] == "yes"
    assert {feature["slug"] for feature in envelope.venue_features} == {
        "free-emory-art-and-antiquities-anchor",
        "compact-campus-museum-stop",
    }
    assert {special["slug"] for special in envelope.venue_specials} == {
        "sunday-funday-free-admission",
    }
