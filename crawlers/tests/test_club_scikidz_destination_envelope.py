from sources.club_scikidz_atlanta import _build_destination_envelope


def test_build_destination_envelope_for_club_scikidz_site() -> None:
    place_data = {
        "name": "St. James UMC- Atlanta",
        "slug": "club-scikidz-st-james-umc-atlanta",
        "city": "Atlanta",
        "website": "https://atlanta.clubscikidz.com/camp-locations/#st-james",
    }

    envelope = _build_destination_envelope(2601, place_data)

    assert envelope.destination_details[0]["venue_id"] == 2601
    assert envelope.destination_details[0]["destination_type"] == "community_center"
    assert envelope.destination_details[0]["parking_type"] == "free_lot"
    assert envelope.destination_details[0]["reservation_required"] is True
    assert "registered stem camp site" in envelope.venue_features[0]["title"].lower()
    assert {feature["slug"] for feature in envelope.venue_features} == {
        "registered-stem-camp-site",
        "planned-camp-day-not-casual-stop",
    }
