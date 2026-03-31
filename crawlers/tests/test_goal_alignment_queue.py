from __future__ import annotations

from scripts.goal_alignment_queue import recommend_goals, render_markdown


def test_recommend_goals_sets_explicit_open_call_goal():
    action, goals, reasons = recommend_goals(
        {
            "slug": "open-calls-artconnect",
            "entity_mode": "open_calls",
            "goals": ["open_calls"],
            "failing_checks": ["stale"],
            "future_events": 0,
            "has_image": False,
        }
    )
    assert action == "set-explicit-goals"
    assert goals == ["open_calls"]
    assert reasons


def test_recommend_goals_flags_gallery_profile_review():
    action, goals, _reasons = recommend_goals(
        {
            "slug": "besharat-gallery",
            "entity_mode": "events",
            "goals": ["events", "exhibits", "images", "tickets"],
            "failing_checks": ["events", "exhibits", "images"],
            "future_events": 0,
            "has_image": False,
        }
    )
    assert action == "review-gallery-profile"
    assert goals == ["exhibits", "images"]


def test_render_markdown_includes_top_candidates_table():
    report = {
        "generated_at": "2026-03-31T12:00:00+00:00",
        "scope": {"portal_slug": "all", "include_inactive": False},
        "summary": {
            "sources_reviewed": 10,
            "alignment_candidates": 1,
            "action_counts": {"set-explicit-goals": 1},
        },
        "rows": [
            {
                "action": "set-explicit-goals",
                "slug": "open-calls-artconnect",
                "portal_slug": "arts-atlanta",
                "entity_mode": "open_calls",
                "current_goals": ["open_calls"],
                "recommended_goals": ["open_calls"],
                "failing_checks": ["stale"],
                "reasons": ["source behaves like an open-calls lane and should not rely on fallback event goals"],
            }
        ],
    }

    markdown = render_markdown(report, limit=10)

    assert "## Top Candidates" in markdown
    assert "| set-explicit-goals | open-calls-artconnect | arts-atlanta | open_calls | open_calls | open_calls | stale |" in markdown
