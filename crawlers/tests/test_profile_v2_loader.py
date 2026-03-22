"""
Tests for v2 profile schema and v1→v2 normalizing loader.
"""

from __future__ import annotations

import json
import tempfile
from pathlib import Path

import pytest

from pipeline.models import (
    SourceProfileV2,
    FetchConfigV2,
    ParseConfigV2,
    VenueConfig,
    ScheduleConfig,
    DefaultsConfigV2,
)
from pipeline.loader import normalize_to_v2, load_profile


# ---------------------------------------------------------------------------
# 1. v2 profile with all fields parses cleanly
# ---------------------------------------------------------------------------

def test_v2_full_profile_parses():
    data = {
        "version": 2,
        "slug": "high-museum",
        "name": "High Museum of Art",
        "city": "atlanta",
        "portal_id": "arts-portal",
        "fetch": {
            "method": "playwright",
            "urls": ["https://high.org/events"],
            "wait_for": ".event-list",
            "scroll": True,
        },
        "parse": {
            "method": "llm",
            "module": "sources.high_museum",
        },
        "entity_lanes": ["events", "exhibitions"],
        "venue": {
            "name": "High Museum of Art",
            "address": "1280 Peachtree St NE",
            "neighborhood": "Midtown",
            "city": "Atlanta",
            "state": "GA",
            "zip": "30309",
            "venue_type": "museum",
            "website": "https://high.org",
            "lat": 33.7899,
            "lng": -84.3853,
        },
        "defaults": {
            "category": "arts",
            "tags": ["museum", "visual-art"],
        },
        "schedule": {
            "frequency": "weekly",
            "priority": "high",
        },
        "detail": {
            "enabled": True,
            "use_jsonld": True,
            "use_open_graph": True,
            "use_heuristic": True,
            "use_llm": True,
        },
    }

    profile = SourceProfileV2(**data)

    assert profile.version == 2
    assert profile.slug == "high-museum"
    assert profile.name == "High Museum of Art"
    assert profile.city == "atlanta"
    assert profile.portal_id == "arts-portal"
    assert profile.fetch.method == "playwright"
    assert profile.fetch.urls == ["https://high.org/events"]
    assert profile.fetch.wait_for == ".event-list"
    assert profile.fetch.scroll is True
    assert profile.parse.method == "llm"
    assert profile.parse.module == "sources.high_museum"
    assert profile.entity_lanes == ["events", "exhibitions"]
    assert profile.venue.address == "1280 Peachtree St NE"
    assert profile.venue.lat == pytest.approx(33.7899)
    assert profile.venue.lng == pytest.approx(-84.3853)
    assert profile.defaults.category == "arts"
    assert profile.defaults.tags == ["museum", "visual-art"]
    assert profile.schedule.frequency == "weekly"
    assert profile.schedule.priority == "high"
    assert profile.detail.enabled is True


# ---------------------------------------------------------------------------
# 2. Minimal v2 profile has sensible defaults
# ---------------------------------------------------------------------------

def test_v2_minimal_profile_defaults():
    profile = SourceProfileV2(slug="test-venue", name="Test Venue")

    assert profile.version == 2
    assert profile.city == "atlanta"
    assert profile.portal_id is None
    assert profile.fetch.method == "static"
    assert profile.fetch.urls == []
    assert profile.fetch.wait_for is None
    assert profile.fetch.scroll is False
    assert profile.parse.method == "llm"
    assert profile.parse.module is None
    assert profile.parse.adapter is None
    assert profile.entity_lanes == ["events"]
    assert profile.venue.name is None
    assert profile.defaults.category is None
    assert profile.defaults.tags == []
    assert profile.schedule.frequency == "daily"
    assert profile.schedule.priority == "normal"


# ---------------------------------------------------------------------------
# 3. v1 html profile normalizes to v2 (static + llm)
# ---------------------------------------------------------------------------

def test_normalize_v1_html_to_v2():
    v1_data = {
        "version": 1,
        "slug": "some-gallery",
        "name": "Some Gallery",
        "integration_method": "html",
        "data_goals": ["events", "exhibits"],
        "discovery": {
            "urls": ["https://some-gallery.com/events"],
            "fetch": {"render_js": False},
        },
        "defaults": {"category": "arts", "tags": ["gallery"]},
    }

    profile = normalize_to_v2(v1_data)

    assert profile.version == 2
    assert profile.slug == "some-gallery"
    assert profile.fetch.method == "static"
    assert profile.parse.method == "llm"
    assert profile.fetch.urls == ["https://some-gallery.com/events"]
    assert "events" in profile.entity_lanes
    assert "exhibitions" in profile.entity_lanes
    assert profile.defaults.category == "arts"
    assert profile.defaults.tags == ["gallery"]


# ---------------------------------------------------------------------------
# 4. v1 api profile normalizes to v2 (api + api_adapter)
# ---------------------------------------------------------------------------

def test_normalize_v1_api_to_v2():
    v1_data = {
        "version": 1,
        "slug": "ticketmaster-atl",
        "name": "Ticketmaster Atlanta",
        "integration_method": "api",
        "data_goals": ["events", "tickets"],
        "discovery": {
            "urls": [],
            "api": {"adapter": "ticketmaster", "params": {"city": "Atlanta"}},
        },
    }

    profile = normalize_to_v2(v1_data)

    assert profile.fetch.method == "api"
    assert profile.parse.method == "api_adapter"
    # tickets is not in the data_goals mapping — should fall through gracefully
    assert "events" in profile.entity_lanes


# ---------------------------------------------------------------------------
# 5. v1 playwright profile normalizes (render_js=True → playwright)
# ---------------------------------------------------------------------------

def test_normalize_v1_playwright_render_js_override():
    v1_data = {
        "version": 1,
        "slug": "fox-theatre",
        "name": "Fox Theatre",
        "integration_method": "html",  # declared html, but render_js=True overrides
        "data_goals": ["events"],
        "discovery": {
            "urls": ["https://foxtheatre.org/events"],
            "fetch": {"render_js": True},
        },
    }

    profile = normalize_to_v2(v1_data)

    assert profile.fetch.method == "playwright"
    assert profile.parse.method == "llm"
    assert profile.fetch.urls == ["https://foxtheatre.org/events"]


def test_normalize_v1_playwright_integration_method():
    v1_data = {
        "version": 1,
        "slug": "some-spa",
        "name": "Some SPA Site",
        "integration_method": "playwright",
        "data_goals": ["events"],
        "discovery": {
            "urls": ["https://spa-site.com/calendar"],
            "fetch": {"render_js": False},
        },
    }

    profile = normalize_to_v2(v1_data)

    assert profile.fetch.method == "playwright"
    assert profile.parse.method == "llm"


def test_normalize_v1_llm_crawler_to_v2():
    v1_data = {
        "version": 1,
        "slug": "complex-site",
        "name": "Complex Site",
        "integration_method": "llm_crawler",
        "data_goals": ["events", "classes"],
        "discovery": {
            "urls": ["https://complex-site.com"],
            "fetch": {"render_js": False},
        },
    }

    profile = normalize_to_v2(v1_data)

    assert profile.fetch.method == "static"
    assert profile.parse.method == "llm"
    assert "programs" in profile.entity_lanes


# ---------------------------------------------------------------------------
# 6. v2 profile passes through without re-normalization
# ---------------------------------------------------------------------------

def test_v2_passthrough_without_renormalization():
    v2_data = {
        "version": 2,
        "slug": "already-v2",
        "name": "Already V2 Source",
        "city": "atlanta",
        "fetch": {"method": "api", "urls": ["https://api.source.com/events"]},
        "parse": {"method": "api_adapter", "adapter": "my_adapter"},
        "entity_lanes": ["events", "programs"],
    }

    profile = normalize_to_v2(v2_data)

    # Should preserve the v2 values as-is, not overwrite fetch/parse
    assert profile.fetch.method == "api"
    assert profile.parse.method == "api_adapter"
    assert profile.parse.adapter == "my_adapter"
    assert profile.entity_lanes == ["events", "programs"]


# ---------------------------------------------------------------------------
# load_profile() integration test (writes temp JSON, loads via loader)
# ---------------------------------------------------------------------------

def test_load_profile_returns_v2():
    v1_profile = {
        "version": 1,
        "slug": "test-source",
        "name": "Test Source",
        "integration_method": "html",
        "data_goals": ["events"],
        "discovery": {
            "urls": ["https://test-source.com/events"],
            "fetch": {"render_js": False},
        },
    }

    with tempfile.TemporaryDirectory() as tmpdir:
        profile_path = Path(tmpdir) / "test-source.json"
        profile_path.write_text(json.dumps(v1_profile), encoding="utf-8")

        result = load_profile("test-source", base_dir=Path(tmpdir))

    assert isinstance(result, SourceProfileV2)
    assert result.slug == "test-source"
    assert result.fetch.method == "static"
    assert result.parse.method == "llm"


def test_load_profile_v2_json_passthrough():
    v2_profile = {
        "version": 2,
        "slug": "native-v2",
        "name": "Native V2 Source",
        "fetch": {"method": "playwright", "urls": ["https://native.com"]},
        "parse": {"method": "llm"},
    }

    with tempfile.TemporaryDirectory() as tmpdir:
        profile_path = Path(tmpdir) / "native-v2.json"
        profile_path.write_text(json.dumps(v2_profile), encoding="utf-8")

        result = load_profile("native-v2", base_dir=Path(tmpdir))

    assert isinstance(result, SourceProfileV2)
    assert result.fetch.method == "playwright"
    assert result.parse.method == "llm"
