from __future__ import annotations

from types import SimpleNamespace

from postgrest.exceptions import APIError


def test_cancel_stale_crawl_logs_marks_old_remote_rows_cancelled(monkeypatch):
    import db.sources as sources
    from db import configure_write_mode
    from db.sources import cancel_stale_crawl_logs

    updates = []

    class FakeQuery:
        def __init__(self):
            self.payload = None

        def select(self, *_args, **_kwargs):
            return self

        def eq(self, *_args, **_kwargs):
            if self.payload is not None:
                updates.append((self.payload, _args, _kwargs))
            return self

        def update(self, payload):
            self.payload = payload
            return self

        def lt(self, *_args, **_kwargs):
            return self

        def order(self, *_args, **_kwargs):
            return self

        def limit(self, *_args, **_kwargs):
            return self

        def execute(self):
            if self.payload is not None:
                return SimpleNamespace(data=[])
            return SimpleNamespace(data=[{"id": 11}, {"id": 12}])

    class ClientRecorder:
        def table(self, name):
            assert name == "crawl_logs"
            return FakeQuery()

    monkeypatch.setattr(sources, "get_client", lambda: ClientRecorder())
    configure_write_mode(True)

    try:
        cancelled = cancel_stale_crawl_logs(max_age_hours=2.0)
    finally:
        configure_write_mode(False, reason="test reset")

    assert cancelled == 2
    assert [entry[1][1] for entry in updates] == [11, 12]


def test_generate_html_report_counts_cancelled_as_failed(monkeypatch):
    import post_crawl_report as report

    recent_crawls = [
        {"status": "success", "events_found": 5, "events_new": 2, "started_at": "2026-04-06T10:00:00", "source": {"name": "Good"}},
        {"status": "cancelled", "events_found": 0, "events_new": 0, "started_at": "2026-04-06T11:00:00", "source": {"name": "Cancelled"}},
        {"status": "running", "events_found": 0, "events_new": 0, "started_at": "2026-04-06T12:00:00", "source": {"name": "Running"}},
    ]

    monkeypatch.setattr(report, "get_system_health_summary", lambda: {"sources": {"healthy": 1, "degraded": 0, "unhealthy": 0}})
    monkeypatch.setattr(report, "get_analytics_summary", lambda: {"total_upcoming": 10, "created_today": 1, "by_category": {}, "top_venues": [], "daily_forecast": [{"count": 1, "day_name": "Mon"}] * 14})
    monkeypatch.setattr(report, "get_sources_needing_attention", lambda threshold=70: [])
    monkeypatch.setattr(report, "get_declining_sources", lambda: [])
    monkeypatch.setattr(report, "get_unhealthy_sources", lambda min_failures=3: [])
    monkeypatch.setattr(report, "get_recent_crawl_results", lambda hours=24: recent_crawls)

    html = report.generate_html_report()

    assert "1 <span class=\"success\">✓</span> / 1 <span class=\"error\">✗</span>" in html
    assert "50% completed success rate, 1 running" in html
    assert "Cancelled" in html
    assert "Running" in html


def test_get_source_info_caches_supported_select_fields(monkeypatch):
    import db.sources as sources

    class FakeQuery:
        def __init__(self, client):
            self.client = client
            self.fields = None

        def select(self, fields):
            self.fields = fields
            self.client.select_calls.append(fields)
            return self

        def limit(self, *_args, **_kwargs):
            return self

        def eq(self, *_args, **_kwargs):
            return self

        def execute(self):
            if self.fields and "producer_id" in self.fields:
                raise Exception("column sources.producer_id does not exist")
            return SimpleNamespace(data=[{"id": 7, "slug": "test-source"}])

    class FakeClient:
        def __init__(self):
            self.select_calls = []

        def table(self, name):
            assert name == "sources"
            return FakeQuery(self)

    client = FakeClient()
    monkeypatch.setattr(sources, "get_client", lambda: client)
    sources._SOURCE_CACHE.clear()

    first = sources.get_source_info(7)
    second = sources.get_source_info(8)

    assert first == {"id": 7, "slug": "test-source"}
    assert second == {"id": 7, "slug": "test-source"}
    # Function tries progressively simpler select lists:
    # For source_id=7: tries with producer_id (fails), then without (succeeds)
    # For source_id=8: tries with producer_id (fails), then without (succeeds)
    assert len(client.select_calls) >= 2
    assert client.select_calls[0] == "id, slug, name, url, owner_portal_id, producer_id, is_sensitive, is_active, integration_method"
    assert "producer_id" not in client.select_calls[1]


def test_screenings_support_tables_treats_schema_cache_miss_as_unsupported(monkeypatch):
    import db.client as client_module

    class FakeQuery:
        def select(self, *_args, **_kwargs):
            return self

        def limit(self, *_args, **_kwargs):
            return self

        def execute(self):
            raise APIError(
                {
                    "message": "Could not find the table 'public.screening_runs' in the schema cache",
                    "code": "PGRST205",
                    "hint": None,
                    "details": None,
                }
            )

    class FakeClient:
        def table(self, name):
            assert name == "screening_runs"
            return FakeQuery()

    monkeypatch.setattr(client_module, "get_client", lambda: FakeClient())
    monkeypatch.setattr(client_module, "_HAS_SCREENING_TABLES", None)

    assert client_module.screenings_support_tables() is False
