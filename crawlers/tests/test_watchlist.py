"""Tests for the flagship watchlist module.

TDD: these tests are written before the implementation.
Run with: python3 -m pytest tests/test_watchlist.py -v
"""

from __future__ import annotations

import watchlist
from watchlist import FLAGSHIP_SOURCES, get_watchlist_status


def test_flagship_sources_exist():
    """Key slugs must be present in FLAGSHIP_SOURCES."""
    slugs = {s["slug"] for s in FLAGSHIP_SOURCES}

    # Theater
    assert "alliance-theatre" in slugs
    assert "dads-garage" in slugs
    assert "7-stages" in slugs
    assert "theatrical-outfit" in slugs
    assert "horizon-theatre" in slugs
    assert "puppetry-arts" in slugs

    # Music
    assert "terminal-west" in slugs
    assert "variety-playhouse" in slugs
    assert "eddies-attic" in slugs
    assert "tabernacle" in slugs
    assert "the-masquerade" in slugs
    assert "the-earl" in slugs
    assert "city-winery-atlanta" in slugs
    assert "aisle5" in slugs
    assert "the-eastern" in slugs
    assert "buckhead-theatre" in slugs
    assert "fox-theatre" in slugs
    assert "coca-cola-roxy" in slugs

    # Film
    assert "plaza-theatre" in slugs
    assert "tara-theatre" in slugs
    assert "starlight-drive-in" in slugs
    assert "landmark-midtown" in slugs

    # Arts
    assert "high-museum" in slugs
    assert "atlanta-contemporary" in slugs
    assert "atlanta-botanical-garden" in slugs

    # Family
    assert "georgia-aquarium" in slugs
    assert "fernbank" in slugs
    assert "childrens-museum" in slugs

    # Sports
    assert "truist-park" in slugs
    assert "state-farm-arena" in slugs

    # Civic
    assert "hands-on-atlanta" in slugs
    assert "atlanta-community-food-bank" in slugs


def test_flagship_has_required_fields():
    """Every entry in FLAGSHIP_SOURCES must have all required fields."""
    required = {"slug", "name", "category", "min_events_30d"}
    for source in FLAGSHIP_SOURCES:
        missing = required - source.keys()
        assert not missing, f"Source {source.get('slug', '?')} missing fields: {missing}"
        # slug and name must be non-empty strings
        assert isinstance(source["slug"], str) and source["slug"], (
            f"slug must be a non-empty string for {source}"
        )
        assert isinstance(source["name"], str) and source["name"], (
            f"name must be a non-empty string for {source}"
        )
        # min_events_30d must be a positive int
        assert isinstance(source["min_events_30d"], int) and source["min_events_30d"] > 0, (
            f"min_events_30d must be a positive int for {source['slug']}"
        )


def test_get_watchlist_status_flags_zero_events(monkeypatch):
    """A source returning 0 events must produce a critical alert."""
    # Patch _count_future_events so the first flagship returns 0, rest return 99
    target_slug = FLAGSHIP_SOURCES[0]["slug"]

    def fake_count(slug: str) -> int:
        return 0 if slug == target_slug else 99

    monkeypatch.setattr(watchlist, "_count_future_events", fake_count)

    alerts = get_watchlist_status()

    critical = [a for a in alerts if a.slug == target_slug and a.severity == "critical"]
    assert critical, (
        f"Expected a critical alert for {target_slug} with 0 events, got: {alerts}"
    )
    alert = critical[0]
    assert alert.actual_count == 0
    assert alert.severity == "critical"
    assert target_slug in alert.message or alert.name in alert.message


def test_get_watchlist_status_no_alert_when_healthy(monkeypatch):
    """No alerts should be produced when every source returns >= its minimum.

    The highest min_events_30d across all flagship sources is 20 (hands-on-atlanta),
    so returning 25 satisfies every source's threshold.
    """
    monkeypatch.setattr(watchlist, "_count_future_events", lambda slug: 25)

    alerts = get_watchlist_status()

    assert alerts == [], f"Expected no alerts when all sources are healthy, got: {alerts}"


def test_get_watchlist_status_warning_below_min(monkeypatch):
    """A source below its minimum (but > 0) must produce a warning alert."""
    # Find a source whose min_events_30d > 1 so we can set count to 1
    target = next(s for s in FLAGSHIP_SOURCES if s["min_events_30d"] > 1)

    def fake_count(slug: str) -> int:
        return 1 if slug == target["slug"] else 99

    monkeypatch.setattr(watchlist, "_count_future_events", fake_count)

    alerts = get_watchlist_status()

    warnings = [a for a in alerts if a.slug == target["slug"] and a.severity == "warning"]
    assert warnings, (
        f"Expected a warning for {target['slug']} with count=1 < min={target['min_events_30d']}"
    )
    alert = warnings[0]
    assert alert.actual_count == 1
    assert alert.expected_min == target["min_events_30d"]
