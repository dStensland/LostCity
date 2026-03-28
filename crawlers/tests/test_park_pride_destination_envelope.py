from sources.park_pride import _build_destination_envelope


def test_build_destination_envelope_for_park_pride_park() -> None:
    place_data = {
        "name": "Freedom Park",
        "slug": "freedom-park",
        "city": "Atlanta",
        "venue_type": "park",
    }

    envelope = _build_destination_envelope(place_data, 2401)

    assert envelope is not None
    assert envelope.destination_details[0]["venue_id"] == 2401
    assert envelope.destination_details[0]["destination_type"] == "park"
    assert envelope.destination_details[0]["family_suitability"] == "yes"
    assert {feature["slug"] for feature in envelope.venue_features} == {
        "free-outdoor-play-space",
    }


def test_build_destination_envelope_skips_non_parks() -> None:
    place_data = {
        "name": "Park Pride",
        "slug": "park-pride",
        "city": "Atlanta",
        "venue_type": "nonprofit",
    }

    assert _build_destination_envelope(place_data, 2402) is None
