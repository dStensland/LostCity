from types import SimpleNamespace

import main

from main import run_post_crawl_tasks, should_run_full_post_crawl_for_source


def test_single_source_defaults_to_skip_full_post_crawl():
    args = SimpleNamespace(skip_launch_maintenance=False, full_post_crawl=False)

    assert should_run_full_post_crawl_for_source(args) is False


def test_single_source_can_opt_into_full_post_crawl():
    args = SimpleNamespace(skip_launch_maintenance=False, full_post_crawl=True)

    assert should_run_full_post_crawl_for_source(args) is True


def test_skip_launch_maintenance_overrides_full_post_crawl_flag():
    args = SimpleNamespace(skip_launch_maintenance=True, full_post_crawl=True)

    assert should_run_full_post_crawl_for_source(args) is False


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
