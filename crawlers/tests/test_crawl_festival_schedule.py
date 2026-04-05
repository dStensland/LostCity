"""Tests for festival schedule parsing helpers."""

import crawl_festival_schedule as festival_crawler
from datetime import date
from types import SimpleNamespace

from crawl_festival_schedule import (
    SessionData,
    _apply_llm_quality_gate,
    _build_factual_festival_session_description,
    _find_existing_festival_session,
    _parse_month_day_tab_label,
    _parse_human_datetime,
    _parse_iso_datetime,
    _parse_jsonld_event,
    extract_sessions_blade_show_schedule,
    extract_sessions_collect_a_con_page,
    extract_sessions_conjuration_homepage,
    extract_sessions_southeastern_stamp_expo_homepage,
    extract_sessions_toylanta_schedule,
    extract_sessions_atlanta_pen_show_schedule,
    extract_sessions_ipms_event_page,
    extract_sessions_tabbed_button_schedule,
    resolve_session_venue,
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


class TestFetchHtml:
    def test_falls_back_to_curl_when_requests_tls_fails(self, monkeypatch):
        monkeypatch.setattr(
            festival_crawler,
            "get_config",
            lambda: SimpleNamespace(
                crawler=SimpleNamespace(user_agent="LostCityTest/1.0", request_timeout=15)
            ),
        )

        def raise_ssl(*_args, **_kwargs):
            raise festival_crawler.requests.exceptions.SSLError("tls failed")

        class _Proc:
            stdout = b"<html>blade show</html>"
            stderr = b""

        monkeypatch.setattr(festival_crawler.requests, "get", raise_ssl)
        monkeypatch.setattr(festival_crawler.shutil, "which", lambda _name: "/usr/bin/curl")
        monkeypatch.setattr(festival_crawler.subprocess, "run", lambda *args, **kwargs: _Proc())

        html = festival_crawler._fetch_with_requests("https://www.bladeshow.com/show-info/")

        assert html == "<html>blade show</html>"


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

    def test_captures_structured_venue_fields_from_jsonld(self):
        event = {
            "@type": "Event",
            "name": "TCA Terminus Chapter Meet",
            "startDate": "2026-09-12T09:00:00-04:00",
            "location": {
                "@type": "Place",
                "name": "VFW Post 5408",
                "sameAs": "https://vfw5408.org/",
                "address": {
                    "@type": "PostalAddress",
                    "streetAddress": "4764 Cobb Parkway NW",
                    "addressLocality": "Acworth",
                    "addressRegion": "Georgia",
                    "postalCode": "30101",
                },
            },
        }

        parsed = _parse_jsonld_event(event, "https://www.tcatrains.org/event/foo/")
        assert parsed is not None
        assert parsed.venue_name == "VFW Post 5408"
        assert parsed.venue_address == "4764 Cobb Parkway NW"
        assert parsed.venue_city == "Acworth"
        assert parsed.venue_state == "Georgia"
        assert parsed.venue_postal_code == "30101"
        assert parsed.venue_website == "https://vfw5408.org/"


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

    def test_keeps_singleton_with_specific_date_evidence(self):
        sessions = [
            SessionData(
                title="Frolicon 2026",
                start_date="2026-05-14",
                start_time=None,
                venue_name="Unknown Venue",
            )
        ]

        kept, reasons = _apply_llm_quality_gate(
            sessions=sessions,
            festival_name="Frolicon",
            today=date(2026, 2, 20),
            page_text=(
                "Frolicon is excited to be celebrating our 20th year this "
                "May 14th - 17th, 2026."
            ),
        )
        assert len(kept) == 1
        assert reasons == []

    def test_rejects_singleton_when_page_says_details_available_soon(self):
        sessions = [
            SessionData(
                title="Atlanta Beltline Lantern Parade",
                start_date="2026-10-01",
                start_time=None,
                venue_name="Atlanta Beltline",
            )
        ]

        kept, reasons = _apply_llm_quality_gate(
            sessions=sessions,
            festival_name="Atlanta Beltline Lantern Parade",
            today=date(2026, 2, 20),
            page_text=(
                "2026 Parade Details. Details, a date, and more for the 2026 "
                "Atlanta Beltline Lantern Parade will be available soon."
            ),
        )
        assert kept == []
        assert "batch_reject:singleton_low_signal" in reasons

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


class TestFactualFestivalSessionDescription:
    def test_uses_meta_summary_for_missing_parent_description(self, monkeypatch):
        monkeypatch.setattr(
            festival_crawler,
            "_get_page_summary",
            lambda *_args, **_kwargs: (
                "Calling all sponsors! We’re back at it September 26, 2026 in East Atlanta Village "
                "with parade events, neighborhood vendors, and community programming."
            ),
        )
        session = SessionData(
            title="East Atlanta Strut",
            start_date="2026-09-26",
            source_url="https://www.eastatlantastrut.com/",
        )

        description = _build_factual_festival_session_description(session, "East Atlanta Strut")

        assert "September 26, 2026" in description
        assert "East Atlanta Village" in description
        assert description.startswith("East Atlanta Strut is part of the published East Atlanta Strut schedule.")

    def test_builds_structured_fallback_when_description_missing(self, monkeypatch):
        monkeypatch.setattr(festival_crawler, "_get_page_summary", lambda *_args, **_kwargs: None)
        session = SessionData(
            title="Networking Now",
            start_date="2026-06-02",
            start_time="08:00",
            venue_name="Meetup space Floor 3",
            category="community",
        )

        description = _build_factual_festival_session_description(session, "RenderATL")

        assert "Networking Now is a networking meetup during RenderATL." in description
        assert "Location: Meetup space Floor 3." in description
        assert "Scheduled start: 08:00." in description

    def test_combines_page_summary_with_factual_context(self, monkeypatch):
        monkeypatch.setattr(
            festival_crawler,
            "_get_page_summary",
            lambda *_args, **_kwargs: (
                "Show floor hours, panel times, VIP events, afterhours schedule, early access shopping, "
                "general admission, lobby swaps, karaoke and more!"
            ),
        )
        session = SessionData(
            title="Toylanta",
            start_date="2026-03-27",
            venue_name="Gas South Convention Center",
            source_url="https://www.toylanta.net/schedule",
        )

        description = _build_factual_festival_session_description(session, "Toylanta")

        assert "Gas South Convention Center" in description
        assert "Show floor hours, panel times" in description
        assert len(description) >= 120


class TestTabbedButtonSchedule:
    def test_parses_tabbed_schedule_rows(self):
        html = """
        <html>
          <head>
            <meta property="og:title" content="RenderATL 2026 | August 12 & 13, 2026" />
          </head>
          <body>
            <button role="tab" aria-controls="day-1">Jun 2</button>
            <div id="day-1">
              <div role="button">
                <div>8:00 AM — 8:45 AM</div>
                <div>Networking Now</div>
                <div>Meetup space Floor 3</div>
                <div><button>Networking</button></div>
              </div>
              <div role="button">
                <div>Time TBD</div>
                <div>Day 3 Registration Opens</div>
                <div>AmericasMart Entry</div>
                <div><button>Show Operations</button></div>
              </div>
            </div>
          </body>
        </html>
        """

        sessions = extract_sessions_tabbed_button_schedule(
            html,
            "https://www.renderatl.com/schedule",
        )

        assert len(sessions) == 1
        assert sessions[0].title == "Networking Now"
        assert sessions[0].start_date == "2026-06-02"
        assert sessions[0].start_time == "08:00"
        assert sessions[0].venue_name == "Meetup space Floor 3"
        assert sessions[0].program_track == "Networking"

    def test_parses_month_day_tab_label(self):
        assert _parse_month_day_tab_label("Jun 2", 2026) == "2026-06-02"


class TestResolveSessionVenue:
    def test_returns_none_for_unknown_venue_without_default(self):
        session = SessionData(
            title="Frolicon 2026",
            start_date="2026-05-14",
            venue_name="Unknown Venue",
        )

        venue_id = resolve_session_venue(session, "frolicon")
        assert venue_id is None

    def test_returns_none_for_city_state_venue_without_default(self, monkeypatch):
        session = SessionData(
            title="Monsterama Con",
            start_date="2026-08-07",
            venue_name="Atlanta, GA",
        )

        def fail_get_or_create(_venue_data):
            raise AssertionError("should not create a placeholder venue")

        monkeypatch.setattr(festival_crawler, "get_or_create_place", fail_get_or_create)

        venue_id = resolve_session_venue(session, "monsterama-con")
        assert venue_id is None

    def test_returns_none_when_venue_creation_is_skipped(self, monkeypatch):
        session = SessionData(
            title="TCA Terminus Chapter Meet",
            start_date="2026-09-12",
            venue_name="VFW Post 5408",
        )

        monkeypatch.setattr(festival_crawler, "get_venue_by_slug", lambda _slug: None)
        monkeypatch.setattr(festival_crawler, "get_or_create_place", lambda _venue: -1)

        venue_id = resolve_session_venue(session, "atlanta-toy-model-train-show")
        assert venue_id is None

    def test_passes_structured_venue_fields_to_creation(self, monkeypatch):
        session = SessionData(
            title="TCA Terminus Chapter Meet",
            start_date="2026-09-12",
            venue_name="VFW Post 5408",
            venue_address="4764 Cobb Parkway NW",
            venue_city="Acworth",
            venue_state="Georgia",
            venue_postal_code="30101",
            venue_website="https://vfw5408.org/",
        )
        captured = {}

        monkeypatch.setattr(festival_crawler, "get_venue_by_slug", lambda _slug: None)

        def fake_get_or_create(place_data):
            captured.update(place_data)
            return 2206

        monkeypatch.setattr(festival_crawler, "get_or_create_place", fake_get_or_create)

        venue_id = resolve_session_venue(session, "atlanta-toy-model-train-show")

        assert venue_id == 2206
        assert captured["name"] == "VFW Post 5408"
        assert captured["address"] == "4764 Cobb Parkway NW"
        assert captured["city"] == "Acworth"
        assert captured["state"] == "Georgia"
        assert captured["zip"] == "30101"
        assert captured["website"] == "https://vfw5408.org/"


class TestFestivalProgramSeriesTitle:
    def test_collapses_generic_toylanta_buckets_to_parent_festival(self):
        session = SessionData(
            title="Toylanta Lobby Swap",
            start_date="2026-03-28",
            start_time="19:30",
        )

        title = festival_crawler._build_festival_program_series_title(
            session,
            "Toylanta",
        )

        assert title == "Toylanta"


class TestInsertSessions:
    def test_existing_rows_still_flow_through_insert_event(self, monkeypatch):
        session = SessionData(
            title="Toylanta Lobby Swap",
            start_date="2026-03-28",
            start_time="19:30",
            end_time="22:00",
            venue_name="Gas South Convention Center",
            source_url="https://www.toylanta.net/schedule",
        )
        captured = {}

        monkeypatch.setattr(festival_crawler, "resolve_session_venue", lambda *args, **kwargs: 123)
        monkeypatch.setattr(festival_crawler, "generate_content_hash", lambda *args, **kwargs: "abc123")
        monkeypatch.setattr(
            festival_crawler,
            "find_event_by_hash",
            lambda _content_hash: {"id": 99, "place_id": 123},
        )
        monkeypatch.setattr(
            festival_crawler,
            "_find_existing_festival_session",
            lambda **_kwargs: None,
        )

        def fake_insert_event(event_record, series_hint=None):
            captured["event_record"] = event_record
            captured["series_hint"] = series_hint
            return 99

        monkeypatch.setattr(festival_crawler, "insert_event", fake_insert_event)

        found, new, skipped = festival_crawler.insert_sessions(
            [session],
            festival_slug="toylanta",
            festival_name="Toylanta",
            source_id=1,
            default_venue_id=123,
            dry_run=False,
        )

        assert (found, new, skipped) == (1, 0, 1)
        assert captured["event_record"]["place_id"] == 123
        assert captured["series_hint"]["series_type"] == "festival_program"
        assert captured["series_hint"]["series_title"] == "Toylanta"


class TestAtlantaPenShowSchedule:
    def test_extracts_public_hours_and_special_events(self):
        html = """
        <html>
          <body>
            <p>Atlanta Pen Show 2026</p>
            <p>Atlanta Pen Show • March 27-29 • Sonesta Atlanta Northwest Galleria</p>
            <table class="hours-table">
              <tbody>
                <tr><td><strong>Friday</strong></td><td>11:00am – 5:00pm</td><td>12:00pm – 5:00pm</td></tr>
                <tr><td><strong>Saturday</strong></td><td>9:00am – 5:00pm</td><td>10:00am – 5:00pm</td></tr>
                <tr><td><strong>Sunday</strong></td><td>9:00am – 5:00pm</td><td>10:00am – 5:00pm</td></tr>
              </tbody>
            </table>
            <div class="schedule-day">
              <ul><li><strong>8:00pm</strong> – <strong>Pen Show After Dark</strong></li></ul>
            </div>
            <div class="schedule-day">
              <ul><li><strong>3:00pm</strong> – Pen Show Door Prize Giveaway</li></ul>
            </div>
          </body>
        </html>
        """

        sessions = extract_sessions_atlanta_pen_show_schedule(
            html,
            "https://atlpenshow.com/pages/show-schedule",
        )

        assert len(sessions) == 5
        assert sessions[0].title == "Atlanta Pen Show"
        assert sessions[0].start_date == "2026-03-27"
        assert sessions[0].start_time == "12:00"
        assert sessions[0].end_time == "17:00"
        assert sessions[0].venue_name == "Sonesta Atlanta Northwest Galleria"
        assert sessions[3].title == "Pen Show After Dark"
        assert sessions[3].start_date == "2026-03-28"
        assert sessions[3].start_time == "20:00"
        assert sessions[4].title == "Pen Show Door Prize Giveaway"
        assert sessions[4].start_date == "2026-03-29"
        assert sessions[4].start_time == "15:00"


class TestBladeShowSchedule:
    def test_extracts_daily_public_hours_from_official_pages(self, monkeypatch):
        show_info_html = """
        <html>
          <body>
            <p>Friday: 10:00 AM (Early Bird Ticket Holders ONLY)</p>
            <p><strong>General Admission</strong></p>
            <p>Friday: 11:00 AM - 6:00 PM</p>
            <p>Saturday: 9:00 AM - 6:00 PM</p>
            <p>Sunday: 9:00 AM - 2:00 PM</p>
          </body>
        </html>
        """
        home_html = """
        <html>
          <body>
            <h3>JUNE 5-7, 2026 | Cobb Convention Center Atlanta</h3>
          </body>
        </html>
        """
        travel_html = """
        <html>
          <body>
            <p><strong>Cobb Convention Center Atlanta</strong><br />2 Galleria Pkwy SE<br />Atlanta, GA 30339</p>
          </body>
        </html>
        """

        def fake_fetch(url, render_js=False):
            assert render_js is False
            if url == "https://www.bladeshow.com/home/":
                return home_html
            if url == "https://www.bladeshow.com/travel/":
                return travel_html
            raise AssertionError(f"Unexpected fetch: {url}")

        monkeypatch.setattr(festival_crawler, "fetch_html", fake_fetch)

        sessions = extract_sessions_blade_show_schedule(
            show_info_html,
            "https://www.bladeshow.com/show-info/",
        )

        assert len(sessions) == 3
        assert sessions[0].title == "Blade Show"
        assert sessions[0].start_date == "2026-06-05"
        assert sessions[0].start_time == "11:00"
        assert sessions[0].end_time == "18:00"
        assert sessions[0].venue_name == "Cobb Galleria Centre"
        assert sessions[0].venue_address == "2 Galleria Pkwy SE"
        assert sessions[0].venue_city == "Atlanta"
        assert sessions[0].venue_state == "GA"
        assert sessions[0].venue_postal_code == "30339"
        assert sessions[0].ticket_url == "https://www.bladeshow.com/buy-tickets/"
        assert sessions[2].start_date == "2026-06-07"
        assert sessions[2].end_time == "14:00"


class TestConjurationHomepage:
    def test_extracts_annual_event_from_current_homepage(self, monkeypatch):
        homepage_html = """
        <html>
          <body>
            <h2>Atlanta’s Ultimate Fantasy Event!</h2>
            <p>November 6-8 2026 Duluth, GA Sonesta Gwinnett Place</p>
            <p>Prepare to be Immersed in a 3-day Magical Extravaganza Like No Other!</p>
            <p>CONjuration 2026</p>
            <p>At CONjuration, your favorite worlds come alive through cosplay, gaming, performances, and community.</p>
            <p>Nov 6–8, 2026 | Duluth, GA</p>
          </body>
        </html>
        """
        hotel_html = """
        <html>
          <body>
            <p>Sonesta Gwinnett Place 1775 Pleasant Hill Rd. Duluth, GA 30096</p>
          </body>
        </html>
        """

        monkeypatch.setattr(
            festival_crawler,
            "fetch_html",
            lambda url, render_js=False: hotel_html
            if url == "https://www.conjurationcon.com/hotel/" and render_js is True
            else (_ for _ in ()).throw(AssertionError(f"Unexpected fetch: {url} render_js={render_js}")),
        )

        sessions = extract_sessions_conjuration_homepage(
            homepage_html,
            "https://www.conjurationcon.com/",
        )

        assert len(sessions) == 1
        assert sessions[0].title == "CONjuration 2026"
        assert sessions[0].start_date == "2026-11-06"
        assert sessions[0].venue_name == "Sonesta Gwinnett Place Atlanta"
        assert sessions[0].venue_address == "1775 Pleasant Hill Rd"
        assert sessions[0].venue_city == "Duluth"
        assert sessions[0].venue_state == "GA"
        assert sessions[0].venue_postal_code == "30096"
        assert "cosplay" in (sessions[0].description or "").lower()


class TestToylantaSchedule:
    def test_extracts_public_floor_hours_and_lobby_swap(self):
        html = """
        <html>
          <body>
            <p>2026 MARCH 27-28-29</p>
            <p>Gas South Convention Center Duluth, GA 30097</p>
            <h2>SCHEDULE</h2>
            <p>FRIDAY 27TH MARCH 2026</p>
            <p>5:00 PM - 6:00 PM: SHOW FLOOR(S) OPEN FOR EARLY ACCESS FOR VIP TICKET HOLDERS</p>
            <p>6:00 PM - 8:00 PM: SHOW FLOOR(S) OPEN FOR GENERAL ADMISSION</p>
            <p>8:00 PM - 10:00 PM: VIP EVENTS</p>
            <p>SATURDAY 28TH MARCH 2026</p>
            <p>9:00 AM - 10:00 AM: SHOW FLOOR(S) OPEN FOR EARLY ACCESS FOR VIP TICKET HOLDERS</p>
            <p>10:00 AM - 6:00 PM: SHOW FLOOR(S) OPEN FOR GENERAL ADMISSION</p>
            <p>7:30 PM - 10:00 PM: TOYLANTA Lobby Swap!!</p>
            <p>SUNDAY 29TH MARCH 2026</p>
            <p>10:00 AM - 10:30 AM: SHOW FLOOR(S) OPEN FOR EARLY ACCESS FOR VIP TICKET HOLDERS</p>
            <p>10:30 AM - 4:30 PM: SHOW FLOOR(S) OPEN FOR GENERAL ADMISSION</p>
          </body>
        </html>
        """

        sessions = extract_sessions_toylanta_schedule(
            html,
            "https://www.toylanta.net/schedule",
        )

        assert len(sessions) == 4
        assert sessions[0].title == "Toylanta"
        assert sessions[0].start_date == "2026-03-27"
        assert sessions[0].start_time == "18:00"
        assert sessions[0].end_time == "20:00"
        assert sessions[0].venue_name == "Gas South Convention Center"
        assert "Public general admission hours" in sessions[0].description
        assert sessions[1].start_date == "2026-03-28"
        assert sessions[1].start_time == "10:00"
        assert sessions[2].title == "Toylanta"
        assert sessions[2].start_date == "2026-03-29"
        assert sessions[2].start_time == "10:30"
        assert sessions[3].title == "Toylanta Lobby Swap"
        assert sessions[3].start_date == "2026-03-28"
        assert sessions[3].start_time == "19:30"
        assert sessions[3].end_time == "22:00"
        assert "after-hours meetup" in sessions[3].description


class TestCollectAConPage:
    def test_extracts_daily_hours_from_official_atlanta_fall_page(self):
        html = """
        <html>
          <body>
            <h1>Atlanta 2</h1>
            <a href="https://www.universe.com/events/collect-a-con-atlanta-2-ga-tickets-WHVL4T?unii-trigger-open=WHVL4T">Buy Tickets</a>
            <p>September 26, 2026 07:00:00</p>
            <p>Saturday: 10am - 6pm</p>
            <p>Sunday: 10am - 5pm</p>
            <div>Venue</div>
            <div>Georgia World Congress Convention Center</div>
            <div>Hall A1</div>
            <div>285 Andrew Young International Blvd NW, Atlanta, GA 30313</div>
            <img alt="Atlanta 2 2026" src="/wp-content/uploads/2025/11/SHOW21-SEP-26-27-2026_ATLANTA_2.png" />
          </body>
        </html>
        """

        sessions = extract_sessions_collect_a_con_page(
            html,
            "https://collectaconusa.com/atlanta-2/",
        )

        assert len(sessions) == 2
        assert sessions[0].title == "Collect-A-Con Atlanta (Fall)"
        assert sessions[0].start_date == "2026-09-26"
        assert sessions[0].start_time == "10:00"
        assert sessions[0].end_time == "18:00"
        assert sessions[0].venue_name == "Georgia World Congress Center"
        assert sessions[0].venue_postal_code == "30313"
        assert sessions[0].ticket_url == "https://www.universe.com/events/collect-a-con-atlanta-2-ga-tickets-WHVL4T?unii-trigger-open=WHVL4T"
        assert sessions[0].image_url == "https://collectaconusa.com/wp-content/uploads/2025/11/SHOW21-SEP-26-27-2026_ATLANTA_2.png"
        assert sessions[1].start_date == "2026-09-27"
        assert sessions[1].start_time == "10:00"
        assert sessions[1].end_time == "17:00"


class TestSoutheasternStampExpoHomepage:
    def test_extracts_daily_hours_from_current_homepage(self):
        html = """
        <html>
          <body>
            <p>The Southeast's Annual Gathering of Stamp Collectors!</p>
            <p>January 22-24, 2027</p>
            <p>10 am - 5:30 pm Friday &amp; Saturday, 10 am - 3 pm Sunday</p>
            <p>The Hilton Atlanta Northeast</p>
            <p>5993 Peachtree Industrial Boulevard</p>
            <p>Peachtree Corners, Georgia 30092</p>
          </body>
        </html>
        """

        sessions = extract_sessions_southeastern_stamp_expo_homepage(
            html,
            "http://www.sefsc.org",
        )

        assert len(sessions) == 3
        assert sessions[0].title == "Southeastern Stamp Expo"
        assert sessions[0].start_date == "2027-01-22"
        assert sessions[0].start_time == "10:00"
        assert sessions[0].end_time == "17:30"
        assert sessions[0].venue_name == "Hilton Atlanta Northeast"
        assert sessions[0].venue_city == "Peachtree Corners"
        assert sessions[1].start_date == "2027-01-23"
        assert sessions[1].end_time == "17:30"
        assert sessions[2].start_date == "2027-01-24"
        assert sessions[2].end_time == "15:00"


class TestIpmsEventPage:
    def test_extracts_single_event_with_structured_venue(self):
        html = """
        <html>
          <body>
            <h2 class="page-header">AtlantaCon 2026</h2>
            <div class="field-name-field-event-date">
              <span class="date-display-start" content="2026-03-21T09:00:00-04:00">9:00am</span>
              to
              <span class="date-display-end" content="2026-03-21T16:30:00-04:00">4:30pm</span>
            </div>
            <div class="field-name-field-event-location-name"><div class="field-item">IAM Local 709</div></div>
            <div class="field-name-field-event-location">
              <div class="field-item">
                <div class="thoroughfare">1032 S. Marietta Pkwy</div>
                <span class="locality">Marietta</span>, <span class="state">GA</span> <span class="postal-code">30060</span>
              </div>
            </div>
            <div class="field-name-field-event-website"><a href="http://www.ipms-atlanta.org">AtlantaCon 2026</a></div>
          </body>
        </html>
        """

        sessions = extract_sessions_ipms_event_page(
            html,
            "https://ipmsusa.org/event/atlantacon-2026",
        )

        assert len(sessions) == 1
        assert sessions[0].title == "AtlantaCon 2026"
        assert sessions[0].start_date == "2026-03-21"
        assert sessions[0].start_time == "09:00"
        assert sessions[0].end_time == "16:30"
        assert sessions[0].venue_name == "IAM Local 709"
        assert sessions[0].venue_address == "1032 S. Marietta Pkwy"
        assert sessions[0].venue_city == "Marietta"
        assert sessions[0].venue_state == "GA"
        assert sessions[0].venue_postal_code == "30060"
        assert sessions[0].venue_website == "http://www.ipms-atlanta.org"


class TestFindExistingFestivalSession:
    def test_falls_back_to_same_source_row_when_source_url_changes(self, monkeypatch):
        rows = [
            {
                "id": 101,
                "title": "Monsterama Con",
                "start_date": "2026-08-07",
                "start_time": None,
                "source_url": "https://monsteramacon.com",
                "is_active": True,
                "canonical_event_id": None,
            }
        ]

        class _ExecResult:
            def __init__(self, data):
                self.data = data

        class _Query:
            def __init__(self, data):
                self._data = data

            def select(self, *_args, **_kwargs):
                return self

            def eq(self, *_args, **_kwargs):
                return self

            def is_(self, *_args, **_kwargs):
                return self

            def execute(self):
                return _ExecResult(self._data)

        class _Client:
            def table(self, _name):
                return _Query(rows)

        monkeypatch.setattr(festival_crawler, "get_client", lambda: _Client())

        existing = _find_existing_festival_session(
            source_id=612,
            title="Monsterama Con",
            start_date="2026-08-07",
            start_time=None,
            source_url="https://monsteramacon.com/monsterama-program-schedule/",
        )

        assert existing is not None
        assert existing["id"] == 101
