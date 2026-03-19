from sources.dekalb_family_programs import _build_destination_envelope


def test_build_destination_envelope_for_rec_center() -> None:
    envelope = _build_destination_envelope(
        {
            "name": "Mason Mill Recreation Center",
            "slug": "mason-mill-recreation-center",
            "venue_type": "recreation",
        },
        1401,
    )

    assert envelope is not None
    assert envelope.destination_details[0]["venue_id"] == 1401
    assert envelope.destination_details[0]["destination_type"] == "community_recreation_center"
    assert envelope.destination_details[0]["family_suitability"] == "yes"
    assert envelope.destination_details[0]["parking_type"] == "free_lot"
    assert envelope.destination_details[0]["practical_notes"]
    assert envelope.destination_details[0]["accessibility_notes"]
    assert {feature["slug"] for feature in envelope.venue_features} == {
        "indoor-family-recreation-space",
        "family-classes-and-seasonal-camps",
    }


def test_build_destination_envelope_for_park() -> None:
    envelope = _build_destination_envelope(
        {
            "name": "Young Deer Park",
            "slug": "young-deer-park",
            "venue_type": "park",
        },
        1402,
    )

    assert envelope is not None
    assert envelope.destination_details[0]["venue_id"] == 1402
    assert envelope.destination_details[0]["destination_type"] == "park"
    assert envelope.destination_details[0]["parking_type"] == "free_lot"
    assert envelope.destination_details[0]["practical_notes"]
    assert envelope.destination_details[0]["accessibility_notes"]
    assert envelope.venue_features[0]["slug"] == "free-outdoor-play-space"


def test_build_destination_envelope_skips_generic_org() -> None:
    assert (
        _build_destination_envelope(
            {
                "name": "DeKalb County Recreation, Parks & Cultural Affairs",
                "slug": "dekalb-county-recreation",
                "venue_type": "organization",
            },
            1403,
        )
        is None
    )
