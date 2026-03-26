"""Tests for closing date extraction from exhibition page text."""

import pytest


def test_import():
    """Verify the extract function exists."""
    from scripts.exhibition_closing_dates import extract_closing_date
    assert callable(extract_closing_date)


class TestDateRangeExtraction:
    def test_standard_range(self):
        from scripts.exhibition_closing_dates import extract_closing_date
        assert extract_closing_date("January 15 – April 30, 2026") == "2026-04-30"
        assert extract_closing_date("Jan 15, 2026 - Mar 30, 2026") == "2026-03-30"

    def test_through_pattern(self):
        from scripts.exhibition_closing_dates import extract_closing_date
        assert extract_closing_date("On view through May 15, 2026") == "2026-05-15"
        assert extract_closing_date("Through June 1, 2026") == "2026-06-01"

    def test_closes_pattern(self):
        from scripts.exhibition_closing_dates import extract_closing_date
        assert extract_closing_date("Closes March 31, 2026") == "2026-03-31"
        assert extract_closing_date("Closing April 15, 2026") == "2026-04-15"

    def test_json_ld_end_date(self):
        from scripts.exhibition_closing_dates import extract_closing_date
        html = '<script type="application/ld+json">{"endDate": "2026-05-01"}</script>'
        assert extract_closing_date(html) == "2026-05-01"

    def test_no_date_found(self):
        from scripts.exhibition_closing_dates import extract_closing_date
        assert extract_closing_date("Welcome to our gallery") is None
        assert extract_closing_date("") is None
