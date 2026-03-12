from sources.park_tavern import parse_detail_page, parse_event_links_from_html


LISTING_HTML = """
<html><body>
  <a href="https://www.parktavern.com/event/get-lucky-fest26/">Get Lucky Fest</a>
  <a href="https://www.parktavern.com/event/march-madness-table-park-tavern/">March Madness VIP Table</a>
  <a href="https://www.parktavern.com/private-events/">Private Events</a>
</body></html>
"""


DETAIL_HTML = """
<html>
  <head>
    <script type="application/ld+json">
      {
        "@context": "http://schema.org/",
        "@type": "Event",
        "name": "March Madness VIP Table at Park Tavern",
        "description": "<p>Park Tavern is the March Madness command center in Midtown with every game on the big screens.</p>",
        "image": ["https://www.parktavern.com/wp-content/uploads/2026/02/march-madness.jpg"],
        "startDate": "2026-03-15 18:00:00",
        "endDate": "2026-03-15 23:00:00"
      }
    </script>
  </head>
  <body>
    <a href="https://www.bigtickets.com/events/parktavern/march-madness-table">Buy Tickets</a>
  </body>
</html>
"""


def test_parse_event_links_from_html_filters_event_detail_urls():
    links = parse_event_links_from_html(LISTING_HTML)

    assert links == [
        "https://www.parktavern.com/event/get-lucky-fest26/",
        "https://www.parktavern.com/event/march-madness-table-park-tavern/",
    ]


def test_parse_detail_page_extracts_sports_watch_party_fields():
    parsed = parse_detail_page(
        DETAIL_HTML,
        "https://www.parktavern.com/event/march-madness-table-park-tavern/",
    )

    assert parsed == {
        "title": "March Madness VIP Table at Park Tavern",
        "description": "Park Tavern is the March Madness command center in Midtown with every game on the big screens.",
        "start_date": "2026-03-15",
        "start_time": "18:00",
        "end_date": "2026-03-15",
        "end_time": "23:00",
        "category": "sports",
        "subcategory": "watch_party",
        "tags": ["sports", "watch-party", "basketball", "piedmont-park"],
        "is_free": False,
        "source_url": "https://www.parktavern.com/event/march-madness-table-park-tavern/",
        "ticket_url": "https://www.bigtickets.com/events/parktavern/march-madness-table",
        "image_url": "https://www.parktavern.com/wp-content/uploads/2026/02/march-madness.jpg",
        "raw_text": "{\"@context\": \"http://schema.org/\", \"@type\": \"Event\", \"name\": \"March Madness VIP Table at Park Tavern\", \"description\": \"<p>Park Tavern is the March Madness command center in Midtown with every game on the big screens.</p>\", \"image\": [\"https://www.parktavern.com/wp-content/uploads/2026/02/march-madness.jpg\"], \"startDate\": \"2026-03-15 18:00:00\", \"endDate\": \"2026-03-15 23:00:00\"}",
    }
