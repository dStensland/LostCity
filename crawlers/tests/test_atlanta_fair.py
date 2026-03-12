from unittest.mock import patch

from sources.atlanta_fair import (
    build_event_record,
    crawl,
    extract_hours_summary,
    extract_price_note,
    parse_date_range,
)


HOMEPAGE_HTML = """
<html>
  <head>
    <meta property="og:image" content="https://img.example.com/atlanta-fair.jpg" />
  </head>
  <body>
    <h1>ATLANTA FAIR</h1>
    <p>March 12 - April 12, 2026</p>
    <p>688 Central Ave SW, Atlanta, Ga 30315</p>
  </body>
</html>
"""

HOURS_HTML = """
<html><body>
  <p>Monday thru Thursday Opens at 5PM Get in GATE before 9PM & Stay until 10PM</p>
  <p>Friday Opens at 5PM Get in GATE before 10PM & Stay until 11PM</p>
  <p>Saturday & Sunday Opens at 1PM Get in GATE before 10PM & Stay until 11PM</p>
</body></html>
"""

PRICES_HTML = """
<html><body>
  <p>Children (always) $3 42” and under Monday thru Thursday $5 42” and Over Friday $10 42” and Over Saturday (opens at 1pm) $10 42” and Over Sunday (opens at 1pm) $10 42” and Over</p>
  <p>Armbands $35 Pay One Price UNLIMITED RIDES Good for ALL RIDES from OPEN to CLOSE</p>
  <p>Single Tickets $1.25 Book of 25 Tickets $25 RIDES take between 2-4 tickets ea each, per person</p>
  <p>We accept all credit & debit cards (MC, Visa, AX, Discover), Apple Pay, Google Pay & CASH</p>
</body></html>
"""


def test_parse_date_range_handles_single_month_season():
    start_date, end_date = parse_date_range("March 12 - April 12, 2026")

    assert start_date == "2026-03-12"
    assert end_date == "2026-04-12"


def test_extract_hours_summary_formats_open_hours():
    summary = extract_hours_summary(
        "Monday thru Thursday Opens at 5PM Get in GATE before 9PM & Stay until 10PM "
        "Friday Opens at 5PM Get in GATE before 10PM & Stay until 11PM "
        "Saturday & Sunday Opens at 1PM Get in GATE before 10PM & Stay until 11PM"
    )

    assert "Monday-Thursday" in summary
    assert "Friday" in summary
    assert "Saturday-Sunday" in summary


def test_extract_price_note_parses_admission_and_ride_pricing():
    price_min, price_max, price_note = extract_price_note(
        "Children (always) $3 42” and under Monday thru Thursday $5 42” and Over "
        "Friday $10 42” and Over Saturday (opens at 1pm) $10 42” and Over "
        "Sunday (opens at 1pm) $10 42” and Over Armbands $35 Pay One Price "
        "UNLIMITED RIDES Single Tickets $1.25 Book of 25 Tickets $25 "
        "We accept all credit & debit cards (MC, Visa, AX, Discover), Apple Pay, Google Pay & CASH"
    )

    assert price_min == 1.25
    assert price_max == 35
    assert "children 42" in price_note.lower()
    assert "Unlimited ride armbands $35" in price_note


def test_build_event_record_shapes_tentpole_fair_event():
    with patch("sources.atlanta_fair.get_or_create_venue", return_value=515):
        record = build_event_record(11, HOMEPAGE_HTML, HOURS_HTML, PRICES_HTML)

    assert record["title"] == "Atlanta Fair 2026"
    assert record["start_date"] == "2026-03-12"
    assert record["end_date"] == "2026-04-12"
    assert record["is_all_day"] is True
    assert record["is_tentpole"] is True
    assert record["category"] == "family"
    assert record["subcategory"] == "fair"
    assert record["venue_id"] == 515
    assert record["image_url"] == "https://img.example.com/atlanta-fair.jpg"
    assert "Monday-Thursday" in record["description"]
    assert record["ticket_url"] is None


def test_crawl_inserts_single_tentpole_event():
    with patch(
        "sources.atlanta_fair._fetch_html",
        side_effect=[HOMEPAGE_HTML, HOURS_HTML, PRICES_HTML],
    ):
        with patch("sources.atlanta_fair.get_or_create_venue", return_value=515):
            with patch("sources.atlanta_fair.find_event_by_hash", return_value=None):
                with patch("sources.atlanta_fair.insert_event") as insert_event:
                    found, new, updated = crawl({"id": 11, "slug": "atlanta-fair"})

    assert found == 1
    assert new == 1
    assert updated == 0
    assert insert_event.call_args[0][0]["title"] == "Atlanta Fair 2026"
