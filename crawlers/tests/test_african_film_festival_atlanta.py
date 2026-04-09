from unittest.mock import patch

from sources.african_film_festival_atlanta import (
    ANNOUNCEMENT_URL,
    build_screening_event_record,
    build_tentpole_event_record,
    crawl,
    parse_eventbrite_collection,
    parse_official_date_range,
)


SUBMISSIONS_HTML = """
<html>
  <head>
    <meta property="og:image" content="https://img.example.com/affatl-submissions.jpg" />
  </head>
  <body>
    <h1>African Film Festival Atlanta Opens Call for Submissions for 2026 Edition</h1>
    <p>
      The African Film Festival Atlanta (AFFATL) is now officially accepting film
      submissions for its 2026 edition, which will take place from March 26 to
      March 30, 2026.
    </p>
    <p>2026 festival theme: "CTRL + CULTURE = AFRICA'S NEXT CINEMA CODE"</p>
  </body>
</html>
"""

ANNOUNCEMENT_HTML = """
<html>
  <head>
    <meta property="og:image" content="https://img.example.com/affatl-hero.jpg" />
  </head>
  <body>
    <h1>The 2026 African Film Festival Atlanta Announces Its Official Film Selections and Ticket Sales</h1>
    <p>
      The 2026 African Film Festival Atlanta announces 32 curated films from 12 countries,
      selected from more than 150 submissions from across the world.
    </p>
    <p>
      Opening night features Son of the Soil. The festival will take place at various
      venues across Atlanta.
    </p>
    <a href="https://www.eventbrite.com/cc/african-film-festival-atlanta-2026-4819851">
      Tickets
    </a>
  </body>
</html>
"""

EVENTBRITE_COLLECTION_HTML = """
<html>
  <body>
    <script>
      window.__SERVER_DATA__ = {
        "events_in_collection": {
          "upcoming": {
            "pagination": {"object_count": 2},
            "events": [
              {
                "name": {"text": "Son of the Soil-Opening Night: The African Film Festival Atlanta (AFFATL)"},
                "summary": "Opening night screening.",
                "description": {
                  "html": "<p>Former soldier Zion Ladejo returns home in Lagos.</p>"
                },
                "start": {"local": "2026-03-26T18:00:00"},
                "end": {"local": "2026-03-26T21:00:00"},
                "url": "https://www.eventbrite.com/e/son-of-the-soil-opening-night-affatl-tickets-1?aff=ebdssbdestsearch",
                "is_free": false,
                "logo": {
                  "url": "https://img.example.com/son-small.jpg",
                  "original": {"url": "https://img.example.com/son-large.jpg"}
                },
                "venue": {
                  "name": "Cinefest Film Theatre",
                  "address": {
                    "address_1": "66 Courtland Street Southeast",
                    "address_2": "#262",
                    "city": "Atlanta",
                    "region": "GA",
                    "postal_code": "30303",
                    "localized_address_display": "66 Courtland Street Southeast #262, Atlanta, GA 30303"
                  }
                }
              },
              {
                "name": {"text": "Shorts Program 1: African Film Festival Atlanta 2026"},
                "summary": "Shorts showcase.",
                "description": {
                  "html": "<p>New shorts from African filmmakers.</p>"
                },
                "start": {"local": "2026-03-27T14:00:00"},
                "end": {"local": "2026-03-27T16:00:00"},
                "url": "https://www.eventbrite.com/e/shorts-program-1-affatl-tickets-2",
                "is_free": true,
                "logo": {
                  "url": "https://img.example.com/shorts-small.jpg"
                },
                "venue": {
                  "name": "Auburn Avenue Research Library",
                  "address": {
                    "address_1": "101 Auburn Avenue Northeast",
                    "city": "Atlanta",
                    "region": "GA",
                    "postal_code": "30303",
                    "localized_address_display": "101 Auburn Avenue Northeast, Atlanta, GA 30303"
                  }
                }
              }
            ]
          }
        }
      };
    </script>
  </body>
</html>
"""


def test_parse_official_date_range_reads_submission_window():
    text = (
        "The festival will take place from March 26 to March 30, 2026."
    )

    start_date, end_date = parse_official_date_range(text)

    assert start_date == "2026-03-26"
    assert end_date == "2026-03-30"


def test_parse_eventbrite_collection_reads_embedded_server_data():
    events = parse_eventbrite_collection(EVENTBRITE_COLLECTION_HTML)

    assert len(events) == 2
    assert events[0]["name"]["text"].startswith("Son of the Soil")


def test_build_tentpole_event_record_prefers_official_dates_and_metadata():
    with patch(
        "sources.african_film_festival_atlanta.get_or_create_place",
        return_value=901,
    ):
        record = build_tentpole_event_record(
            55,
            SUBMISSIONS_HTML,
            ANNOUNCEMENT_HTML,
            parse_eventbrite_collection(EVENTBRITE_COLLECTION_HTML),
        )

    assert record["title"] == "African Film Festival Atlanta 2026"
    assert record["start_date"] == "2026-03-26"
    assert record["end_date"] == "2026-03-30"
    assert record["is_tentpole"] is True
    assert record["category"] == "film"
    assert record["subcategory"] == "festival"
    assert record["source_url"] == ANNOUNCEMENT_URL
    assert record["ticket_url"] == "https://www.eventbrite.com/cc/african-film-festival-atlanta-2026-4819851"
    assert record["place_id"] == 901
    assert "32 curated films from 12 countries" in record["description"]
    assert "CTRL + CULTURE = AFRICA'S NEXT CINEMA CODE" in record["description"]


def test_build_screening_event_record_shapes_session_event():
    screening_event = parse_eventbrite_collection(EVENTBRITE_COLLECTION_HTML)[0]

    with patch(
        "sources.african_film_festival_atlanta.get_or_create_place",
        return_value=902,
    ):
        record = build_screening_event_record(55, screening_event)

    assert record["title"] == "Son of the Soil - Opening Night: The African Film Festival Atlanta (AFFATL)"
    assert record["start_date"] == "2026-03-26"
    assert record["start_time"] == "18:00"
    assert record["end_time"] == "21:00"
    assert record["category"] == "film"
    assert record["subcategory"] == "screening"
    assert record["is_free"] is False
    assert record["ticket_url"] == "https://www.eventbrite.com/e/son-of-the-soil-opening-night-affatl-tickets-1"
    assert record["image_url"] == "https://img.example.com/son-large.jpg"
    assert record["place_id"] == 902


def test_crawl_accumulates_entries_and_runs_screening_primary_pipeline():
    collection_events = parse_eventbrite_collection(EVENTBRITE_COLLECTION_HTML)
    run_summary = {
        "events_created": 3,
        "events_updated": 0,
        "times_linked": 3,
        "run_event_hashes": set(),
    }
    with patch(
        "sources.african_film_festival_atlanta._fetch_html",
        side_effect=[SUBMISSIONS_HTML, ANNOUNCEMENT_HTML, EVENTBRITE_COLLECTION_HTML],
    ):
        with patch(
            "sources.african_film_festival_atlanta.get_or_create_place",
            side_effect=[901, 902, 903],
        ):
            with patch(
                "sources.african_film_festival_atlanta.entries_to_event_like_rows",
                return_value=[],
            ):
                with patch(
                    "sources.african_film_festival_atlanta.build_screening_bundle_from_event_rows",
                    return_value={},
                ):
                    with patch(
                        "sources.african_film_festival_atlanta.persist_screening_bundle",
                        return_value={"titles": 2, "runs": 3, "times": 3},
                    ):
                        with patch(
                            "sources.african_film_festival_atlanta.sync_run_events_from_screenings",
                            return_value=run_summary,
                        ) as sync_mock:
                            with patch(
                                "sources.african_film_festival_atlanta.remove_stale_showtime_events",
                            ) as stale_mock:
                                found, new, updated = crawl(
                                    {"id": 55, "slug": "african-film-festival-atlanta"}
                                )

    assert len(collection_events) == 2
    assert found == 3  # 1 tentpole + 2 screenings
    assert new == 3
    assert updated == 0
    sync_mock.assert_called_once_with(source_id=55, source_slug="african-film-festival-atlanta")
    # run_event_hashes is empty set, so stale cleanup should not be called
    stale_mock.assert_not_called()
