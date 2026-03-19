from sources.dunwoody_island_ford_camps import _build_destination_envelope


def test_build_destination_envelope_marks_island_ford_as_family_river_park() -> None:
    envelope = _build_destination_envelope(2302)

    assert envelope.destination_details[0]["destination_type"] == "park"
    assert envelope.destination_details[0]["family_suitability"] == "yes"
    assert {feature["slug"] for feature in envelope.venue_features} == {
        "river-and-pond-exploration",
        "forest-trails-and-outdoor-adventure",
    }
