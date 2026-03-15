from sources.dekalb_family_programs import _build_program_record


def test_build_program_record_projects_event_into_program_lane() -> None:
    record = _build_program_record(
        event_record={
            "venue_id": 42,
            "title": "Spring Break Art Camp",
            "description": "A weeklong mixed-media camp for kids.",
            "start_date": "2026-04-06",
            "end_date": "2026-04-10",
            "price_min": 125,
            "price_note": "per week",
            "source_url": "https://example.com/programs/1",
            "tags": ["arts", "camp", "family-friendly"],
        },
        venue_name="Mason Mill Recreation Center",
        source_id=55,
        portal_id="portal-123",
        age_min=6,
        age_max=10,
    )

    assert record is not None
    assert record["source_id"] == 55
    assert record["venue_id"] == 42
    assert record["name"] == "Spring Break Art Camp"
    assert record["program_type"] == "camp"
    assert record["season"] == "spring"
    assert record["cost_amount"] == 125
    assert record["cost_period"] == "per_week"
    assert record["portal_id"] == "portal-123"
    assert record["_venue_name"] == "Mason Mill Recreation Center"
