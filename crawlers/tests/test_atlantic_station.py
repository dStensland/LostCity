from datetime import datetime

from sources.atlantic_station import (
    build_event_record,
    extract_detail_data,
    extract_listing_cards,
    next_occurrence_for_repeat,
    parse_time_range,
)


def test_extract_listing_cards_dedupes_duplicate_detail_urls():
    html = """
    <html><body>
      <div class="elementor-location-single">
        <a href="https://atlanticstation.com/event/pulse-run-club/"></a>
        <h4 class="elementor-heading-title">Pulse Run Club</h4>
        <div class="elementor-widget-dyncontel-acf" data-settings='{"acf_field_list":"event_date","acf_type":"date"}'>
          <div class="dynamic-content-for-elementor-acf">January 14</div>
        </div>
        <figure class="dynamic-content-featuredimage-bg" style="background-image: url(https://atlanticstation.com/run.jpg);"></figure>
      </div>
      <div class="elementor-location-single">
        <a href="https://atlanticstation.com/event/pulse-run-club/"></a>
        <h4 class="elementor-heading-title">Pulse Run Club</h4>
        <div class="elementor-widget-dyncontel-acf" data-settings='{"acf_field_list":"event_date","acf_type":"date"}'>
          <div class="dynamic-content-for-elementor-acf">January 14</div>
        </div>
      </div>
      <div class="elementor-location-single">
        <a href="https://atlanticstation.com/event/tot-spot-2/"></a>
        <h4 class="elementor-heading-title">tot spot</h4>
        <div class="elementor-widget-dyncontel-acf" data-settings='{"acf_field_list":"event_date","acf_type":"date"}'>
          <div class="dynamic-content-for-elementor-acf">May 14</div>
        </div>
      </div>
    </body></html>
    """

    cards = extract_listing_cards(html)

    assert [card["detail_url"] for card in cards] == [
        "https://atlanticstation.com/event/pulse-run-club/",
        "https://atlanticstation.com/event/tot-spot-2/",
    ]
    assert cards[0]["image_url"] == "https://atlanticstation.com/run.jpg"
    assert cards[1]["title"] == "Tot Spot"


def test_extract_detail_data_reads_acf_fields_and_external_ticket_link():
    html = """
    <html>
      <head><meta property="og:image" content="https://atlanticstation.com/tot.jpg"/></head>
      <body>
        <h2 class="elementor-heading-title">tot spot</h2>
        <h2 class="elementor-heading-title">Atlantic Green</h2>
        <h2 class="elementor-heading-title">1380 Atlantic Dr. NW | Atlanta, GA 30363</h2>
        <div class="elementor-widget-dyncontel-acf" data-settings='{"acf_field_list":"event_date","acf_type":"date"}'>
          <div class="dynamic-content-for-elementor-acf">May 14</div>
        </div>
        <div class="elementor-widget-dyncontel-acf" data-settings='{"acf_field_list":"event_time_from-to","acf_type":"text"}'>
          <div class="dynamic-content-for-elementor-acf">10am-12pm</div>
        </div>
        <p>Tot Spot is our summer event for our littlest Atlantic Stationers.</p>
        <p>Stay tuned for the theme for May 14th.</p>
        <a href="https://example.com/register">click here to learn more</a>
      </body>
    </html>
    """

    detail = extract_detail_data(html, fallback_title="Tot Spot")

    assert detail["title"] == "Tot Spot"
    assert detail["location"] == "Atlantic Green"
    assert detail["date_label"] == "May 14"
    assert detail["time_label"] == "10am-12pm"
    assert detail["ticket_url"] == "https://example.com/register"
    assert detail["image_url"] == "https://atlanticstation.com/tot.jpg"


def test_next_occurrence_for_repeat_advances_to_next_weekday():
    next_date, recurrence_rule = next_occurrence_for_repeat(
        "every wednesday",
        datetime(2026, 1, 14),
        reference_date=datetime(2026, 3, 10),
    )

    assert next_date.strftime("%Y-%m-%d") == "2026-03-11"
    assert recurrence_rule == "FREQ=WEEKLY;BYDAY=WE"


def test_parse_time_range_handles_movie_starts_label():
    start_time, end_time, is_all_day = parse_time_range("movie starts at 7pm")

    assert start_time == "19:00"
    assert end_time is None
    assert is_all_day is False


def test_build_event_record_skips_stale_non_recurring_dates():
    record = build_event_record(
        source_id=1,
        venue_id=2,
        detail_url="https://atlanticstation.com/event/old-sale/",
        detail={
            "title": "Old Sale",
            "description": "Expired sample sale.",
            "date_label": "March 2",
            "repeat_type": None,
            "time_label": "hours vary",
            "location": "Atlantic Station",
            "ticket_url": None,
            "image_url": None,
        },
        reference_date=datetime(2026, 3, 10),
    )

    assert record is None


def test_build_event_record_advances_recurring_series_to_next_occurrence():
    record = build_event_record(
        source_id=1,
        venue_id=2,
        detail_url="https://atlanticstation.com/event/pulse-run-club/",
        detail={
            "title": "Pulse Run Club",
            "description": "Join them every Wednesday.",
            "date_label": "January 14",
            "repeat_type": "every wednesday",
            "time_label": "6pm-7:30pm",
            "location": "Millennium Gate",
            "ticket_url": "https://instagram.com/thepulserunclub",
            "image_url": "https://atlanticstation.com/pulse.jpg",
        },
        reference_date=datetime(2026, 3, 10),
    )

    assert record is not None
    assert record["start_date"] == "2026-03-11"
    assert record["start_time"] == "18:00"
    assert record["end_time"] == "19:30"
    assert record["is_recurring"] is True
    assert record["recurrence_rule"] == "FREQ=WEEKLY;BYDAY=WE"
