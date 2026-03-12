from datetime import date

from sources.critical_materials_minerals_expo import parse_attend_page


def test_parse_attend_page_extracts_daily_sessions() -> None:
    html = """
    <html>
      <body>
        <h1>Register To Attend I Critical Minerals Expo, North America</h1>
        <p>October 28 2026 Conference: 09:30 – 16:30 Expo: 09:00 – 17:00</p>
        <p>October 29 2026 Conference: 09:30 – 15:30 Expo: 09:00 – 16:30</p>
        <p>Cobb Convention Center Two Galleria Parkway Atlanta, Georgia 30339</p>
      </body>
    </html>
    """

    show = parse_attend_page(html, today=date(2026, 3, 11))

    assert show == {
        "title": "Critical Materials & Minerals Expo 2026 (North America)",
        "source_url": "https://criticalmineralsexpona.com/register-attend",
        "sessions": [
            {
                "title": "Critical Materials & Minerals Expo 2026 (North America)",
                "start_date": "2026-10-28",
                "start_time": "09:00",
                "end_time": "17:00",
            },
            {
                "title": "Critical Materials & Minerals Expo 2026 (North America)",
                "start_date": "2026-10-29",
                "start_time": "09:00",
                "end_time": "16:30",
            },
        ],
    }

