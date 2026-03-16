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
        item={
            "id": 11875,
            "number": "3.112.306.41",
            "activity_online_start_time": "2026-01-16 09:00:00",
            "date_range": "June 1, 2026 to June 5, 2026",
            "date_range_description": "Practice times vary based on age and skill level.",
            "total_open": 150,
            "already_enrolled": 28,
            "urgent_message": {"status_description": ""},
            "location": {"label": "Grant Park Recreation Center"},
            "ages": "At least 5 but less than 10",
        },
        desc_text="Beginner Swim Lessons camp runs weekdays. Activity Times: Mon. & Wed 4 :00 p.m. to 5:00 pm.",
        venue_name="Grant Park Recreation Center",
        source_id=22,
        portal_id="portal-atlanta-families",
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
    assert record["schedule_days"] == [1, 2, 3, 4, 5]
    assert record["schedule_start_time"] == "16:00:00"
    assert record["schedule_end_time"] == "17:00:00"
    assert record["registration_opens"] == "2026-01-16"
    assert record["registration_status"] == "open"
    assert record["metadata"]["activity_id"] == 11875
    assert record["portal_id"] == "portal-atlanta-families"
