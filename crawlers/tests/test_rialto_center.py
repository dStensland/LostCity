from dedupe import generate_content_hash
from sources.rialto_center import (
    clean_description,
    determine_category,
    parse_iso_datetime,
    parse_jsonld_events,
    parse_offer_fields,
)


EVENTS_HTML = """
<html>
  <head>
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Event",
        "name": "Tony Jackson",
        "description": "Tony Jackson - Rialto Series\\nThursday, Mar. 12, 2026 | 8:00 PM",
        "startDate": "2026-03-12T20:00:00-04:00",
        "endDate": "2026-03-12",
        "offers": {
          "@type": "Offer",
          "url": "https://events.rialtocenter.gsu.edu/Online/default.asp?BOparam::WScontent::loadArticle::permalink=jackson26",
          "price": "$39-$79"
        },
        "location": {
          "@type": "Place",
          "name": "Rialto Center for the Arts"
        },
        "url": "https://calendar.gsu.edu/event/tony-jackson",
        "image": "https://localist-images.azureedge.net/photos/50215710488581/huge/example.jpg"
      }
    </script>
    <script type="application/ld+json">
      {"@context": "https://schema.org", "@type": "Organization", "name": "Rialto"}
    </script>
  </head>
</html>
"""


def test_parse_jsonld_events_extracts_event_objects():
    events = parse_jsonld_events(EVENTS_HTML)

    assert len(events) == 1
    assert events[0]["name"] == "Tony Jackson"


def test_parse_iso_datetime_handles_date_only_end_date():
    start_date, start_time = parse_iso_datetime("2026-03-12T20:00:00-04:00")
    end_date, end_time = parse_iso_datetime("2026-03-12")

    assert start_date == "2026-03-12"
    assert start_time == "20:00"
    assert end_date == "2026-03-12"
    assert end_time is None


def test_parse_offer_fields_parses_range_and_ticket_url():
    price_min, price_max, price_note, ticket_url, is_free = parse_offer_fields(
        {
            "@type": "Offer",
            "url": "https://events.rialtocenter.gsu.edu/Online/default.asp?BOparam::WScontent::loadArticle::permalink=jackson26",
            "price": "$39-$79",
        }
    )

    assert price_min == 39
    assert price_max == 79
    assert price_note == "$39-$79"
    assert ticket_url.endswith("permalink=jackson26")
    assert is_free is False


def test_determine_category_flags_music_events():
    category, subcategory, tags = determine_category(
        "GSU Jazz Band with Special Guest Patrick Bartley",
        "A high-energy night of jazz featuring the Georgia State University Jazz Band.",
    )

    assert category == "music"
    assert subcategory == "live"
    assert "live-music" in tags


def test_clean_description_strips_html():
    cleaned = clean_description("<p>Free and <strong>open</strong> to the public.</p>")

    assert cleaned == "Free and open to the public."


def test_content_hash_basis_matches_screening_pattern():
    content_hash = generate_content_hash(
        "Tony Jackson",
        "Rialto Center for the Arts",
        "2026-03-12|20:00",
    )

    assert isinstance(content_hash, str)
    assert len(content_hash) == 32
