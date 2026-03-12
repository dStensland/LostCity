from datetime import date

from sources.modex import parse_homepage


def test_parse_homepage_extracts_modex_cycle() -> None:
    html = """
    <html>
      <head>
        <meta
          name="description"
          content="MODEX 2026 - The Premier Supply Chain Experience Trade Show. April 13-16, 2026, Atlanta GA."
        />
        <meta property="og:image" content="https://og.mhi.org/images/social-media/MX26-social-image.png" />
      </head>
      <body>
        <a href="/register">REGISTER FOR FREE</a>
      </body>
    </html>
    """

    event = parse_homepage(html, today=date(2026, 3, 11))

    assert event == {
        "title": "MODEX 2026",
        "start_date": "2026-04-13",
        "end_date": "2026-04-16",
        "ticket_url": "https://modexshow.com/register",
        "image_url": "https://og.mhi.org/images/social-media/MX26-social-image.png",
        "description": "MODEX 2026 - The Premier Supply Chain Experience Trade Show. April 13-16, 2026, Atlanta GA.",
        "source_url": "https://modexshow.com/",
    }
