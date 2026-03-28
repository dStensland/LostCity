from sources.college_football_hof import _build_destination_envelope


def test_build_destination_envelope_for_college_football_hall_of_fame() -> None:
    envelope = _build_destination_envelope(214)

    assert envelope.destination_details[0]["place_id"] == 214
    assert envelope.destination_details[0]["destination_type"] == "sports_museum"
    assert envelope.destination_details[0]["parking_type"] == "garage"
    assert "school-age" in envelope.venue_features[1]["description"].lower()
    assert {feature["slug"] for feature in envelope.venue_features} == {
        "interactive-football-history-galleries",
        "downtown-sports-history-anchor",
    }
