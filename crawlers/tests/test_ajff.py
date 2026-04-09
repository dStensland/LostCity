from sources.ajff import (
    _build_event_record,
    _build_tentpole_event_record,
    _normalize_ongoing_dates,
)


def test_normalize_ongoing_dates_moves_open_window_to_today():
    start_date, end_date = _normalize_ongoing_dates(
        "2026-03-06",
        "2026-03-15",
        "2026-03-10",
    )

    assert start_date == "2026-03-10"
    assert end_date == "2026-03-15"


def test_build_event_record_parses_physical_screening():
    item = {
        "type": "happening--screening",
        "attributes": {
            "field_date_time": "2026-03-12T19:30:00-04:00",
            "field_has_q_a": True,
            "field_sale_status": "sold_out",
            "field_ticket_purchase_url": {
                "url": "https://ajff.evenue.net/cgi-bin/ncommerce3/SEGetEventInfo?ticketCode=abc"
            },
        },
        "relationships": {
            "field_offering": {
                "data": {"type": "node--offering", "id": "offering-1"}
            },
            "field_space": {"data": {"type": "node--space", "id": "space-1"}},
        },
    }
    included = {
        ("node--offering", "offering-1"): {
            "attributes": {
                "title": "Abortion in the Holy Land",
                "path": {"alias": "/offering/abortion-holy-land"},
                "field_synopsis": (
                    "<p>An incisive exploration of Israel's abortion regime.</p>"
                ),
            },
            "relationships": {
                "field_feature_film": {
                    "data": {"type": "node--film", "id": "film-1"}
                },
                "field_hero_image": {
                    "data": {"type": "media--image", "id": "media-1"}
                },
            },
        },
        ("node--film", "film-1"): {
            "attributes": {
                "title": "Abortion in the Holy Land",
            },
            "relationships": {},
        },
        ("media--image", "media-1"): {
            "relationships": {
                "field_media_image": {
                    "data": {"type": "file--file", "id": "file-1"}
                }
            }
        },
        ("file--file", "file-1"): {
            "links": {
                "ajff_rec_slider": {
                    "href": (
                        "https://data.ajff.org/sites/default/files/styles/ajff_rec_slider/"
                        "public/2025-12/film-abortion.png"
                    )
                }
            }
        },
        ("node--space", "space-1"): {
            "attributes": {"title": "The Springs Cinema & Taphouse - Auditorium 1"},
            "relationships": {
                "field_venue": {"data": {"type": "node--venue", "id": "venue-1"}}
            },
        },
        ("node--venue", "venue-1"): {
            "attributes": {
                "title": "The Springs Cinema & Taphouse",
                "path": {"alias": "/venue/springs-cinema-taphouse"},
                "field_path": "/venue/springs-cinema-taphouse",
                "field_address": {
                    "address_line1": "5920 Roswell Rd.",
                    "locality": "Sandy Springs",
                    "administrative_area": "GA",
                    "postal_code": "30328",
                },
            },
            "relationships": {},
        },
    }

    record = _build_event_record(item, included, today_iso="2026-03-10")

    assert record is not None
    assert record["title"] == "Abortion in the Holy Land"
    assert record["start_date"] == "2026-03-12"
    assert record["start_time"] == "19:30"
    assert record["is_all_day"] is False
    assert record["venue_data"]["name"] == "The Springs Cinema & Taphouse - Auditorium 1"
    assert record["venue_data"]["slug"] == "ajff-the-springs-cinema-taphouse-auditorium-1"
    assert record["source_url"] == "https://ajff.org/offering/abortion-holy-land"
    assert record["ticket_url"].startswith("https://ajff.evenue.net/")
    assert record["image_url"].endswith("/film-abortion.png")
    assert "Q&A component" in record["description"]
    assert record["price_note"] == "Sold out"


def test_build_event_record_parses_virtual_screening_window():
    item = {
        "type": "happening--virtual_screening",
        "attributes": {
            "field_start_date": "2026-03-06T00:00:00-05:00",
            "field_end_date": "2026-03-15T23:30:00-04:00",
            "field_geo_block": "Georgia",
            "field_release_window_qualifier": "through Sunday, March 15",
            "field_sale_status": "on_sale",
            "field_ticket_purchase_url": {
                "url": "https://ajff.evenue.net/cgi-bin/ncommerce3/SEGetEventInfo?ticketCode=virtual"
            },
        },
        "relationships": {
            "field_offering": {
                "data": {"type": "node--offering", "id": "offering-virtual"}
            },
            "field_space": {
                "data": {"type": "node--space", "id": "virtual-space"}
            },
        },
    }
    included = {
        ("node--offering", "offering-virtual"): {
            "attributes": {
                "title": "2026 Streaming Pass",
                "path": {"alias": "/offering/2026-annual-festival/2026-streaming-pass"},
                "field_synopsis": (
                    "<p>AJFF is happy to offer an all-access Streaming Pass to every film "
                    "in the Virtual Cinema.</p>"
                ),
            },
            "relationships": {},
        },
        ("node--space", "virtual-space"): {
            "attributes": {"title": "Virtual Cinema - Auditorium V"},
            "relationships": {},
        },
    }

    record = _build_event_record(item, included, today_iso="2026-03-10")

    assert record is not None
    assert record["title"] == "2026 Streaming Pass"
    assert record["start_date"] == "2026-03-10"
    assert record["start_time"] is None
    assert record["end_date"] == "2026-03-15"
    assert record["is_all_day"] is True
    assert record["is_virtual"] is True
    assert record["venue_data"] is None
    assert "Streaming window" in record["description"]
    assert "Georgia" in record["price_note"]
    assert "virtual-cinema" in record["tags"]


def test_build_tentpole_event_record_parses_festival_series_payload():
    festival_payload = {
        "data": {
            "type": "node--festival_series",
            "id": "festival-1",
            "attributes": {
                "title": "2026 Annual Festival",
                "path": {"alias": "/festival-series/2026-annual-festival"},
                "field_path": "/festival-series/2026-annual-festival",
                "field_start_date": "2026-02-18",
                "field_end_date": "2026-03-15",
                "field_teaser": (
                    "Atlanta Jewish Film Festival returns to Theaters February 18 - March 3 "
                    "and Streaming March 6 - March 15."
                ),
                "field_ticketing_status": "on_sale",
                "meta": [
                    {
                        "tag": "meta",
                        "attributes": {
                            "name": "description",
                            "content": (
                                "The 2026 Atlanta Jewish Film Festival returns to theaters and "
                                "streaming for another celebration of Jewish cinema."
                            ),
                        },
                    }
                ],
            },
            "relationships": {
                "field_heroes": {
                    "data": [
                        {"type": "paragraph--hero", "id": "hero-1"},
                    ]
                }
            },
        },
        "included": [
            {
                "type": "paragraph--hero",
                "id": "hero-1",
                "attributes": {
                    "field_body": {
                        "processed": (
                            "<p>AJFF is now streaming across metro Atlanta and throughout Georgia "
                            "through March 15.</p>"
                        )
                    }
                },
                "relationships": {
                    "field_hero_image": {
                        "data": {"type": "media--image", "id": "media-1"}
                    }
                },
            },
            {
                "type": "media--image",
                "id": "media-1",
                "relationships": {
                    "field_media_image": {
                        "data": {"type": "file--file", "id": "file-1"}
                    }
                },
            },
            {
                "type": "file--file",
                "id": "file-1",
                "links": {
                    "ajff_org_hero": {
                        "href": "https://data.ajff.org/sites/default/files/styles/ajff_org_hero/public/2026-hero.png"
                    }
                },
            },
        ],
    }

    record = _build_tentpole_event_record(festival_payload, today_iso="2026-03-10")

    assert record["title"] == "2026 Annual Festival"
    assert record["start_date"] == "2026-03-10"
    assert record["end_date"] == "2026-03-15"
    assert record["is_tentpole"] is True
    assert record["source_url"] == "https://ajff.org/festival-series/2026-annual-festival"
    assert record["ticket_url"] == "https://ajff.org/films"
    assert record["image_url"].endswith("/2026-hero.png")
    description = record["description"].lower()
    assert "festival returns to theaters and streaming" in description
    assert "streaming across metro atlanta" in description
