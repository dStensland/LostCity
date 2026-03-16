from sources.dekalb_library import (
    _build_branch_destination_envelope,
    find_branch_venue,
)


def test_build_branch_destination_envelope_projects_library_branch_details() -> None:
    envelope = _build_branch_destination_envelope(
        venue_id=1301,
        venue_data={
            "name": "Decatur Library",
            "venue_type": "library",
        },
    )

    assert envelope.destination_details[0]["venue_id"] == 1301
    assert envelope.destination_details[0]["destination_type"] == "library_branch"
    assert envelope.destination_details[0]["commitment_tier"] == "hour"
    assert envelope.destination_details[0]["family_suitability"] == "yes"
    assert envelope.destination_details[0]["fee_note"] == "Free public library access."
    assert envelope.destination_details[0]["metadata"]["branch_name"] == "Decatur Library"


def test_find_branch_venue_matches_full_branch_name() -> None:
    venue = find_branch_venue("Toco Hill-Avis G. Williams Library")

    assert venue["slug"] == "toco-hill-avis-g-williams-library"
    assert venue["city"] == "Decatur"
