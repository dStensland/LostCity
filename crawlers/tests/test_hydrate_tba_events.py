from hydrate_tba_events import enrich_single_event


def test_enrich_single_event_skips_generic_class_hub_urls():
    event = {
        "source_url": "https://classes.inquicker.com/?ClientID=12422",
        "ticket_url": None,
    }

    assert enrich_single_event(event) == {}


def test_enrich_single_event_skips_shared_calendar_urls():
    event = {
        "source_url": "https://cscatl.gnosishosting.net/Events/Calendar",
        "ticket_url": None,
    }

    assert enrich_single_event(event) == {}


def test_enrich_single_event_skips_vimeo_showcases():
    event = {
        "source_url": "https://vimeo.com/showcase/9027934?autoplay=1",
        "ticket_url": None,
    }

    assert enrich_single_event(event) == {}


def test_enrich_single_event_skips_dream_schedule_release_page():
    event = {
        "source_url": "https://dream.wnba.com/2026-schedule-release",
        "ticket_url": "https://dream.wnba.com/single-game-tickets",
    }

    assert enrich_single_event(event) == {}
