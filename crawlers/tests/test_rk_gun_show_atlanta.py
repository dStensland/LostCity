from datetime import date

from sources.rk_gun_show_atlanta import extract_event_urls, parse_event_page


def test_extract_event_urls_returns_unique_atlanta_pages() -> None:
    html = """
    <html>
      <body>
        <a href="https://rkshows.com/event/atlanta-ga-gun-show-032826/">March</a>
        <a href="https://rkshows.com/event/atlanta-ga-gun-show-032826/">March Dup</a>
        <a href="https://rkshows.com/event/atlanta-ga-gun-show-091926/">September</a>
        <a href="https://rkshows.com/event/atlanta-ga-gun-show/">Ignore</a>
      </body>
    </html>
    """

    assert extract_event_urls(html) == [
        "https://rkshows.com/event/atlanta-ga-gun-show-032826/",
        "https://rkshows.com/event/atlanta-ga-gun-show-091926/",
    ]


def test_parse_event_page_extracts_daily_sessions_from_jsonld_and_text() -> None:
    html = """
    <html>
      <head>
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Event",
              "name": "Atlanta, GA - Gun Show",
              "description": "Looking for a great way to spend a day or the weekend of May 16-17, 2026? If you are a gun collector or are a hunting enthusiast, the gun show at the Atlanta Expo Center in Atlanta, GA is a great place to spend some time.",
              "image": {
                "@id": "https://rkshows.com/wp-content/uploads/2024/11/atlanta-gun-show.jpg"
              },
              "startDate": "2026-05-16T00:00:00-05:00",
              "endDate": "2026-05-17T23:59:59-05:00",
              "location": {
                "@type": "Place",
                "name": "Atlanta Expo Center",
                "address": {
                  "@type": "PostalAddress",
                  "streetAddress": "3650 Jonesboro Rd SE",
                  "addressLocality": "Atlanta",
                  "addressRegion": "GA",
                  "postalCode": "30354"
                }
              }
            }
          ]
        }
        </script>
      </head>
      <body>
        <p>Schedule Show Hours: Saturday: 9 AM – 5 PM Sunday: 10 AM – 4 PM</p>
        <p>Tickets Adults(Ages 13 & up): $16, VIP: $18.50 – no line, no wait Children(Ages 6-12): $6, VIP: $8.50 – no line, no wait</p>
      </body>
    </html>
    """

    show = parse_event_page(
        html,
        "https://rkshows.com/event/atlanta-ga-gun-show-051626/",
        today=date(2026, 3, 11),
    )

    assert show == {
        "title": "R.K. Atlanta Gun Show",
        "source_url": "https://rkshows.com/event/atlanta-ga-gun-show-051626/",
        "image_url": "https://rkshows.com/wp-content/uploads/2024/11/atlanta-gun-show.jpg",
        "description": "Looking for a great way to spend a day or the weekend of May 16-17, 2026? If you are a gun collector or are a hunting enthusiast, the gun show at the Atlanta Expo Center in Atlanta, GA is a great place to spend some time.",
        "venue": {
            "name": "Atlanta Expo Center",
            "slug": "atlanta-expo-center",
            "address": "3650 Jonesboro Rd SE",
            "city": "Atlanta",
            "state": "GA",
            "zip": "30354",
            "venue_type": "convention_center",
            "spot_type": "convention_center",
            "website": "https://rkshows.com/",
        },
        "price_min": 16.0,
        "price_max": 18.5,
        "price_note": "Adults 13+ $16; VIP $18.50; Children 6-12 $6.",
        "sessions": [
            {
                "title": "R.K. Atlanta Gun Show",
                "start_date": "2026-05-16",
                "start_time": "09:00",
                "end_time": "17:00",
            },
            {
                "title": "R.K. Atlanta Gun Show",
                "start_date": "2026-05-17",
                "start_time": "10:00",
                "end_time": "16:00",
            },
        ],
    }
