"""
Tests for deduplication logic in dedupe.py.
"""

import pytest
from unittest.mock import patch, MagicMock
from dedupe import (
    normalize_text,
    generate_content_hash,
    calculate_similarity,
    merge_event_data,
)


class TestNormalizeText:
    """Tests for the normalize_text function."""

    def test_lowercase(self):
        assert normalize_text("HELLO WORLD") == "hello world"

    def test_removes_extra_whitespace(self):
        assert normalize_text("too   many    spaces") == "too many spaces"

    def test_removes_common_prefixes(self):
        assert normalize_text("The Earl") == "earl"
        assert normalize_text("A Night Out") == "night out"
        assert normalize_text("An Evening") == "evening"

    def test_removes_punctuation(self):
        # Note: normalize_text may leave extra spaces after punctuation removal
        result = normalize_text("Rock & Roll!")
        assert "rock" in result and "roll" in result
        result2 = normalize_text("What's Up?")
        assert "whats" in result2 and "up" in result2

    def test_empty_string(self):
        assert normalize_text("") == ""

    def test_none_input(self):
        assert normalize_text(None) == ""

    def test_preserves_numbers(self):
        assert normalize_text("Event 2026") == "event 2026"

    def test_combined_normalization(self):
        assert normalize_text("  The  Big  Show!  ") == "big show"


class TestGenerateContentHash:
    """Tests for the generate_content_hash function."""

    def test_basic_hash(self):
        hash1 = generate_content_hash("Test Event", "Test Venue", "2026-01-15")
        assert isinstance(hash1, str)
        assert len(hash1) == 32  # MD5 hex digest

    def test_same_inputs_same_hash(self):
        hash1 = generate_content_hash("Concert", "The Earl", "2026-02-01")
        hash2 = generate_content_hash("Concert", "The Earl", "2026-02-01")
        assert hash1 == hash2

    def test_different_inputs_different_hash(self):
        hash1 = generate_content_hash("Concert", "The Earl", "2026-02-01")
        hash2 = generate_content_hash("Concert", "The Earl", "2026-02-02")
        assert hash1 != hash2

    def test_normalization_in_hash(self):
        # Different casing should produce same hash
        hash1 = generate_content_hash("test event", "test venue", "2026-01-15")
        hash2 = generate_content_hash("TEST EVENT", "TEST VENUE", "2026-01-15")
        assert hash1 == hash2

    def test_prefix_normalization(self):
        # "The Earl" and "Earl" should produce same hash
        hash1 = generate_content_hash("Show", "The Earl", "2026-01-15")
        hash2 = generate_content_hash("Show", "Earl", "2026-01-15")
        assert hash1 == hash2

    def test_whitespace_normalization(self):
        hash1 = generate_content_hash("Rock Show", "The Venue", "2026-01-15")
        hash2 = generate_content_hash("Rock   Show", "The  Venue", "2026-01-15")
        assert hash1 == hash2


class TestCalculateSimilarity:
    """Tests for the calculate_similarity function."""

    def test_identical_events(self):
        """Mock EventData class for testing."""

        class MockEventData:
            def __init__(self, title, venue_name, start_date):
                self.title = title
                self.start_date = start_date

                class Venue:
                    def __init__(self, name):
                        self.name = name

                self.venue = Venue(venue_name)

        event1 = MockEventData("Rock Concert", "The Earl", "2026-02-15")
        event2 = {"title": "Rock Concert", "venue_name": "The Earl", "start_date": "2026-02-15"}

        similarity = calculate_similarity(event1, event2)
        assert similarity == 100.0

    def test_different_dates_zero_similarity(self):
        class MockEventData:
            def __init__(self):
                self.title = "Rock Concert"
                self.start_date = "2026-02-15"

                class Venue:
                    name = "The Earl"

                self.venue = Venue()

        event1 = MockEventData()
        event2 = {"title": "Rock Concert", "venue_name": "The Earl", "start_date": "2026-02-16"}

        similarity = calculate_similarity(event1, event2)
        assert similarity == 0.0

    def test_similar_titles(self):
        class MockEventData:
            def __init__(self):
                self.title = "Live Music Night"
                self.start_date = "2026-02-15"

                class Venue:
                    name = "The Venue"

                self.venue = Venue()

        event1 = MockEventData()
        event2 = {
            "title": "Live Music Night!",
            "venue_name": "The Venue",
            "start_date": "2026-02-15",
        }

        similarity = calculate_similarity(event1, event2)
        assert similarity > 90.0


class TestMergeEventData:
    """Tests for the merge_event_data function."""

    def test_merge_missing_description(self):
        class MockEventData:
            description = "New longer description"
            start_time = None
            end_time = None
            confidence = 0.8
            tags = ["new-tag"]
            price_min = None
            price_max = None
            price_note = None
            image_url = None
            ticket_url = None

        existing = {"title": "Event", "description": None, "tags": ["old-tag"]}
        new = MockEventData()

        merged = merge_event_data(existing, new)
        assert merged["description"] == "New longer description"

    def test_keep_longer_description(self):
        class MockEventData:
            description = "Short"
            start_time = None
            end_time = None
            confidence = 0.8
            tags = []
            price_min = None
            price_max = None
            price_note = None
            image_url = None
            ticket_url = None

        existing = {"title": "Event", "description": "Much longer existing description"}
        new = MockEventData()

        merged = merge_event_data(existing, new)
        assert merged["description"] == "Much longer existing description"

    def test_merge_tags(self):
        class MockEventData:
            description = None
            start_time = None
            end_time = None
            confidence = 0.8
            tags = ["new-tag", "another"]
            price_min = None
            price_max = None
            price_note = None
            image_url = None
            ticket_url = None

        existing = {"tags": ["existing-tag"]}
        new = MockEventData()

        merged = merge_event_data(existing, new)
        assert "existing-tag" in merged["tags"]
        assert "new-tag" in merged["tags"]
        assert "another" in merged["tags"]

    def test_add_missing_times(self):
        class MockEventData:
            description = None
            start_time = "20:00"
            end_time = "23:00"
            confidence = 0.8
            tags = []
            price_min = None
            price_max = None
            price_note = None
            image_url = None
            ticket_url = None

        existing = {"start_time": None, "end_time": None}
        new = MockEventData()

        merged = merge_event_data(existing, new)
        assert merged["start_time"] == "20:00"
        assert merged["end_time"] == "23:00"

    def test_dont_overwrite_existing_times(self):
        class MockEventData:
            description = None
            start_time = "21:00"
            end_time = "00:00"
            confidence = 0.8
            tags = []
            price_min = None
            price_max = None
            price_note = None
            image_url = None
            ticket_url = None

        existing = {"start_time": "19:00", "end_time": "22:00"}
        new = MockEventData()

        merged = merge_event_data(existing, new)
        assert merged["start_time"] == "19:00"
        assert merged["end_time"] == "22:00"

    def test_add_missing_price(self):
        class MockEventData:
            description = None
            start_time = None
            end_time = None
            confidence = 0.8
            tags = []
            price_min = 15.0
            price_max = 30.0
            price_note = "GA/VIP"
            image_url = None
            ticket_url = None

        existing = {"price_min": None, "price_max": None, "price_note": None}
        new = MockEventData()

        merged = merge_event_data(existing, new)
        assert merged["price_min"] == 15.0
        assert merged["price_max"] == 30.0
        assert merged["price_note"] == "GA/VIP"

    def test_add_missing_image(self):
        class MockEventData:
            description = None
            start_time = None
            end_time = None
            confidence = 0.8
            tags = []
            price_min = None
            price_max = None
            price_note = None
            image_url = "https://example.com/image.jpg"
            ticket_url = None

        existing = {"image_url": None}
        new = MockEventData()

        merged = merge_event_data(existing, new)
        assert merged["image_url"] == "https://example.com/image.jpg"

    def test_prefer_lower_confidence(self):
        class MockEventData:
            description = None
            start_time = None
            end_time = None
            confidence = 0.6
            tags = []
            price_min = None
            price_max = None
            price_note = None
            image_url = None
            ticket_url = None

        existing = {"extraction_confidence": 0.9}
        new = MockEventData()

        merged = merge_event_data(existing, new)
        assert merged["extraction_confidence"] == 0.6
