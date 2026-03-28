from sources.clark_atlanta_art_museum import build_exhibition_lane_record


def test_build_exhibition_lane_record_projects_clark_exhibition() -> None:
    record = build_exhibition_lane_record(
        {
            "title": "Legacy in Color:",
            "date_text": "February 12 - May 1, 2026",
            "description": "A survey of modern Black printmaking.",
            "image_url": "https://example.com/legacy.jpg",
        },
        source_id=18,
        venue_id=404,
        portal_id="portal-arts",
    )

    assert record["title"] == "Legacy in Color"
    assert record["source_id"] == 18
    assert record["place_id"] == 404
    assert record["portal_id"] == "portal-arts"
    assert record["opening_date"] == "2026-02-12"
    assert record["closing_date"] == "2026-05-01"
    assert record["admission_type"] == "donation"
