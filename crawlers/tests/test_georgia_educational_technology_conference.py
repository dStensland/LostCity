from datetime import date

from sources.georgia_educational_technology_conference import parse_homepage


def test_parse_homepage_extracts_current_gaetc_cycle() -> None:
    html = """
    <html>
      <body>
        <a href="https://conference.gaetc.org/attend-gaetc/">ATTEND</a>
        <h1>Georgia Educational Technology Conference</h1>
        <p>November 4-6, 2026</p>
        <p>Georgia International Convention Center</p>
        <p>2000 Convention Center Concourse, Atlanta, Ga. 30337</p>
      </body>
    </html>
    """

    event = parse_homepage(html, today=date(2026, 3, 11))

    assert event == {
        "title": "Georgia Educational Technology Conference",
        "start_date": "2026-11-04",
        "end_date": "2026-11-06",
        "source_url": "https://conference.gaetc.org/",
        "ticket_url": "https://conference.gaetc.org/attend-gaetc/",
        "description": "GaETC is Georgia’s flagship educational technology conference, bringing educators, school leaders, exhibitors, and EdTech practitioners together for sessions, workshops, and statewide professional learning.",
    }

