from datetime import date

from sources.transact import parse_homepage


def test_parse_homepage_extracts_transact_sessions_from_jsonld() -> None:
    html = """
    <html>
      <body>
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Event",
            "name": "TRANSACT 2026",
            "description": "TRANSACT gathers payments leaders, fintech operators, and merchants in Atlanta.",
            "startDate": "2026-03-18T08:00:00-04:00",
            "endDate": "2026-03-20T12:30:00-04:00",
            "location": {
              "@type": "Place",
              "name": "Georgia World Congress Center",
              "address": {
                "@type": "PostalAddress",
                "streetAddress": "285 Andrew Young International Blvd NW",
                "addressLocality": "Atlanta",
                "addressRegion": "GA",
                "postalCode": "30313"
              }
            },
            "image": [
              "https://transactshow.com/wp-content/uploads/2023/11/T26_LogoLockup_WHT_605x182.png"
            ],
            "offers": {
              "@type": "AggregateOffer",
              "url": "https://transactshow.com/register/"
            },
            "eventSchedule": [
              {
                "@type": "Schedule",
                "startDate": "2026-03-18",
                "startTime": "08:00:00",
                "endTime": "18:30:00"
              },
              {
                "@type": "Schedule",
                "startDate": "2026-03-19",
                "startTime": "07:00:00",
                "endTime": "17:30:00"
              },
              {
                "@type": "Schedule",
                "startDate": "2026-03-20",
                "startTime": "08:00:00",
                "endTime": "12:30:00"
              }
            ]
          }
        </script>
      </body>
    </html>
    """

    event = parse_homepage(html, today=date(2026, 3, 11))

    assert event == {
        "title": "TRANSACT 2026",
        "source_url": "https://www.transactshow.com/",
        "ticket_url": "https://transactshow.com/register/",
        "image_url": "https://transactshow.com/wp-content/uploads/2023/11/T26_LogoLockup_WHT_605x182.png",
        "description": "TRANSACT gathers payments leaders, fintech operators, and merchants in Atlanta.",
        "venue": {
            "name": "Georgia World Congress Center",
            "slug": "georgia-world-congress-center",
            "address": "285 Andrew Young International Blvd NW",
            "city": "Atlanta",
            "state": "GA",
            "zip": "30313",
            "place_type": "convention_center",
            "spot_type": "convention_center",
            "website": "https://www.gwcca.org/",
        },
        "sessions": [
            {
                "title": "TRANSACT 2026",
                "start_date": "2026-03-18",
                "start_time": "08:00",
                "end_time": "18:30",
            },
            {
                "title": "TRANSACT 2026",
                "start_date": "2026-03-19",
                "start_time": "07:00",
                "end_time": "17:30",
            },
            {
                "title": "TRANSACT 2026",
                "start_date": "2026-03-20",
                "start_time": "08:00",
                "end_time": "12:30",
            },
        ],
    }
