"""
Tests for source data-goal resolution.
"""

from types import SimpleNamespace


def test_normalize_goal_aliases():
    from source_goals import normalize_goal

    assert normalize_goal("event") == "events"
    assert normalize_goal("workshops") == "classes"
    assert normalize_goal("hours") == "venue_hours"
    assert normalize_goal("parking") == "planning"
    assert normalize_goal("ada") == "accessibility"
    assert normalize_goal("allergies") == "dietary"
    assert normalize_goal("not-a-goal") is None


def test_infer_data_goals_for_museum():
    from source_goals import infer_data_goals

    goals = infer_data_goals(
        source_slug="example-museum",
        source_name="Example Museum",
        venue_type="museum",
    )
    assert "events" in goals
    assert "exhibits" in goals
    assert "tickets" in goals
    assert "images" in goals


def test_infer_data_goals_for_open_calls_slug():
    from source_goals import infer_data_goals

    goals = infer_data_goals(
        source_slug="open-calls-artconnect",
        source_name="ArtConnect Open Calls",
    )
    assert goals == ["open_calls"]


def test_profile_model_accepts_open_calls_goal():
    from pipeline.models import SourceProfile

    profile = SourceProfile(slug="open-calls-artconnect", name="ArtConnect", data_goals=["open_calls"])
    assert profile.data_goals == ["open_calls"]


def test_infer_data_goals_for_exhibitions_slug():
    from source_goals import infer_data_goals

    goals = infer_data_goals(
        source_slug="exhibitions-moca-ga",
        source_name="MOCA GA Exhibitions",
    )
    assert goals == ["exhibits", "images"]


def test_resolve_source_data_goals_prefers_profile(monkeypatch):
    from source_goals import resolve_source_data_goals

    monkeypatch.setattr(
        "source_goals.load_profile",
        lambda slug: SimpleNamespace(data_goals=["events", "artist_lineup", "tickets"]),
    )

    goals, mode = resolve_source_data_goals("test-source", source_name="Test Source")
    assert mode == "profile"
    assert goals == ["events", "lineup", "tickets"]


def test_resolve_source_data_goals_respects_explicit_empty_profile_goals(monkeypatch):
    from source_goals import resolve_source_data_goals

    monkeypatch.setattr(
        "source_goals.load_profile",
        lambda slug: SimpleNamespace(data_goals=[]),
    )

    goals, mode = resolve_source_data_goals("atlanta-movie-tours", source_name="Atlanta Movie Tours")
    assert mode == "profile"
    assert goals == []


def test_resolve_source_data_goals_falls_back_to_inference(monkeypatch):
    from source_goals import resolve_source_data_goals

    def _raise(_slug):
        raise FileNotFoundError("no profile")

    monkeypatch.setattr("source_goals.load_profile", _raise)

    goals, mode = resolve_source_data_goals(
        "test-garden",
        source_name="Test Botanical Garden",
        venue_type="garden",
    )
    assert mode == "inferred"
    assert "events" in goals
    assert "exhibits" in goals


def test_destination_only_helper():
    from source_goals import source_has_event_feed_goal, source_is_destination_only

    assert source_has_event_feed_goal(["tickets", "events"]) is True
    assert source_is_destination_only(["tickets", "images", "venue_hours", "planning"]) is True
    assert source_is_destination_only(["tickets", "images", "events"]) is False


def test_fernbank_profile_overrides_inferred_exhibits():
    from source_goals import resolve_source_data_goals

    goals, mode = resolve_source_data_goals(
        "fernbank-science-center",
        source_name="Fernbank Science Center",
        venue_type="museum",
    )

    assert mode == "profile"
    assert goals == ["events", "images", "venue_hours"]


def test_show_led_bar_profiles_do_not_require_hours():
    from source_goals import resolve_source_data_goals

    goals, mode = resolve_source_data_goals(
        "smiths-olde-bar",
        source_name="Smith's Olde Bar",
        venue_type="music_venue",
    )

    assert mode == "profile"
    assert goals == ["events", "images", "specials", "tickets"]


def test_atlanta_printmakers_profile_targets_exhibitions():
    from source_goals import resolve_source_data_goals

    goals, mode = resolve_source_data_goals(
        "atlanta-printmakers-studio",
        source_name="Atlanta Printmakers Studio",
        venue_type="studio",
    )

    assert mode == "profile"
    assert goals == ["exhibits", "images"]
