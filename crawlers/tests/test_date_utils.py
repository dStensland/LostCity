from datetime import date

from date_utils import normalize_iso_date, parse_human_date


def test_parse_human_date_rolls_to_next_year_near_year_end():
    # December crawl parsing a January date should roll into next year.
    parsed = parse_human_date(
        "Jan 15",
        today=date(2026, 12, 10),
    )
    assert parsed == "2027-01-15"


def test_parse_human_date_does_not_create_far_future_artifact():
    # February crawl parsing an already-past January date should stay in 2026,
    # not roll to 2027.
    parsed = parse_human_date(
        "Jan 15",
        today=date(2026, 2, 10),
    )
    assert parsed == "2026-01-15"


def test_normalize_iso_date_heals_plus_one_year_bug():
    # Common bug: next-year date when same month/day this year is plausible.
    normalized = normalize_iso_date(
        "2027-02-19",
        today=date(2026, 2, 10),
    )
    assert normalized == "2026-02-19"


def test_normalize_iso_date_rejects_unhealable_far_future():
    normalized = normalize_iso_date(
        "2028-10-01",
        today=date(2026, 2, 10),
    )
    assert normalized is None
