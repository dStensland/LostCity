from __future__ import annotations

from scripts.profile_contract_adoption_queue import build_adoption_report, classify_action, render_markdown


def test_classify_action_prefers_ops_rehab():
    action = classify_action(
        {
            "failing_checks": ["health", "events"],
            "warning_checks": [],
        }
    )

    assert action == "ops-rehab"


def test_build_adoption_report_filters_to_profile_backed_actionable_sources():
    report = build_adoption_report(
        {
            "generated_at": "2026-03-31T00:00:00+00:00",
            "scope": {"portal_slug": "all", "include_inactive": False},
            "sources": [
                {
                    "slug": "profile-fail",
                    "portal_slug": "atlanta",
                    "goal_mode": "profile",
                    "status": "fail",
                    "priority_score": 90,
                    "goals": ["events", "images"],
                    "failing_checks": ["events", "images"],
                    "warning_checks": [],
                    "reasons": ["missing output"],
                },
                {
                    "slug": "profile-pass",
                    "portal_slug": "atlanta",
                    "goal_mode": "profile",
                    "status": "pass",
                    "priority_score": 0,
                    "goals": ["events"],
                    "failing_checks": [],
                    "warning_checks": [],
                    "reasons": [],
                },
                {
                    "slug": "inferred-fail",
                    "portal_slug": "atlanta",
                    "goal_mode": "inferred",
                    "status": "fail",
                    "priority_score": 80,
                    "goals": ["events"],
                    "failing_checks": ["events"],
                    "warning_checks": [],
                    "reasons": ["missing output"],
                },
            ],
        }
    )

    assert report["summary"]["profile_sources_reviewed"] == 2
    assert report["summary"]["actionable_sources"] == 1
    assert report["summary"]["action_counts"] == {"entity-output-fix": 1}
    assert report["rows"][0]["slug"] == "profile-fail"


def test_render_markdown_includes_action_counts_and_queue():
    markdown = render_markdown(
        {
            "scope": {"portal_slug": "all", "include_inactive": False},
            "summary": {
                "profile_sources_reviewed": 10,
                "actionable_sources": 2,
                "status_counts": {"fail": 1, "pass": 8, "warn": 1},
                "action_counts": {"entity-output-fix": 1, "metadata-polish": 1},
                "fail_checks": {"events": 1},
                "warn_checks": {"description": 1},
            },
            "rows": [
                {
                    "action": "entity-output-fix",
                    "portal_slug": "atlanta",
                    "slug": "example-source",
                    "status": "fail",
                    "goals": ["events", "images"],
                    "failing_checks": ["events"],
                    "warning_checks": [],
                    "priority_score": 100,
                    "reasons": ["event-oriented source has no future or recent event output"],
                }
            ],
        }
    )

    assert "- Actionable sources: 2" in markdown
    assert "entity-output-fix=1" in markdown
    assert "| entity-output-fix | atlanta | example-source | fail | events, images | events | - | 100 |" in markdown
