from datetime import date

from sources.stamp_scrapbook_expo import parse_event_page


def test_parse_event_page_extracts_main_show_floor_days() -> None:
    html = """
    <html>
      <body>
        <p>WHEN: July 17-18, 2026</p>
        <p>WHERE: Gas South Convention Center 6400 Sugarloaf Parkway Duluth, GA 30097</p>
        <p>TIME: Friday: 9am - 6pm Saturday: 9am - 5pm</p>
        <p>Online Admission Tickets: $12 | Friday (9am - 6pm) $12 | Saturday (9am - 5pm)</p>
      </body>
    </html>
    """

    sessions = parse_event_page(html, today=date(2026, 3, 11))

    assert sessions == [
        {
            "title": "Stamp & Scrapbook Expo",
            "start_date": "2026-07-17",
            "start_time": "09:00",
            "end_time": "18:00",
        },
        {
            "title": "Stamp & Scrapbook Expo",
            "start_date": "2026-07-18",
            "start_time": "09:00",
            "end_time": "17:00",
        },
    ]
