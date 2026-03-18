from sources._activecommunities_family_filter import (
    infer_activecommunities_registration_open,
    infer_activecommunities_schedule_days,
    infer_activecommunities_schedule_time_range,
    is_family_relevant_activity,
    normalize_activecommunities_age,
    normalize_activecommunities_session_title,
    parse_age_from_name,
)


def test_family_filter_keeps_youth_programs_and_skips_adult_programs() -> None:
    assert (
        is_family_relevant_activity(
            name="Youth Basketball Clinic",
            desc_text="Skills clinic for kids ages 8-12.",
            age_min=8,
            age_max=12,
            category="fitness",
            tags=["community", "kids"],
        )
        is True
    )
    assert (
        is_family_relevant_activity(
            name="Adult Water Aerobics",
            desc_text="Low-impact aqua fit for older adults.",
            age_min=18,
            age_max=None,
            category="fitness",
            tags=["community", "adults"],
        )
        is False
    )


def test_family_filter_respects_blocked_keywords() -> None:
    assert (
        is_family_relevant_activity(
            name="Family Swim",
            desc_text="Public pool program.",
            age_min=None,
            age_max=None,
            category="family",
            tags=["community"],
            blocked_keywords=["family swim"],
        )
        is False
    )


def test_family_filter_skips_adult_gendered_programs() -> None:
    assert (
        is_family_relevant_activity(
            name="Men's Chess and Checkers",
            desc_text="Open recreation for adults.",
            age_min=None,
            age_max=None,
            category="games",
            tags=["community"],
        )
        is False
    )


def test_family_filter_keeps_youth_camps_without_explicit_ages() -> None:
    assert (
        is_family_relevant_activity(
            name="Summer Camp at Adams Park",
            desc_text="Weekly camp for kids with crafts and games.",
            age_min=None,
            age_max=None,
            category="community",
            tags=["summer"],
        )
        is True
    )


def test_infer_activecommunities_schedule_days_supports_weekday_phrases_and_short_ranges() -> None:
    assert (
        infer_activecommunities_schedule_days(
            session_start="2026-06-08",
            session_end="2026-06-12",
            date_range_description="",
            desc_text="Camp runs weekdays with arts and games.",
        )
        == [1, 2, 3, 4, 5]
    )
    assert (
        infer_activecommunities_schedule_days(
            session_start="2026-03-21",
            session_end="2026-03-21",
            date_range_description="",
            desc_text="One-day workshop.",
        )
        == [6]
    )


def test_infer_activecommunities_registration_open_prefers_payload_then_description() -> None:
    assert (
        infer_activecommunities_registration_open(
            activity_online_start_time="2026-01-16 09:00:00",
            desc_text="",
            session_start="2026-06-08",
        )
        == "2026-01-16"
    )
    assert (
        infer_activecommunities_registration_open(
            activity_online_start_time="",
            desc_text="Open registration for new plots will begin February 3rd.",
            session_start="2026-01-02",
        )
        == "2026-02-03"
    )


def test_normalize_activecommunities_age_treats_zero_as_missing() -> None:
    """ACTIVENet uses 0 to mean 'no restriction', not 'infant'. Both must become None."""
    assert normalize_activecommunities_age(0) is None
    assert normalize_activecommunities_age(None) is None
    assert normalize_activecommunities_age(5) == 5
    assert normalize_activecommunities_age(17) == 17
    assert normalize_activecommunities_age(18) == 18
    # Values above 90 are sentinels for "adult" — also None
    assert normalize_activecommunities_age(99) is None
    assert normalize_activecommunities_age(120) is None


def test_normalize_activecommunities_age_does_not_drop_legitimate_low_ages() -> None:
    """Age 1 and above must be preserved (age 0 is the only sentinel)."""
    assert normalize_activecommunities_age(1) == 1
    assert normalize_activecommunities_age(3) == 3


def test_normalize_activecommunities_session_title_strips_trailing_month_day() -> None:
    """Daily camp sessions should consolidate under their base title."""
    assert (
        normalize_activecommunities_session_title("Gresham 2026 Spring Break Camp Apr. 6th")
        == "Gresham 2026 Spring Break Camp"
    )
    assert (
        normalize_activecommunities_session_title("Gresham 2026 Spring Break Camp Apr. 10th")
        == "Gresham 2026 Spring Break Camp"
    )
    assert (
        normalize_activecommunities_session_title("Summer Camp at Adams Park May 27th")
        == "Summer Camp at Adams Park"
    )


def test_normalize_activecommunities_session_title_preserves_non_dated_titles() -> None:
    """Titles without trailing date suffixes must be unchanged."""
    assert (
        normalize_activecommunities_session_title("Beginner Swim Lessons")
        == "Beginner Swim Lessons"
    )
    assert (
        normalize_activecommunities_session_title("Youth Basketball Clinic 2026")
        == "Youth Basketball Clinic 2026"
    )


def test_infer_activecommunities_schedule_time_range_parses_activity_time_text() -> None:
    assert infer_activecommunities_schedule_time_range(
        date_range_description="",
        desc_text=(
            "Activity Times: Mon. & Wed 4 :00 p.m. to 5:00 pm. "
            "Registration Fees: $0 Free for Afterschool Participants"
        ),
    ) == ("16:00:00", "17:00:00")

    assert infer_activecommunities_schedule_time_range(
        date_range_description="Camp runs from 9am-4pm.",
        desc_text="",
    ) == ("09:00:00", "16:00:00")


# ---------------------------------------------------------------------------
# parse_age_from_name
# ---------------------------------------------------------------------------


def test_parse_age_from_name_handles_ages_N_dash_M() -> None:
    assert parse_age_from_name("Youth Basketball Clinic Ages 8-12") == (8, 12)
    assert parse_age_from_name("Ages 5-10 Swimming") == (5, 10)
    assert parse_age_from_name("Age 6 to 10 Art Camp") == (6, 10)


def test_parse_age_from_name_handles_parenthetical_yrs_pattern() -> None:
    assert parse_age_from_name("Swim Lessons (6-8 yrs)") == (6, 8)
    assert parse_age_from_name("Dance Class (3-5 year)") == (3, 5)


def test_parse_age_from_name_handles_grade_range_with_conversion() -> None:
    # Grades 3-5 -> ages 8-10
    assert parse_age_from_name("After School Program Grades 3-5") == (8, 10)


def test_parse_age_from_name_handles_N_and_under() -> None:
    assert parse_age_from_name("Soccer Skills 12 & Under") == (0, 12)
    assert parse_age_from_name("Arts and Crafts 8 & Under") == (0, 8)


def test_parse_age_from_name_returns_none_none_when_no_match() -> None:
    assert parse_age_from_name("Open Gym Drop-In") == (None, None)
    assert parse_age_from_name("Senior Fitness Class") == (None, None)
    assert parse_age_from_name("Adult Water Aerobics") == (None, None)


def test_parse_age_from_name_rejects_adult_ranges() -> None:
    """Age ranges where max > 18 must not be returned — those are adult programs."""
    # "18-65" would erroneously tag an adult program as youth
    assert parse_age_from_name("Adult Aqua Fit 18-65 years") == (None, None)
    # max > 18 is also excluded
    assert parse_age_from_name("All Ages 5-25 years") == (None, None)


def test_parse_age_from_name_accepts_teen_program_through_18() -> None:
    """Ages 14-18 includes teens and is legitimately a youth/family program."""
    assert parse_age_from_name("Teen Program Ages 14-18") == (14, 18)


def test_parse_age_from_name_returns_none_none_for_empty_input() -> None:
    assert parse_age_from_name("") == (None, None)
