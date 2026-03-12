from sources._rec1_base import _should_skip_session_keywords, is_family_relevant_session


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
