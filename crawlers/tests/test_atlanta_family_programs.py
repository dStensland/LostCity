from sources.atlanta_family_programs import _build_program_record


def test_build_program_record_projects_event_into_program_lane() -> None:
    record = _build_program_record(
        event_record={
            "venue_id": 7,
            "title": "Beginner Swim Lessons",
            "description": "Six-week swim instruction for elementary-age kids.",
            "start_date": "2026-06-01",
            "end_date": "2026-07-10",
            "price_min": 85,
            "price_note": "per week",
            "source_url": "https://example.com/atlanta-dpr/program/1",
            "tags": ["swimming", "family-friendly"],
        },
        venue_name="Grant Park Recreation Center",
        source_id=22,
        portal_id="portal-hooky",
        age_min=5,
        age_max=9,
    )

    assert record is not None
    assert record["source_id"] == 22
    assert record["venue_id"] == 7
    assert record["name"] == "Beginner Swim Lessons"
    assert record["program_type"] == "class"
    assert record["cost_amount"] == 85
    assert record["cost_period"] == "per_week"
    assert record["portal_id"] == "portal-hooky"
