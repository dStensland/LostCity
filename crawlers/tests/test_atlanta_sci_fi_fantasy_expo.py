from datetime import date

from sources.atlanta_sci_fi_fantasy_expo import NoCurrentCycleError, parse_source_pages


def test_parse_source_pages_extracts_current_cycle() -> None:
    homepage_html = """
    <html>
      <body>
        <a href="https://www.eventbrite.com/e/atlanta-sci-fi-and-fantasy-expo-tickets-1969890924784">
          Get FREE Tickets
        </a>
        <p>Atlanta Sci-Fi & Fantasy Expo</p>
        <p>March 14-15, 2026</p>
        <p>Northlake Mall, Atlanta GA</p>
      </body>
    </html>
    """
    schedule_html = """
    <html>
      <body>
        <h1>2026 Schedule</h1>
        <p>March 14-15, 2026</p>
        <p>Northlake Mall, Atlanta GA</p>
      </body>
    </html>
    """
    ticket_html = """
    <html>
      <head>
        <script type="application/ld+json">
          {
            "@context": "http://schema.org",
            "@type": "BusinessEvent",
            "name": "Atlanta Sci-Fi and Fantasy Expo",
            "startDate": "2026-03-14T11:00:00-04:00",
            "endDate": "2026-03-14T19:00:00-04:00",
            "image": "https://img.evbuc.com/example.jpg",
            "location": {
              "@type": "Place",
              "name": "Northlake Mall",
              "address": {
                "@type": "PostalAddress",
                "streetAddress": "4800 Briarcliff Road Northeast, Atlanta, GA 30345"
              }
            }
          }
        </script>
      </head>
    </html>
    """

    event = parse_source_pages(
        homepage_html,
        schedule_html,
        ticket_html,
        today=date(2026, 3, 11),
    )

    assert event == {
        "title": "Atlanta Sci-Fi & Fantasy Expo",
        "start_date": "2026-03-14",
        "end_date": "2026-03-15",
        "ticket_url": "https://www.eventbrite.com/e/atlanta-sci-fi-and-fantasy-expo-tickets-1969890924784",
        "image_url": "https://img.evbuc.com/example.jpg",
        "source_url": "https://atlantascifiexpo.com/schedule/",
        "description": "Atlanta Sci-Fi & Fantasy Expo is a free fan convention built around creators, panels, gaming, workshops, vendors, cosplay, and community fandom at Northlake Mall.",
        "saturday_start_time": "11:00",
        "saturday_end_time": "19:00",
    }


def test_parse_source_pages_rejects_past_cycle() -> None:
    homepage_html = """
    <html><body><a href="https://www.eventbrite.com/example">Get FREE Tickets</a><p>March 14-15, 2026</p><p>Northlake Mall</p></body></html>
    """
    schedule_html = "<html><body><p>March 14-15, 2026 Northlake Mall</p></body></html>"

    try:
        parse_source_pages(homepage_html, schedule_html, "", today=date(2026, 3, 16))
    except NoCurrentCycleError as exc:
        assert "past-dated cycle" in str(exc)
    else:
        raise AssertionError("Expected past-only Atlanta Sci-Fi & Fantasy Expo cycle to be rejected")
