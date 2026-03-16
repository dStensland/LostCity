from sources._rec1_base import (
    _build_program_record,
    _parse_age_range_text,
    _parse_registration_window,
    _parse_schedule_days,
    _should_skip_session_keywords,
    is_family_relevant_session,
)


def test_should_skip_session_keywords_matches_title_substring() -> None:
    session = {"text": "Basic Meditation: Inner Peace"}

    assert _should_skip_session_keywords(session, ["basic meditation"]) is True
    assert _should_skip_session_keywords(session, ["line dance"]) is False


def test_family_relevance_keeps_youth_sessions_and_skips_adults() -> None:
    youth_session = {
        "text": "Sensory Friendly Swim",
        "features": [{"name": "ageGender", "value": "Ages 5-12"}],
    }
    adult_session = {
        "text": "Line Dancing Basics",
        "features": [{"name": "ageGender", "value": "Adults"}],
    }
    ambiguous_session = {
        "text": "Open Studio",
        "features": [{"name": "ageGender", "value": ""}],
    }

    assert (
        is_family_relevant_session(
            section_name="Aquatics",
            group_name="Sensory Friendly Swim",
            session=youth_session,
            age_min=5,
            age_max=12,
            tags=["gwinnett", "family-friendly", "kids"],
        )
        is True
    )
    assert (
        is_family_relevant_session(
            section_name="Classes & Activities",
            group_name="Line Dancing",
            session=adult_session,
            age_min=18,
            age_max=None,
            tags=["gwinnett", "adults"],
        )
        is False
    )
    assert (
        is_family_relevant_session(
            section_name="Arts",
            group_name="Open Studio",
            session=ambiguous_session,
            age_min=None,
            age_max=None,
            tags=["cobb", "rsvp-required"],
        )
        is False
    )


def test_parse_age_range_handles_year_and_month_flooring() -> None:
    assert _parse_age_range_text("3yr 6m-10") == (3, 10)
    assert _parse_age_range_text("2 to 3.5 year old") == (2, 3)


def test_parse_schedule_days_supports_weekdays_and_named_days() -> None:
    assert _parse_schedule_days("Weekdays") == [1, 2, 3, 4, 5]
    assert _parse_schedule_days("Tue & Thu") == [2, 4]
    assert _parse_schedule_days("TU, SU") == [2, 7]
    assert _parse_schedule_days("M, W, F") == [1, 3, 5]
    assert _parse_schedule_days("F-SU") == [5, 6, 7]


def test_parse_registration_window_supports_numeric_rec1_ranges() -> None:
    opens, closes = _parse_registration_window(
        {"regStart": None},
        ["Registration: 1/16 9a-3/18 10a"],
        2026,
    )

    assert opens == "2026-01-16"
    assert closes == "2026-03-18"


def test_build_program_record_captures_rec1_schedule_and_registration_fields(monkeypatch) -> None:
    monkeypatch.setattr(
        "db.sources.get_source_info",
        lambda _source_id: {"owner_portal_id": "atlanta-families-portal"},
    )

    program = _build_program_record(
        event_record={
            "source_id": 123,
            "venue_id": 5624,
            "title": "Spring Break Musical: Junie B. Jones Jr.",
            "description": "Camp description",
            "start_date": "2026-04-06",
            "end_date": "2026-04-18",
            "start_time": "09:00",
            "end_time": "20:30",
            "price_min": 275.0,
            "price_note": "$275 resident fee",
            "source_url": "https://secure.rec1.com/GA/cobb-county-ga/catalog",
            "tags": ["cobb", "kids"],
            "age_min": 9,
            "age_max": 12,
        },
        session={
            "id": 4127902,
            "registrationType": "8",
            "registrationOpen": True,
            "registrationOver": False,
            "sessionFull": False,
            "regStart": "01/28/2026",
            "basicInfo": [
                "Registration: Jan 28 9a-Apr 6 Noon",
                "Dates: Apr 6-Apr 18",
            ],
            "features": [
                {"name": "location", "value": "Jennie T. Anderson Theatre"},
                {"name": "ageGender", "value": "9-12"},
                {"name": "days", "value": "Weekdays"},
                {"name": "dates", "value": "04/06-04/18"},
                {"name": "times", "value": "9am-8:30pm"},
            ],
        },
        section_name="Camps - Art & Performance Camps",
        group_name="Jennie T. Anderson Theatre Spring Break Camp",
        venue_name="Jennie T. Anderson Theatre",
        reg_type="8",
        tenant=type("Tenant", (), {"county_name": "Cobb County", "county_tag": "cobb"})(),
    )

    assert program is not None
    assert program["portal_id"] == "atlanta-families-portal"
    assert program["schedule_days"] == [1, 2, 3, 4, 5]
    assert program["registration_opens"] == "2026-01-28"
    assert program["registration_closes"] == "2026-04-06"
    assert program["metadata"]["session_id"] == 4127902
    assert program["metadata"]["days"] == "Weekdays"
