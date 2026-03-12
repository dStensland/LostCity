from bs4 import BeautifulSoup

from scrape_venue_hours import get_hours_from_jsonld, get_hours_from_text, parse_day_range, parse_text_hours


def test_parse_schema_hours_accepts_single_object_jsonld():
    html = """
    <html><head>
      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        "openingHoursSpecification": {
          "@type": "OpeningHoursSpecification",
          "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
          "opens": "09:00",
          "closes": "18:00"
        }
      }
      </script>
    </head></html>
    """

    hours = get_hours_from_jsonld(BeautifulSoup(html, "html.parser"))

    assert hours is not None
    assert hours["mon"] == {"open": "09:00", "close": "18:00"}
    assert hours["sun"] == {"open": "09:00", "close": "18:00"}


def test_parse_day_range_supports_wraparound_week_ranges():
    assert parse_day_range("wed - mon") == ["wed", "thu", "fri", "sat", "sun", "mon"]


def test_parse_text_hours_handles_closed_on_one_day_copy():
    text = "Museum Hours 9am-3pm, Hangars, 747 & Store are closed on Wednesday."

    hours = parse_text_hours(text)

    assert hours is not None
    assert "wed" not in hours
    assert hours["mon"] == {"open": "09:00", "close": "15:00"}
    assert hours["sun"] == {"open": "09:00", "close": "15:00"}


def test_get_hours_from_text_falls_back_to_whole_page_text():
    html = """
    <html><body>
      <main>
        <p>Please Note Today's Schedule: Hangars &amp; 747 Open 9am-3pm.</p>
        <p>Museum Hours 9am-3pm, Hangars, 747 &amp; Store are closed on Wednesday.</p>
      </main>
    </body></html>
    """

    hours = get_hours_from_text(BeautifulSoup(html, "html.parser"))

    assert hours is not None
    assert hours["tue"] == {"open": "09:00", "close": "15:00"}
    assert "wed" not in hours


def test_parse_text_hours_handles_from_copy():
    text = "Founded in 2024, we are open Monday-Friday from 12pm-6pm and on weekends/evenings during events."

    hours = parse_text_hours(text)

    assert hours is not None
    assert hours["mon"] == {"open": "12:00", "close": "18:00"}
    assert hours["fri"] == {"open": "12:00", "close": "18:00"}


def test_parse_text_hours_handles_available_hours_copy():
    text = "Reservations: (404) 252-LAFF(5233) Available hours MON - FRI: 12:00PM - 10:00PM SAT: 10:00AM - 12:00PM SUN: 10:00AM - 9:00PM"

    hours = parse_text_hours(text)

    assert hours is not None
    assert hours["mon"] == {"open": "12:00", "close": "22:00"}
    assert hours["sat"] == {"open": "10:00", "close": "12:00"}
    assert hours["sun"] == {"open": "10:00", "close": "21:00"}
