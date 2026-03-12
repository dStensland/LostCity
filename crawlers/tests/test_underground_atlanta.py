from sources.underground_atlanta import determine_category, extract_detail_urls, parse_event_jsonld


LISTING_HTML = """
<html>
  <body>
    <a href="https://www.undergroundatl.com/events/underground-comedy-club-open-mic-comedy-2026-09-11-23-00">Comedy</a>
    <a href="https://www.undergroundatl.com/events/underground-comedy-club-open-mic-comedy-2026-09-11-23-00&amp;quote=foo">Share</a>
  </body>
</html>
"""


DETAIL_HTML = """
<html>
  <head>
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Event",
        "name": "Underground Comedy Club: Open Mic Comedy",
        "description": "FREE open mic comedy every Friday.",
        "startDate": "2026-09-11T23:00:00-04:00",
        "endDate": "2026-09-12T03:00:00-04:00",
        "image": {"url": "https://static.wixstatic.com/example.png"}
      }
    </script>
  </head>
</html>
"""


def test_extract_detail_urls_filters_share_links():
    assert extract_detail_urls(LISTING_HTML) == [
        "https://www.undergroundatl.com/events/underground-comedy-club-open-mic-comedy-2026-09-11-23-00"
    ]


def test_parse_event_jsonld_extracts_event():
    event = parse_event_jsonld(DETAIL_HTML)

    assert event["name"] == "Underground Comedy Club: Open Mic Comedy"
    assert event["startDate"] == "2026-09-11T23:00:00-04:00"


def test_determine_category_uses_comedy():
    category, subcategory, tags = determine_category(
        "Underground Comedy Club: Open Mic Comedy",
        "FREE open mic comedy every Friday.",
    )

    assert category == "comedy"
    assert subcategory is None
    assert "comedy" in tags
