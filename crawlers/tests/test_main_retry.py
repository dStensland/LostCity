"""Tests for transient retry handling in main.run_source()."""

from types import SimpleNamespace

import main


def test_run_source_retries_transient_disconnect(monkeypatch):
    source = {"id": 1, "slug": "test-source", "name": "Test Source", "is_active": True}
    updates = []
    sleeps = []
    attempts = {"count": 0}

    def fake_run_crawler(_source):
        attempts["count"] += 1
        if attempts["count"] == 1:
            raise Exception("Server disconnected")
        return 5, 2, 3

    monkeypatch.setattr(main, "get_recommended_delay", lambda _slug: 0)
    monkeypatch.setattr(main, "get_source_by_slug", lambda _slug: source)
    monkeypatch.setattr(main, "should_skip_crawl", lambda _slug: (False, ""))
    monkeypatch.setattr(main, "create_crawl_log", lambda _source_id: 101)
    monkeypatch.setattr(main, "reset_validation_stats", lambda: None)
    monkeypatch.setattr(main, "get_validation_stats", lambda: SimpleNamespace(rejected=0, warnings=0, get_summary=lambda: ""))
    monkeypatch.setattr(main, "health_record_start", lambda _slug: "run-1")
    monkeypatch.setattr(main, "health_record_success", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(main, "health_record_failure", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(main, "update_source_last_crawled", lambda _source_id: None)
    monkeypatch.setattr(main, "update_expected_event_count", lambda _source_id, _count: None)
    monkeypatch.setattr(main, "run_crawler", fake_run_crawler)
    monkeypatch.setattr(main, "update_crawl_log", lambda *args, **kwargs: updates.append((args, kwargs)))
    monkeypatch.setattr(main.time, "sleep", lambda seconds: sleeps.append(seconds))
    monkeypatch.setattr(main, "logger", SimpleNamespace(info=lambda *a, **k: None, warning=lambda *a, **k: None, error=lambda *a, **k: None, debug=lambda *a, **k: None))

    ok = main.run_source("test-source")

    assert ok is True
    assert attempts["count"] == 2
    assert sleeps == [1.0]
    assert updates[-1][1]["status"] == "success"
    assert updates[-1][1]["events_found"] == 5


def test_run_source_does_not_retry_non_transient_error(monkeypatch):
    source = {"id": 1, "slug": "test-source", "name": "Test Source", "is_active": True}
    updates = []
    attempts = {"count": 0}

    def fake_run_crawler(_source):
        attempts["count"] += 1
        raise Exception("EVENTBRITE_API_KEY not configured")

    monkeypatch.setattr(main, "get_recommended_delay", lambda _slug: 0)
    monkeypatch.setattr(main, "get_source_by_slug", lambda _slug: source)
    monkeypatch.setattr(main, "should_skip_crawl", lambda _slug: (False, ""))
    monkeypatch.setattr(main, "create_crawl_log", lambda _source_id: 101)
    monkeypatch.setattr(main, "reset_validation_stats", lambda: None)
    monkeypatch.setattr(main, "health_record_start", lambda _slug: "run-1")
    monkeypatch.setattr(main, "health_record_success", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(main, "health_record_failure", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(main, "run_crawler", fake_run_crawler)
    monkeypatch.setattr(main, "update_crawl_log", lambda *args, **kwargs: updates.append((args, kwargs)))
    monkeypatch.setattr(main.time, "sleep", lambda _seconds: None)
    monkeypatch.setattr(main, "logger", SimpleNamespace(info=lambda *a, **k: None, warning=lambda *a, **k: None, error=lambda *a, **k: None, debug=lambda *a, **k: None))

    ok = main.run_source("test-source")

    assert ok is False
    assert attempts["count"] == 1
    assert updates[-1][1]["status"] == "error"
    assert "EVENTBRITE_API_KEY not configured" in updates[-1][1]["error_message"]


def test_run_source_fails_after_transient_retry_budget(monkeypatch):
    source = {"id": 1, "slug": "test-source", "name": "Test Source", "is_active": True}
    updates = []
    attempts = {"count": 0}
    sleeps = []

    def fake_run_crawler(_source):
        attempts["count"] += 1
        raise Exception("Server disconnected")

    monkeypatch.setattr(main, "get_recommended_delay", lambda _slug: 0)
    monkeypatch.setattr(main, "get_source_by_slug", lambda _slug: source)
    monkeypatch.setattr(main, "should_skip_crawl", lambda _slug: (False, ""))
    monkeypatch.setattr(main, "create_crawl_log", lambda _source_id: 101)
    monkeypatch.setattr(main, "reset_validation_stats", lambda: None)
    monkeypatch.setattr(main, "health_record_start", lambda _slug: "run-1")
    monkeypatch.setattr(main, "health_record_success", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(main, "health_record_failure", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(main, "run_crawler", fake_run_crawler)
    monkeypatch.setattr(main, "update_crawl_log", lambda *args, **kwargs: updates.append((args, kwargs)))
    monkeypatch.setattr(main.time, "sleep", lambda seconds: sleeps.append(seconds))
    monkeypatch.setattr(main, "logger", SimpleNamespace(info=lambda *a, **k: None, warning=lambda *a, **k: None, error=lambda *a, **k: None, debug=lambda *a, **k: None))

    ok = main.run_source("test-source")

    assert ok is False
    assert attempts["count"] == 2
    assert sleeps == [1.0]
    assert updates[-1][1]["status"] == "error"
    assert "Server disconnected" in updates[-1][1]["error_message"]
