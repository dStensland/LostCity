from sources.atlanta_botanical import _VENUE_MIDTOWN, _build_destination_envelope


def test_build_destination_envelope_projects_family_garden_details() -> None:
    envelope = _build_destination_envelope(1602, _VENUE_MIDTOWN)

    assert envelope.destination_details[0]["venue_id"] == 1602
    assert envelope.destination_details[0]["destination_type"] == "botanical_garden"
    assert envelope.destination_details[0]["family_suitability"] == "yes"
    assert envelope.destination_details[0]["parking_type"] == "paid_lot"
    assert "timed-entry" in envelope.destination_details[0]["practical_notes"].lower()
    assert {feature["slug"] for feature in envelope.venue_features} == {
        "childrens-garden-and-kids-programming",
        "paved-garden-paths-and-stroller-friendly-circulation",
        "indoor-conservatories-and-weather-flex-space",
        "shade-and-conservatory-reset-flex",
    }
