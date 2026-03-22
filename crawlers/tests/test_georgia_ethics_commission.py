from sources.georgia_ethics_commission import _extract_meeting_events, _extract_training_events


def test_extract_meeting_events_parses_future_commission_meeting() -> None:
    feed_xml = """<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0">
      <channel>
        <item>
          <title>COMMISSION MEETING: March 30, 2026</title>
          <link>https://ethics.ga.gov/commission-meeting-march-30-2026/</link>
          <pubDate>Wed, 25 Feb 2026 19:34:56 +0000</pubDate>
          <description><![CDATA[
            The State Ethics Commission will hold their Commission Meeting on Monday, March 30, 2026.
            The meeting is scheduled to start at 10:00 am in the Georgia Board of Pardons and Paroles Board Room.
          ]]></description>
        </item>
      </channel>
    </rss>
    """

    events = _extract_meeting_events(feed_xml)

    assert len(events) == 1
    assert events[0]["title"] == "COMMISSION MEETING: March 30, 2026"
    assert events[0]["start_date"] == "2026-03-30"
    assert events[0]["start_time"] == "10:00"
    assert "public-meeting" in events[0]["tags"]


def test_extract_training_events_parses_visible_training_block() -> None:
    home_html = """
    <html><body>
      <h5>2026 Trainings:</h5>
      <p>Athens, February 25-27 | <strong>GMA Newly Elected Officials Conference</strong></p>
      <p>Tifton, March 18-20 | <strong>GMA Newly Elected Officials Conference</strong></p>
      <p>Athens, April 15 | <strong>GAVERO Conference</strong></p>
      <p>Athens, May 12 | <strong>Georgia Association of Tax Professionals Conference</strong></p>
      <div>CONNECT WITH US</div>
    </body></html>
    """

    events = _extract_training_events(home_html)

    assert [event["title"] for event in events[:2]] == [
        "GAVERO Conference (Athens)",
        "Georgia Association of Tax Professionals Conference (Athens)",
    ]
    assert events[0]["start_date"] == "2026-04-15"
    assert events[0]["category"] == "learning"
    assert "training" in events[0]["tags"]
