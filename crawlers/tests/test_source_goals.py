"""
Tests for source data-goal resolution.
"""

from types import SimpleNamespace


def test_normalize_goal_aliases():
    from source_goals import normalize_goal

    assert normalize_goal("event") == "events"
    assert normalize_goal("workshops") == "classes"
    assert normalize_goal("hours") == "venue_hours"
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


def test_resolve_source_data_goals_prefers_profile(monkeypatch):
    from source_goals import resolve_source_data_goals

    monkeypatch.setattr(
        "source_goals.load_profile",
        lambda slug: SimpleNamespace(data_goals=["events", "artist_lineup", "tickets"]),
    )

    goals, mode = resolve_source_data_goals("test-source", source_name="Test Source")
    assert mode == "profile"
    assert goals == ["events", "lineup", "tickets"]


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
