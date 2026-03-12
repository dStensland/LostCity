from datetime import date

from sources.atlanta_camping_rv_show import parse_show_details


def test_parse_show_details_extracts_daily_sessions_and_prices() -> None:
    text = """
    The Largest All-Indoor RV Show in Georgia
    January 21-24, 2027
    Atlanta Exposition Center South
    3850 Jonesboro Road, Atlanta, GA 30354
    Show Hours:
    Thursday January 21 11:00 AM-7:00 PM
    Friday January 22 10:00AM-7:00 PM
    Saturday January 23 9:00 AM-7:00 PM
    Sunday January 24 10:00 AM-5:00 PM
    On-Line Pricing for Single Day Entry Discount Applied
    Thursday or Friday Adult $10.00
    Kids 16 and under Free
    Saturday or Sunday Adult $12.00
    Kids 16 and Under Free
    """

    show = parse_show_details(text, today=date(2026, 3, 11))

    assert show["start_date"] == "2027-01-21"
    assert show["end_date"] == "2027-01-24"
    assert show["sessions"] == [
        {
            "title": "Atlanta Camping & RV Show",
            "weekday": "thursday",
            "start_date": "2027-01-21",
            "start_time": "11:00",
            "end_time": "19:00",
            "price": 10.0,
        },
        {
            "title": "Atlanta Camping & RV Show",
            "weekday": "friday",
            "start_date": "2027-01-22",
            "start_time": "10:00",
            "end_time": "19:00",
            "price": 10.0,
        },
        {
            "title": "Atlanta Camping & RV Show",
            "weekday": "saturday",
            "start_date": "2027-01-23",
            "start_time": "09:00",
            "end_time": "19:00",
            "price": 12.0,
        },
        {
            "title": "Atlanta Camping & RV Show",
            "weekday": "sunday",
            "start_date": "2027-01-24",
            "start_time": "10:00",
            "end_time": "17:00",
            "price": 12.0,
        },
    ]


def test_parse_show_details_rejects_past_only_cycle() -> None:
    text = """
    January 21-24, 2027
    Thursday January 21 11:00 AM-7:00 PM
    Friday January 22 10:00AM-7:00 PM
    Saturday January 23 9:00 AM-7:00 PM
    Sunday January 24 10:00 AM-5:00 PM
    """

    try:
        parse_show_details(text, today=date(2027, 1, 25))
    except ValueError as exc:
        assert "past-dated cycle" in str(exc)
    else:
        raise AssertionError("Expected past-only Atlanta Camping & RV Show cycle to be rejected")
