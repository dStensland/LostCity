from datetime import date

from sources.atlanta_shoe_market import parse_show_dates


def test_parse_show_dates_extracts_daily_sessions() -> None:
    text = """
    Show Dates
    Location:
    Cobb Convention Center – 2 Galleria Pkwy SE, Atlanta, GA 30339
    August 15-17, 2026
    Saturday, August 15, 2026 -  9:00 AM – 6:00 PM
    Sunday, August 16, 2026 - 9:00 AM – 6:00 PM
    Monday, August 17, 2026  - 9:00 AM – 4:00 PM
    """

    sessions = parse_show_dates(text, today=date(2026, 3, 11))

    assert sessions == [
        {
            "title": "Atlanta Shoe Market",
            "weekday": "saturday",
            "start_date": "2026-08-15",
            "start_time": "09:00",
            "end_time": "18:00",
        },
        {
            "title": "Atlanta Shoe Market",
            "weekday": "sunday",
            "start_date": "2026-08-16",
            "start_time": "09:00",
            "end_time": "18:00",
        },
        {
            "title": "Atlanta Shoe Market",
            "weekday": "monday",
            "start_date": "2026-08-17",
            "start_time": "09:00",
            "end_time": "16:00",
        },
    ]


def test_parse_show_dates_rejects_past_only_cycle() -> None:
    text = """
    August 15-17, 2026
    Saturday, August 15, 2026 -  9:00 AM – 6:00 PM
    Sunday, August 16, 2026 - 9:00 AM – 6:00 PM
    Monday, August 17, 2026  - 9:00 AM – 4:00 PM
    """

    try:
        parse_show_dates(text, today=date(2026, 8, 18))
    except ValueError as exc:
        assert "past-dated show" in str(exc)
    else:
        raise AssertionError("Expected past-only Atlanta Shoe Market cycle to be rejected")
