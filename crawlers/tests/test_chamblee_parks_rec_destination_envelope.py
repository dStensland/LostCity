from sources.chamblee_parks_rec import _build_destination_envelope


def test_build_destination_envelope_marks_chamblee_as_family_rec_center() -> None:
    envelope = _build_destination_envelope(2301)

    assert envelope.destination_details[0]["destination_type"] == "community_recreation_center"
    assert {feature["slug"] for feature in envelope.venue_features} == {
        "indoor-family-recreation-space",
        "family-classes-and-seasonal-camps",
    }
