from datetime import date

from sources.atlanta_black_expo import parse_next_event_range, parse_session_blocks, parse_time_range


def test_parse_time_range_handles_expo_homepage_format() -> None:
    assert parse_time_range("10AM-5PM") == ("10:00", "17:00")
    assert parse_time_range("9AM-10AM") == ("09:00", "10:00")


def test_parse_next_event_range_extracts_2026_window() -> None:
    text = """
    Georgia World Congress Center
    Atlanta, Georgia
    TBA
    Next Event
    February 20 - 22 2026
    """

    window = parse_next_event_range(text, today=date(2026, 3, 11))

    assert window["start_date"].isoformat() == "2026-02-20"
    assert window["end_date"].isoformat() == "2026-02-22"


def test_parse_session_blocks_extracts_all_homepage_program_blocks() -> None:
    text = """
    Next Event February 20 - 22 2026
    Friday 20th
    Education Day:
    Speakers & Workshops
    (10AM-5PM)
    Black Foodie Friday:
    Food/Drink Tastings & Competition
    (5PM-9PM)
    Saturday 21ST
    Exhibitor Showcase:
    300+ Exhibitors
    (10AM-5PM)
    Homecoming Tailgate Party:
    Old School Music
    Game Night
    (5PM-9PM)
    Sunday 22ND
    Prayer & Worship:
    (9AM-10AM)
    Exhibitor Showcase:
    300+ Exhibitors
    (10AM-5PM)
    Our Economic Impact Goal
    """

    sessions = parse_session_blocks(text, date(2026, 2, 20))

    assert sessions == [
        {
            "title": "Atlanta Black Expo: Education Day",
            "description": "Speakers & Workshops",
            "start_date": "2026-02-20",
            "start_time": "10:00",
            "end_date": None,
            "end_time": "17:00",
            "is_all_day": False,
        },
        {
            "title": "Atlanta Black Expo: Black Foodie Friday",
            "description": "Food/Drink Tastings & Competition",
            "start_date": "2026-02-20",
            "start_time": "17:00",
            "end_date": None,
            "end_time": "21:00",
            "is_all_day": False,
        },
        {
            "title": "Atlanta Black Expo: Exhibitor Showcase",
            "description": "300+ Exhibitors",
            "start_date": "2026-02-21",
            "start_time": "10:00",
            "end_date": None,
            "end_time": "17:00",
            "is_all_day": False,
        },
        {
            "title": "Atlanta Black Expo: Homecoming Tailgate Party",
            "description": "Old School Music Game Night",
            "start_date": "2026-02-21",
            "start_time": "17:00",
            "end_date": None,
            "end_time": "21:00",
            "is_all_day": False,
        },
        {
            "title": "Atlanta Black Expo: Prayer & Worship",
            "description": "Official Atlanta Black Expo program block.",
            "start_date": "2026-02-22",
            "start_time": "09:00",
            "end_date": None,
            "end_time": "10:00",
            "is_all_day": False,
        },
        {
            "title": "Atlanta Black Expo: Exhibitor Showcase",
            "description": "300+ Exhibitors",
            "start_date": "2026-02-22",
            "start_time": "10:00",
            "end_date": None,
            "end_time": "17:00",
            "is_all_day": False,
        },
    ]
