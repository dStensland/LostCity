from sources.sports_social import parse_detail_page, parse_event_links_from_html


LISTING_HTML = """
<html><body>
  <a href="https://liveatthebatteryatlanta.com/events-and-entertainment/events/20260315-march-hoops">
    March Hoops
  </a>
  <a href="https://liveatthebatteryatlanta.com/events-and-entertainment/events/20260320-nfc-fight-night">
    NFC Fight Night
  </a>
  <a href="https://liveatthebatteryatlanta.com/private-events">
    Private Events
  </a>
</body></html>
"""

DETAIL_HTML = """
<html>
  <head>
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Event",
        "name": "NFC Fight Night",
        "description": "The Fights are BACK! Live professional and amateur MMA at Sports & Social.",
        "startDate": "2026-03-20T17:00:00.000-04:00",
        "endDate": "2026-03-20T23:00:00.000-04:00",
        "image": "https://example.com/nfc.png",
        "location": {
          "@type": "Place",
          "name": "Sports & Social Atlanta",
          "address": {
            "@type": "PostalAddress",
            "streetAddress": "825 Battery Ave SE, Suite 600",
            "addressLocality": "Atlanta",
            "addressRegion": "GA",
            "postalCode": "30339",
            "addressCountry": "US"
          }
        },
        "offers": {
          "@type": "Offer",
          "url": "https://www.nfcfighting.com/",
          "availability": "https://schema.org/InStock"
        }
      }
    </script>
  </head>
  <body>
    <div class="EventDetail_upper_button__WFXY0">
      <a href="https://www.nfcfighting.com/">Buy Tickets Now</a>
    </div>
    <p>TICKET PRICES</p>
    <p>General Admission Standing Tickets: $50</p>
    <p>Premium Reserved Cageside Table of 8: $1,600</p>
  </body>
</html>
"""


def test_parse_event_links_from_html_filters_event_detail_urls():
    links = parse_event_links_from_html(LISTING_HTML)

    assert links == [
        "https://liveatthebatteryatlanta.com/events-and-entertainment/events/20260315-march-hoops",
        "https://liveatthebatteryatlanta.com/events-and-entertainment/events/20260320-nfc-fight-night",
    ]


def test_parse_detail_page_extracts_sports_social_event_fields():
    parsed = parse_detail_page(
        DETAIL_HTML,
        "https://liveatthebatteryatlanta.com/events-and-entertainment/events/20260320-nfc-fight-night",
    )

    assert parsed == {
        "title": "NFC Fight Night",
        "description": "The Fights are BACK! Live professional and amateur MMA at Sports & Social.",
        "location_name": "Sports & Social Atlanta",
        "start_date": "2026-03-20",
        "start_time": "17:00",
        "end_date": "2026-03-20",
        "end_time": "23:00",
        "category": "sports",
        "subcategory": "sports.mma",
        "tags": [
            "sports",
            "sports-bar",
            "the-battery",
            "sports-social",
            "mma",
            "fight-night",
            "combat-sports",
        ],
        "price_min": 50.0,
        "price_max": 1600.0,
        "price_note": "$50-$1600",
        "is_free": False,
        "source_url": "https://liveatthebatteryatlanta.com/events-and-entertainment/events/20260320-nfc-fight-night",
        "ticket_url": "https://www.nfcfighting.com/",
        "image_url": "https://example.com/nfc.png",
        "cta_label": "Buy Tickets Now",
    }
