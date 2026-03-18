import sys
from types import SimpleNamespace

import main

from main import (
    run_post_crawl_tasks,
    should_run_full_post_crawl_for_source,
    should_run_post_crawl_for_batch,
)


def test_single_source_defaults_to_skip_full_post_crawl():
    args = SimpleNamespace(skip_launch_maintenance=False, full_post_crawl=False)

    assert should_run_full_post_crawl_for_source(args) is False


def test_single_source_can_opt_into_full_post_crawl():
    args = SimpleNamespace(skip_launch_maintenance=False, full_post_crawl=True)

    assert should_run_full_post_crawl_for_source(args) is True


def test_skip_launch_maintenance_overrides_full_post_crawl_flag():
    args = SimpleNamespace(skip_launch_maintenance=True, full_post_crawl=True)

    assert should_run_full_post_crawl_for_source(args) is False


def test_batch_runs_default_to_post_crawl():
    args = SimpleNamespace(skip_launch_maintenance=False)

    assert should_run_post_crawl_for_batch(args) is True


def test_batch_runs_can_skip_post_crawl():
    args = SimpleNamespace(skip_launch_maintenance=True)

    assert should_run_post_crawl_for_batch(args) is False


def test_scoped_post_crawl_skips_all_follow_on_tasks(monkeypatch):
    calls = []

    monkeypatch.setattr(main, "writes_enabled", lambda: True)
    monkeypatch.setattr(
        main,
        "refresh_available_filters",
        lambda: calls.append("refresh") or True,
    )
    monkeypatch.setattr(
        main,
        "fetch_logos",
        lambda: calls.append("logos") or {"success": 0, "failed": 0, "skipped": 0},
    )
    monkeypatch.setattr(
        main,
        "get_system_health_summary",
        lambda: calls.append("health") or {"sources": {"healthy": 0, "degraded": 0, "unhealthy": 0}},
    )

    run_post_crawl_tasks(run_global_tasks=False, run_launch_maintenance=False)

    assert calls == []


def test_full_post_crawl_refreshes_filters_and_search(monkeypatch):
    calls = []
    hydrate_calls = []

    monkeypatch.setattr(main, "writes_enabled", lambda: True)
    monkeypatch.setattr(
        main,
        "refresh_available_filters",
        lambda: calls.append("filters") or True,
    )
    monkeypatch.setattr(
        main,
        "refresh_search_suggestions",
        lambda city: calls.append(f"search:{city}") or True,
    )
    monkeypatch.setattr(
        main,
        "fetch_logos",
        lambda: {"success": 0, "failed": 0, "skipped": 0},
    )
    monkeypatch.setattr(
        main,
        "get_system_health_summary",
        lambda: {"sources": {"healthy": 0, "degraded": 0, "unhealthy": 0}},
    )
    monkeypatch.setattr(main, "run_full_cleanup", lambda **_: {})
    monkeypatch.setattr(main, "run_festival_schedules", lambda **_: {
        "sessions_found": 0,
        "sessions_inserted": 0,
        "festivals_with_data": 0,
        "festivals_processed": 0,
    })
    monkeypatch.setattr(main, "demote_stale_festival_dates", lambda: 0)
    monkeypatch.setattr(main, "check_unannounced_festivals", lambda **_: None)
    monkeypatch.setattr(main, "get_festival_tier_summary", lambda: {"t1": 0, "t2": 0, "t3": 0})
    monkeypatch.setattr(main, "deactivate_tba_events", lambda: 0)
    monkeypatch.setattr(main, "detect_zero_event_sources", lambda: (0, []))
    monkeypatch.setattr(main, "save_html_report", lambda: "/tmp/post-crawl-report.html")
    monkeypatch.setattr(main, "print_quality_report", lambda: None)
    monkeypatch.setattr(main, "record_daily_snapshot", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(main, "print_analytics_report", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(main, "run_launch_post_crawl_maintenance", lambda **_: True)
    monkeypatch.setitem(
        sys.modules,
        "heal_events",
        SimpleNamespace(run_healing_loop=lambda **_: {
            "prices_fixed": 0,
            "titles_cleaned": 0,
            "caps_fixed": 0,
            "closed_deactivated": 0,
            "alerts": 0,
        }),
    )
    monkeypatch.setitem(
        sys.modules,
        "festival_health",
        SimpleNamespace(run_festival_health_check=lambda: {
            "titles_backfilled": 0,
            "festival_dates_backfilled": 0,
        }),
    )
    monkeypatch.setitem(
        sys.modules,
        "scripts.backfill_event_artists",
        SimpleNamespace(run_artist_backfill=lambda **_: {
            "cleanup_checked": 0,
            "cleanup_changed": 0,
            "cleanup_deleted": 0,
            "backfill_checked": 0,
            "backfill_added": 0,
        }),
    )
    monkeypatch.setitem(
        sys.modules,
        "hydrate_tba_events",
        SimpleNamespace(
            hydrate_tba_events=lambda **kwargs: hydrate_calls.append(kwargs) or {"total": 0}
        ),
    )
    monkeypatch.setitem(
        sys.modules,
        "backfill_tags",
        SimpleNamespace(backfill_tags=lambda **_: {"updated": 0}),
    )

    run_post_crawl_tasks(
        run_global_tasks=True,
        run_launch_maintenance=False,
        maintenance_city="Atlanta",
        tba_hydration_limit=25,
    )

    assert calls[:2] == ["filters", "search:Atlanta"]
    assert hydrate_calls == [{"apply": True, "limit": 25}]


def test_post_crawl_can_skip_tba_hydration(monkeypatch):
    calls = []

    monkeypatch.setattr(main, "writes_enabled", lambda: True)
    monkeypatch.setattr(main, "refresh_available_filters", lambda: True)
    monkeypatch.setattr(main, "refresh_search_suggestions", lambda city: True)
    monkeypatch.setattr(main, "fetch_logos", lambda: {"success": 0, "failed": 0, "skipped": 0})
    monkeypatch.setattr(main, "get_system_health_summary", lambda: {"sources": {"healthy": 0, "degraded": 0, "unhealthy": 0}})
    monkeypatch.setattr(main, "run_full_cleanup", lambda **_: {})
    monkeypatch.setattr(main, "run_festival_schedules", lambda **_: {
        "sessions_found": 0,
        "sessions_inserted": 0,
        "festivals_with_data": 0,
        "festivals_processed": 0,
    })
    monkeypatch.setattr(main, "demote_stale_festival_dates", lambda: 0)
    monkeypatch.setattr(main, "check_unannounced_festivals", lambda **_: None)
    monkeypatch.setattr(main, "get_festival_tier_summary", lambda: {"t1": 0, "t2": 0, "t3": 0})
    monkeypatch.setattr(main, "deactivate_tba_events", lambda: 0)
    monkeypatch.setattr(main, "detect_zero_event_sources", lambda: (0, []))
    monkeypatch.setattr(main, "save_html_report", lambda: "/tmp/post-crawl-report.html")
    monkeypatch.setattr(main, "record_daily_snapshot", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(main, "run_launch_post_crawl_maintenance", lambda **_: True)
    monkeypatch.setitem(
        sys.modules,
        "heal_events",
        SimpleNamespace(run_healing_loop=lambda **_: {
            "prices_fixed": 0,
            "titles_cleaned": 0,
            "caps_fixed": 0,
            "closed_deactivated": 0,
            "alerts": 0,
        }),
    )
    monkeypatch.setitem(
        sys.modules,
        "festival_health",
        SimpleNamespace(run_festival_health_check=lambda: {
            "titles_backfilled": 0,
            "festival_dates_backfilled": 0,
        }),
    )
    monkeypatch.setitem(
        sys.modules,
        "scripts.backfill_event_artists",
        SimpleNamespace(run_artist_backfill=lambda **_: {
            "cleanup_checked": 0,
            "cleanup_changed": 0,
            "cleanup_deleted": 0,
            "backfill_checked": 0,
            "backfill_added": 0,
        }),
    )
    monkeypatch.setitem(
        sys.modules,
        "backfill_tags",
        SimpleNamespace(backfill_tags=lambda **_: {"updated": 0}),
    )
    monkeypatch.setitem(
        sys.modules,
        "hydrate_tba_events",
        SimpleNamespace(hydrate_tba_events=lambda **kwargs: calls.append(kwargs) or {"total": 0}),
    )

    run_post_crawl_tasks(
        run_global_tasks=True,
        run_launch_maintenance=False,
        skip_tba_hydration=True,
    )

    assert calls == []
