from datetime import date

from sources.smu_steel_summit import parse_pages


def test_parse_pages_extracts_current_smu_cycle() -> None:
    home_html = """
    <html>
      <body>
        <a href="register">Register</a>
        <p>SMU Steel Summit 2026 August 24-26, 2026</p>
      </body>
    </html>
    """
    venue_html = """
    <html>
      <body>
        <h1>Venue</h1>
        <p>Georgia International Convention Center</p>
        <p>2000 Convention Center Concourse College Park, GA 30337</p>
      </body>
    </html>
    """

    event = parse_pages(home_html, venue_html, today=date(2026, 3, 11))

    assert event == {
        "title": "SMU Steel Summit",
        "start_date": "2026-08-24",
        "end_date": "2026-08-26",
        "source_url": "http://www.events.crugroup.com/smusteelsummit/venue",
        "ticket_url": "http://www.events.crugroup.com/smusteelsummit/register",
        "description": "SMU Steel Summit is a major North American steel-industry conference focused on market analysis, networking, trade, manufacturing, and business strategy.",
    }

