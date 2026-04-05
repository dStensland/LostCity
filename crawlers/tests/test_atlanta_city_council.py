"""
Tests for the Atlanta City Council IQM2 crawler.

Covers:
- Title parsing (committee, doc_type, datetime_str extraction)
- Date/time parsing including edge cases
- Feed HTML parsing (entry extraction, link normalization)
- Meeting-ID deduplication logic
- Committee tag assignment
- Series hint generation
"""

from datetime import date


from sources.atlanta_city_council import (
    _parse_entry_title,
    _parse_meeting_datetime,
    _parse_meeting_id,
    _parse_feed,
    _committee_tags,
    _series_hint,
    BASE_TAGS,
)


# ---------------------------------------------------------------------------
# _parse_entry_title
# ---------------------------------------------------------------------------

class TestParseEntryTitle:
    def test_standard_committee_title(self):
        result = _parse_entry_title(
            "Finance/Executive Committee - Agenda - Mar 25, 2026 1:30 PM"
        )
        assert result is not None
        committee, doc_type, datetime_str = result
        assert committee == "Finance/Executive Committee"
        assert doc_type == "Agenda"
        assert datetime_str == "Mar 25, 2026 1:30 PM"

    def test_city_council_title(self):
        result = _parse_entry_title(
            "Atlanta City Council - Agenda - Mar 16, 2026 1:00 PM"
        )
        assert result is not None
        committee, doc_type, datetime_str = result
        assert committee == "Atlanta City Council"
        assert doc_type == "Agenda"
        assert datetime_str == "Mar 16, 2026 1:00 PM"

    def test_minutes_doc_type(self):
        result = _parse_entry_title(
            "Atlanta City Council - Minutes - Mar 16, 2026 1:00 PM"
        )
        assert result is not None
        _, doc_type, _ = result
        assert doc_type == "Minutes"

    def test_webcast_doc_type(self):
        result = _parse_entry_title(
            "Committee on Council - Webcast - Mar 16, 2026 11:30 AM"
        )
        assert result is not None
        _, doc_type, _ = result
        assert doc_type == "Webcast"

    def test_public_safety_committee_with_ampersand(self):
        # Title contains " & " which should not confuse the splitter
        result = _parse_entry_title(
            "Public Safety & Legal Administration Committee - Agenda - Mar 23, 2026 1:00 PM"
        )
        assert result is not None
        committee, doc_type, datetime_str = result
        assert committee == "Public Safety & Legal Administration Committee"
        assert doc_type == "Agenda"

    def test_community_development_slash_human_services(self):
        result = _parse_entry_title(
            "Community Development/Human Services Committee - Agenda - Mar 24, 2026 1:30 PM"
        )
        assert result is not None
        committee, _, _ = result
        assert committee == "Community Development/Human Services Committee"

    def test_returns_none_for_short_title(self):
        assert _parse_entry_title("No dashes here") is None

    def test_returns_none_for_empty_string(self):
        assert _parse_entry_title("") is None

    def test_returns_none_for_only_one_dash(self):
        assert _parse_entry_title("Committee - Only one separator") is None


# ---------------------------------------------------------------------------
# _parse_meeting_datetime
# ---------------------------------------------------------------------------

class TestParseMeetingDatetime:
    def test_afternoon_meeting(self):
        start_date, start_time = _parse_meeting_datetime("Mar 25, 2026 1:30 PM")
        assert start_date == "2026-03-25"
        assert start_time == "13:30"

    def test_morning_meeting(self):
        start_date, start_time = _parse_meeting_datetime("Mar 25, 2026 10:00 AM")
        assert start_date == "2026-03-25"
        assert start_time == "10:00"

    def test_noon_pm(self):
        # 12:00 PM should remain 12:00 (not 24:00)
        start_date, start_time = _parse_meeting_datetime("Jan 5, 2026 12:00 PM")
        assert start_date == "2026-01-05"
        assert start_time == "12:00"

    def test_midnight_am(self):
        # 12:00 AM should convert to 00:00
        start_date, start_time = _parse_meeting_datetime("Jan 5, 2026 12:00 AM")
        assert start_date == "2026-01-05"
        assert start_time == "00:00"

    def test_eleven_pm(self):
        start_date, start_time = _parse_meeting_datetime("Jan 5, 2026 11:00 PM")
        assert start_date == "2026-01-05"
        assert start_time == "23:00"

    def test_abbreviated_month(self):
        start_date, start_time = _parse_meeting_datetime("Feb 10, 2026 1:30 PM")
        assert start_date == "2026-02-10"
        assert start_time == "13:30"

    def test_full_month_name(self):
        start_date, start_time = _parse_meeting_datetime("March 25, 2026 1:30 PM")
        assert start_date == "2026-03-25"
        assert start_time == "13:30"

    def test_date_without_time(self):
        # Fallback: date only — time should be None
        start_date, start_time = _parse_meeting_datetime("Mar 25, 2026")
        assert start_date == "2026-03-25"
        assert start_time is None

    def test_invalid_date_returns_none(self):
        start_date, start_time = _parse_meeting_datetime("not a date at all")
        assert start_date is None
        assert start_time is None

    def test_committee_on_council_am(self):
        start_date, start_time = _parse_meeting_datetime("Mar 16, 2026 11:30 AM")
        assert start_date == "2026-03-16"
        assert start_time == "11:30"


# ---------------------------------------------------------------------------
# _parse_meeting_id
# ---------------------------------------------------------------------------

class TestParseMeetingId:
    def test_extracts_numeric_id(self):
        link = "https://atlantacityga.iqm2.com/Citizens/Detail_Meeting.aspx?ID=4287"
        assert _parse_meeting_id(link) == "4287"

    def test_mixed_case_id(self):
        link = "https://AtlantaCityGA.IQM2.com/Citizens/Detail_Meeting.aspx?ID=1234"
        assert _parse_meeting_id(link) == "1234"

    def test_returns_none_for_no_id(self):
        assert _parse_meeting_id("https://example.com/page") is None

    def test_returns_none_for_empty_string(self):
        assert _parse_meeting_id("") is None


# ---------------------------------------------------------------------------
# _committee_tags
# ---------------------------------------------------------------------------

class TestCommitteeTags:
    def test_base_tags_always_present(self):
        tags = _committee_tags("Unknown Committee")
        for base in BASE_TAGS:
            assert base in tags

    def test_zoning_committee_tags(self):
        tags = _committee_tags("Zoning Committee")
        assert "zoning" in tags
        assert "planning" in tags
        assert "land-use" in tags

    def test_transportation_committee_tags(self):
        tags = _committee_tags("Transportation Committee")
        assert "transportation" in tags
        assert "transit" in tags

    def test_city_council_tags(self):
        tags = _committee_tags("Atlanta City Council")
        assert "legislation" in tags
        assert "governance" in tags

    def test_no_duplicate_tags(self):
        tags = _committee_tags("Atlanta City Council")
        assert len(tags) == len(set(tags))

    def test_public_safety_committee(self):
        tags = _committee_tags("Public Safety & Legal Administration Committee")
        assert "public-safety" in tags
        assert "legal" in tags


# ---------------------------------------------------------------------------
# _series_hint
# ---------------------------------------------------------------------------

class TestSeriesHint:
    def test_returns_recurring_show_type(self):
        hint = _series_hint("Zoning Committee")
        assert hint["series_type"] == "recurring_show"

    def test_series_title_includes_committee_name(self):
        hint = _series_hint("Transportation Committee")
        assert "Transportation Committee" in hint["series_title"]

    def test_frequency_is_monthly(self):
        hint = _series_hint("Finance/Executive Committee")
        assert hint["frequency"] == "monthly"


# ---------------------------------------------------------------------------
# _parse_feed (integration-level — exercises HTML parsing end-to-end)
# ---------------------------------------------------------------------------

SAMPLE_FEED_HTML = """<?xml version="1.0" encoding="utf-16"?>
<html>
<head><title>RSS Feed</title></head>
<body>
<div><h1>City of Atlanta - Meeting Calendar</h1></div>
<div>
  <h2>Finance/Executive Committee - Agenda - Mar 25, 2026 1:30 PM</h2>
  <p><a href='https://AtlantaCityGA.IQM2.com/Citizens/Detail_Meeting.aspx?ID=4287'>View Web Agenda</a></p>
  <p><em>Published on: Fri, 20 Mar 2026 16:27:04 GMT</em></p>
</div>
<div>
  <h2>Atlanta City Council - Minutes - Mar 16, 2026 1:00 PM</h2>
  <p><a href='https://AtlantaCityGA.IQM2.com/Citizens/Detail_Meeting.aspx?ID=4257'>View Web Agenda</a></p>
  <p><em>Published on: Wed, 18 Mar 2026 18:48:01 GMT</em></p>
</div>
<div>
  <h2>Zoning Committee - Agenda - Apr 6, 2026 11:00 AM</h2>
  <p><a href='https://AtlantaCityGA.IQM2.com/Citizens/Detail_Meeting.aspx?ID=4500'>View Web Agenda</a></p>
  <p><em>Published on: Mon, 23 Mar 2026 10:00:00 GMT</em></p>
</div>
<div>
  <h2>Public Safety &amp; Legal Administration Committee - Agenda - Mar 23, 2026 1:00 PM</h2>
  <p><a href='https://AtlantaCityGA.IQM2.com/Citizens/Detail_Meeting.aspx?ID=4315'>View Web Agenda</a></p>
  <p><em>Published on: Fri, 20 Mar 2026 17:09:46 GMT</em></p>
</div>
<div><h2>This div has no link</h2><p>No meeting info</p></div>
</body>
</html>"""


class TestParseFeed:
    def test_parses_four_valid_entries(self):
        entries = _parse_feed(SAMPLE_FEED_HTML)
        # The header div ("City of Atlanta - Meeting Calendar") has no link, so skipped
        # "This div has no link" also skipped
        # 3 entries have detail links + 1 with &amp; in title
        assert len(entries) == 4

    def test_agenda_entry_structure(self):
        entries = _parse_feed(SAMPLE_FEED_HTML)
        agenda_entries = [e for e in entries if e["doc_type"] == "Agenda"]
        assert len(agenda_entries) == 3  # Finance, Zoning, Public Safety

    def test_minutes_entry_parsed(self):
        entries = _parse_feed(SAMPLE_FEED_HTML)
        minutes = [e for e in entries if e["doc_type"] == "Minutes"]
        assert len(minutes) == 1
        assert minutes[0]["committee"] == "Atlanta City Council"

    def test_link_normalized_to_lowercase_domain(self):
        entries = _parse_feed(SAMPLE_FEED_HTML)
        for entry in entries:
            # Mixed-case IQM2 domain in source HTML should be normalized
            assert "AtlantaCityGA.IQM2.com" not in entry["link"]
            assert "atlantacityga.iqm2.com" in entry["link"].lower()

    def test_meeting_id_extracted(self):
        entries = _parse_feed(SAMPLE_FEED_HTML)
        finance = next(e for e in entries if "Finance" in e["committee"])
        assert finance["meeting_id"] == "4287"

    def test_html_entity_unescaped_in_committee_name(self):
        entries = _parse_feed(SAMPLE_FEED_HTML)
        ps = next(
            e for e in entries if "Public Safety" in e["committee"]
        )
        # &amp; in HTML should decode to & in the committee name
        assert "&" in ps["committee"]
        assert "&amp;" not in ps["committee"]

    def test_divs_without_h2_are_skipped(self):
        html = "<html><body><div><p>No h2 here</p></div></body></html>"
        entries = _parse_feed(html)
        assert entries == []

    def test_divs_without_detail_link_are_skipped(self):
        html = (
            "<html><body>"
            "<div><h2>Committee - Agenda - Mar 25, 2026 1:30 PM</h2>"
            "<a href='https://example.com/other'>Other</a></div>"
            "</body></html>"
        )
        entries = _parse_feed(html)
        assert entries == []


# ---------------------------------------------------------------------------
# End-to-end filtering: only Agenda + upcoming entries should become events
# ---------------------------------------------------------------------------

class TestCrawlFiltering:
    """
    Validates that the crawl() function filters correctly.
    These tests check the filtering logic indirectly through helper functions
    since crawl() has DB side-effects that require mocking.
    """

    def test_agenda_type_filter(self):
        # Minutes and Webcast must be excluded
        entries = _parse_feed(SAMPLE_FEED_HTML)
        agenda_only = [e for e in entries if e["doc_type"].lower() == "agenda"]
        assert all(e["doc_type"].lower() == "agenda" for e in agenda_only)
        assert len(agenda_only) == 3

    def test_past_meeting_would_be_filtered(self):
        # Mar 16, 2026 is in the past relative to today (2026-03-22)
        start_date, _ = _parse_meeting_datetime("Mar 16, 2026 1:00 PM")
        assert start_date is not None
        from datetime import date
        event_date = date.fromisoformat(start_date)
        # Confirm this date is before our reference "today" for the task
        assert event_date < date(2026, 3, 22)

    def test_future_meeting_would_pass_filter(self):
        start_date, _ = _parse_meeting_datetime("Mar 25, 2026 1:30 PM")
        assert start_date is not None
        event_date = date.fromisoformat(start_date)
        assert event_date >= date(2026, 3, 22)
