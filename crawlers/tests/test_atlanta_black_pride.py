from sources.atlanta_black_pride import _parse_weekend_date_range


def test_parse_weekend_date_range_handles_compact_dates() -> None:
    start_date, end_date = _parse_weekend_date_range("09/05/26 - 09/07/26")
    assert start_date == "2026-09-05"
    assert end_date == "2026-09-07"

