from sources.mudfire_pottery_studio import _build_program_record as build_mudfire_program
from sources.vista_yoga import _build_program_record as build_vista_program


def test_mudfire_program_record_projects_class_lane() -> None:
    program = build_mudfire_program(
        "Beginner Wheel 101",
        {"category": "Classes", "duration": 120, "class_size": 8, "price": "$65.00"},
        venue_id=2590,
        source_id=811,
        description="Intro pottery class.",
        price_min=65.0,
        start_time="14:00",
        tags=["pottery", "beginner-friendly"],
    )

    assert program["program_type"] == "class"
    assert program["provider_name"] == "MudFire Pottery Studio"
    assert program["schedule_days"] == [6]
    assert program["schedule_start_time"] == "14:00"
    assert program["cost_period"] == "per_session"
    assert program["registration_status"] == "open"
    assert program["status"] == "active"


def test_mudfire_missing_active_flag_is_treated_as_live_class_type() -> None:
    cls = {"name": "Beginner Wheel 101"}

    assert cls.get("is_active", True) is True


def test_vista_program_record_aggregates_occurrences_into_single_class() -> None:
    program = build_vista_program(
        "Morning Flow",
        [
            {
                "title": "Morning Flow",
                "description": "Yoga class",
                "start_date": "2026-04-01",
                "start_time": "09:00",
                "end_time": "10:00",
                "ticket_url": "https://vistayoga.com/book",
                "tags": ["vista-yoga", "yoga"],
                "instructor": "Teacher A",
            },
            {
                "title": "Morning Flow",
                "description": "Yoga class",
                "start_date": "2026-04-08",
                "start_time": "09:00",
                "end_time": "10:00",
                "ticket_url": "https://vistayoga.com/book",
                "tags": ["vista-yoga", "yoga"],
                "instructor": "Teacher A",
            },
        ],
        source_id=173,
        venue_id=596,
    )

    assert program["program_type"] == "class"
    assert program["provider_name"] == "Vista Yoga"
    assert program["session_start"] == "2026-04-01"
    assert program["session_end"] == "2026-04-08"
    assert program["schedule_days"] == [3]
    assert program["registration_url"] == "https://vistayoga.com/book"
    assert program["status"] == "active"
