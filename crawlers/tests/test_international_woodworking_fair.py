from datetime import date

from sources.international_woodworking_fair import parse_source_pages


def test_parse_source_pages_extracts_daily_iwf_sessions() -> None:
    homepage_html = """
    <html>
      <head>
        <meta property="og:image" content="https://iwfatlanta.com/wp-content/uploads/2026/01/iwf-business-rectangle-8.webp" />
      </head>
      <body>
        <p>
          Power up your business August 25–28, 2026, at the Georgia World Congress Center in Atlanta.
        </p>
      </body>
    </html>
    """
    attend_html = """
    <html>
      <body>
        <a href="https://registration.experientevent.com/ShowIWF261/">Register to Attend</a>
        <p>Georgia World Congress Center, 285 Andrew Young International Blvd, Atlanta, GA 30313</p>
      </body>
    </html>
    """
    schedule_html = """
    <html>
      <body>
        <p>Exhibits can be seen in Building A, B, BC and C Exhibit Halls on Level 1 of the Georgia World Congress Center.</p>
        <p>Georgia World Congress Center, 285 Andrew Young International Blvd, Atlanta, GA 30313</p>
        <ul class="elementor-price-list">
          <li><span class="elementor-price-list-title">Tuesday, August 25</span><span class="elementor-price-list-price">8:30 am* - 5:00 pm</span></li>
          <li><span class="elementor-price-list-title">Wednesday, August 26</span><span class="elementor-price-list-price">8:30 am* - 5:00 pm</span></li>
          <li><span class="elementor-price-list-title">Thursday, August 27</span><span class="elementor-price-list-price">8:30 am* - 5:00 pm</span></li>
          <li><span class="elementor-price-list-title">Friday, August 28</span><span class="elementor-price-list-price">8:30 am* - 2:00 pm</span></li>
        </ul>
      </body>
    </html>
    """

    event = parse_source_pages(
        homepage_html,
        attend_html,
        schedule_html,
        today=date(2026, 3, 11),
    )

    assert event == {
        "title": "International Woodworking Fair",
        "source_url": "https://iwfatlanta.com/about-iwf/show-schedule/",
        "ticket_url": "https://registration.experientevent.com/ShowIWF261/",
        "image_url": "https://iwfatlanta.com/wp-content/uploads/2026/01/iwf-business-rectangle-8.webp",
        "description": "International Woodworking Fair is a destination trade show for woodworking machinery, materials, design, fabrication, and shop-floor innovation at Georgia World Congress Center.",
        "sessions": [
            {
                "title": "International Woodworking Fair",
                "weekday": "tuesday",
                "start_date": "2026-08-25",
                "start_time": "08:30",
                "end_time": "17:00",
            },
            {
                "title": "International Woodworking Fair",
                "weekday": "wednesday",
                "start_date": "2026-08-26",
                "start_time": "08:30",
                "end_time": "17:00",
            },
            {
                "title": "International Woodworking Fair",
                "weekday": "thursday",
                "start_date": "2026-08-27",
                "start_time": "08:30",
                "end_time": "17:00",
            },
            {
                "title": "International Woodworking Fair",
                "weekday": "friday",
                "start_date": "2026-08-28",
                "start_time": "08:30",
                "end_time": "14:00",
            },
        ],
    }
