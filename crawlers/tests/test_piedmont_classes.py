from sources.piedmont_classes import (
    _build_description,
    _build_detail_url,
    _build_program_record,
    _parse_occurrence_datetime,
    _parse_schedule_days,
)


def test_parse_occurrence_datetime_returns_date_and_time() -> None:
    assert _parse_occurrence_datetime("2026-04-13T17:15:00") == (
        "2026-04-13",
        "17:15:00",
    )


def test_build_detail_url_uses_item_level_route() -> None:
    assert _build_detail_url(84901, "84901-2-32") == (
        "https://classes.inquicker.com/details/?ClientID=12422"
        "&ClassID=84901&OccurrenceID=84901-2-32&lang=en-US"
    )


def test_build_description_stitches_notes_without_duplicates() -> None:
    assert _build_description(
        {
            "ClassDescription": "Learn newborn basics.",
            "ParkingNotes": "Park in deck A.",
            "SupplyNotes": "Bring a notebook.",
            "EnrolleeNotes": "Bring a notebook.",
        }
    ) == "Learn newborn basics. Park in deck A. Bring a notebook."


def test_parse_schedule_days_handles_text_list() -> None:
    assert _parse_schedule_days("Monday, Wednesday", None) == [1, 3]


def test_build_program_record_projects_class_occurrence_into_program_lane() -> None:
    event_record = {
        "source_id": 255,
        "place_id": 476,
        "title": "Baby Basics + Infant CPR - Atlanta",
        "description": "Hands-on newborn care and infant CPR instruction.",
        "start_date": "2026-04-13",
        "start_time": "17:15:00",
        "end_date": "2026-04-13",
        "end_time": "20:30:00",
        "price_min": 60.0,
        "price_note": "Pay by credit or debit card",
        "source_url": "https://classes.inquicker.com/details/?ClientID=12422&ClassID=100062&OccurrenceID=100062-3-16&lang=en-US",
        "ticket_url": "https://classes.inquicker.com/details/?ClientID=12422&ClassID=100062&OccurrenceID=100062-3-16&lang=en-US",
        "tags": ["piedmont", "healthcare", "class", "maternity"],
    }

    program = _build_program_record(
        occurrence={
            "ClassID": 100062,
            "OccurrenceID": "100062-3-16",
            "BusinessName": "Piedmont Atlanta Hospital",
            "AgeDescription": "At least 18 but less than 100",
            "RoomName": "Classrooms 2&3",
            "DaysHeld": "Monday",
            "PaymentMethodNames": "Pay by credit or debit card",
            "IsWaitList": False,
            "VirturalClassFlag": False,
            "StartRegistrationDateTime": "2026-01-10T09:00:00",
            "EndRegistrationDateTime": "2026-04-12T23:59:00",
            "IsEnrollAllowed": True,
            "TotalSeats": 20,
            "FilledSeats": 8,
        },
        event_record=event_record,
        category_name="Maternity Services",
        venue_name="Piedmont Atlanta Hospital",
        portal_id="portal-piedmont",
    )

    assert program["source_id"] == 255
    assert program["place_id"] == 476
    assert program["name"] == "Baby Basics + Infant CPR - Atlanta"
    assert program["program_type"] == "rec_program"
    assert program["provider_name"] == "Piedmont Healthcare"
    assert program["age_min"] == 18
    assert program["age_max"] == 99
    assert program["season"] == "spring"
    assert program["schedule_days"] == [1]
    assert program["schedule_start_time"] == "17:15:00"
    assert program["schedule_end_time"] == "20:30:00"
    assert program["cost_amount"] == 60.0
    assert program["cost_period"] == "per_session"
    assert program["registration_status"] == "open"
    assert program["registration_opens"] == "2026-01-10"
    assert program["registration_closes"] == "2026-04-12"
    assert program["metadata"]["occurrence_id"] == "100062-3-16"
    assert program["_venue_name"] == "Piedmont Atlanta Hospital"
