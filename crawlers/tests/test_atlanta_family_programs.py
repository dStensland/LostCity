from sources.atlanta_family_programs import _build_program_record, _consolidate_daily_sessions


def test_build_program_record_projects_event_into_program_lane() -> None:
    record = _build_program_record(
        event_record={
            "place_id": 7,
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
    assert record["place_id"] == 7
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


def _make_session_item(name: str, start: str, end: str, location: str = "Gresham Park Recreation Center") -> dict:
    return {
        "id": hash(name + start),
        "name": name,
        "desc": "",
        "date_range_start": start,
        "date_range_end": end,
        "location": {"label": location},
        "ages": "",
        "age_min_year": 0,
        "age_max_year": 0,
        "detail_url": "https://example.com/activity",
        "date_range_description": "",
    }


def test_consolidate_daily_sessions_merges_per_day_camp_sessions() -> None:
    """Five daily camp sessions should merge into one record spanning the full week."""
    items = [
        _make_session_item("Gresham 2026 Spring Break Camp Apr. 6th", "2026-04-06", "2026-04-06"),
        _make_session_item("Gresham 2026 Spring Break Camp Apr. 7th", "2026-04-07", "2026-04-07"),
        _make_session_item("Gresham 2026 Spring Break Camp Apr. 8th", "2026-04-08", "2026-04-08"),
        _make_session_item("Gresham 2026 Spring Break Camp Apr. 9th", "2026-04-09", "2026-04-09"),
        _make_session_item("Gresham 2026 Spring Break Camp Apr. 10th", "2026-04-10", "2026-04-10"),
    ]
    result = _consolidate_daily_sessions(items)

    assert len(result) == 1
    merged = result[0]
    assert merged["name"] == "Gresham 2026 Spring Break Camp"
    assert merged["date_range_start"] == "2026-04-06"
    assert merged["date_range_end"] == "2026-04-10"
    assert merged["_merged_session_count"] == 5


def test_consolidate_daily_sessions_merges_same_activity_id_even_when_dates_differ() -> None:
    items = [
        {
            **_make_session_item("2025/2026 Developmental Swim Team-CTM", "2026-03-23", "2026-03-23"),
            "id": 11874,
        },
        {
            **_make_session_item("2025/2026 Developmental Swim Team-CTM", "2026-03-24", "2026-03-24"),
            "id": 11874,
        },
        {
            **_make_session_item("2025/2026 Developmental Swim Team-CTM", "2026-03-27", "2026-03-27"),
            "id": 11874,
        },
    ]

    result = _consolidate_daily_sessions(items)

    assert len(result) == 1
    merged = result[0]
    assert merged["name"] == "2025/2026 Developmental Swim Team-CTM"
    assert merged["date_range_start"] == "2026-03-23"
    assert merged["date_range_end"] == "2026-03-27"
    assert merged["_merged_session_count"] == 3


def test_consolidate_daily_sessions_does_not_merge_different_programs() -> None:
    """Different program names at the same venue must stay as separate records."""
    items = [
        _make_session_item("Youth Basketball Clinic Apr. 6th", "2026-04-06", "2026-04-06"),
        _make_session_item("Swim Lessons Apr. 6th", "2026-04-06", "2026-04-06"),
    ]
    result = _consolidate_daily_sessions(items)
    assert len(result) == 2


def test_consolidate_daily_sessions_does_not_merge_same_name_different_venue() -> None:
    """Same program name at different venues must remain separate."""
    items = [
        _make_session_item("Spring Break Camp Apr. 6th", "2026-04-06", "2026-04-06", "Gresham Park Recreation Center"),
        _make_session_item("Spring Break Camp Apr. 6th", "2026-04-06", "2026-04-06", "Brownwood Recreation Center"),
    ]
    result = _consolidate_daily_sessions(items)
    assert len(result) == 2


def test_consolidate_daily_sessions_passes_through_single_item_unchanged() -> None:
    """A single item with no siblings must be returned as-is."""
    items = [_make_session_item("Beginner Swim Lessons", "2026-06-01", "2026-06-28")]
    result = _consolidate_daily_sessions(items)
    assert len(result) == 1
    assert result[0]["name"] == "Beginner Swim Lessons"
    assert "_merged_session_count" not in result[0]
