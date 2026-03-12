from datetime import date

from sources.scott_antique_markets import (
    build_market_sessions,
    parse_atlanta_location_details,
    parse_next_atlanta_show_range,
)


def test_parse_next_atlanta_show_range_extracts_next_official_weekend() -> None:
    text = """
    JOIN US AT OUR NEXT SHOW!
    Atlanta Show : Mar 12 - 15th
    Ohio Show : Mar 28th - 29th
    """

    start_date, end_date = parse_next_atlanta_show_range(text, today=date(2026, 3, 11))

    assert start_date.isoformat() == "2026-03-12"
    assert end_date.isoformat() == "2026-03-15"


def test_parse_next_atlanta_show_range_rolls_into_next_year() -> None:
    text = "Atlanta Show : Jan 8 - 11th"

    start_date, end_date = parse_next_atlanta_show_range(text, today=date(2026, 12, 20))

    assert start_date.isoformat() == "2027-01-08"
    assert end_date.isoformat() == "2027-01-11"


def test_parse_atlanta_location_details_extracts_hours_and_admission() -> None:
    text = """
    Atlanta Expo Centers
    3650 & 3850 Jonesboro Rd. SE, Atlanta, Georgia 30354
    Thursday: 10am-5pm
    Friday & Saturday: 9am-6pm
    Sunday: 10am-4pm
    Admission: $5 per person (CASH ONLY AT GATE). Good all weekend!
    Parking: Free!
    """

    venue_label, hours, admission_price, admission_note = parse_atlanta_location_details(text)

    assert venue_label == "Atlanta Expo Centers"
    assert hours["thursday"] == ("10:00", "17:00")
    assert hours["friday"] == ("09:00", "18:00")
    assert hours["saturday"] == ("09:00", "18:00")
    assert hours["sunday"] == ("10:00", "16:00")
    assert admission_price == 5.0
    assert admission_note == "CASH ONLY AT GATE"


def test_build_market_sessions_creates_daily_rows_from_show_window() -> None:
    sessions = build_market_sessions(
        date(2026, 3, 12),
        date(2026, 3, 15),
        {
            "thursday": ("10:00", "17:00"),
            "friday": ("09:00", "18:00"),
            "saturday": ("09:00", "18:00"),
            "sunday": ("10:00", "16:00"),
        },
    )

    assert sessions == [
        {"start_date": "2026-03-12", "start_time": "10:00", "end_time": "17:00"},
        {"start_date": "2026-03-13", "start_time": "09:00", "end_time": "18:00"},
        {"start_date": "2026-03-14", "start_time": "09:00", "end_time": "18:00"},
        {"start_date": "2026-03-15", "start_time": "10:00", "end_time": "16:00"},
    ]
