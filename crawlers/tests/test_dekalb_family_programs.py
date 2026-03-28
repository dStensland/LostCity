from sources.dekalb_family_programs import _build_program_record


def test_build_program_record_projects_event_into_program_lane() -> None:
    record = _build_program_record(
        event_record={
            "place_id": 42,
            "title": "Spring Break Art Camp",
            "description": "A weeklong mixed-media camp for kids.",
            "start_date": "2026-04-06",
            "end_date": "2026-04-10",
            "price_min": 125,
            "price_note": "per week",
            "source_url": "https://example.com/programs/1",
            "tags": ["arts", "camp", "family-friendly"],
        },
        item={
            "id": 18779,
            "number": "18875",
            "activity_online_start_time": "",
            "date_range": "June 8, 2026 to June 12, 2026",
            "date_range_description": "",
            "total_open": 20,
            "already_enrolled": 6,
            "urgent_message": {"status_description": ""},
            "location": {"label": "Mason Mill Recreation Center"},
            "ages": "At least 6 but less than 10",
        },
        desc_text=(
            "Open registration for camp begins February 3rd. "
            "Camp runs weekdays. Activity Times: Mon. & Wed 4 :00 p.m. to 5:00 pm."
        ),
        venue_name="Mason Mill Recreation Center",
        source_id=55,
        portal_id="portal-123",
        age_min=6,
        age_max=10,
    )

    assert record is not None
    assert record["source_id"] == 55
    assert record["place_id"] == 42
    assert record["name"] == "Spring Break Art Camp"
    assert record["program_type"] == "camp"
    assert record["season"] == "spring"
    assert record["cost_amount"] == 125
    assert record["cost_period"] == "per_week"
    assert record["schedule_days"] == [1, 2, 3, 4, 5]
    assert record["schedule_start_time"] == "16:00:00"
    assert record["schedule_end_time"] == "17:00:00"
    assert record["registration_opens"] == "2026-02-03"
    assert record["registration_status"] == "open"
    assert record["metadata"]["activity_id"] == 18779
    assert record["portal_id"] == "portal-123"
    assert record["_venue_name"] == "Mason Mill Recreation Center"
