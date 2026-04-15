from sources.mudfire_pottery_studio import _build_program_record as build_mudfire_program
from sources.junior_achievement_georgia import (
    _build_program_record as build_ja_program,
)
from sources.vista_yoga import _build_program_record as build_vista_program
from sources.all_fired_up import _build_program_record as build_all_fired_up_program
from sources.dancing_dogs_yoga import _build_program_record as build_dancing_dogs_program
from sources.atlanta_clay_works import _build_program_record as build_clay_works_program


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


def test_junior_achievement_program_record_projects_homeschool_day() -> None:
    program = build_ja_program(
        source_id=201,
        venue_id=901,
        event_date="2026-04-27",
        program_type="biztown",
        location_name="Atlanta",
        register_url="https://www.georgia.ja.org/homeschool",
    )

    assert program["program_type"] == "enrichment"
    assert program["provider_name"] == "Junior Achievement of Georgia — Atlanta"
    assert program["session_start"] == "2026-04-27"
    assert program["schedule_start_time"] == "10:00"
    assert program["schedule_end_time"] == "14:00"
    assert program["registration_url"] == "https://www.georgia.ja.org/homeschool"


def test_all_fired_up_program_record_projects_workshop_lane() -> None:
    program = build_all_fired_up_program(
        source_id=301,
        venue_id=401,
        venue_name="All Fired Up Art - Emory Village",
        clean_title="Resin Ocean Dish Workshop",
        description="Hands-on resin workshop.",
        start_date="2026-05-12",
        start_time="18:00",
        duration_minutes=120,
        price_min=48.0,
        source_url="https://allfiredupart.com/products/resin-ocean-dish",
        tags=["family-friendly", "hands-on", "class", "arts"],
        product_id=555,
        external_id="777",
    )

    assert program["provider_name"] == "All Fired Up Art - Emory Village"
    assert program["session_start"] == "2026-05-12"
    assert program["schedule_end_time"] == "20:00"
    assert program["cost_period"] == "per_session"
    assert program["registration_status"] == "open"


def test_dancing_dogs_program_record_projects_workshop_lane() -> None:
    program = build_dancing_dogs_program(
        source_id=55,
        venue_id=77,
        parsed={
            "title": "Restorative Sound Bath",
            "description": "Evening yoga workshop.",
            "start_date": "2026-06-15",
            "start_time": "18:30",
            "end_time": "20:00",
            "source_url": "https://dancingdogsyoga.com/events/restorative-sound-bath",
            "ticket_url": "https://dancingdogsyoga.com/events/restorative-sound-bath",
            "price_min": 35.0,
        },
    )

    assert program["program_type"] == "class"
    assert program["provider_name"] == "Dancing Dogs Yoga"
    assert program["session_start"] == "2026-06-15"
    assert program["schedule_end_time"] == "20:00"
    assert program["cost_period"] == "per_session"


def test_clay_works_program_record_projects_class_lane() -> None:
    row = {
        "title": "Beginner Wheel Throwing",
        "description": "Hands-on pottery class.",
        "start_date": "2026-07-08",
        "ticket_url": "https://www.atlclayworks.org/classes/beginner-wheel-throwing",
        "source_url": "https://www.atlclayworks.org/classes/beginner-wheel-throwing",
        "tags": ["pottery", "beginner-friendly"],
    }
    program = build_clay_works_program(
        source_id=88,
        venue_id=99,
        row=row,
    )

    assert program["program_type"] == "class"
    assert program["provider_name"] == "Atlanta Clay Works"
    assert program["session_start"] == "2026-07-08"
    assert program["registration_url"] == "https://www.atlclayworks.org/classes/beginner-wheel-throwing"
