from __future__ import annotations

from scripts.weekly_ops_queue import classify_workstream, render_markdown


def test_classify_workstream_prioritizes_deterministic_upgrade():
    assert classify_workstream("graduate-from-llm", "fail") == "deterministic-upgrade"


def test_classify_workstream_routes_ignore_failures_to_gate_only_fix():
    assert classify_workstream("ignore", "fail") == "gate-only-fix"


def test_render_markdown_includes_top_queue_section():
    report = {
        "generated_at": "2026-03-31T12:00:00+00:00",
        "scope": {"portal_slug": "all", "include_inactive": False},
        "summary": {
            "sources_reviewed": 2,
            "queued_sources": 1,
            "workstream_counts": {"deterministic-upgrade": 1},
            "weekly_action_counts": {"graduate-from-llm": 1, "ignore": 1},
            "gate_status_counts": {"fail": 1, "pass": 1},
        },
        "rows": [
            {
                "workstream": "deterministic-upgrade",
                "slug": "example",
                "portal_slug": "atlanta",
                "weekly_action": "graduate-from-llm",
                "gate_status": "fail",
                "combined_priority_score": 512,
                "entity_lane": "events",
                "future_items": 22,
                "recent_items_30d": 18,
                "weekly_reasons": ["primary integration still uses llm_crawler"],
                "gate_reasons": ["images goal is declared but the primary venue has no image"],
                "gate_failing_checks": ["images"],
                "gate_warning_checks": [],
            }
        ],
    }

    markdown = render_markdown(report, limit=10)

    assert "## Top Queue" in markdown
    assert "| deterministic-upgrade | example | atlanta | graduate-from-llm | fail | 512 | events | 22 | 18 |" in markdown
