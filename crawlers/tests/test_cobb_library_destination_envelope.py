from sources.cobb_library import _build_branch_destination_envelope


def test_build_branch_destination_envelope_projects_library_branch_details() -> None:
    envelope = _build_branch_destination_envelope(
        venue_id=1501,
        venue_data={
            "name": "Sewell Mill Library & Cultural Center",
            "venue_type": "library",
        },
    )

    assert envelope.destination_details[0]["venue_id"] == 1501
    assert envelope.destination_details[0]["destination_type"] == "library_branch"
    assert envelope.destination_details[0]["commitment_tier"] == "hour"
    assert envelope.destination_details[0]["family_suitability"] == "yes"
    assert envelope.destination_details[0]["fee_note"] == "Free public library access."
    assert envelope.destination_details[0]["metadata"]["branch_name"] == "Sewell Mill Library & Cultural Center"
    assert envelope.destination_details[0]["metadata"]["county"] == "cobb"
    assert [feature["slug"] for feature in envelope.venue_features] == [
        "free-indoor-family-stop",
        "storytime-and-family-programs",
    ]
    assert all(feature["is_free"] for feature in envelope.venue_features)
