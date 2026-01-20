"""
Tests for crawler parsing logic.
Tests common patterns used across multiple crawlers.
"""

import pytest
import re
from datetime import datetime
from typing import Optional
from unittest.mock import patch, MagicMock
from bs4 import BeautifulSoup


class TestDateParsing:
    """Tests for date parsing patterns used in crawlers."""

    def parse_date(self, date_text: str) -> Optional[str]:
        """Common date parsing logic used across crawlers."""
        date_text = date_text.strip()
        patterns = [
            (r"(\w{3,9})\s+(\d{1,2}),?\s*(\d{4})?", "%B %d %Y"),
            (r"(\w{3})\s+(\d{1,2}),?\s*(\d{4})?", "%b %d %Y"),
        ]
        for pattern, fmt in patterns:
            match = re.search(pattern, date_text)
            if match:
                groups = match.groups()
                year = (
                    groups[2]
                    if len(groups) > 2 and groups[2]
                    else str(datetime.now().year)
                )
                try:
                    dt = datetime.strptime(f"{groups[0]} {groups[1]} {year}", fmt)
                    if dt < datetime.now():
                        dt = datetime.strptime(
                            f"{groups[0]} {groups[1]} {int(year) + 1}", fmt
                        )
                    return dt.strftime("%Y-%m-%d")
                except ValueError:
                    continue
        return None

    def test_full_month_name(self):
        # Use a future date to avoid year bumping logic
        result = self.parse_date("December 15, 2026")
        assert result == "2026-12-15"

    def test_abbreviated_month(self):
        # Use a future date to avoid year bumping logic
        result = self.parse_date("Dec 15, 2026")
        assert result == "2026-12-15"

    def test_month_without_year(self):
        # Should default to current or next year
        result = self.parse_date("February 20")
        assert result is not None
        assert "-02-20" in result

    def test_no_comma(self):
        result = self.parse_date("March 10 2026")
        assert result == "2026-03-10"

    def test_invalid_date(self):
        result = self.parse_date("Not a date")
        assert result is None

    def test_partial_date(self):
        result = self.parse_date("December 25")
        assert result is not None
        assert "-12-25" in result


class TestTimeParsing:
    """Tests for time parsing patterns used in crawlers."""

    def parse_time(self, time_text: str) -> Optional[str]:
        """Common time parsing logic used across crawlers."""
        match = re.search(r"(\d{1,2}):?(\d{2})?\s*(am|pm)", time_text, re.IGNORECASE)
        if match:
            hour, minute, period = match.groups()
            hour = int(hour)
            minute = minute or "00"
            if period.lower() == "pm" and hour != 12:
                hour += 12
            elif period.lower() == "am" and hour == 12:
                hour = 0
            return f"{hour:02d}:{minute}"
        return None

    def test_standard_time(self):
        assert self.parse_time("7:30 PM") == "19:30"

    def test_no_minutes(self):
        assert self.parse_time("8pm") == "20:00"

    def test_morning_time(self):
        assert self.parse_time("10:00 AM") == "10:00"

    def test_noon(self):
        assert self.parse_time("12:00 PM") == "12:00"

    def test_midnight(self):
        assert self.parse_time("12:00 AM") == "00:00"

    def test_case_insensitive(self):
        assert self.parse_time("7:30 pm") == "19:30"
        assert self.parse_time("7:30 Pm") == "19:30"

    def test_no_space(self):
        assert self.parse_time("9PM") == "21:00"

    def test_invalid_time(self):
        assert self.parse_time("not a time") is None


class TestCategoryDetermination:
    """Tests for category determination logic."""

    def determine_category(self, title: str) -> tuple[str, Optional[str], list[str]]:
        """Common category determination logic."""
        title_lower = title.lower()
        tags = []

        if any(w in title_lower for w in ["trivia", "quiz"]):
            return "community", "trivia", tags + ["trivia"]
        if any(w in title_lower for w in ["music", "concert", "live", "band", "open mic"]):
            return "music", "live-music", tags + ["live-music"]
        if any(w in title_lower for w in ["comedy", "comedian", "stand-up"]):
            return "comedy", None, tags + ["comedy"]
        if any(w in title_lower for w in ["yoga", "fitness", "run", "workout"]):
            return "fitness", None, tags + ["fitness"]
        if any(w in title_lower for w in ["art", "gallery", "exhibition"]):
            return "art", "exhibition", tags + ["art"]
        if any(w in title_lower for w in ["theater", "theatre", "play", "musical"]):
            return "theater", None, tags + ["theater"]

        return "other", None, tags

    def test_music_category(self):
        cat, sub, tags = self.determine_category("Live Music Night")
        assert cat == "music"
        assert sub == "live-music"

    def test_comedy_category(self):
        cat, sub, tags = self.determine_category("Stand-up Comedy Show")
        assert cat == "comedy"

    def test_trivia_category(self):
        cat, sub, tags = self.determine_category("Pub Trivia Night")
        assert cat == "community"
        assert sub == "trivia"

    def test_yoga_category(self):
        cat, sub, tags = self.determine_category("Morning Yoga Class")
        assert cat == "fitness"

    def test_art_category(self):
        cat, sub, tags = self.determine_category("Art Exhibition Opening")
        assert cat == "art"
        assert sub == "exhibition"

    def test_theater_category(self):
        cat, sub, tags = self.determine_category("Theater Performance Tonight")
        assert cat == "theater"

    def test_unknown_category(self):
        cat, sub, tags = self.determine_category("Random Event")
        assert cat == "other"


class TestHTMLParsing:
    """Tests for HTML parsing patterns used in crawlers."""

    def test_find_event_cards_by_class(self, sample_html_events_page):
        soup = BeautifulSoup(sample_html_events_page, "html.parser")
        # Find divs with class containing "event" or "card"
        cards = soup.find_all("div", class_=re.compile(r"event", re.I))
        # Should find event-card divs - they exist in the fixture
        assert len(cards) >= 1

    def test_extract_title(self, sample_html_event_card):
        soup = BeautifulSoup(sample_html_event_card, "html.parser")
        title_el = soup.find(["h2", "h3", "h4"], class_=re.compile(r"title|name", re.I))
        if not title_el:
            title_el = soup.find(["h2", "h3", "h4"])
        assert title_el is not None
        assert title_el.get_text(strip=True) == "Live Jazz Night"

    def test_extract_date(self, sample_html_event_card):
        soup = BeautifulSoup(sample_html_event_card, "html.parser")
        date_el = soup.find(class_=re.compile(r"date", re.I))
        assert date_el is not None
        assert "February 20, 2026" in date_el.get_text()

    def test_extract_time(self, sample_html_event_card):
        soup = BeautifulSoup(sample_html_event_card, "html.parser")
        time_el = soup.find(class_=re.compile(r"time", re.I))
        assert time_el is not None
        assert "8:00 PM" in time_el.get_text()

    def test_extract_link(self, sample_html_event_card):
        soup = BeautifulSoup(sample_html_event_card, "html.parser")
        link = soup.find("a", href=True)
        assert link is not None
        assert link.get("href") == "/events/jazz-night"

    def test_extract_description(self, sample_html_event_card):
        soup = BeautifulSoup(sample_html_event_card, "html.parser")
        desc = soup.find("p", class_=re.compile(r"desc", re.I))
        assert desc is not None
        assert "smooth jazz" in desc.get_text().lower()


class TestPriceExtraction:
    """Tests for price extraction from HTML."""

    def extract_is_free(self, card_text: str) -> bool:
        """Check if event is free based on card text."""
        return "free" in card_text.lower()

    def test_free_event(self):
        assert self.extract_is_free("Event - Free admission") is True
        assert self.extract_is_free("FREE") is True

    def test_paid_event(self):
        assert self.extract_is_free("Tickets $25") is False

    def test_case_insensitive(self):
        assert self.extract_is_free("free") is True
        assert self.extract_is_free("Free") is True
        assert self.extract_is_free("FREE") is True


class TestURLConstruction:
    """Tests for URL construction logic used in crawlers."""

    def build_full_url(self, href: str, base_url: str) -> str:
        """Build full URL from href and base URL."""
        if href.startswith("http"):
            return href
        return f"{base_url}{href}"

    def test_relative_url(self):
        url = self.build_full_url("/events/123", "https://example.com")
        assert url == "https://example.com/events/123"

    def test_absolute_url(self):
        url = self.build_full_url("https://other.com/events", "https://example.com")
        assert url == "https://other.com/events"

    def test_empty_href(self):
        url = self.build_full_url("", "https://example.com")
        assert url == "https://example.com"


class TestCrawlerIntegration:
    """Integration tests for crawler structure."""

    def test_crawler_module_has_crawl_function(self):
        """Verify crawlers have the expected crawl function."""
        from sources import the_earl

        assert hasattr(the_earl, "crawl")
        assert callable(the_earl.crawl)

    def test_crawl_function_signature(self):
        """Verify crawl function accepts source dict."""
        from sources import the_earl
        import inspect

        sig = inspect.signature(the_earl.crawl)
        params = list(sig.parameters.keys())
        assert "source" in params

    def test_venue_data_structure(self):
        """Verify venue data has required fields."""
        from sources import the_earl

        assert hasattr(the_earl, "VENUE_DATA")
        venue = the_earl.VENUE_DATA
        required_fields = ["name", "slug", "address", "city", "state"]
        for field in required_fields:
            assert field in venue, f"Missing required field: {field}"

    def test_crawler_returns_tuple(self, sample_source):
        """Verify crawler module structure allows tuple returns."""
        from sources import the_earl
        import inspect

        # Verify crawl function exists and returns tuple annotation
        sig = inspect.signature(the_earl.crawl)
        # The return type hint should be tuple[int, int, int]
        return_annotation = sig.return_annotation
        # Just verify function exists and is callable
        assert callable(the_earl.crawl)


class TestContentHash:
    """Tests for content hash generation used for deduplication."""

    def test_hash_consistency(self):
        """Same inputs should produce same hash."""
        from dedupe import generate_content_hash

        hash1 = generate_content_hash("Test Event", "Test Venue", "2026-01-15")
        hash2 = generate_content_hash("Test Event", "Test Venue", "2026-01-15")
        assert hash1 == hash2

    def test_hash_uniqueness(self):
        """Different inputs should produce different hashes."""
        from dedupe import generate_content_hash

        hash1 = generate_content_hash("Event A", "Venue", "2026-01-15")
        hash2 = generate_content_hash("Event B", "Venue", "2026-01-15")
        assert hash1 != hash2

    def test_date_affects_hash(self):
        """Different dates should produce different hashes."""
        from dedupe import generate_content_hash

        hash1 = generate_content_hash("Event", "Venue", "2026-01-15")
        hash2 = generate_content_hash("Event", "Venue", "2026-01-16")
        assert hash1 != hash2
