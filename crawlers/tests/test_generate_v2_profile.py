"""
Tests for generate_v2_profile.py — reads legacy Python crawler source files
and generates v2 YAML profiles.

TDD: these tests are written before the implementation.
"""

from __future__ import annotations

import sys
import textwrap
from pathlib import Path

import yaml


# ---------------------------------------------------------------------------
# Minimal helper to import the script under test without side-effects.
# The script lives at crawlers/scripts/generate_v2_profile.py, which is NOT
# on sys.path by default.  We add scripts/ to sys.path before importing.
# ---------------------------------------------------------------------------

SCRIPTS_DIR = Path(__file__).parent.parent / "scripts"
sys.path.insert(0, str(SCRIPTS_DIR))  # noqa: E402

from generate_v2_profile import extract_profile_data, generate_v2_yaml  # noqa: E402


# ---------------------------------------------------------------------------
# Fixtures — representative source code snippets
# ---------------------------------------------------------------------------

STATIC_SOURCE = textwrap.dedent("""\
    \"\"\"Crawler for A Cappella Books.\"\"\"

    import requests
    from bs4 import BeautifulSoup
    from db import get_or_create_venue, insert_event

    BASE_URL = "https://www.acappellabooks.com"
    EVENTS_URL = f"{BASE_URL}/events.php"

    VENUE_DATA = {
        "name": "A Cappella Books",
        "slug": "a-cappella-books",
        "address": "208 Haralson Ave NE",
        "neighborhood": "Inman Park",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30307",
        "venue_type": "bookstore",
        "website": BASE_URL,
    }

    def crawl(source):
        pass
""")

PLAYWRIGHT_SOURCE = textwrap.dedent("""\
    \"\"\"Crawler for High Museum of Art.\"\"\"

    from playwright.sync_api import sync_playwright
    from db import get_or_create_venue, insert_event

    BASE_URL = "https://high.org"
    EVENTS_URL = f"{BASE_URL}/events/"

    VENUE_DATA = {
        "name": "High Museum of Art",
        "slug": "high-museum",
        "address": "1280 Peachtree St NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30309",
        "venue_type": "museum",
        "website": BASE_URL,
    }

    def crawl(source):
        with sync_playwright() as p:
            pass
""")

COMEDY_SOURCE = textwrap.dedent("""\
    \"\"\"Crawler for The Punchline Comedy Club.\"\"\"

    import requests
    from db import get_or_create_venue, insert_event

    BASE_URL = "https://www.punchline.com"
    CALENDAR_URL = f"{BASE_URL}/calendar"

    VENUE_DATA = {
        "name": "The Punchline Comedy Club",
        "slug": "punchline-comedy-club",
        "address": "280 Hilderbrand Dr NE",
        "neighborhood": "Sandy Springs",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30328",
        "venue_type": "comedy_club",
        "website": BASE_URL,
    }

    def crawl(source):
        pass
""")

EXPLICIT_CATEGORY_SOURCE = textwrap.dedent("""\
    \"\"\"Crawler for Some Comedy Venue.\"\"\"

    import requests
    from db import get_or_create_venue, insert_event

    BASE_URL = "https://example.com"

    VENUE_DATA = {
        "name": "Some Venue",
        "slug": "some-venue",
        "city": "Atlanta",
        "state": "GA",
        "venue_type": "venue",
        "website": BASE_URL,
    }

    def crawl(source):
        event = {
            "title": "Stand-Up Night",
            "category": "comedy",
        }
        insert_event(event)
""")

NO_VENUE_DATA_SOURCE = textwrap.dedent("""\
    \"\"\"Crawler with no VENUE_DATA dict.\"\"\"

    import requests

    BASE_URL = "https://example.com"

    def crawl(source):
        pass
""")

MULTILINE_URL_SOURCE = textwrap.dedent("""\
    \"\"\"Crawler with a plain string URL constant.\"\"\"

    import requests
    from db import get_or_create_venue

    BASE_URL = "https://www.fernbankmuseum.org"

    VENUE_DATA = {
        "name": "Fernbank Museum",
        "slug": "fernbank-museum",
        "city": "Atlanta",
        "state": "GA",
        "venue_type": "museum",
        "website": BASE_URL,
    }

    def crawl(source):
        pass
""")


# ===========================================================================
# 1. extract_profile_data — VENUE_DATA extraction
# ===========================================================================

class TestExtractVenueData:
    def test_extracts_venue_data_from_static_source(self):
        data = extract_profile_data(STATIC_SOURCE, "a_cappella_books")
        assert data["venue_data"]["name"] == "A Cappella Books"
        assert data["venue_data"]["slug"] == "a-cappella-books"
        assert data["venue_data"]["venue_type"] == "bookstore"

    def test_extracts_venue_data_from_playwright_source(self):
        data = extract_profile_data(PLAYWRIGHT_SOURCE, "high_museum")
        assert data["venue_data"]["name"] == "High Museum of Art"
        assert data["venue_data"]["slug"] == "high-museum"
        assert data["venue_data"]["venue_type"] == "museum"

    def test_returns_empty_venue_data_when_not_present(self):
        data = extract_profile_data(NO_VENUE_DATA_SOURCE, "no_venue")
        assert data["venue_data"] == {}

    def test_extracts_nested_venue_data_with_hours(self):
        source = textwrap.dedent("""\
            VENUE_DATA = {
                "name": "Test Venue",
                "slug": "test-venue",
                "venue_type": "bar",
                "hours": {
                    "monday": "closed",
                    "tuesday": "17:00-23:00",
                },
            }
        """)
        data = extract_profile_data(source, "test_venue")
        assert data["venue_data"]["hours"]["monday"] == "closed"


# ===========================================================================
# 2. extract_profile_data — fetch method detection
# ===========================================================================

class TestFetchMethodDetection:
    def test_detects_playwright_via_import(self):
        data = extract_profile_data(PLAYWRIGHT_SOURCE, "high_museum")
        assert data["fetch_method"] == "playwright"

    def test_detects_playwright_via_sync_playwright_string(self):
        source = textwrap.dedent("""\
            import requests
            # Uses sync_playwright internally
            VENUE_DATA = {"name": "X", "slug": "x", "venue_type": "bar"}
            def crawl(source):
                from playwright.sync_api import sync_playwright
                with sync_playwright() as p:
                    pass
        """)
        data = extract_profile_data(source, "some_venue")
        assert data["fetch_method"] == "playwright"

    def test_detects_static_requests_only(self):
        data = extract_profile_data(STATIC_SOURCE, "a_cappella_books")
        assert data["fetch_method"] == "static"

    def test_detects_static_when_no_http_imports(self):
        source = textwrap.dedent("""\
            from db import get_or_create_venue
            VENUE_DATA = {"name": "Quiet Venue", "slug": "quiet", "venue_type": "gallery"}
            def crawl(source):
                pass
        """)
        data = extract_profile_data(source, "quiet_venue")
        assert data["fetch_method"] == "static"


# ===========================================================================
# 3. extract_profile_data — URL constant extraction
# ===========================================================================

class TestUrlExtraction:
    def test_extracts_base_url(self):
        data = extract_profile_data(STATIC_SOURCE, "a_cappella_books")
        assert data["urls"]["BASE_URL"] == "https://www.acappellabooks.com"

    def test_extracts_events_url(self):
        data = extract_profile_data(STATIC_SOURCE, "a_cappella_books")
        # EVENTS_URL uses an f-string referencing BASE_URL; we resolve to the
        # literal value if possible, or at least capture the raw string.
        assert "EVENTS_URL" in data["urls"]
        assert "acappellabooks.com" in data["urls"]["EVENTS_URL"]

    def test_extracts_calendar_url(self):
        data = extract_profile_data(COMEDY_SOURCE, "punchline_comedy_club")
        assert "CALENDAR_URL" in data["urls"]
        assert "calendar" in data["urls"]["CALENDAR_URL"]

    def test_extracts_base_url_only_when_no_events_url(self):
        data = extract_profile_data(MULTILINE_URL_SOURCE, "fernbank_museum")
        assert data["urls"]["BASE_URL"] == "https://www.fernbankmuseum.org"
        assert "EVENTS_URL" not in data["urls"]


# ===========================================================================
# 4. extract_profile_data — category inference
# ===========================================================================

class TestCategoryInference:
    def test_infers_category_from_venue_type_museum(self):
        data = extract_profile_data(PLAYWRIGHT_SOURCE, "high_museum")
        assert data["category"] == "art"

    def test_infers_category_from_venue_type_bookstore(self):
        data = extract_profile_data(STATIC_SOURCE, "a_cappella_books")
        assert data["category"] == "words"

    def test_infers_category_from_venue_type_comedy_club(self):
        data = extract_profile_data(COMEDY_SOURCE, "punchline_comedy_club")
        assert data["category"] == "comedy"

    def test_extracts_explicit_category_from_event_dict(self):
        data = extract_profile_data(EXPLICIT_CATEGORY_SOURCE, "some_venue")
        assert data["category"] == "comedy"

    def test_returns_none_category_when_unknown_venue_type(self):
        source = textwrap.dedent("""\
            VENUE_DATA = {
                "name": "Mystery Place",
                "slug": "mystery-place",
                "venue_type": "zeppelin_hangar",
            }
        """)
        data = extract_profile_data(source, "mystery_place")
        assert data["category"] is None


# ===========================================================================
# 5. generate_v2_yaml — YAML output
# ===========================================================================

class TestGenerateV2Yaml:
    def _make_data(self, **overrides):
        base = {
            "slug": "test-venue",
            "name": "Test Venue",
            "fetch_method": "static",
            "urls": {"BASE_URL": "https://test-venue.com", "EVENTS_URL": "https://test-venue.com/events"},
            "category": "music",
            "venue_data": {
                "name": "Test Venue",
                "slug": "test-venue",
                "address": "123 Main St",
                "city": "Atlanta",
                "state": "GA",
                "venue_type": "music_venue",
                "website": "https://test-venue.com",
            },
        }
        base.update(overrides)
        return base

    def test_produces_parseable_yaml(self):
        data = self._make_data()
        yaml_str = generate_v2_yaml(data)
        parsed = yaml.safe_load(yaml_str)
        assert parsed is not None
        assert isinstance(parsed, dict)

    def test_yaml_has_version_2(self):
        data = self._make_data()
        yaml_str = generate_v2_yaml(data)
        parsed = yaml.safe_load(yaml_str)
        assert parsed["version"] == 2

    def test_yaml_has_correct_slug(self):
        data = self._make_data(slug="high-museum")
        yaml_str = generate_v2_yaml(data)
        parsed = yaml.safe_load(yaml_str)
        assert parsed["slug"] == "high-museum"

    def test_yaml_fetch_method_static(self):
        data = self._make_data(fetch_method="static")
        yaml_str = generate_v2_yaml(data)
        parsed = yaml.safe_load(yaml_str)
        assert parsed["fetch"]["method"] == "static"

    def test_yaml_fetch_method_playwright(self):
        data = self._make_data(fetch_method="playwright")
        yaml_str = generate_v2_yaml(data)
        parsed = yaml.safe_load(yaml_str)
        assert parsed["fetch"]["method"] == "playwright"

    def test_yaml_fetch_urls_present(self):
        data = self._make_data()
        yaml_str = generate_v2_yaml(data)
        parsed = yaml.safe_load(yaml_str)
        assert "https://test-venue.com/events" in parsed["fetch"]["urls"]

    def test_yaml_uses_base_url_when_no_events_url(self):
        data = self._make_data(urls={"BASE_URL": "https://test-venue.com"})
        yaml_str = generate_v2_yaml(data)
        parsed = yaml.safe_load(yaml_str)
        assert "https://test-venue.com" in parsed["fetch"]["urls"]

    def test_yaml_has_venue_block(self):
        data = self._make_data()
        yaml_str = generate_v2_yaml(data)
        parsed = yaml.safe_load(yaml_str)
        assert "venue" in parsed
        assert parsed["venue"]["name"] == "Test Venue"

    def test_yaml_has_defaults_category(self):
        data = self._make_data(category="comedy")
        yaml_str = generate_v2_yaml(data)
        parsed = yaml.safe_load(yaml_str)
        assert parsed["defaults"]["category"] == "comedy"

    def test_yaml_defaults_category_none_when_unknown(self):
        data = self._make_data(category=None)
        yaml_str = generate_v2_yaml(data)
        parsed = yaml.safe_load(yaml_str)
        # category should be absent or null — either is fine
        defaults = parsed.get("defaults", {})
        assert defaults.get("category") is None

    def test_yaml_has_parse_method_llm(self):
        data = self._make_data()
        yaml_str = generate_v2_yaml(data)
        parsed = yaml.safe_load(yaml_str)
        assert parsed["parse"]["method"] == "llm"

    def test_yaml_has_entity_lanes(self):
        data = self._make_data()
        yaml_str = generate_v2_yaml(data)
        parsed = yaml.safe_load(yaml_str)
        assert "entity_lanes" in parsed
        assert "events" in parsed["entity_lanes"]

    def test_yaml_is_string(self):
        data = self._make_data()
        result = generate_v2_yaml(data)
        assert isinstance(result, str)
        assert len(result) > 0


# ===========================================================================
# 6. Round-trip: extract then generate
# ===========================================================================

class TestRoundTrip:
    def test_static_source_round_trip(self):
        data = extract_profile_data(STATIC_SOURCE, "a_cappella_books")
        data["slug"] = "a-cappella-books"
        data["name"] = data["venue_data"].get("name", "A Cappella Books")
        yaml_str = generate_v2_yaml(data)
        parsed = yaml.safe_load(yaml_str)

        assert parsed["version"] == 2
        assert parsed["slug"] == "a-cappella-books"
        assert parsed["fetch"]["method"] == "static"
        assert parsed["defaults"]["category"] == "words"

    def test_playwright_source_round_trip(self):
        data = extract_profile_data(PLAYWRIGHT_SOURCE, "high_museum")
        data["slug"] = "high-museum"
        data["name"] = data["venue_data"].get("name", "High Museum of Art")
        yaml_str = generate_v2_yaml(data)
        parsed = yaml.safe_load(yaml_str)

        assert parsed["fetch"]["method"] == "playwright"
        assert parsed["defaults"]["category"] == "art"
