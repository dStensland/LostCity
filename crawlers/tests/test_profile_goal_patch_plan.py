from __future__ import annotations

from pathlib import Path

from scripts.profile_goal_patch_plan import (
    format_data_goals_yaml,
    format_profile_yaml,
    profile_is_schema_invalid,
    render_markdown,
)


def test_format_data_goals_yaml_renders_list():
    assert format_data_goals_yaml(["exhibits", "images"]) == "data_goals:\n  - exhibits\n  - images"


def test_format_profile_yaml_renders_minimal_create_profile():
    assert format_profile_yaml(
        slug="open-calls-artconnect",
        name="ArtConnect",
        goals=["open_calls"],
        profile_action="create-profile",
    ) == "version: 1\nslug: open-calls-artconnect\nname: ArtConnect\ndata_goals:\n  - open_calls"


def test_render_markdown_includes_yaml_snippet_section():
    report = {
        "generated_at": "2026-03-31T12:00:00+00:00",
        "scope": {"portal_slug": "all", "include_inactive": False},
        "summary": {
            "patch_candidates": 1,
            "skipped_invalid_profiles": 0,
            "profile_action_counts": {"create-profile": 1},
            "alignment_action_counts": {"set-explicit-goals": 1},
        },
        "rows": [
            {
                "profile_action": "create-profile",
                "slug": "open-calls-artconnect",
                "name": "ArtConnect",
                "portal_slug": "arts-atlanta",
                "profile_path": "/Users/coach/Projects/LostCity/crawlers/sources/profiles/open-calls-artconnect.yaml",
                "recommended_goals": ["open_calls"],
                "reasons": ["source behaves like an open-calls lane and should not rely on fallback event goals"],
                "yaml_snippet": "version: 1\nslug: open-calls-artconnect\nname: ArtConnect\ndata_goals:\n  - open_calls",
            }
        ],
    }

    markdown = render_markdown(report, limit=10)

    assert "## YAML Snippets" in markdown
    assert "### open-calls-artconnect" in markdown
    assert "version: 1\nslug: open-calls-artconnect\nname: ArtConnect\ndata_goals:\n  - open_calls" in markdown


def test_profile_is_schema_invalid_for_legacy_goal_profile():
    assert profile_is_schema_invalid("atlanta-parks-family-map") is True


def test_profile_is_schema_invalid_false_for_missing_profile(tmp_path: Path, monkeypatch):
    monkeypatch.setattr(
        "scripts.profile_goal_patch_plan.find_profile_path",
        lambda slug: None,
    )
    assert profile_is_schema_invalid("missing-slug") is False
