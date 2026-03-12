from sources.variety_playhouse import build_event_record


def test_build_event_record_uses_detail_page_as_source_and_leaves_ticket_url_blank():
    record = build_event_record(
        source_id=7,
        venue_id=11,
        title="Dehd",
        description="With Laser Background",
        start_date="2026-04-18",
        start_time="20:00",
        price_note="Sold Out",
        source_url="https://www.variety-playhouse.com/events/detail/dehd",
        image_url="https://img.example.com/dehd.jpg",
        raw_text="Dehd - Laser Background",
    )

    assert record["source_url"] == "https://www.variety-playhouse.com/events/detail/dehd"
    assert record["ticket_url"] is None
    assert record["price_note"] == "Sold Out"
    assert record["content_hash"]
