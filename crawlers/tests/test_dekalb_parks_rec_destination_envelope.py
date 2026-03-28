from sources.dekalb_parks_rec import _build_destination_envelope


def test_build_destination_envelope_for_rec_center() -> None:
    envelope = _build_destination_envelope(
        {
            "name": "N.H. Scott Recreation Center",
            "slug": "nh-scott-recreation-center",
            "place_type": "recreation",
        },
        1601,
    )

    assert envelope is not None
    assert envelope.destination_details[0]["place_id"] == 1601
    assert envelope.destination_details[0]["destination_type"] == "community_recreation_center"
    assert envelope.destination_details[0]["family_suitability"] == "yes"
    assert {feature["slug"] for feature in envelope.venue_features} == {
        "indoor-family-recreation-space",
        "family-classes-and-seasonal-camps",
    }


def test_build_destination_envelope_for_park() -> None:
    envelope = _build_destination_envelope(
        {
            "name": "Young Deer Park",
            "slug": "young-deer-park",
            "place_type": "park",
        },
        1602,
    )

    assert envelope is not None
    assert envelope.destination_details[0]["place_id"] == 1602
    assert envelope.destination_details[0]["destination_type"] == "park"
    assert envelope.destination_details[0]["parking_type"] == "free_lot"
    assert envelope.venue_features[0]["slug"] == "free-outdoor-play-space"


def test_build_destination_envelope_skips_generic_org() -> None:
    assert (
        _build_destination_envelope(
            {
                "name": "DeKalb County Recreation, Parks & Cultural Affairs",
                "slug": "dekalb-county-recreation",
                "place_type": "organization",
            },
            1603,
        )
        is None
    )
