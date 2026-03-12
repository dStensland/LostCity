from datetime import date

from sources.okecon_tcg import parse_homepage


def test_parse_homepage_extracts_current_okecon_cycle() -> None:
    html = """
    <html>
      <body>
        <a href="https://Okecon.eventbrite.com">Buy Tickets</a>
        <a href="https://okeconvendor.eventbrite.com">Vendor Registration</a>
        <p>Atlanta’s TCG-Only Marketplace for Collectors, Players & Families</p>
        <p>April 25-26TH · GICC · Atlanta</p>
        <p>What is OkeCon TCG? OkeCon TCG is a trading card game event built around the games and collectibles people come for. This is a place to buy, sell, trade, and connect. What to Expect</p>
        <footer>2026 OkeCon TCG LLC. All rights reserved.</footer>
      </body>
    </html>
    """

    event = parse_homepage(html, today=date(2026, 3, 11))

    assert event == {
        "title": "OkeCon TCG",
        "start_date": "2026-04-25",
        "end_date": "2026-04-26",
        "source_url": "https://www.okecontcg.com/",
        "ticket_url": "https://Okecon.eventbrite.com",
        "vendor_url": "https://okeconvendor.eventbrite.com",
        "description": "OkeCon TCG is a trading card game event built around the games and collectibles people come for. This is a place to buy, sell, trade, and connect.",
    }

