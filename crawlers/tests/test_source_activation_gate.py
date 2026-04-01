from __future__ import annotations

from datetime import datetime, timezone

from scripts.source_activation_gate import (
    SourceGate,
    _resolve_primary_venue,
    crawl_recency_days,
    detect_entity_mode,
    evaluate_gate,
    has_usable_hours,
    parse_iso_datetime,
    render_markdown,
)


def _gate(**overrides) -> SourceGate:
    base = {
        "id": 1,
        "slug": "example",
        "name": "Example",
        "portal_slug": "atlanta",
        "is_active": True,
        "integration_method": "html",
        "last_crawled_at": "2026-03-25T12:00:00+00:00",
        "health_tags": [],
        "goals": ["events", "images"],
        "goal_mode": "profile",
        "entity_mode": "events",
        "primary_venue_id": 10,
        "primary_venue_name": "Example Venue",
        "venue_type": "music_venue",
        "future_events": 12,
        "recent_events_30d": 15,
        "active_programs": 0,
        "recent_programs_30d": 0,
        "future_exhibitions": 0,
        "recent_exhibitions_30d": 0,
        "open_open_calls": 0,
        "recent_open_calls_30d": 0,
        "active_specials": 0,
        "has_hours": False,
        "has_description": True,
        "has_image": True,
        "has_planning": False,
    }
    base.update(overrides)
    return SourceGate(**base)


def test_evaluate_gate_passes_when_declared_goals_are_satisfied():
    gate = _gate()
    evaluate_gate(gate, now=datetime(2026, 3, 31, tzinfo=timezone.utc))
    assert gate.status == "pass"
    assert gate.failing_checks == []


def test_evaluate_gate_fails_when_classes_goal_has_no_program_output():
    gate = _gate(goals=["classes"], future_events=0, recent_events_30d=0, has_image=False)
    evaluate_gate(gate, now=datetime(2026, 3, 31, tzinfo=timezone.utc))
    assert gate.status == "fail"
    assert "classes" in gate.failing_checks


def test_evaluate_gate_fails_when_destination_goals_have_no_primary_venue():
    gate = _gate(goals=["specials", "venue_hours"], primary_venue_id=None, primary_venue_name=None)
    evaluate_gate(gate, now=datetime(2026, 3, 31, tzinfo=timezone.utc))
    assert gate.status == "fail"
    assert "missing-primary-venue" in gate.failing_checks


def test_evaluate_gate_allows_event_source_without_primary_venue_when_only_image_ticket_goals_exist():
    gate = _gate(
        goals=["events", "images", "tickets"],
        primary_venue_id=None,
        primary_venue_name=None,
        future_events=4,
        recent_events_30d=4,
    )

    evaluate_gate(gate, now=datetime(2026, 3, 31, tzinfo=timezone.utc))

    assert "missing-primary-venue" not in gate.failing_checks
    assert gate.status == "pass"


def test_parse_iso_datetime_accepts_short_fractional_second_offsets():
    parsed = parse_iso_datetime("2026-03-31T07:09:31.14788+00:00")
    assert parsed is not None
    assert parsed.year == 2026
    assert parsed.minute == 9


def test_has_usable_hours_accepts_string_day_ranges():
    assert has_usable_hours({"monday": "16:00-23:00", "tuesday": ""}) is True


def test_detect_entity_mode_treats_open_calls_sources_as_open_call_lane():
    mode = detect_entity_mode(
        "open-calls-artconnect",
        future_events=0,
        recent_events_30d=0,
        active_programs=0,
        recent_programs_30d=0,
        future_exhibitions=0,
        recent_exhibitions_30d=0,
        open_open_calls=24,
        recent_open_calls_30d=30,
        goals=["events", "images"],
    )
    assert mode == "open_calls"


def test_detect_entity_mode_treats_destination_only_goals_as_destination_lane():
    mode = detect_entity_mode(
        "scofflaw-brewing",
        future_events=0,
        recent_events_30d=0,
        active_programs=0,
        recent_programs_30d=0,
        future_exhibitions=0,
        recent_exhibitions_30d=0,
        open_open_calls=0,
        recent_open_calls_30d=0,
        goals=["images", "venue_hours"],
    )
    assert mode == "destination"


def test_resolve_primary_venue_falls_back_to_slug_match_when_source_has_no_output():
    primary_venue_id, venue = _resolve_primary_venue(
        source_slug="joystick-gamebar",
        source_name="Joystick Gamebar",
        venue_counts=None,
        venues={10: {"id": 10, "slug": "joystick-gamebar", "name": "Joystick Gamebar"}},
        venues_by_slug={"joystick-gamebar": {"id": 10, "slug": "joystick-gamebar", "name": "Joystick Gamebar"}},
        venues_by_name={"joystick gamebar": {"id": 10, "slug": "joystick-gamebar", "name": "Joystick Gamebar"}},
    )

    assert primary_venue_id == 10
    assert venue["name"] == "Joystick Gamebar"


def test_resolve_primary_venue_falls_back_to_unique_exact_name_match_when_slug_differs():
    primary_venue_id, venue = _resolve_primary_venue(
        source_slug="three-taverns",
        source_name="Three Taverns Craft Brewery",
        venue_counts=None,
        venues={10: {"id": 10, "slug": "three-taverns-brewery", "name": "Three Taverns Craft Brewery"}},
        venues_by_slug={},
        venues_by_name={
            "three taverns craft brewery": {
                "id": 10,
                "slug": "three-taverns-brewery",
                "name": "Three Taverns Craft Brewery",
            }
        },
    )

    assert primary_venue_id == 10
    assert venue["slug"] == "three-taverns-brewery"


def test_evaluate_gate_does_not_duplicate_exhibition_failure_for_exhibition_lane():
    gate = _gate(
        goals=["exhibits", "images"],
        entity_mode="exhibitions",
        future_events=0,
        recent_events_30d=0,
        future_exhibitions=0,
        recent_exhibitions_30d=0,
        primary_venue_id=None,
        primary_venue_name=None,
        has_image=False,
    )
    evaluate_gate(gate, now=datetime(2026, 3, 31, tzinfo=timezone.utc))
    assert gate.failing_checks.count("exhibits") == 1


def test_evaluate_gate_ignores_stale_timeout_health_tag_after_recent_success():
    gate = _gate(
        health_tags=["source-timeout"],
        last_crawled_at="2026-03-31T07:09:31.14788+00:00",
        last_crawl_status="success",
        goals=["images", "venue_hours"],
        entity_mode="destination",
        future_events=0,
        recent_events_30d=0,
        active_programs=0,
        recent_programs_30d=0,
        has_image=True,
        has_hours=True,
    )
    evaluate_gate(gate, now=datetime(2026, 3, 31, 16, 0, tzinfo=timezone.utc))
    assert "health" not in gate.failing_checks
    assert "stale" not in gate.failing_checks
    assert gate.status == "pass"


def test_crawl_recency_days_falls_back_to_recent_crawl_log_timestamp():
    gate = _gate(
        last_crawled_at=None,
        last_crawl_logged_at="2026-03-31T07:09:31.14788+00:00",
    )

    age_days = crawl_recency_days(gate, datetime(2026, 3, 31, 16, 0, tzinfo=timezone.utc))

    assert age_days == 0


def test_evaluate_gate_ignores_timeout_health_tag_during_recent_running_attempt():
    gate = _gate(
        health_tags=["source-timeout"],
        last_crawled_at=None,
        last_crawl_logged_at="2026-03-31T07:09:31.14788+00:00",
        last_crawl_status="running",
        goals=["images", "venue_hours"],
        entity_mode="destination",
        future_events=0,
        recent_events_30d=0,
        active_programs=0,
        recent_programs_30d=0,
        has_image=True,
        has_hours=True,
    )

    evaluate_gate(gate, now=datetime(2026, 3, 31, 16, 0, tzinfo=timezone.utc))

    assert "health" not in gate.failing_checks
    assert "stale" not in gate.failing_checks
    assert gate.status == "pass"


def test_evaluate_gate_warns_instead_of_failing_for_destination_batch_without_primary_venue():
    gate = _gate(
        goals=["images", "planning", "accessibility"],
        entity_mode="destination",
        primary_venue_id=None,
        primary_venue_name=None,
        future_events=0,
        recent_events_30d=0,
        has_image=False,
        has_planning=False,
    )

    evaluate_gate(gate, now=datetime(2026, 3, 31, 16, 0, tzinfo=timezone.utc))

    assert "missing-primary-venue" not in gate.failing_checks
    assert "images" not in gate.failing_checks
    assert "destination-batch" in gate.warning_checks
    assert gate.status == "warn"


def test_render_markdown_includes_failing_sources_section():
    report = {
        "generated_at": "2026-03-31T12:00:00+00:00",
        "scope": {"portal_slug": "all", "include_inactive": False},
        "summary": {
            "sources_reviewed": 1,
            "status_counts": {"fail": 1},
            "fail_checks": {"events": 1},
            "warn_checks": {},
        },
        "statuses": {
            "fail": [
                {
                    "portal_slug": "atlanta",
                    "slug": "example",
                    "goals": ["events"],
                    "primary_venue_name": "Example Venue",
                    "future_events": 0,
                    "active_programs": 0,
                    "future_exhibitions": 0,
                    "active_specials": 0,
                    "has_hours": False,
                    "has_image": False,
                    "reasons": ["event-oriented source has no future or recent event output"],
                }
            ],
            "warn": [],
            "pass": [],
        },
    }

    markdown = render_markdown(report, limit=10)

    assert "## Failing Sources" in markdown
    assert "| atlanta | example | events | Example Venue | 0 | 0 | 0 | 0 | no | no |" in markdown
