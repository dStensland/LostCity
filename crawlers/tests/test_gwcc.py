from sources.gwcc import (
    determine_category,
    get_venue_for_event,
    normalize_date_text,
    parse_date_range,
    parse_card_date,
    should_skip_dedicated_event,
)


def test_normalize_date_text_strips_leading_day_number_and_month_period() -> None:
    assert normalize_date_text("16 Jan. 16, 2026") == "Jan 16, 2026"
    assert normalize_date_text("8 Sept. 8-10, 2026") == "Sep 8-10, 2026"


def test_parse_date_range_handles_single_same_month_and_cross_month_ranges() -> None:
    assert parse_date_range("Jan. 16, 2026") == ("2026-01-16", None)
    assert parse_date_range("Jan. 8-11, 2026") == ("2026-01-08", "2026-01-11")
    assert parse_date_range("January 30 - February 2, 2026") == ("2026-01-30", "2026-02-02")


def test_parse_card_date_uses_fallback_year_for_short_dates() -> None:
    assert parse_card_date("March 12", 2026) == ("2026-03-12", None)


def test_gwcc_skips_dedicated_stadium_and_momocon_rows() -> None:
    assert should_skip_dedicated_event("MBS: AC/DC Concert @ 7P", "mercedes-benz-stadium") is True
    assert should_skip_dedicated_event("Atlanta United vs. Charlotte FC", "georgia-world-congress-center") is True
    assert should_skip_dedicated_event("MomoCon 2026", "georgia-world-congress-center") is True
    assert should_skip_dedicated_event("MODEX 2026", "georgia-world-congress-center") is True
    assert should_skip_dedicated_event("TRANSACT 2026", "georgia-world-congress-center") is True
    assert should_skip_dedicated_event("International Woodworking Fair 2026", "georgia-world-congress-center") is True
    assert should_skip_dedicated_event("The Thomas P. Hinman Dental Meeting 2026", "georgia-world-congress-center") is True


def test_gwcc_venue_and_category_inference_prefers_convention_center_rows() -> None:
    assert get_venue_for_event("International Woodworking Fair 2026", "")["slug"] == "georgia-world-congress-center"
    assert get_venue_for_event("Centennial Olympic Park July 4th", "Centennial Olympic Park")["slug"] == "centennial-olympic-park"
    assert determine_category("IBM TechXchange Conference 2026") == "community"
    assert determine_category("Tonight's Conversation Live & UNCUT") == "music"
