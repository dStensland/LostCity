from sources.sandy_springs_pac import determine_category, parse_date_range, parse_time


def test_parse_date_range_same_month():
    start_date, end_date = parse_date_range("March 13 - 29")

    assert start_date == "2026-03-13"
    assert end_date == "2026-03-29"


def test_parse_date_range_cross_month():
    start_date, end_date = parse_date_range("February 18 - March 15")

    assert start_date == "2026-02-18"
    assert end_date == "2026-03-15"


def test_parse_time_accepts_hour_without_minutes():
    assert parse_time("6 PM") == "18:00"


def test_determine_category_prefers_wellness():
    category, subcategory, tags = determine_category(
        "The New R&R: Sound Bath Meditation",
        "Experience a unique form of relaxation with sound healing.",
    )

    assert category == "wellness"
    assert subcategory is None
    assert "wellness" in tags
