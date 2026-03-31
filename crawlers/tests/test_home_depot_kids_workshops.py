from sources.home_depot_kids_workshops import (
    ATLANTA_HOME_DEPOT_LOCATIONS,
    build_workshop_program_record,
)


def test_build_workshop_program_record_projects_monthly_class_lane() -> None:
    program = build_workshop_program_record(
        ATLANTA_HOME_DEPOT_LOCATIONS[0],
        venue_id=1278,
        source_id=414,
    )

    assert program["program_type"] == "class"
    assert program["provider_name"] == "Home Depot - Ponce de Leon"
    assert program["age_min"] == 5
    assert program["age_max"] == 12
    assert program["schedule_days"] == [6]
    assert program["schedule_start_time"] == "09:00"
    assert program["schedule_end_time"] == "12:00"
    assert program["registration_status"] == "open"
    assert program["registration_url"] == "https://www.homedepot.com/workshops/"
    assert program["status"] == "active"
