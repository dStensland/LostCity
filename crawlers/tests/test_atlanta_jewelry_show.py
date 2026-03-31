from datetime import date

from sources.atlanta_jewelry_show import NoCurrentCycleError, parse_show_window


def test_parse_show_window_extracts_current_spring_season() -> None:
    text = """
    AJS Spring 2026 | March 14-15, 2026 | Cobb Convention Center, Atlanta | #AJS2026
    Buyers and exhibitors are carefully qualified to ensure meaningful business connections
    """

    show = parse_show_window(text, today=date(2026, 3, 11))

    assert show == {
        "title": "AJS Spring 2026",
        "season": "spring",
        "year": 2026,
        "start_date": "2026-03-14",
        "end_date": "2026-03-15",
    }


def test_parse_show_window_rejects_past_only_season() -> None:
    text = "AJS Spring 2026 | March 14-15, 2026 | Cobb Convention Center, Atlanta | #AJS2026"

    try:
        parse_show_window(text, today=date(2026, 3, 16))
    except NoCurrentCycleError as exc:
        assert "past-dated season" in str(exc)
    else:
        raise AssertionError("Expected past-only season to be rejected")


def test_parse_show_window_handles_marketing_copy_between_title_and_dates() -> None:
    text = """
    AJS Fall 2026
    Where buyers and exhibitors connect through education, networking, and sourcing.
    August 22-23, 2026
    Cobb Convention Center, Atlanta
    """

    show = parse_show_window(text, today=date(2026, 3, 31))

    assert show == {
        "title": "AJS Fall 2026",
        "season": "fall",
        "year": 2026,
        "start_date": "2026-08-22",
        "end_date": "2026-08-23",
    }
