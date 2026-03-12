from datetime import date

from sources.atlanta_streetwear_market import parse_official_homepage, parse_venue_listing


def test_parse_official_homepage_extracts_current_cycle() -> None:
    text = """
    Atlanta Streetwear Market
    The World Famous ATLANTA STREETWEAR MARKET
    Be the first to Join thousands of creators at the April 2026 Atlanta Streetwear Market on April 25-26.
    GRAB TICKETS FOR ASWM SPRING '26
    """

    show = parse_official_homepage(text, today=date(2026, 3, 11))

    assert show == {
        "title": "Atlanta Streetwear Market",
        "start_date": "2026-04-25",
        "end_date": "2026-04-26",
    }


def test_parse_venue_listing_extracts_future_facility_label() -> None:
    html = """
    <html>
      <body>
        <p><a href="https://www.atlantastreetwearmarket.com/">4/26 - 4/26 ATL Streetwear Market</a></p>
        <p><em>Atlanta Expo Centers - North Facility</em></p>
      </body>
    </html>
    """

    facility = parse_venue_listing(html, today=date(2026, 3, 11))

    assert facility == "Atlanta Expo Centers - North Facility"


def test_parse_official_homepage_rejects_past_cycle() -> None:
    text = "Be the first to Join thousands of creators at the April 2026 Atlanta Streetwear Market on April 25-26."

    try:
        parse_official_homepage(text, today=date(2026, 4, 27))
    except ValueError as exc:
        assert "past-dated cycle" in str(exc)
    else:
        raise AssertionError("Expected past-only Atlanta Streetwear Market cycle to be rejected")
