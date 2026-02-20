"""Tests for festival schedule URL candidate building in main.py."""

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
