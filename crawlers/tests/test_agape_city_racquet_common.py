from sources.agape_city_racquet_common import (
    extract_table_year,
    parse_date_label,
    parse_time_range,
    should_skip_event,
)


def test_extract_table_year_prefers_event_heading_not_nav_years():
    text = """
    Adult Tennis Winter-Spring 2026
    Pickleball Winter-Spring 2026
    2024 Adult and Junior Tennis Events
    Date Event Time Cost Register
    """
    assert extract_table_year(text, "https://example.com/events/") == 2024


def test_parse_date_label_handles_multi_day_and_cross_year_ranges():
    assert parse_date_label("JUNE 15 & 16", 2024) == ("2024-06-15", "2024-06-16")
    assert parse_date_label("FEB 19, 20, 21, 22, 23", 2024) == ("2024-02-19", "2024-02-23")
    assert parse_date_label("DEC 26-27, 30-31, JAN 2-3", 2024) == ("2024-12-26", "2025-01-03")


def test_parse_time_range_borrows_meridian_from_end_time():
    assert parse_time_range("12:30 - 3:00 P.M.") == ("12:30", "15:00")
    assert parse_time_range("10:00 A.M. -12:00 P.M. & 6:00 – 8:00 P.M.") == ("10:00", "12:00")


def test_should_skip_event_filters_leagues_and_cross_promotions():
    assert should_skip_event("WORLD TEAM TENNIS LEAGUE", "Bitsy Grant Tennis Center") is True
    assert should_skip_event("ADULT SINGLES CHALLENGE LADDER", "Joseph McGhee Tennis Center") is True
    assert should_skip_event("FALL ALTA WARM UPS: MEN MATCH PLAY", "Sharon Lester Tennis Center at Piedmont Park") is True
    assert should_skip_event("RED & ORANGE BALL CHAMPIONSHIPS Held at Bitsy Grant Tennis Center", "Chastain Park Tennis Center") is True
    assert should_skip_event("FREE COMMUNITY TENNIS EVENT", "Washington Park Tennis Center") is False
