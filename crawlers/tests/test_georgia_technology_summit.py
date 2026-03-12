from datetime import date

from sources.georgia_technology_summit import parse_homepage


def test_parse_homepage_extracts_gts_from_jsonld() -> None:
    html = """
    <html>
      <body>
        <a href="https://members.tagonline.org/ap/Events/Register/wZF4vw0FeCxCw">REGISTER HERE</a>
        <script type="application/ld+json">
          {
            "@context": "http://schema.org",
            "@type": "Event",
            "name": "2026 Georgia Technology Summit",
            "startDate": "2026-04-30 08:00",
            "endDate": "2026-04-30 19:00",
            "description": "Georgia Technology Summit brings together 1000+ Georgia-focused technologists to network, learn, and engage with the latest trends in Georgia innovation.",
            "offers": {
              "@type": "Offer",
              "url": "https://www.georgiatechnologysummit.com"
            }
          }
        </script>
      </body>
    </html>
    """

    event = parse_homepage(html, today=date(2026, 3, 11))

    assert event == {
        "title": "Georgia Technology Summit",
        "start_date": "2026-04-30",
        "start_time": "08:00",
        "end_time": "19:00",
        "ticket_url": "https://members.tagonline.org/ap/Events/Register/wZF4vw0FeCxCw",
        "source_url": "https://www.georgiatechnologysummit.com/",
        "description": "Georgia Technology Summit brings together 1000+ Georgia-focused technologists to network, learn, and engage with the latest trends in Georgia innovation.",
    }
