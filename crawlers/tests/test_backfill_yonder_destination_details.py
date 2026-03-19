from scripts.backfill_yonder_destination_details import _build_detail_record


def test_build_detail_record_for_campground() -> None:
    record = _build_detail_record(
        "campground",
        {
            "slug": "amicalola-falls-state-park-campground",
            "website": "https://gastateparks.reserveamerica.com/example",
            "planning_notes": "Book ahead for peak weekends.",
        },
    )

    assert record["destination_type"] == "campground"
    assert record["commitment_tier"] == "weekend"
    assert record["primary_activity"] == "camping"
    assert record["reservation_required"] is True
    assert record["metadata"]["seed_slug"] == "amicalola-falls-state-park-campground"


def test_build_detail_record_for_trail_combines_notes() -> None:
    record = _build_detail_record(
        "trail",
        {
            "slug": "pocket-trail",
            "website": "https://www.fs.usda.gov/example",
            "planning_notes": "Use for route-level hiking support.",
            "parking_note": "Start from the recreation-area lot.",
        },
    )

    assert record["destination_type"] == "trail"
    assert record["parking_type"] == "free_lot"
    assert "route-level hiking support" in record["practical_notes"]
    assert "recreation-area lot" in record["practical_notes"]
