from datetime import date

from sources.groomd import NoCurrentCycleError, parse_registration_page


def test_parse_registration_page_extracts_current_cycle() -> None:
    text = """
    GROOM’D FAQs
    When is the next GROOM’D?
    GROOM’D 2026 takes place Friday, March 13 – Sunday, March 15, 2026.
    Where is GROOM’D located?
    GROOM’D will be held at the Georgia International Convention Center, 2000 Convention Center Concourse, College Park, GA 30337.
    Is GROOM’D open to the public?
    GROOM’D is a trade-only event; however, children are permitted to attend.
    """

    event = parse_registration_page(text, today=date(2026, 3, 11))

    assert event == {
        "title": "Groom'd",
        "start_date": "2026-03-13",
        "end_date": "2026-03-15",
        "trade_only": True,
    }


def test_parse_registration_page_rejects_past_cycle() -> None:
    text = """
    GROOM’D 2026 takes place Friday, March 13 – Sunday, March 15, 2026.
    GROOM’D will be held at the Georgia International Convention Center, 2000 Convention Center Concourse, College Park, GA 30337.
    """

    try:
        parse_registration_page(text, today=date(2026, 3, 16))
    except NoCurrentCycleError as exc:
        assert "past-dated cycle" in str(exc)
    else:
        raise AssertionError("Expected past-only GROOM'D cycle to be rejected")
