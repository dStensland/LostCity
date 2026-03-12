from datetime import date

from sources.importexpo_atlanta import parse_atlanta_page


def test_parse_atlanta_page_extracts_current_official_event() -> None:
    html = """
    <html>
      <body>
        <p>COBB CONVENTION CENTER</p>
        <p>COBB CONVENTION CENTER</p>
        <p>2 GALLERIA PKWY SE</p>
        <p>ATLANTA, GA 30339</p>
        <p>SATURDAY MAY 16, 2026</p>
        <p>5PM-10PM</p>
        <p>GENERAL ADMISSION</p>
        <p>$25.00 + SERVICE FEES (PRE-SALE)</p>
        <p>$35.00 + SERVICE FEES (DAY OF SHOW)</p>
        <p>KIDS UNDER 12 FREE w/ ACCOMPANIED ADULT</p>
      </body>
    </html>
    """

    event = parse_atlanta_page(html, today=date(2026, 3, 11))

    assert event == {
        "title": "ImportExpo Car Show",
        "start_date": "2026-05-16",
        "start_time": "17:00",
        "end_time": "22:00",
        "postal_code": "30339",
        "price_min": 25.0,
        "price_max": 35.0,
        "price_note": "General admission $25 presale / $35 day-of-show. Kids under 12 free with accompanied adult.",
        "description": "IMPORTEXPO Atlanta is an indoor automotive and car-culture show featuring modified vehicles, music, vendors, and enthusiast showcase entries at Cobb Convention Center.",
    }
