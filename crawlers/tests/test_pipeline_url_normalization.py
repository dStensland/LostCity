from pipeline_main import _normalize_discovery_seed_urls


def test_normalize_discovery_seed_urls_absolutizes_relative_links() -> None:
    seed = {
        "detail_url": "?date=3/6/2026&display=event&eventid=2516695",
        "ticket_url": "/tickets/live-music",
        "image_url": "/images/poster.jpg",
    }

    normalized = _normalize_discovery_seed_urls(seed, "https://cafe.hardrock.com/atlanta/event-calendar.aspx")

    assert normalized["detail_url"] == (
        "https://cafe.hardrock.com/atlanta/event-calendar.aspx?date=3/6/2026&display=event&eventid=2516695"
    )
    assert normalized["ticket_url"] == "https://cafe.hardrock.com/tickets/live-music"
    assert normalized["image_url"] == "https://cafe.hardrock.com/images/poster.jpg"


def test_normalize_discovery_seed_urls_keeps_absolute_and_data_urls() -> None:
    seed = {
        "detail_url": "https://example.com/event/123",
        "ticket_url": "mailto:boxoffice@example.com",
        "image_url": "data:image/png;base64,AAAA",
    }

    normalized = _normalize_discovery_seed_urls(seed, "https://example.com/events")

    assert normalized["detail_url"] == "https://example.com/event/123"
    assert normalized["ticket_url"] == "mailto:boxoffice@example.com"
    assert normalized["image_url"] == "data:image/png;base64,AAAA"
