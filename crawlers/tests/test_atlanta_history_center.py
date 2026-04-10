from datetime import date, timedelta

from bs4 import BeautifulSoup

from sources.atlanta_history_center import (
    _collect_exhibition_urls,
    _parse_exhibition_record,
    _parse_summer_camp_records,
    _select_redundant_row_ids,
)


def test_parse_summer_camp_records_extracts_grade_bands_and_dates():
    html = """
    <html>
      <head><title>History Summer Camp | Atlanta History Center</title></head>
      <body>
        <main>
          <article>
            <p>Please register your camper for the grade level they will have completed by the end of the 2025-2026 school year.</p>
            <p>Campers K-2 Pharaohs, Philosophers, and Kings: Leaders in the Ancient World. June 1-5. Register Now Secret Superheroes. June 8-12. Register Now</p>
            <p>Campers 3-5 Pharaohs, Philosophers, and Kings: Leaders in the Ancient World. June 1-5. Register Now Secret Superheroes. June 8-12. Register Now</p>
          </article>
        </main>
      </body>
    </html>
    """
    soup = BeautifulSoup(html, "html.parser")

    records = _parse_summer_camp_records(
        "https://www.atlantahistorycenter.com/history-summer-camp/",
        soup,
        source_id=105,
        venue_id=211,
    )

    assert len(records) == 4
    assert records[0]["title"] == (
        "History Summer Camp: Pharaohs, Philosophers, and Kings: Leaders in the Ancient World (K-2)"
    )
    assert records[0]["start_date"] == "2026-06-01"
    assert records[0]["end_date"] == "2026-06-05"
    assert records[0]["content_kind"] == "event"
    assert records[0]["age_min"] == 5
    assert records[0]["age_max"] == 8


def test_parse_summer_camp_records_prefers_heading_structure_when_present():
    html = """
    <html>
      <head><title>History Summer Camp | Atlanta History Center</title></head>
      <body>
        <main>
          <h2>Please register your camper for the grade level they will have completed by the end of the 2025-2026 school year.</h2>
          <h2>Campers K-2</h2>
          <h2>Pharaohs, Philosophers, and Kings: Leaders in the Ancient World. June 1-5.</h2>
          <h2>Secret Superheroes. June 8-12.</h2>
          <p>*Camp activities may vary per grade group.</p>
        </main>
      </body>
    </html>
    """
    soup = BeautifulSoup(html, "html.parser")

    records = _parse_summer_camp_records(
        "https://www.atlantahistorycenter.com/history-summer-camp/",
        soup,
        source_id=105,
        venue_id=211,
    )

    assert len(records) == 2
    assert records[0]["title"] == (
        "History Summer Camp: Pharaohs, Philosophers, and Kings: Leaders in the Ancient World (K-2)"
    )


def test_parse_exhibition_record_does_not_set_start_date_to_today():
    """Regression: start_date must NOT be today — it changes daily and breaks content hash dedup."""
    future_close = date.today() + timedelta(days=60)
    future_close_text = future_close.strftime("%B %d, %Y").replace(" 0", " ")
    html = """
    <html>
      <head>
        <title>Slavery at Monticello | Exhibitions | Atlanta History Center</title>
        <meta name="description" content="An exploration of the enslaved community at Monticello." />
      </head>
      <body>
        <main>
          <h1>Slavery at Monticello</h1>
          <p>Slavery at Monticello closes on FUTURE_CLOSE_DATE.</p>
        </main>
      </body>
    </html>
    """.replace("FUTURE_CLOSE_DATE", future_close_text)
    soup = BeautifulSoup(html, "html.parser")

    record = _parse_exhibition_record(
        "https://www.atlantahistorycenter.com/exhibitions/slavery-at-monticello/",
        soup,
        source_id=105,
        venue_id=211,
    )

    assert record is not None
    assert record.get("start_date") != date.today().strftime("%Y-%m-%d"), (
        "start_date must not be today's date — it would produce a new content hash on every crawl run"
    )


def test_parse_exhibition_record_marks_current_exhibit_as_ongoing():
    future_close = date.today() + timedelta(days=30)
    future_close_text = future_close.strftime("%B %d, %Y").replace(" 0", " ")
    html = """
    <html>
      <head>
        <title>Their Finest Hour: Atlanta Remembers World War II | Exhibitions | Atlanta History Center</title>
        <meta name="description" content="This exhibition honors the sacrifices of the World War II generation." />
      </head>
      <body>
        <main>
          <h1>Their Finest Hour: Atlanta Remembers World War II</h1>
          <p>Their Finest Hour: Atlanta Remembers World War II closes on FUTURE_CLOSE_DATE.</p>
          <p>Included with admission to Atlanta History Center.</p>
        </main>
      </body>
    </html>
    """.replace("FUTURE_CLOSE_DATE", future_close_text)
    soup = BeautifulSoup(html, "html.parser")

    record = _parse_exhibition_record(
        "https://www.atlantahistorycenter.com/exhibitions/their-finest-hour-atlanta-remembers-world-war-ii/",
        soup,
        source_id=105,
        venue_id=211,
    )

    assert record is not None
    assert record["title"] == "Their Finest Hour: Atlanta Remembers World War II"
    assert record["content_kind"] == "exhibit"
    assert record["end_date"] == future_close.strftime("%Y-%m-%d")
    assert record["price_note"] == "Included with admission"


def test_parse_exhibition_record_marks_children_experience_as_family():
    html = """
    <html>
      <head>
        <title>Visit Goizueta Children's Experience | Atlanta History Center</title>
        <meta name="description" content="The immersive and multi-sensory design will delight children from crawlers to second graders." />
      </head>
      <body>
        <main>
          <h1>Visit Goizueta Children’s Experience</h1>
          <p>This experience is included with museum admission.</p>
        </main>
      </body>
    </html>
    """
    soup = BeautifulSoup(html, "html.parser")

    record = _parse_exhibition_record(
        "https://www.atlantahistorycenter.com/visit-goizueta-childrens-experience/",
        soup,
        source_id=105,
        venue_id=211,
    )

    assert record is not None
    assert record["category"] == "family"
    assert "kids" in record["tags"]


def test_collect_exhibition_urls_uses_current_widget_items_only():
    html = """
    <html>
      <body>
        <main>
          <ahc-exhibition-index-list :items='[
            {"link":{"url":"https://www.atlantahistorycenter.com/exhibitions/current-show/"},"onViewCurrently":true},
            {"link":{"url":"https://www.atlantahistorycenter.com/exhibitions/past-show/"},"onViewCurrently":false}
          ]'></ahc-exhibition-index-list>
        </main>
      </body>
    </html>
    """
    soup = BeautifulSoup(html, "html.parser")

    urls = _collect_exhibition_urls(soup)

    assert "https://www.atlantahistorycenter.com/exhibitions/current-show/" in urls
    assert "https://www.atlantahistorycenter.com/exhibitions/past-show/" not in urls
    assert "https://www.atlantahistorycenter.com/our-war-too-women-in-service/" in urls


def test_select_redundant_row_ids_prefers_specific_event_rows():
    rows = [
        {
            "id": 1,
            "title": "A’lelia Bundles",
            "start_date": "2026-03-16",
            "start_time": "19:00:00",
            "source_url": "https://www.atlantahistorycenter.com/event/alelia-bundles/",
        },
        {
            "id": 2,
            "title": "Aiken Lecture featuring A’Lelia Bundles in conversation with Ernie Suggs",
            "start_date": "2026-03-16",
            "start_time": "19:00:00",
            "source_url": "https://www.atlantahistorycenter.com/event/alelia-bundles/",
        },
        {
            "id": 3,
            "title": "Living Room Learning Lecture by Dr. Patrick Allitt (Week 1)",
            "start_date": "2026-03-16",
            "start_time": "14:00:00",
            "source_url": "https://www.atlantahistorycenter.com/programs-events/living-room-learning/",
        },
        {
            "id": 4,
            "title": "“King George III and the British View of the American Revolution”",
            "start_date": "2026-03-16",
            "start_time": "14:00:00",
            "source_url": "https://www.atlantahistorycenter.com/event/king-george-iii-and-the-british-view-of-the-american-revolution/",
        },
        {
            "id": 5,
            "title": "Beauty Walk",
            "start_date": "2026-03-26",
            "start_time": "11:00:00",
            "source_url": "https://www.atlantahistorycenter.com/event/beauty-walk/",
        },
        {
            "id": 6,
            "title": "Greet the Sheep and Goats",
            "start_date": "2026-03-26",
            "start_time": "11:00:00",
            "source_url": "https://www.atlantahistorycenter.com/event/greet-the-sheep-and-goats/",
        },
    ]

    assert _select_redundant_row_ids(rows) == [1, 3]


def test_select_redundant_row_ids_keeps_distinct_same_url_camp_sessions():
    rows = [
        {
            "id": 10,
            "title": "History Summer Camp: Secret Superheroes (K-2)",
            "start_date": "2026-06-08",
            "start_time": None,
            "source_url": "https://www.atlantahistorycenter.com/history-summer-camp/",
        },
        {
            "id": 11,
            "title": "History Summer Camp: Secret Superheroes (3-5)",
            "start_date": "2026-06-08",
            "start_time": None,
            "source_url": "https://www.atlantahistorycenter.com/history-summer-camp/",
        },
    ]

    assert _select_redundant_row_ids(rows) == []
