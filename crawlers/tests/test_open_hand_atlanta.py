from datetime import datetime

from sources.open_hand_atlanta import _parse_volunteer_calendar_text, build_description


def test_parse_volunteer_calendar_text_extracts_dated_shifts():
    body_text = """
    Volunteer Calendar
    Session Time
    March 2026
    Sunday Monday Tuesday Wednesday Thursday Friday Saturday
    9
    10
    8:30am - 12:00pm
    AM Meal Packing
    9:00am - 12:00pm
    Delivery Driver Volunteer
    11
    8:30am - 12:00pm
    Loading Assistance
    Next month
    """

    shifts = _parse_volunteer_calendar_text(
        body_text,
        reference_dt=datetime(2026, 3, 10, 9, 0),
    )

    assert shifts == [
        {
            "title": "AM Meal Packing",
            "start_date": "2026-03-10",
            "start_time": "08:30",
            "end_time": "12:00",
        },
        {
            "title": "Delivery Driver Volunteer",
            "start_date": "2026-03-10",
            "start_time": "09:00",
            "end_time": "12:00",
        },
        {
            "title": "Loading Assistance",
            "start_date": "2026-03-11",
            "start_time": "08:30",
            "end_time": "12:00",
        },
    ]


def test_build_description_uses_role_specific_fallbacks():
    assert (
        build_description("Delivery Driver Volunteer")
        == "Help deliver Open Hand meals directly to clients across metro Atlanta."
    )
    assert (
        build_description("AM Meal Packing")
        == "Pack medically tailored meals that Open Hand delivers to Atlanta neighbors in need."
    )


def test_build_description_falls_back_for_unknown_roles():
    description = build_description("Special Kitchen Support")

    assert "special kitchen support shift" in description.lower()
    assert "Open Hand Atlanta".lower() in description.lower()
