from datetime import date

from sources.culture_collision import parse_homepage


def test_parse_homepage_extracts_daily_public_sessions() -> None:
    html = """
    <html>
      <body>
        <p>June 5th-7th, 2026</p>
        <p>GICC, Atlanta, GA</p>
        <p>Location: 2000 Convention Center Concourse College Park, GA 30337</p>
        <p>Friday, June 5th 3 PM VIP Early Entry 4 PM General Admission 9 PM Show Ends</p>
        <p>Saturday, June 6th 9 AM VIP Early Entry 10 AM General Admission 7 PM Show Ends 7:30 PM Trade Night TBA</p>
        <p>Sunday, June 7th 9 AM VIP Early Entry 10 PM General Admission 4 PM Show Ends</p>
      </body>
    </html>
    """

    sessions = parse_homepage(html, today=date(2026, 3, 11))

    assert sessions == [
        {
            "title": "Culture Collision",
            "start_date": "2026-06-05",
            "start_time": "16:00",
            "end_time": "21:00",
        },
        {
            "title": "Culture Collision",
            "start_date": "2026-06-06",
            "start_time": "10:00",
            "end_time": "19:00",
        },
        {
            "title": "Culture Collision",
            "start_date": "2026-06-07",
            "start_time": "10:00",
            "end_time": "16:00",
        },
    ]
