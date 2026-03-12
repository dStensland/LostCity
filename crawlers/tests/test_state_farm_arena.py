from sources.state_farm_arena import build_event_record, determine_category


def test_build_event_record_leaves_ticket_url_blank_for_detail_enrichment():
    record = build_event_record(
        source_id=9,
        venue_id=11,
        title="Eric Church",
        start_date="2026-03-20",
        start_time="19:30",
        category="music",
        subcategory="concert",
        tags=["concert", "state-farm-arena"],
        source_url="https://www.statefarmarena.com/events/detail/eric-church",
        image_url="https://img.example.com/eric.jpg",
    )

    assert record["source_url"] == "https://www.statefarmarena.com/events/detail/eric-church"
    assert record["ticket_url"] is None
    assert record["content_hash"]


def test_determine_category_routes_known_non_sports_titles_out_of_sports():
    mana_category, mana_subcategory, _ = determine_category("MANÁ")
    gabriel_category, gabriel_subcategory, gabriel_tags = determine_category("Gabriel Iglesias")

    assert mana_category == "music"
    assert mana_subcategory == "concert"
    assert gabriel_category == "nightlife"
    assert gabriel_subcategory == "comedy"
    assert "comedy" in gabriel_tags
