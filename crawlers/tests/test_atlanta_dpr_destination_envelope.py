from sources.atlanta_dpr import _build_destination_envelope


def test_build_destination_envelope_for_aquatic_center() -> None:
    place_data = {
        "name": "MLK Jr. Recreation & Aquatic Center",
        "slug": "mlk-recreation-center",
        "place_type": "recreation",
    }

    envelope = _build_destination_envelope(place_data, 1201)

    assert envelope is not None
    assert envelope.destination_details[0]["place_id"] == 1201
    assert envelope.destination_details[0]["destination_type"] == "aquatic_center"
    assert envelope.destination_details[0]["family_suitability"] == "yes"
    assert envelope.destination_details[0]["practical_notes"]
    assert envelope.destination_details[0]["accessibility_notes"]
    assert envelope.venue_features[0]["slug"] == "public-pool-and-aquatics-programs"


def test_build_destination_envelope_for_park() -> None:
    place_data = {
        "name": "John A. White Park",
        "slug": "john-a-white-park",
        "place_type": "park",
    }

    envelope = _build_destination_envelope(place_data, 1202)

    assert envelope is not None
    assert envelope.destination_details[0]["place_id"] == 1202
    assert envelope.destination_details[0]["destination_type"] == "park"
    assert envelope.destination_details[0]["parking_type"] == "free_lot"
    assert envelope.destination_details[0]["practical_notes"]
    assert envelope.destination_details[0]["accessibility_notes"]
    assert envelope.venue_features[0]["slug"] == "free-outdoor-play-space"


def test_build_destination_envelope_for_rec_center_adds_program_feature() -> None:
    place_data = {
        "name": "Pittman Park Recreation Center",
        "slug": "pittman-park-recreation-center",
        "place_type": "recreation",
    }

    envelope = _build_destination_envelope(place_data, 1204)

    assert envelope is not None
    assert envelope.destination_details[0]["destination_type"] == "community_recreation_center"
    assert envelope.destination_details[0]["practical_notes"]
    assert envelope.destination_details[0]["accessibility_notes"]
    assert {feature["slug"] for feature in envelope.venue_features} == {
        "indoor-family-recreation-space",
        "family-classes-and-seasonal-camps",
    }


def test_build_destination_envelope_skips_generic_org() -> None:
    place_data = {
        "name": "Atlanta Department of Parks & Recreation",
        "slug": "atlanta-dept-parks-recreation",
        "place_type": "organization",
    }

    assert _build_destination_envelope(place_data, 1203) is None
