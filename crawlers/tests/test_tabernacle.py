from sources.tabernacle import SHOWS_URL, build_event_record


def test_build_event_record_uses_event_url_for_source_and_ticket():
    record = build_event_record(
        source_id=7,
        venue_id=11,
        title="Humbe - Dueno Del Cielo Tour",
        start_date="2026-03-11",
        category="music",
        subcategory="concert",
        tags=["music", "concert", "tabernacle"],
        event_url="https://www.ticketmaster.com/humbe-dueno-del-cielo-tour-atlanta-georgia-03-11-2026/event/0E006384F11EF36D",
        image_url="https://img.example.com/humbe.jpg",
        raw_text="WED 11 MAR - Humbe - Dueno Del Cielo Tour",
    )

    assert record["source_url"].startswith("https://www.ticketmaster.com/")
    assert record["ticket_url"] == record["source_url"]
    assert record["content_hash"]


def test_build_event_record_leaves_ticket_url_blank_when_only_listing_url_exists():
    record = build_event_record(
        source_id=7,
        venue_id=11,
        title="Unknown Event",
        start_date="2026-04-01",
        category="music",
        subcategory="concert",
        tags=["music", "concert", "tabernacle"],
        event_url=SHOWS_URL,
        image_url=None,
        raw_text="TUE 01 APR - Unknown Event",
    )

    assert record["source_url"] == SHOWS_URL
    assert record["ticket_url"] is None
