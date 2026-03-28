from sources._rec1_base import (
    TenantConfig,
    VenueInfo,
    _build_program_record,
    _infer_category_and_tags,
    _parse_age_range_text,
    _parse_registration_window,
    _parse_schedule_days,
    _resolve_venue,
    _should_skip_session_keywords,
    is_adult_program,
    is_family_relevant_session,
)
from entity_lanes import TypedEntityEnvelope


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


def test_build_program_record_clamps_stale_registration_status_to_closed(monkeypatch) -> None:
    """A program whose registration_closes is in the past must show 'closed',
    even if the Rec1 API still reports sessionFull=False."""
    monkeypatch.setattr(
        "db.sources.get_source_info",
        lambda _source_id: {"owner_portal_id": "atlanta-families-portal"},
    )

    program = _build_program_record(
        event_record={
            "source_id": 123,
            "venue_id": 5624,
            "title": "Fall Swim Lessons: Beginner",
            "description": "Beginner swim lessons",
            "start_date": "2025-10-01",
            "end_date": "2025-10-31",
            "start_time": "09:00",
            "end_time": "10:00",
            "price_min": 75.0,
            "price_note": "$75 resident fee",
            "source_url": "https://secure.rec1.com/GA/cobb-county-ga/catalog",
            "tags": ["cobb", "kids"],
            "age_min": 5,
            "age_max": 10,
        },
        session={
            "id": 9999001,
            "registrationType": "8",
            "registrationOpen": False,
            "registrationOver": False,
            "sessionFull": False,  # API still says not full — but deadline has passed
            "regStart": "09/01/2025",
            "basicInfo": [
                "Registration: Sep 1-Sep 20",
                "Dates: Oct 1-Oct 31",
            ],
            "features": [
                {"name": "location", "value": "Cobb Aquatic Center"},
                {"name": "ageGender", "value": "5-10"},
                {"name": "days", "value": "Tue & Thu"},
                {"name": "dates", "value": "10/01-10/31"},
                {"name": "times", "value": "9am-10am"},
            ],
        },
        section_name="Aquatics",
        group_name="Beginner Swim Lessons",
        venue_name="Cobb Aquatic Center",
        reg_type="8",
        tenant=type("Tenant", (), {"county_name": "Cobb County", "county_tag": "cobb"})(),
    )

    assert program is not None
    # registration_closes is Sep 20 2025 — well in the past as of 2026-03-16
    assert program["registration_closes"] == "2025-09-20"
    assert program["registration_status"] == "closed"


def test_resolve_venue_persists_enrichment_envelope(monkeypatch) -> None:
    persisted = []

    monkeypatch.setattr(
        "sources._rec1_base.get_or_create_place",
        lambda _venue_data: 77,
    )
    monkeypatch.setattr(
        "sources._rec1_base.persist_typed_entity_envelope",
        lambda envelope: persisted.append(envelope),
    )

    venue = VenueInfo(
        name="Bogan Park Community Recreation Center",
        slug="bogan-park-crc",
        address="2723 N Bogan Rd",
        neighborhood="Buford",
        city="Buford",
        state="GA",
        zip_code="30519",
        lat=34.0979,
        lng=-83.9948,
        venue_type="community_center",
    )

    def build_envelope(_venue_info: VenueInfo, venue_id: int) -> TypedEntityEnvelope:
        envelope = TypedEntityEnvelope()
        envelope.add("destination_details", {"venue_id": venue_id, "destination_type": "community_recreation_center"})
        return envelope

    tenant = TenantConfig(
        tenant_slug="gwinnett-county-parks-recreation",
        county_name="Gwinnett County",
        county_tag="gwinnett",
        default_venue=venue,
        known_venues={"bogan park": venue},
        venue_enrichment_builder=build_envelope,
    )

    venue_id, venue_name = _resolve_venue("Bogan Park", tenant, {})

    assert venue_id == 77
    assert venue_name == "Bogan Park Community Recreation Center"
    assert persisted
    assert persisted[0].destination_details[0]["venue_id"] == 77


# ---------------------------------------------------------------------------
# is_adult_program + _infer_category_and_tags adults-only tagging
# ---------------------------------------------------------------------------


def test_is_adult_program_detects_keyword_matches() -> None:
    assert is_adult_program("Senior Fitness Class", None) is True
    assert is_adult_program("AARP Safe Driving", None) is True
    assert is_adult_program("Adult Pottery Beginner", None) is True
    assert is_adult_program("Wine and Canvas", None) is True
    assert is_adult_program("Cocktail Mixology Workshop", None) is True
    assert is_adult_program("55+ Water Aerobics", None) is True
    assert is_adult_program("Adults Only Pool Night", None) is True


def test_is_adult_program_detects_age_min_18_or_higher() -> None:
    assert is_adult_program("Open Gym", 18) is True
    assert is_adult_program("Open Gym", 21) is True
    assert is_adult_program("Open Gym", 17) is False


def test_is_adult_program_returns_false_for_youth_programs() -> None:
    assert is_adult_program("Youth Soccer Camp", None) is False
    assert is_adult_program("Summer Swim Lessons Ages 5-12", None) is False
    assert is_adult_program("Beginner Swim Lessons", 6) is False


def test_infer_category_and_tags_adds_adults_only_for_keyword_match() -> None:
    """Keyword-matched adult programs get adults-only tag and lose family-friendly."""
    _, tags = _infer_category_and_tags(
        session_name="Senior Fitness Class",
        section_name="Wellness",
        group_name="Senior Fitness",
        reg_type="2",
        age_min=None,
        age_max=None,
        county_tag="cobb",
    )
    assert "adults-only" in tags
    assert "family-friendly" not in tags


def test_infer_category_and_tags_adds_adults_only_for_age_min_18() -> None:
    """Structured age_min >= 18 triggers adults-only tag via is_adult_program."""
    _, tags = _infer_category_and_tags(
        session_name="Pickleball Open Play",
        section_name="Sports",
        group_name="Adult Pickleball",
        reg_type="5",
        age_min=18,
        age_max=None,
        county_tag="gwinnett",
    )
    assert "adults-only" in tags
    assert "family-friendly" not in tags


def test_infer_category_and_tags_preserves_family_friendly_for_kids_program() -> None:
    """Youth programs must not receive adults-only tag."""
    _, tags = _infer_category_and_tags(
        session_name="Spring Break Camp",
        section_name="Camps",
        group_name="Spring Break Camp",
        reg_type="8",
        age_min=6,
        age_max=12,
        county_tag="cobb",
    )
    assert "adults-only" not in tags
    assert "family-friendly" in tags
