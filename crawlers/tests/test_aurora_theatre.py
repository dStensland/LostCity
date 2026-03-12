from sources.aurora_theatre import extract_price_info, parse_date_range


def test_parse_date_range_handles_full_month_span():
    start_date, end_date = parse_date_range("Jan 22, 2026-Feb 15, 2026")

    assert start_date == "2026-01-22"
    assert end_date == "2026-02-15"


def test_extract_price_info_reads_standard_ticket_section():
    body_text = """
    Buy Tickets
    Tickets:
    $150 | Standard Pricing
    Date: March 7, 2026 | 6PM
    Location: Lawrenceville Arts Center Campus
    """

    price_min, price_max, price_note = extract_price_info(body_text)

    assert price_min == 150.0
    assert price_max == 150.0
    assert price_note == "$150 | Standard Pricing"


def test_extract_price_info_reads_starting_price_language():
    body_text = """
    ABOUT
    A bold new musical.
    Buy Tickets
    Tickets start at $22.50 for previews and $30 for weekends.
    Date: April 4, 2026
    """

    price_min, price_max, price_note = extract_price_info(body_text)

    assert price_min == 22.5
    assert price_max == 30.0
    assert "Tickets start at $22.50" in price_note
