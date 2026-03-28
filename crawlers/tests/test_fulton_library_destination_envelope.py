from sources.fulton_library import _build_branch_destination_envelope


def test_build_branch_destination_envelope_projects_library_branch_details() -> None:
    envelope = _build_branch_destination_envelope(
        venue_id=901,
        place_data={
            "name": "Sandy Springs Library",
            "venue_type": "library",
        },
    )

    assert envelope.destination_details[0]["venue_id"] == 901
    assert envelope.destination_details[0]["destination_type"] == "library_branch"
    assert envelope.destination_details[0]["commitment_tier"] == "hour"
    assert envelope.destination_details[0]["family_suitability"] == "yes"
    assert envelope.destination_details[0]["accessibility_notes"]
    assert envelope.destination_details[0]["fee_note"] == "Free public library access."
    assert envelope.destination_details[0]["metadata"]["branch_name"] == "Sandy Springs Library"
    assert [feature["slug"] for feature in envelope.venue_features] == [
        "free-indoor-family-stop",
        "storytime-and-family-programs",
    ]
    assert all(feature["is_free"] for feature in envelope.venue_features)
