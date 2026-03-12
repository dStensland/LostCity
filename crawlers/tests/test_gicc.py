from datetime import date

from sources.gicc import parse_event_feed_page


def test_parse_event_feed_page_extracts_timed_and_all_day_events() -> None:
    html = """
    <html>
      <body>
        <script type="application/ld+json">
        [
          {
            "@context": "http://schema.org",
            "@type": "Event",
            "name": "GROOM&#8217;D",
            "description": "&lt;p&gt;Pet-care trade show.&lt;/p&gt;",
            "url": "https://www.gicc.com/event/groomd-4/",
            "startDate": "2026-03-13T10:00:00-04:00",
            "endDate": "2026-03-15T17:00:00-04:00"
          },
          {
            "@context": "http://schema.org",
            "@type": "Event",
            "name": "ATHLETIC CHAMPIONSHIPS",
            "description": "&lt;p&gt;National two-day competition.&lt;/p&gt;",
            "url": "https://www.gicc.com/event/athletic-championships/",
            "startDate": "2026-03-21T00:00:00-04:00",
            "endDate": "2026-03-22T23:59:59-04:00"
          },
          {
            "@context": "http://schema.org",
            "@type": "Event",
            "name": "OKECON TCG",
            "description": "&lt;p&gt;Dedicated organizer source should own this.&lt;/p&gt;",
            "url": "https://www.gicc.com/event/okecon-tcg/",
            "startDate": "2026-04-25T00:00:00-04:00",
            "endDate": "2026-04-26T23:59:59-04:00"
          },
          {
            "@context": "http://schema.org",
            "@type": "Event",
            "name": "SMU Steel Summit",
            "description": "&lt;p&gt;Dedicated organizer source should own this.&lt;/p&gt;",
            "url": "https://www.gicc.com/event/smu/",
            "startDate": "2026-08-24T00:00:00-04:00",
            "endDate": "2026-08-26T23:59:59-04:00"
          },
          {
            "@context": "http://schema.org",
            "@type": "Event",
            "name": "The Georgia Educational Technology Conference",
            "description": "&lt;p&gt;Dedicated organizer source should own this.&lt;/p&gt;",
            "url": "https://www.gicc.com/event/georgia-educational-technology-conference-2/",
            "startDate": "2026-11-04T00:00:00-04:00",
            "endDate": "2026-11-06T23:59:59-04:00"
          }
        ]
        </script>
        <a href="/events/list/page/2/">Next Events</a>
      </body>
    </html>
    """

    events, next_url = parse_event_feed_page(html, today=date(2026, 3, 11))

    assert next_url == "https://www.gicc.com/events/list/page/2/"
    assert events == [
        {
            "title": "ATHLETIC CHAMPIONSHIPS",
            "description": "National two-day competition.",
            "start_date": "2026-03-21",
            "start_time": None,
            "end_date": "2026-03-22",
            "end_time": None,
            "is_all_day": True,
            "source_url": "https://www.gicc.com/event/athletic-championships/",
            "ticket_url": "https://www.gicc.com/event/athletic-championships/",
            "subcategory": None,
            "tags": ["convention-center", "sports"],
            "raw_text": "ATHLETIC CHAMPIONSHIPS | 2026-03-21T00:00:00-04:00 | 2026-03-22T23:59:59-04:00 | National two-day competition.",
        },
    ]


def test_parse_event_feed_page_skips_past_events_and_archive_chrome() -> None:
    html = """
    <html>
      <body>
        <script type="application/ld+json">
        [
          {
            "@type": "Event",
            "name": "This Month",
            "description": "&lt;p&gt;Archive heading&lt;/p&gt;",
            "url": "https://www.gicc.com/events/list/",
            "startDate": "2026-03-01T00:00:00-04:00",
            "endDate": "2026-03-01T23:59:59-04:00"
          },
          {
            "@type": "Event",
            "name": "Past Expo",
            "description": "&lt;p&gt;Already happened.&lt;/p&gt;",
            "url": "https://www.gicc.com/event/past-expo/",
            "startDate": "2026-03-01T10:00:00-04:00",
            "endDate": "2026-03-02T17:00:00-04:00"
          },
          {
            "@type": "Event",
            "name": "Too Far Conference",
            "description": "&lt;p&gt;Next year.&lt;/p&gt;",
            "url": "https://www.gicc.com/event/too-far-conference/",
            "startDate": "2027-01-08T08:00:00-04:00",
            "endDate": "2027-01-10T17:00:00-04:00"
          }
        ]
        </script>
      </body>
    </html>
    """

    events, next_url = parse_event_feed_page(html, today=date(2026, 3, 11))

    assert next_url is None
    assert events == []
