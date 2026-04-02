from sources._tribe_events_html_base import parse_date_from_text, parse_time_from_text


def test_parse_date_from_text_handles_abbreviated_month() -> None:
    parsed = parse_date_from_text("Apr 10")
    assert parsed is not None
    assert parsed.endswith("-04-10")


def test_parse_date_from_text_handles_full_month_and_year() -> None:
    assert parse_date_from_text("February 23, 2026") == "2026-02-23"


def test_parse_time_from_text_handles_am_pm() -> None:
    assert parse_time_from_text("10:30 am") == "10:30"
    assert parse_time_from_text("2:15 pm") == "14:15"


def test_parse_date_from_text_returns_none_for_garbage() -> None:
    assert parse_date_from_text("not a date") is None
