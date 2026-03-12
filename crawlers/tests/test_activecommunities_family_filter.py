from sources._activecommunities_family_filter import is_family_relevant_activity


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
