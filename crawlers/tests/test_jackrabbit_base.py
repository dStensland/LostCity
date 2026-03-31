from sources._jackrabbit_base import (
    JackRabbitConfig,
    _build_program_record,
    _parse_schedule_days,
    _registration_status,
)


def _config() -> JackRabbitConfig:
    return JackRabbitConfig(
        org_id="549755",
        place_data={
            "name": "Atlanta School of Gymnastics",
            "slug": "atlanta-school-of-gymnastics",
            "address": "3345 Montreal Station",
            "neighborhood": "Tucker",
            "city": "Tucker",
            "state": "GA",
            "zip": "30084",
            "lat": 33.8571,
            "lng": -84.2165,
            "place_type": "fitness_center",
            "website": "https://atlantaschoolofgymnastics.net",
        },
        default_category="fitness",
        default_tags=["gymnastics", "kids", "family-friendly", "class"],
        enrollment_url="https://app.jackrabbitclass.com/regv2.asp?id=549755",
    )


def test_parse_schedule_days_maps_named_weekdays_to_iso_values() -> None:
    assert _parse_schedule_days("Monday") == [1]
    assert _parse_schedule_days("Tue Thu") == [2, 4]


def test_registration_status_reads_openings_text() -> None:
    assert _registration_status("5") == "open"
    assert _registration_status("0") == "closed"
    assert _registration_status("Full") == "closed"
    assert _registration_status("Wait List") == "waitlist"


def test_build_program_record_projects_jackrabbit_class_to_program_lane() -> None:
    program = _build_program_record(
        {
            "name": "Gym Steps 1",
            "description": "Introductory gymnastics fundamentals.",
            "days": "Monday",
            "times": "4:30pm - 5:15pm",
            "ages": "3 yrs - 4 yrs",
            "openings": "5",
            "start_date": "04/01/2026",
            "end_date": "05/20/2026",
            "session": "Spring Session",
            "tuition": "95",
            "gender": "Coed",
        },
        source_id=1841,
        venue_id=7164,
        venue_name="Atlanta School of Gymnastics",
        config=_config(),
    )

    assert program is not None
    assert program["source_id"] == 1841
    assert program["place_id"] == 7164
    assert program["name"] == "Gym Steps 1 - Monday 4:30pm - 5:15pm"
    assert program["program_type"] == "class"
    assert program["provider_name"] == "Atlanta School of Gymnastics"
    assert program["age_min"] == 3
    assert program["age_max"] == 4
    assert program["season"] == "spring"
    assert program["session_start"] == "2026-04-01"
    assert program["session_end"] == "2026-05-20"
    assert program["schedule_days"] == [1]
    assert program["schedule_start_time"] == "16:30"
    assert program["schedule_end_time"] == "17:15"
    assert program["cost_amount"] == 95.0
    assert program["cost_period"] == "per_month"
    assert program["registration_status"] == "open"
    assert program["registration_url"] == "https://app.jackrabbitclass.com/regv2.asp?id=549755"
    assert program["_venue_name"] == "Atlanta School of Gymnastics"
