"""
Tests for the 404 Day crawler (crawlers/sources/four04_day.py).

All external HTTP calls and DB writes are mocked so the tests run offline.
"""

from unittest.mock import patch

import pytest

from sources.four04_day import (
    _extract_sanity_image_from_src,
    _find_event_jsonld,
    _load_jsonld_objects,
    _parse_event_cards,
    _build_main_festival_event,
    _build_stankonia_event,
    crawl,
)


# ---------------------------------------------------------------------------
# HTML fixtures
# ---------------------------------------------------------------------------

HOMEPAGE_HTML = """
<html>
  <head>
    <script type="application/ld+json">
      [
        {
          "@context": "https://schema.org",
          "@type": "Event",
          "name": "404 Day 2026",
          "description": "Atlanta's annual free outdoor music and culture festival.",
          "startDate": "2026-04-04",
          "endDate": "2026-04-04",
          "isAccessibleForFree": true,
          "url": "https://404day.com",
          "image": "https://404day.com/404day-logo-white.png",
          "location": {
            "@type": "Place",
            "name": "Piedmont Park",
            "address": {
              "@type": "PostalAddress",
              "streetAddress": "400 Park Dr NE",
              "addressLocality": "Atlanta",
              "addressRegion": "GA",
              "postalCode": "30306"
            }
          },
          "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "USD",
            "url": "https://404day.com/tickets"
          }
        },
        {
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": "404 Day",
          "url": "https://404day.com"
        }
      ]
    </script>
  </head>
  <body>
    <h1>404 Day</h1>
  </body>
</html>
"""

EVENTS_HTML = """
<html>
  <body>
    <button class="card overflow-hidden !p-0 text-left group cursor-pointer w-full">
      <div class="aspect-video relative overflow-hidden">
        <img
          alt="404 Day"
          src="/_next/image?url=https%3A%2F%2Fcdn.sanity.io%2Fimages%2Fwvc4gc0r%2Fproduction%2Fmainimage.jpg%3Fw%3D600&w=3840&q=75"
          srcset="/_next/image?url=https%3A%2F%2Fcdn.sanity.io%2Fimages%2Fwvc4gc0r%2Fproduction%2Fmainimage.jpg%3Fw%3D600&w=640&q=75 640w, /_next/image?url=https%3A%2F%2Fcdn.sanity.io%2Fimages%2Fwvc4gc0r%2Fproduction%2Fmainimage.jpg%3Fw%3D600&w=3840&q=75 3840w"
        />
      </div>
      <div class="p-4">
        <div class="text-[#FF8A3D] text-xs font-bold uppercase tracking-widest mb-1">April 4, 2026</div>
        <h3 class="text-[#1A2B3C] font-bold text-sm mb-1">404 Day</h3>
        <p class="text-[#5a5a5a] text-xs leading-relaxed line-clamp-2">The 404 Day DJ lineup is curated with meticulous care to deliver an unparalleled musical experience showcasing the rich diversity of talent that defines Atlanta.</p>
      </div>
    </button>
    <button class="card overflow-hidden !p-0 text-left group cursor-pointer w-full">
      <div class="aspect-video relative overflow-hidden">
        <img
          alt="Old Atlanta vs New Atlanta"
          src="/_next/image?url=https%3A%2F%2Fcdn.sanity.io%2Fimages%2Fwvc4gc0r%2Fproduction%2Fstankonia.jpg%3Fw%3D600&w=3840&q=75"
          srcset="/_next/image?url=https%3A%2F%2Fcdn.sanity.io%2Fimages%2Fwvc4gc0r%2Fproduction%2Fstankonia.jpg%3Fw%3D600&w=640&q=75 640w, /_next/image?url=https%3A%2F%2Fcdn.sanity.io%2Fimages%2Fwvc4gc0r%2Fproduction%2Fstankonia.jpg%3Fw%3D600&w=3840&q=75 3840w"
        />
      </div>
      <div class="p-4">
        <div class="text-[#FF8A3D] text-xs font-bold uppercase tracking-widest mb-1">April 4, 2026</div>
        <h3 class="text-[#1A2B3C] font-bold text-sm mb-1">404 Day: Old Atlanta vs. New Atlanta - A Live Hip-Hop Culture Experience</h3>
        <p class="text-[#5a5a5a] text-xs leading-relaxed line-clamp-2">A one-night collision of Atlanta legends and rising stars celebrating the past, present, and future of the 404, LIVE at Stankonia Studios.</p>
      </div>
    </button>
  </body>
</html>
"""

# No event cards at all — edge case.
EMPTY_EVENTS_HTML = """
<html><body><p>No events found.</p></body></html>
"""


# ---------------------------------------------------------------------------
# Unit tests — pure parsing helpers
# ---------------------------------------------------------------------------


def test_load_jsonld_objects_returns_event_and_org():
    objects = _load_jsonld_objects(HOMEPAGE_HTML)
    types = {obj.get("@type") for obj in objects}
    assert "Event" in types
    assert "Organization" in types


def test_load_jsonld_objects_returns_empty_for_no_scripts():
    objects = _load_jsonld_objects("<html><body>no scripts</body></html>")
    assert objects == []


def test_load_jsonld_objects_handles_malformed_json():
    html = '<script type="application/ld+json">{ bad json }</script>'
    objects = _load_jsonld_objects(html)
    assert objects == []


def test_find_event_jsonld_extracts_event():
    event = _find_event_jsonld(HOMEPAGE_HTML)
    assert event is not None
    assert event["@type"] == "Event"
    assert event["name"] == "404 Day 2026"
    assert event["startDate"] == "2026-04-04"
    assert event["isAccessibleForFree"] is True


def test_find_event_jsonld_returns_none_for_missing():
    result = _find_event_jsonld("<html><body></body></html>")
    assert result is None


def test_extract_sanity_image_from_next_proxied_src():
    src = (
        "/_next/image?url=https%3A%2F%2Fcdn.sanity.io%2Fimages%2Fwvc4gc0r%2Fproduction"
        "%2F44e9a1cd-675x1200.jpg%3Fw%3D600&w=3840&q=75"
    )
    result = _extract_sanity_image_from_src(src)
    assert result is not None
    assert result.startswith("https://cdn.sanity.io/images/")
    assert "?" not in result  # Sanity query params stripped


def test_extract_sanity_image_returns_none_for_empty():
    assert _extract_sanity_image_from_src("") is None
    assert _extract_sanity_image_from_src(None) is None  # type: ignore[arg-type]


def test_parse_event_cards_returns_two_cards():
    cards = _parse_event_cards(EVENTS_HTML)
    assert len(cards) == 2


def test_parse_event_cards_main_festival_first():
    cards = _parse_event_cards(EVENTS_HTML)
    assert "404 Day" in cards[0]["title"]
    assert "Old Atlanta" in cards[1]["title"]


def test_parse_event_cards_extracts_description():
    cards = _parse_event_cards(EVENTS_HTML)
    assert "DJ lineup" in cards[0]["description"]
    assert "Stankonia" in cards[1]["description"]


def test_parse_event_cards_extracts_sanity_image():
    cards = _parse_event_cards(EVENTS_HTML)
    for card in cards:
        assert card["image_url"] is not None
        assert card["image_url"].startswith("https://cdn.sanity.io/images/")


def test_parse_event_cards_returns_empty_for_no_cards():
    cards = _parse_event_cards(EMPTY_EVENTS_HTML)
    assert cards == []


def test_parse_event_cards_date_label_extracted():
    cards = _parse_event_cards(EVENTS_HTML)
    assert "April 4, 2026" in cards[0]["date_label"]


# ---------------------------------------------------------------------------
# Build helper tests
# ---------------------------------------------------------------------------


def test_build_main_festival_event_is_free_all_day():
    event = _build_main_festival_event(
        source_id=1,
        venue_id=100,
        card={"description": "Great festival.", "image_url": "https://cdn.sanity.io/img.jpg"},
        jsonld={"startDate": "2026-04-04"},
    )
    assert event["is_free"] is True
    assert event["is_all_day"] is True
    assert event["start_date"] == "2026-04-04"
    assert event["price_min"] == 0
    assert event["price_max"] == 0
    assert event["category"] == "music"
    assert event["subcategory"] == "festival"
    assert "piedmont-park" in event["tags"]
    assert event["is_tentpole"] is True
    assert event["venue_id"] == 100
    assert event["source_id"] == 1


def test_build_main_festival_event_falls_back_to_og_image():
    event = _build_main_festival_event(
        source_id=1,
        venue_id=100,
        card={"description": "Festival.", "image_url": None},
        jsonld=None,
    )
    assert event["image_url"] == "https://404day.com/404day-atlanta-music-festival-flyer.jpg"


def test_build_main_festival_event_uses_jsonld_date():
    event = _build_main_festival_event(
        source_id=1,
        venue_id=100,
        card={},
        jsonld={"startDate": "2026-04-04T00:00:00"},
    )
    assert event["start_date"] == "2026-04-04"


def test_build_main_festival_event_truncates_long_description():
    long_desc = "A" * 700
    event = _build_main_festival_event(
        source_id=1,
        venue_id=100,
        card={"description": long_desc, "image_url": None},
        jsonld=None,
    )
    assert len(event["description"]) <= 600
    assert event["description"].endswith("...")


def test_build_stankonia_event_is_ticketed():
    card = {
        "title": "404 Day: Old Atlanta vs. New Atlanta",
        "description": "Legends at Stankonia Studios.",
        # button_url is always TICKETS_URL in the real parser (cards are <button>s not <a>s)
        "button_url": "https://404day.com/tickets",
        "image_url": "https://cdn.sanity.io/stankonia.jpg",
    }
    event = _build_stankonia_event(source_id=1, venue_id=200, card=card)
    assert event["is_free"] is False
    assert event["price_min"] is None
    assert event["category"] == "music"
    assert event["subcategory"] == "concert"
    assert event["ticket_url"] == "https://404day.com/tickets"
    assert event["venue_id"] == 200


def test_build_stankonia_event_content_hash_differs_from_main():
    main = _build_main_festival_event(
        source_id=1, venue_id=100, card={}, jsonld={"startDate": "2026-04-04"}
    )
    stankonia = _build_stankonia_event(
        source_id=1,
        venue_id=200,
        card={"description": "Concert.", "button_url": None, "image_url": None},
    )
    assert main["content_hash"] != stankonia["content_hash"]


# ---------------------------------------------------------------------------
# Integration test — crawl() with all external calls mocked
# ---------------------------------------------------------------------------


def test_crawl_inserts_main_and_stankonia_events():
    inserted: list[dict] = []
    series_hints: list[dict] = []

    def mock_insert_event(record, series_hint=None):
        inserted.append(record)
        series_hints.append(series_hint)

    with (
        patch("sources.four04_day._fetch_html", side_effect=lambda url: HOMEPAGE_HTML if url == "https://404day.com" else EVENTS_HTML),
        patch("sources.four04_day.get_or_create_place", side_effect=[100, 200]),
        patch("sources.four04_day.find_event_by_hash", return_value=None),
        patch("sources.four04_day.insert_event", side_effect=mock_insert_event),
    ):
        found, new, updated = crawl({"id": 42, "slug": "404-day"})

    assert found == 2
    assert new == 2
    assert updated == 0

    titles = [e["title"] for e in inserted]
    assert "404 Day 2026" in titles
    assert "404 Day: Old Atlanta vs. New Atlanta" in titles


def test_crawl_main_event_uses_piedmont_park_venue():
    inserted: list[dict] = []

    def mock_insert_event(record, series_hint=None):
        inserted.append(record)

    with (
        patch("sources.four04_day._fetch_html", side_effect=lambda url: HOMEPAGE_HTML if url == "https://404day.com" else EVENTS_HTML),
        patch("sources.four04_day.get_or_create_place", side_effect=[100, 200]),
        patch("sources.four04_day.find_event_by_hash", return_value=None),
        patch("sources.four04_day.insert_event", side_effect=mock_insert_event),
    ):
        crawl({"id": 42, "slug": "404-day"})

    main = next(e for e in inserted if e["title"] == "404 Day 2026")
    assert main["venue_id"] == 100  # Piedmont Park gets the first venue ID


def test_crawl_groups_both_events_under_same_series():
    hints: list[dict] = []

    def mock_insert_event(record, series_hint=None):
        hints.append(series_hint)

    with (
        patch("sources.four04_day._fetch_html", side_effect=lambda url: HOMEPAGE_HTML if url == "https://404day.com" else EVENTS_HTML),
        patch("sources.four04_day.get_or_create_place", side_effect=[100, 200]),
        patch("sources.four04_day.find_event_by_hash", return_value=None),
        patch("sources.four04_day.insert_event", side_effect=mock_insert_event),
    ):
        crawl({"id": 42, "slug": "404-day"})

    assert all(h is not None for h in hints), "All events should have a series_hint"
    assert all(h["series_type"] == "festival_program" for h in hints)
    assert all(h["series_title"] == "404 Day 2026" for h in hints)


def test_crawl_returns_updated_count_when_events_exist():
    fake_existing = {"id": 99, "title": "404 Day 2026"}

    with (
        patch("sources.four04_day._fetch_html", side_effect=lambda url: HOMEPAGE_HTML if url == "https://404day.com" else EVENTS_HTML),
        patch("sources.four04_day.get_or_create_place", side_effect=[100, 200]),
        patch("sources.four04_day.find_event_by_hash", return_value=fake_existing),
        patch("sources.four04_day.smart_update_existing_event"),
    ):
        found, new, updated = crawl({"id": 42, "slug": "404-day"})

    assert found == 2
    assert new == 0
    assert updated == 2


def test_crawl_skips_stankonia_when_card_not_found():
    """If the Stankonia card disappears from the page, only insert the main festival."""
    # Provide only the main festival card, no Stankonia card.
    single_card_html = """
    <html><body>
      <button class="card overflow-hidden !p-0 text-left group cursor-pointer w-full">
        <div class="aspect-video relative overflow-hidden">
          <img alt="404 Day" src="/_next/image?url=https%3A%2F%2Fcdn.sanity.io%2Fimages%2Fmain.jpg&w=640&q=75" />
        </div>
        <div class="p-4">
          <div class="text-[#FF8A3D] text-xs font-bold uppercase tracking-widest mb-1">April 4, 2026</div>
          <h3 class="text-[#1A2B3C] font-bold text-sm mb-1">404 Day</h3>
          <p class="text-[#5a5a5a] text-xs leading-relaxed">The main festival.</p>
        </div>
      </button>
    </body></html>
    """
    inserted: list[str] = []

    with (
        patch("sources.four04_day._fetch_html", side_effect=lambda url: HOMEPAGE_HTML if url == "https://404day.com" else single_card_html),
        patch("sources.four04_day.get_or_create_place", side_effect=[100]),
        patch("sources.four04_day.find_event_by_hash", return_value=None),
        patch("sources.four04_day.insert_event", side_effect=lambda r, series_hint=None: inserted.append(r["title"])),
    ):
        found, new, updated = crawl({"id": 42, "slug": "404-day"})

    assert found == 1
    assert new == 1
    assert "404 Day 2026" in inserted
    assert not any("Stankonia" in t or "Old Atlanta" in t for t in inserted)


def test_crawl_raises_on_http_error():
    import requests as req

    with (
        patch("sources.four04_day._fetch_html", side_effect=req.RequestException("timeout")),
    ):
        with pytest.raises(req.RequestException):
            crawl({"id": 42, "slug": "404-day"})
