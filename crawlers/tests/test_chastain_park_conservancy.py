from sources.chastain_park_conservancy import (
    _build_destination_envelope,
    _extract_calendar_events,
    _extract_our_events,
)


def test_build_destination_envelope_for_chastain_park() -> None:
    envelope = _build_destination_envelope(2601)

    assert envelope.destination_details[0]["place_id"] == 2601
    assert envelope.destination_details[0]["destination_type"] == "park"
    assert envelope.destination_details[0]["parking_type"] == "free_lot"
    assert "stroller" in envelope.destination_details[0]["practical_notes"].lower()
    assert {feature["slug"] for feature in envelope.venue_features} == {
        "athletic-swimming-pool-and-summer-aquatics",
        "family-meetup-lawns-and-pavilion-space",
        "playground-and-open-green-space",
        "walking-trails-and-path-loops",
        "outdoor-classroom-and-park-programs",
        "slow-pace-meetup-park-day",
    }


def test_extract_our_events_parses_flagship_conservancy_events() -> None:
    html = """
    <html><body>
      <article>
        Upcoming Conservancy Events
        Wine Chastain April 18
        Wine Chastain is an intimate wine and food tasting experience in beautiful Chastain Park.
        Tickets Now Available
        Home & Garden Tour May 2
        A curated tour of stunning Chastain homes and gardens.
        Register
      </article>
    </body></html>
    """

    events = _extract_our_events(html)
    titles = {event["title"] for event in events}

    assert "Wine Chastain" in titles
    assert "Home & Garden Tour" in titles


def test_extract_calendar_events_parses_public_workshops() -> None:
    html = """
    <html><body>
      <article>
        March 2026
        CPC- Meadow Maintenance Workshop
        CPC- Meadow Maintenance Workshop
        March 20, 2026
        9:00 am - 12:00 pm
        Allison Brown Garden
        See more details
        CPCA- Easter Egg Hunt
        CPCA- Easter Egg Hunt
        March 28, 2026
        10:00 am - 12:00 pm
        Chastain Park Playground
        See more details
      </article>
    </body></html>
    """

    events = _extract_calendar_events(html)
    titles = {event["title"] for event in events}

    assert "Chastain Park Meadow Maintenance Workshop" in titles
    assert "Chastain Park Easter Egg Hunt" in titles
