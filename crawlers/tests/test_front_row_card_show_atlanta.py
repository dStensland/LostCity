from datetime import date

from sources.front_row_card_show_atlanta import parse_atlanta_page


def test_parse_atlanta_page_extracts_show_days_and_trade_night() -> None:
    html = """
    <html>
      <body>
        <h1>Atlanta | Mar 28-29</h1>
        <p>COBB CONVENTION CENTER ATLANTA</p>
        <p>2 Galleria Parkway, Atlanta, GA 30339</p>
        <p>TICKETS ARE AVAILABLE NOW - CLICK HERE FOR TICKETS</p>
        <p>SATURDAY, MARCH 28</p>
        <p>SHOW HOURS - 11:00 AM to 5:00 PM</p>
        <p>(VIPs enter at 10:00 AM)</p>
        <p>TRADE NIGHT - 5:30 PM to 9:00 PM at CardsHQ</p>
        <p>SUNDAY, MARCH 29</p>
        <p>SHOW HOURS - 11:00 AM to 5:00 PM</p>
        <p>(VIPs enter at 10:00 AM)</p>
        <p>Official Trade Night will take place on Saturday 5:30 PM to 9:00 PM at CardsHQ located at 3101 Cobb Pkwy SE, Suite 100, Atlanta, GA 30339.</p>
      </body>
    </html>
    """

    events = parse_atlanta_page(html, today=date(2026, 3, 11))

    assert events == [
        {
            "title": "Front Row Card Show",
            "start_date": "2026-03-28",
            "start_time": "11:00",
            "end_time": "17:00",
            "venue": {
                "name": "Cobb Convention Center (Cobb Galleria Centre)",
                "slug": "cobb-convention-center-cobb-galleria-centre",
                "address": "2 Galleria Parkway",
                "city": "Atlanta",
                "state": "GA",
                "zip": "30339",
                "place_type": "convention_center",
                "spot_type": "convention_center",
                "website": "https://cobbgalleria.com/",
            },
            "price_min": 10.0,
            "price_max": 25.0,
            "price_note": "General admission $10 advance / $15 door. VIP early entry starts at 10:00 AM.",
            "is_free": False,
        },
        {
            "title": "Front Row Card Show Trade Night",
            "start_date": "2026-03-28",
            "start_time": "17:30",
            "end_time": "21:00",
            "venue": {
                "name": "CardsHQ",
                "slug": "cardshq",
                "address": "3101 Cobb Pkwy SE, Suite 100",
                "city": "Atlanta",
                "state": "GA",
                "zip": "30339",
                "place_type": "event_space",
                "spot_type": "event_space",
                "website": "https://cardshq.com/",
            },
            "price_min": 0.0,
            "price_max": 0.0,
            "price_note": "Official trade night at CardsHQ; entry is free.",
            "is_free": True,
        },
        {
            "title": "Front Row Card Show",
            "start_date": "2026-03-29",
            "start_time": "11:00",
            "end_time": "17:00",
            "venue": {
                "name": "Cobb Convention Center (Cobb Galleria Centre)",
                "slug": "cobb-convention-center-cobb-galleria-centre",
                "address": "2 Galleria Parkway",
                "city": "Atlanta",
                "state": "GA",
                "zip": "30339",
                "place_type": "convention_center",
                "spot_type": "convention_center",
                "website": "https://cobbgalleria.com/",
            },
            "price_min": 10.0,
            "price_max": 25.0,
            "price_note": "General admission $10 advance / $15 door. VIP early entry starts at 10:00 AM.",
            "is_free": False,
        },
    ]
