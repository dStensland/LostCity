"""Tests for festival schedule URL candidate building in main.py."""

from types import SimpleNamespace

import main
from main import _build_festival_schedule_candidate_urls


def test_prioritizes_schedule_like_urls():
    urls = _build_festival_schedule_candidate_urls(
        website="https://examplefest.com",
        source_url="https://examplefest.com",
        profile_urls=["https://examplefest.com/program"],
    )

    assert urls
    assert any(marker in urls[0] for marker in ("schedule", "lineup", "program", "agenda", "session", "calendar"))


def test_dedupes_equivalent_root_urls():
    urls = _build_festival_schedule_candidate_urls(
        website="https://examplefest.com/",
        source_url="https://examplefest.com",
        profile_urls=["https://examplefest.com/"],
        max_candidates=20,
    )

    root_urls = [url for url in urls if url.rstrip("/") == "https://examplefest.com"]
    assert len(root_urls) == 1


def test_keeps_root_url_in_default_candidate_budget():
    urls = _build_festival_schedule_candidate_urls(
        website="https://examplefest.com/",
        source_url="https://examplefest.com",
        profile_urls=[],
    )

    assert any(url.rstrip("/") == "https://examplefest.com" for url in urls)


def test_includes_discovered_links_when_enabled(monkeypatch):
    monkeypatch.setattr(
        main,
        "_discover_festival_schedule_links",
        lambda seed_urls, max_links=24: [
            "https://examplefest.com/things-to-do/programming/events/"
        ],
    )

    urls = _build_festival_schedule_candidate_urls(
        website="https://examplefest.com/",
        source_url="https://examplefest.com",
        profile_urls=[],
        max_candidates=20,
        discover_links=True,
    )

    assert "https://examplefest.com/things-to-do/programming/events" in [u.rstrip("/") for u in urls]


def test_run_festival_schedules_uses_profile_render_js(monkeypatch):
    class _ExecResult:
        def __init__(self, data):
            self.data = data

    class _TableQuery:
        def __init__(self, data):
            self._data = data
            self.not_ = self

        def select(self, *_args, **_kwargs):
            return self

        def is_(self, *_args, **_kwargs):
            return self

        def order(self, *_args, **_kwargs):
            return self

        def in_(self, *_args, **_kwargs):
            return self

        def execute(self):
            return _ExecResult(self._data)

    class _Client:
        def table(self, name):
            if name == "festivals":
                return _TableQuery(
                    [
                        {
                            "slug": "render-js-fest",
                            "name": "Render JS Fest",
                            "website": "https://examplefest.com",
                        }
                    ]
                )
            if name == "sources":
                return _TableQuery(
                    [
                        {
                            "slug": "render-js-fest",
                            "url": "https://examplefest.com/program",
                            "owner_portal_id": "portal-1",
                        }
                    ]
                )
            raise AssertionError(f"Unexpected table lookup: {name}")

    captured = {}

    monkeypatch.setattr(main, "time", SimpleNamespace(sleep=lambda *_args, **_kwargs: None))
    monkeypatch.setattr(main, "_build_festival_schedule_candidate_urls", lambda **_kwargs: ["https://examplefest.com/program"])

    def fake_crawl_festival_schedule(**kwargs):
        captured.update(kwargs)
        return 1, 1, 0

    monkeypatch.setattr("db.get_client", lambda: _Client())
    monkeypatch.setattr(main, "logger", SimpleNamespace(info=lambda *args, **kwargs: None, warning=lambda *args, **kwargs: None, debug=lambda *args, **kwargs: None))
    monkeypatch.setattr("pipeline.loader.load_profile", lambda _slug: SimpleNamespace(
        discovery=SimpleNamespace(
            urls=["https://examplefest.com/program"],
            fetch=SimpleNamespace(render_js=True),
        ),
        detail=SimpleNamespace(fetch=SimpleNamespace(render_js=False)),
    ))
    monkeypatch.setattr("crawl_festival_schedule.crawl_festival_schedule", fake_crawl_festival_schedule)

    stats = main.run_festival_schedules()

    assert captured["slug"] == "render-js-fest"
    assert captured["url"] == "https://examplefest.com/program"
    assert captured["render_js"] is True
    assert stats["festivals_with_data"] == 1
