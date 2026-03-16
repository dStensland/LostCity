from sources._activecommunities_family_filter import (
    infer_activecommunities_registration_open,
    infer_activecommunities_schedule_days,
    infer_activecommunities_schedule_time_range,
    is_family_relevant_activity,
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
