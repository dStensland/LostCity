"""Tests for festival schedule parsing helpers."""

from datetime import date

from crawl_festival_schedule import (
    SessionData,
    _apply_llm_quality_gate,
    _parse_human_datetime,
    _parse_iso_datetime,
    _parse_jsonld_event,
)


class TestParseHumanDatetime:
    def test_parses_date_and_time(self):
        date_value, time_value = _parse_human_datetime("Saturday, March 15, 2026 at 7:30 PM")
        assert date_value == "2026-03-15"
        assert time_value == "19:30"


class TestParseIsoDatetime:
    def test_parses_timezone_iso_format(self):
        date_value, time_value = _parse_iso_datetime("2026-03-15T19:30:00-04:00")
        assert date_value == "2026-03-15"
        assert time_value == "19:30"


class TestJsonLdImageSelection:
    def test_prefers_non_logo_image_and_resolves_relative_url(self):
        event = {
            "@type": "Event",
            "name": "Main Stage Headliner",
            "startDate": "2026-03-15T19:30:00-04:00",
            "image": [
                "https://example.com/assets/logo.png",
                "/images/headliner-hero.jpg",
            ],
        }

        parsed = _parse_jsonld_event(event, "https://example.com/festival")
        assert parsed is not None
        assert parsed.image_url == "https://example.com/images/headliner-hero.jpg"


class TestLlmQualityGate:
    def test_rejects_singleton_low_signal_session(self):
        sessions = [
            SessionData(
                title="Atlanta Salsa & Bachata Festival",
                start_date="2026-03-01",
                start_time=None,
                venue_name="Unknown Venue",
            )
        ]

        kept, reasons = _apply_llm_quality_gate(
            sessions=sessions,
            festival_name="Atlanta Salsa & Bachata Festival",
            today=date(2026, 2, 20),
        )
        assert kept == []
        assert "batch_reject:singleton_low_signal" in reasons

    def test_keeps_multi_session_batch_with_times(self):
        sessions = [
            SessionData(
                title="Keynote",
                start_date="2026-06-02",
                start_time="09:00",
                venue_name="Main Stage",
            ),
            SessionData(
                title="Breakout",
                start_date="2026-06-02",
                start_time="10:00",
                venue_name="Room A",
            ),
        ]

        kept, reasons = _apply_llm_quality_gate(
            sessions=sessions,
            festival_name="Render ATL",
            today=date(2026, 2, 20),
        )
        assert len(kept) == 2
        assert reasons == []

    def test_drops_past_dated_rows(self):
        sessions = [
            SessionData(
                title="Legacy Listing",
                start_date="2025-01-01",
                start_time="09:00",
                venue_name="Main Stage",
            )
        ]

        kept, reasons = _apply_llm_quality_gate(
            sessions=sessions,
            festival_name="Example Fest",
            today=date(2026, 2, 20),
        )
        assert kept == []
        assert any(reason.endswith("past_date") for reason in reasons)
