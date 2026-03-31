from __future__ import annotations

from datetime import datetime, timezone

from scripts.weekly_source_review import (
    _connector_candidate_families,
    classify_source,
    detect_entity_lane,
    detect_platform_family,
    render_markdown,
    SourceReview,
)


def _source(**overrides) -> SourceReview:
    base = {
        "id": 1,
        "slug": "example",
        "name": "Example",
        "url": "https://example.com/events",
        "source_type": "venue",
        "is_active": True,
        "integration_method": "html",
        "expected_event_count": 12,
        "last_crawled_at": "2026-03-15T12:00:00+00:00",
        "owner_portal_id": "portal-1",
        "portal_slug": "atlanta",
        "health_tags": [],
        "future_items": 6,
        "recent_inserts_30d": 4,
        "data_goals": ["events"],
        "goal_mode": "profile",
        "event_feed_goal": True,
        "destination_only": False,
        "platform_family": None,
        "platform_label": None,
        "platform_kind": None,
        "host_group": "example.com",
    }
    base.update(overrides)
    return SourceReview(**base)


def test_detect_platform_family_matches_rec1():
    family, label, kind = detect_platform_family(
        slug="gwinnett-parks-rec",
        name="Gwinnett Parks & Recreation",
        source_url="https://secure.rec1.com/GA/gwinnett-county-parks-recreation/catalog",
        profile_text="integration_method: python",
    )
    assert family == "rec1"
    assert label == "Rec1 / CivicRec"
    assert kind == "platform"


def test_detect_entity_lane_for_open_calls_slug():
    assert detect_entity_lane("open-calls-artconnect", "scrape", ["events", "images"]) == "open_calls"


def test_classify_source_prioritizes_graduate_from_llm():
    llm_source = _source(
        integration_method="llm_crawler",
        future_items=14,
        platform_family="tribe_events",
        platform_label="Tribe Events",
        platform_kind="platform",
    )
    connector_candidates = {
        "tribe_events": _connector_candidate_families(
            [
                llm_source,
                _source(id=2, slug="b", platform_family="tribe_events", platform_label="Tribe Events", platform_kind="platform"),
                _source(id=3, slug="c", platform_family="tribe_events", platform_label="Tribe Events", platform_kind="platform"),
            ]
        )["tribe_events"]
    }
    classify_source(llm_source, connector_candidates=connector_candidates, now=datetime.now(timezone.utc))
    assert llm_source.action == "graduate-from-llm"
    assert any("llm_crawler" in reason for reason in llm_source.reasons)


def test_classify_source_marks_rehab_for_zero_yield_and_bad_tags():
    source = _source(
        future_items=0,
        recent_inserts_30d=0,
        health_tags=["timeout", "parse-error"],
        last_crawled_at="2026-02-01T00:00:00+00:00",
    )
    classify_source(source, connector_candidates={}, now=datetime(2026, 3, 15, tzinfo=timezone.utc))
    assert source.action == "rehab"
    assert any("health tags" in reason for reason in source.reasons)


def test_connector_candidate_family_requires_repeated_platform_sources():
    candidates = _connector_candidate_families(
        [
            _source(id=1, slug="one", integration_method="html", platform_family="rec1", platform_label="Rec1 / CivicRec", platform_kind="platform"),
            _source(id=2, slug="two", integration_method="playwright", platform_family="rec1", platform_label="Rec1 / CivicRec", platform_kind="platform"),
            _source(id=3, slug="three", integration_method="llm_crawler", platform_family="rec1", platform_label="Rec1 / CivicRec", platform_kind="platform"),
        ]
    )
    assert "rec1" in candidates
    assert candidates["rec1"].active_count == 3


def test_render_markdown_keeps_top_priorities_and_method_mix_separate():
    review = {
        "generated_at": "2026-03-31T12:00:00+00:00",
        "scope": {"portal_slug": "all", "include_inactive": False},
        "summary": {
            "sources_reviewed": 1,
            "active_sources": 1,
            "event_feed_sources": 1,
            "destination_only_sources": 0,
            "method_counts": {"html": 1},
            "action_counts": {"graduate-from-llm": 1},
            "ignore_counts": {},
            "platform_counts": {},
            "top_host_counts": {},
        },
        "connector_families": [],
        "sources": [
            {
                "entity_lane": "events",
            }
        ],
        "actions": {
            "connector": [],
            "rehab": [],
            "graduate-from-llm": [
                {
                    "action": "graduate-from-llm",
                    "slug": "example",
                    "entity_lane": "events",
                    "priority_score": 321,
                    "future_items": 12,
                    "recent_inserts_30d": 8,
                    "reasons": ["primary integration still uses llm_crawler"],
                    "portal_slug": "atlanta",
                    "integration_method": "llm_crawler",
                    "platform_label": None,
                    "host_group": "example.com",
                }
            ],
            "ignore": [],
        },
    }

    markdown = render_markdown(review, limit=10)

    assert "## Top Priorities This Week\n\n| Action | Slug | Lane | Score | Future | Recent 30d | Why |" in markdown
    assert "## Method Mix\n\n| Method | Count |" in markdown
