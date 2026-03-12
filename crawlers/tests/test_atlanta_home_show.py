from datetime import date

from sources.atlanta_home_show import parse_show_info_page


def test_parse_show_info_page_extracts_daily_sessions() -> None:
    html = """
    <html>
      <body>
        <a href="https://atlantahomeshow.mpetickets.com/">Buy Tickets</a>
        <p>Atlanta Home Show March 20-22, 2026 Cobb Galleria Centre</p>
        <p>Friday March 20, 2026 10:00AM - 6:00PM Saturday March 21, 2026 10:00AM - 8:00PM Sunday March 22, 2026 11:00AM - 5:00PM</p>
        <p>Show Location Cobb Convention Center Atlanta Two Galleria Parkway Atlanta, GA 30339 CobbGalleria.com</p>
      </body>
    </html>
    """

    show = parse_show_info_page(html, today=date(2026, 3, 11))

    assert show == {
        "title": "Atlanta Home Show",
        "source_url": "https://www.atlantahomeshow.com/attendee-info/show-info",
        "ticket_url": "https://atlantahomeshow.mpetickets.com/",
        "sessions": [
            {
                "title": "Atlanta Home Show",
                "weekday": "friday",
                "start_date": "2026-03-20",
                "start_time": "10:00",
                "end_time": "18:00",
            },
            {
                "title": "Atlanta Home Show",
                "weekday": "saturday",
                "start_date": "2026-03-21",
                "start_time": "10:00",
                "end_time": "20:00",
            },
            {
                "title": "Atlanta Home Show",
                "weekday": "sunday",
                "start_date": "2026-03-22",
                "start_time": "11:00",
                "end_time": "17:00",
            },
        ],
    }

