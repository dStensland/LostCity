from datetime import date

from sources.atlanta_home_and_remodeling_show import extract_product_urls, parse_product_page


def test_extract_product_urls_returns_unique_atlanta_pages() -> None:
    html = """
    <html>
      <body>
        <a href="https://nationwideexpos.com/product/atlanta-spring-2026/">Spring</a>
        <a href="https://nationwideexpos.com/product/atlanta-spring-2026/">Spring Dup</a>
        <a href="https://nationwideexpos.com/product/atlanta-oct-2026/?attribute_pa_booth=10x10">Fall</a>
        <a href="https://nationwideexpos.com/product/2026-rentals/">Ignore</a>
      </body>
    </html>
    """

    assert extract_product_urls(html) == [
        "https://nationwideexpos.com/product/atlanta-spring-2026/",
        "https://nationwideexpos.com/product/atlanta-oct-2026/",
    ]


def test_parse_product_page_extracts_daily_sessions() -> None:
    html = """
    <html>
      <head>
        <script type="application/ld+json">
        {
          "@context": "https://schema.org/",
          "@graph": [
            {
              "@type": "Product",
              "name": "April 17-19, 2026 | Atlanta Home and Remodeling Show - Atlanta, GA",
              "description": "Atlanta Home and Remodeling Show April 17-19, 2026 Friday 12:00pm - 6:00pm Saturday 10:00am – 5:00pm Sunday 11:00am – 4:00pm Atlanta Expo Center South 3850 Jonesboro Rd, Atlanta, GA 30354",
              "image": "https://nationwideexpos.com/wp-content/uploads/2024/04/Atlanta-2.png"
            }
          ]
        }
        </script>
      </head>
      <body>
        <h1>April 17-19, 2026 | Atlanta Home and Remodeling Show – Atlanta, GA</h1>
      </body>
    </html>
    """

    show = parse_product_page(
        html,
        "https://nationwideexpos.com/product/atlanta-spring-2026/",
        today=date(2026, 3, 11),
    )

    assert show == {
        "title": "Atlanta Home and Remodeling Show",
        "image_url": "https://nationwideexpos.com/wp-content/uploads/2024/04/Atlanta-2.png",
        "source_url": "https://nationwideexpos.com/product/atlanta-spring-2026/",
        "sessions": [
            {
                "title": "Atlanta Home and Remodeling Show",
                "weekday": "friday",
                "start_date": "2026-04-17",
                "start_time": "12:00",
                "end_time": "18:00",
            },
            {
                "title": "Atlanta Home and Remodeling Show",
                "weekday": "saturday",
                "start_date": "2026-04-18",
                "start_time": "10:00",
                "end_time": "17:00",
            },
            {
                "title": "Atlanta Home and Remodeling Show",
                "weekday": "sunday",
                "start_date": "2026-04-19",
                "start_time": "11:00",
                "end_time": "16:00",
            },
        ],
    }
