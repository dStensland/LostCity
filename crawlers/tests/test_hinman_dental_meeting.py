from datetime import date

from sources.hinman_dental_meeting import NoCurrentCycleError, parse_source_pages


def test_parse_source_pages_extracts_hinman_cycle() -> None:
    homepage_html = """
    <html>
      <body>
        <a href="https://www.prereg.net/2026/hd">Register Now!</a>
      </body>
    </html>
    """
    prereg_html = """
    <html>
      <head>
        <meta
          name="description"
          content="World-Class Dental CE, Cutting-Edge Exhibits and Long-Lasting Connections - Join us for the Hinman Dental Meeting, March 12-14, 2026 in Atlanta. Register now or learn more at Hinman.org."
        />
        <meta property="og:image" content="imagesLocal/logoFull.jpg" />
      </head>
    </html>
    """

    event = parse_source_pages(homepage_html, prereg_html, today=date(2026, 3, 11))

    assert event == {
        "title": "The Thomas P. Hinman Dental Meeting 2026",
        "start_date": "2026-03-12",
        "end_date": "2026-03-14",
        "ticket_url": "https://www.prereg.net/2026/hd",
        "image_url": "https://www.prereg.net/2026/hd/imagesLocal/logoFull.jpg",
        "description": "The Thomas P. Hinman Dental Meeting is a destination dental convention for continuing education, exhibits, practice innovation, and professional networking in Atlanta.",
        "source_url": "https://www.hinman.org/",
    }


def test_parse_source_pages_rejects_past_cycle() -> None:
    homepage_html = """
    <html>
      <body>
        <a href="https://www.prereg.net/2026/hd">Register Now!</a>
      </body>
    </html>
    """
    prereg_html = """
    <html>
      <head>
        <meta
          name="description"
          content="World-Class Dental CE, Cutting-Edge Exhibits and Long-Lasting Connections - Join us for the Hinman Dental Meeting, March 12-14, 2026 in Atlanta. Register now or learn more at Hinman.org."
        />
      </head>
    </html>
    """

    try:
        parse_source_pages(homepage_html, prereg_html, today=date(2026, 3, 15))
    except NoCurrentCycleError as exc:
        assert "past-dated cycle" in str(exc)
    else:
        raise AssertionError("Expected past-only Hinman cycle to be rejected")
