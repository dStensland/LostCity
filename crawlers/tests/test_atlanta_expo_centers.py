from datetime import date

from sources.atlanta_expo_centers import parse_event_blocks


def test_parse_event_blocks_extracts_future_public_events_and_skips_dedicated() -> None:
    html = """
    <html>
      <body>
        <p>Dates Current as of 12/27/2024. Please visit the events website for more information.</p>
        <h2>April</h2>
        <p><a href="http://www.nationwideexpos.com">4/17 - 4/19 -Nationwide Expo Home Show</a></p>
        <p><em>Atlanta Expo Centers - South Facility</em></p>
        <p><a href="http://www.infodo.com">4/24 - 4/27 - Cherokee Rose Cluster Dog Show</a></p>
        <p><em>Atlanta Expo Centers - South Facility</em></p>
        <p>Shopping for your pet is also available.</p>
        <p><a href="https://www.atlantastreetwearmarket.com/">4/26 - 4/26 ATL Streetwear Market</a></p>
        <p><em>Atlanta Expo Centers - North Facility</em></p>
        <h2>August</h2>
        <p><a href="https://totallyradvf.com">8/15 Totally Rad Vintage Fest</a></p>
        <p><em>Atlanta Expo Centers - South Facility</em></p>
      </body>
    </html>
    """

    events = parse_event_blocks(html, today=date(2026, 3, 11))

    assert events == [
        {
            "title": "Cherokee Rose Cluster Dog Show",
            "start_date": "2026-04-24",
            "end_date": "2026-04-27",
            "facility": "Atlanta Expo Centers - South Facility",
            "ticket_url": "http://www.infodo.com",
            "source_url": "http://www.infodo.com",
            "note_text": "Shopping for your pet is also available.",
        },
        {
            "title": "Totally Rad Vintage Fest",
            "start_date": "2026-08-15",
            "end_date": None,
            "facility": "Atlanta Expo Centers - South Facility",
            "ticket_url": "https://totallyradvf.com",
            "source_url": "https://totallyradvf.com",
            "note_text": None,
        },
    ]


def test_parse_event_blocks_skips_invalid_or_private_rows() -> None:
    html = """
    <html>
      <body>
        <p>2026 SCHEDULE</p>
        <h2>January</h2>
        <p>1/19-1/23 - PDI Ride & Drive Event</p>
        <p>Atlanta Expo Centers - North Lot.</p>
        <p>Not open to the public, Parking lot only.</p>
        <h2>March</h2>
        <p>2/28-2/29 National Arms Show</p>
        <p>Atlanta Expo Centers - North Facility</p>
        <h2>April</h2>
        <p>4/17 - 4/19 Nationwide Expo Home Show</p>
        <p>Atlanta Expo Centers - South Facility</p>
      </body>
    </html>
    """

    events = parse_event_blocks(html, today=date(2026, 1, 1))

    assert events == []
