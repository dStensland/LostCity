from unittest.mock import patch

from sources.four04_weekend import (
    build_child_event,
    crawl,
    normalize_title,
    parse_collection_event_urls,
    parse_detail_jsonld,
    parse_event_series,
    parse_schedule_cards,
    parse_schedule_text,
)


HOMEPAGE_HTML = """
<html>
  <head>
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "EventSeries",
        "name": "404 Day Weekend 2026",
        "startDate": "2026-04-01T00:00:00-04:00",
        "endDate": "2026-04-04T23:59:00-04:00",
        "subEvent": [
          {
            "@type": "Event",
            "name": "404 Day! Weekend City Takeover",
            "url": "https://404weekend.com/event/404-day-weekend-city-takeover/"
          },
          {
            "@type": "Event",
            "name": "2nd Annual 404 Day! Parade",
            "url": "https://404weekend.com/event/2nd-annual-404-day-parade/"
          },
          {
            "@type": "Event",
            "name": "404 Day! Weekend Celebration &amp; Night Party",
            "url": "https://404weekend.com/event/404-day-weekend-celebration-night-party/"
          }
        ]
      }
    </script>
  </head>
</html>
"""


EVENTS_HTML = """
<html>
  <head>
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "mainEntity": {
          "@type": "ItemList",
          "itemListElement": [
            {
              "@type": "Event",
              "name": "404 Day! Weekend City Takeover",
              "url": "https://404weekend.com/event/404-day-weekend-city-takeover/",
              "image": {"@type": "ImageObject", "url": "https://404weekend.com/city.png"}
            },
            {
              "@type": "Event",
              "name": "2nd Annual 404 Day! Parade",
              "url": "https://404weekend.com/event/2nd-annual-404-day-parade/",
              "image": {"@type": "ImageObject", "url": "https://404weekend.com/parade.png"}
            },
            {
              "@type": "Event",
              "name": "404 Day! Weekend Celebration &amp; Night Party",
              "url": "https://404weekend.com/event/404-day-weekend-celebration-night-party/",
              "image": {"@type": "ImageObject", "url": "https://404weekend.com/night.png"}
            }
          ]
        }
      }
    </script>
  </head>
  <body>
    <div class="events-grid">
      <div class="event-card">
        <h3 class="event-title">404 Day! Weekend City Takeover</h3>
        <p class="event-time">Wednesday, April 1 • 12:00 AM – Saturday, April 4 • 11:59 PM</p>
        <p class="event-location">All Around Atlanta</p>
        <p class="event-description">A citywide lineup of partner events and activations.</p>
        <a class="event-button" href="https://404weekend.com/event/404-day-weekend-city-takeover/">See Details</a>
      </div>
      <div class="event-card">
        <h3 class="event-title">2nd Annual 404 Day! Parade</h3>
        <p class="event-time">Saturday, April 4th • 10am</p>
        <p class="event-location">Downtown Atlanta</p>
        <p class="event-description">Experience the 2nd Annual 404 Day Parade during 404 Day! Weekend 2026.</p>
        <a class="event-button" href="https://www.eventeny.com/events/2nd-404-day-parade-27361/">REGISTER YOUR GROUP!</a>
      </div>
      <div class="event-card">
        <h3 class="event-title">404 Day! Weekend Celebration &amp; Night Party</h3>
        <p class="event-time">Saturday, April 4th • 9PM – 1AM</p>
        <p class="event-location">The Stave Room</p>
        <p class="event-description">The official after dark celebration.</p>
        <a class="event-button" href="https://posh.vip/e/404-day-celebration-the-stave-room">GET YOUR TICKET!</a>
      </div>
    </div>
  </body>
</html>
"""


PARADE_HTML = """
<html>
  <head>
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Event",
        "name": "2nd Annual 404 Day Parade",
        "startDate": "2026-04-04T10:00:00-04:00",
        "endDate": "2026-04-04T12:00:00-04:00",
        "url": "https://404weekend.com/parade/",
        "offers": {
          "@type": "Offer",
          "url": "https://www.eventeny.com/events/2nd-404-day-parade-27361/"
        }
      }
    </script>
  </head>
</html>
"""


CITY_HTML = """
<html>
  <head>
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Event",
        "name": "404 Day! Weekend City Takeover",
        "startDate": "2026-04-01T00:00:00-04:00",
        "endDate": "2026-04-01T23:59:00-04:00",
        "image": {"@type": "ImageObject", "url": "https://404weekend.com/city-detail.png"}
      }
    </script>
  </head>
</html>
"""


NIGHT_HTML = """
<html>
  <head>
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Event",
        "name": "404 Day! Weekend Celebration &amp; Night Party",
        "startDate": "2026-04-04T21:00:00-04:00",
        "endDate": "2026-04-04T23:59:00-04:00",
        "image": {"@type": "ImageObject", "url": "https://404weekend.com/night-detail.png"},
        "offers": {
          "@type": "Offer",
          "url": "https://posh.vip/e/404-day-celebration-the-stave-room"
        }
      }
    </script>
  </head>
</html>
"""


def test_parse_schedule_text_handles_multiday_window():
    parsed = parse_schedule_text(
        "Wednesday, April 1 • 12:00 AM – Saturday, April 4 • 11:59 PM",
        2026,
    )

    assert parsed["start_date"] == "2026-04-01"
    assert parsed["start_time"] == "00:00"
    assert parsed["end_date"] == "2026-04-04"
    assert parsed["end_time"] == "23:59"


def test_parse_schedule_cards_handles_overnight_party():
    cards = parse_schedule_cards(EVENTS_HTML, 2026)
    party = cards["404 Day Weekend Celebration & Night Party"]

    assert party["start_date"] == "2026-04-04"
    assert party["start_time"] == "21:00"
    assert party["end_date"] == "2026-04-05"
    assert party["end_time"] == "01:00"


def test_parse_jsonld_helpers_extract_series_and_urls():
    series = parse_event_series(HOMEPAGE_HTML)
    urls = parse_collection_event_urls(EVENTS_HTML)
    detail = parse_detail_jsonld(PARADE_HTML)

    assert series["name"] == "404 Day Weekend 2026"
    assert urls["404 Day Weekend City Takeover"]["url"].endswith("/404-day-weekend-city-takeover/")
    assert detail["endDate"] == "2026-04-04T12:00:00-04:00"


def test_build_child_event_marks_parade_free_and_suppresses_registration_ticket():
    cards = parse_schedule_cards(EVENTS_HTML, 2026)
    parade = build_child_event(
        source_id=1,
        title="2nd Annual 404 Day Parade",
        card=cards["2nd Annual 404 Day Parade"],
        collection_event=parse_collection_event_urls(EVENTS_HTML)["2nd Annual 404 Day Parade"],
        detail_event=parse_detail_jsonld(PARADE_HTML),
        parade_event=parse_detail_jsonld(PARADE_HTML),
    )

    assert parade["source_url"] == "https://404weekend.com/parade/"
    assert parade["is_free"] is True
    assert parade["ticket_url"] is None
    assert parade["price_note"] == "Free to attend; group registration available"
    assert parade["end_time"] == "12:00"
    assert "Ralph McGill Ave" in parade["description"]


def test_crawl_stitches_parent_and_child_events():
    html_by_url = {
        "https://404weekend.com": HOMEPAGE_HTML,
        "https://404weekend.com/events/": EVENTS_HTML,
        "https://404weekend.com/parade/": PARADE_HTML,
        "https://404weekend.com/event/404-day-weekend-city-takeover/": CITY_HTML,
        "https://404weekend.com/event/2nd-annual-404-day-parade/": PARADE_HTML,
        "https://404weekend.com/event/404-day-weekend-celebration-night-party/": NIGHT_HTML,
    }

    inserted_titles = []

    with patch("sources.four04_weekend._fetch_html", side_effect=lambda url: html_by_url[url]):
        with patch("sources.four04_weekend.get_or_create_venue", side_effect=[11, 12, 13, 14]):
            with patch("sources.four04_weekend.find_event_by_hash", return_value=None):
                with patch("sources.four04_weekend.insert_event", side_effect=lambda record: inserted_titles.append(record["title"])):
                    found, new, updated = crawl({"id": 99, "slug": "404-weekend"})

    assert found == 4
    assert new == 4
    assert updated == 0
    assert inserted_titles[0] == "404 Day Weekend 2026"
    assert "404 Day Weekend City Takeover" in inserted_titles
    assert "2nd Annual 404 Day Parade" in inserted_titles
    assert "404 Day Weekend Celebration & Night Party" in inserted_titles
    assert normalize_title("404 Day! Weekend Celebration &amp; Night Party") == "404 Day Weekend Celebration & Night Party"
