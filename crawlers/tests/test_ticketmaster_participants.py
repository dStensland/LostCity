from unittest.mock import patch

from sources.ticketmaster import (
    _build_parsed_artists,
    _fetch_detail_enrichment,
    _normalize_sports_matchup_title,
    _should_force_tours_category,
    _should_skip_event_title,
    crawl,
    parse_event,
)


def test_build_parsed_artists_filters_package_rows() -> None:
    rows = _build_parsed_artists(
        [
            {"name": "Atlanta Braves"},
            {"name": "Kansas City Royals"},
            {"name": "VIP Package"},
            {"name": "Premium Seating"},
        ]
    )
    assert [r["name"] for r in rows] == ["Atlanta Braves", "Kansas City Royals"]
    assert [r["role"] for r in rows] == ["headliner", "support"]


def test_parse_event_emits_structured_participants_from_attractions() -> None:
    event = parse_event(
        {
            "name": "Atlanta Braves v. Kansas City Royals",
            "url": "",
            "dates": {"start": {"localDate": "2026-03-15", "localTime": "19:20:00"}},
            "classifications": [{"segment": {"name": "Sports"}, "genre": {"name": "Baseball"}}],
            "_embedded": {
                "venues": [
                    {
                        "name": "Truist Park",
                        "city": {"name": "Atlanta"},
                        "state": {"stateCode": "GA"},
                        "address": {"line1": "755 Battery Ave SE"},
                        "location": {"latitude": "33.8908", "longitude": "-84.4677"},
                    }
                ],
                "attractions": [
                    {"name": "Atlanta Braves"},
                    {"name": "Kansas City Royals"},
                ],
            },
            "info": (
                "This matchup includes full game presentation and venue operations details "
                "for fans planning attendance at Truist Park in Atlanta."
            ),
        }
    )

    assert event is not None
    participants = event.get("_parsed_artists") or []
    assert [row["name"] for row in participants] == [
        "Atlanta Braves",
        "Kansas City Royals",
    ]


def test_should_skip_event_title_for_ticket_addon_rows() -> None:
    assert _should_skip_event_title("HAWKS SUITE PASS: Portland Trail Blazers")
    assert _should_skip_event_title("2026 USMNT vs Belgium Suite Passes")
    assert _should_skip_event_title("Atlanta Braves vs. Kansas City Royals * Premium Seating *")
    assert _should_skip_event_title("Gladiators vs Florida - Suites")
    assert _should_skip_event_title("POST GAME ACCESS ONLY vs Nets")
    assert _should_skip_event_title("Star Wars Item Voucher")
    assert _should_skip_event_title("Lit Lounge Hospitality Add-on - Ally ACC WBBT")
    assert _should_skip_event_title("Bryce Crawford VIP Q&A Add-Ons - Not a Concert Ticket")
    assert _should_skip_event_title("Childcare Pass: DC United")
    assert _should_skip_event_title("Molly B's Pass: Columbus Crew")
    assert _should_skip_event_title("2026 Group Deposits")
    assert _should_skip_event_title("Harlem Globetrotters 100 Year Tour Souvenir Ticket")
    assert _should_skip_event_title("Limited Edition 100 Year Golden Replica Game Ball by Spalding®")
    assert _should_skip_event_title("USMNT vs Belgium Rental Event")
    assert _should_skip_event_title("fevo shirt test")
    assert _should_skip_event_title("Premium Member Training Event")
    assert _should_skip_event_title("New Aip 900 Build April 9")
    assert _should_skip_event_title("Delta Sky 360 Club Experience - New Edition")
    assert _should_skip_event_title("Delta Sky360 Club Red Carpet Experience: New Edition")


def test_should_force_tours_category_for_venue_tour_rows() -> None:
    assert _should_force_tours_category("Tours: Truist Park")
    assert _should_force_tours_category("Braves Historian Tour 3/28/26")
    assert _should_force_tours_category("Braves Bats & Bites Tour 3/27/26")
    assert not _should_force_tours_category("Tour Championship")


def test_normalize_sports_matchup_title_rewrites_v_to_vs() -> None:
    assert _normalize_sports_matchup_title("Atlanta Vibe v. Omaha Supernovas") == "Atlanta Vibe vs. Omaha Supernovas"
    assert _normalize_sports_matchup_title("Atlanta Hawks v. Dallas Mavericks") == "Atlanta Hawks vs. Dallas Mavericks"


def test_parse_event_skips_ticket_addon_rows() -> None:
    event = parse_event(
        {
            "name": "HAWKS SUITE PASS: Portland Trail Blazers",
            "url": "",
            "dates": {"start": {"localDate": "2026-03-01", "localTime": "18:00:00"}},
            "classifications": [{"segment": {"name": "Sports"}, "genre": {"name": "Basketball"}}],
            "_embedded": {
                "venues": [
                    {
                        "name": "State Farm Arena",
                        "city": {"name": "Atlanta"},
                        "state": {"stateCode": "GA"},
                    }
                ]
            },
        }
    )

    assert event is None


def test_parse_event_skips_low_fidelity_uppercase_placeholder_rows() -> None:
    event = parse_event(
        {
            "name": "WE THEM ONES",
            "url": "https://www.ticketmaster.com/event/we-them-ones-placeholder",
            "dates": {"start": {"localDate": "2026-04-05", "localTime": "19:00:00"}},
            "classifications": None,
            "_embedded": {
                "venues": [
                    {
                        "name": "State Farm Arena",
                        "city": {"name": "Atlanta"},
                        "state": {"stateCode": "GA"},
                    }
                ]
            },
        }
    )

    assert event is None


def test_parse_event_normalizes_matchup_title_even_when_segment_is_not_sports() -> None:
    event = parse_event(
        {
            "name": "LOVB Atlanta v LOVB Nebraska",
            "url": "https://www.ticketmaster.com/event/evt-2",
            "dates": {"start": {"localDate": "2026-03-25", "localTime": "20:00:00"}},
            "classifications": [{"segment": {"name": "Miscellaneous"}, "genre": {"name": "Other"}}],
            "_embedded": {
                "venues": [
                    {
                        "name": "Gas South Arena",
                        "city": {"name": "Duluth"},
                        "state": {"stateCode": "GA"},
                    }
                ]
            },
        }
    )

    assert event is not None
    assert event["title"] == "LOVB Atlanta vs. LOVB Nebraska"


def test_parse_event_routes_truist_tour_out_of_sports() -> None:
    event = parse_event(
        {
            "name": "Tours: Truist Park",
            "url": "https://www.ticketmaster.com/event/truist-tour",
            "dates": {"start": {"localDate": "2026-03-20", "localTime": "14:00:00"}},
            "classifications": [{"segment": {"name": "Sports"}, "genre": {"name": "Baseball"}}],
            "_embedded": {
                "venues": [
                    {
                        "name": "Truist Park",
                        "city": {"name": "Atlanta"},
                        "state": {"stateCode": "GA"},
                    }
                ]
            },
        }
    )

    assert event is not None
    assert event["category"] == "tours"


def test_parse_event_normalizes_known_ticketmaster_venue_aliases() -> None:
    event = parse_event(
        {
            "name": "Men In Blazers",
            "url": "https://www.ticketmaster.com/event/men-in-blazers",
            "dates": {"start": {"localDate": "2026-03-27", "localTime": "19:30:00"}},
            "classifications": [{"segment": {"name": "Sports"}, "genre": {"name": "Soccer"}}],
            "_embedded": {
                "venues": [
                    {
                        "name": "The Eastern-GA",
                        "city": {"name": "Atlanta"},
                        "state": {"stateCode": "GA"},
                        "address": {"line1": "777 Memorial Dr SE"},
                    }
                ]
            },
        }
    )

    assert event is not None
    assert event["venue"]["name"] == "The Eastern"
    assert event["venue"]["slug"] == "the-eastern"


@patch("sources.ticketmaster.requests.get")
@patch("sources.ticketmaster.extract_jsonld_event_fields")
@patch("sources.ticketmaster.extract_open_graph_fields")
def test_fetch_detail_enrichment_returns_description_and_image(
    mock_extract_og,
    mock_extract_jsonld,
    mock_get,
) -> None:
    mock_get.return_value.ok = True
    mock_get.return_value.text = "<html></html>"
    mock_extract_jsonld.return_value = {"description": "Long Ticketmaster detail description.", "image_url": "https://example.com/photo.jpg"}
    mock_extract_og.return_value = {}

    result = _fetch_detail_enrichment("https://www.ticketmaster.com/event/test")

    assert result["description"] == "Long Ticketmaster detail description."
    assert result["image_url"] == "https://example.com/photo.jpg"


@patch("sources.ticketmaster.requests.get")
@patch("sources.ticketmaster.extract_jsonld_event_fields")
@patch("sources.ticketmaster.extract_open_graph_fields")
def test_fetch_detail_enrichment_returns_structured_price_and_status(
    mock_extract_og,
    mock_extract_jsonld,
    mock_get,
) -> None:
    mock_get.return_value.ok = True
    mock_get.return_value.text = "<html></html>"
    mock_extract_jsonld.return_value = {
        "price_min": 29.5,
        "price_max": 89.5,
        "price_note": "$29.50 - $89.50",
        "ticket_status": "tickets-available",
        "ticket_url": "https://www.ticketmaster.com/event/test",
        "artists": ["Example Artist"],
    }
    mock_extract_og.return_value = {}

    result = _fetch_detail_enrichment("https://www.ticketmaster.com/event/test")

    assert result["price_min"] == 29.5
    assert result["price_max"] == 89.5
    assert result["price_note"] == "$29.50 - $89.50"
    assert result["ticket_status"] == "tickets-available"
    assert result["ticket_url"] == "https://www.ticketmaster.com/event/test"
    assert result["artists"] == ["Example Artist"]


@patch("sources.ticketmaster.requests.get")
@patch("sources.ticketmaster.extract_jsonld_event_fields")
@patch("sources.ticketmaster.extract_open_graph_fields")
def test_fetch_detail_enrichment_falls_back_to_og(
    mock_extract_og,
    mock_extract_jsonld,
    mock_get,
) -> None:
    mock_get.return_value.ok = True
    mock_get.return_value.text = "<html></html>"
    mock_extract_jsonld.return_value = {}
    mock_extract_og.return_value = {"description": "OG description.", "image_url": "https://example.com/og.jpg"}

    result = _fetch_detail_enrichment("https://www.ticketmaster.com/event/test")

    assert result["description"] == "OG description."
    assert result["image_url"] == "https://example.com/og.jpg"


@patch("sources.ticketmaster._fetch_detail_enrichment")
def test_parse_event_uses_detail_enrichment_for_misc_comedy_rows(mock_detail_fetch) -> None:
    mock_detail_fetch.return_value = {
        "description": "A full stand-up set from Example Comic with featured guests and venue details.",
        "image_url": "https://example.com/comic.jpg",
        "price_min": 35.0,
        "price_max": 55.0,
        "price_note": "$35-$55",
        "ticket_status": "tickets-available",
        "artists": ["Example Comic"],
    }

    event = parse_event(
        {
            "name": "Example Comic Live",
            "url": "https://www.ticketmaster.com/event/example-comic",
            "dates": {"start": {"localDate": "2026-03-20", "localTime": "20:00:00"}},
            "classifications": [
                {
                    "segment": {"name": "Miscellaneous"},
                    "genre": {"name": "Comedy"},
                    "subGenre": {"name": "Comedy"},
                }
            ],
            "_embedded": {
                "venues": [
                    {
                        "name": "Atlanta Venue",
                        "city": {"name": "Atlanta"},
                        "state": {"stateCode": "GA"},
                    }
                ]
            },
        }
    )

    assert event is not None
    assert event["category"] == "nightlife"
    assert event["genres"] == ["stand-up"]
    assert event["genre"] == "stand-up"
    assert event["price_min"] == 35.0
    assert event["price_max"] == 55.0
    assert event["price_note"] == "$35-$55"
    assert event["ticket_status"] == "tickets-available"
    assert event["_parsed_artists"][0]["name"] == "Example Comic"
    assert event["links"] == [
        {"type": "event", "url": "https://www.ticketmaster.com/event/example-comic"},
        {"type": "ticket", "url": "https://www.ticketmaster.com/event/example-comic"},
    ]


@patch("sources.ticketmaster.insert_event")
@patch("sources.ticketmaster.smart_update_existing_event")
@patch("sources.ticketmaster.find_existing_event_for_insert")
@patch("sources.ticketmaster.get_or_create_place", return_value=126)
@patch("sources.ticketmaster.fetch_events")
def test_crawl_uses_natural_key_guard_for_normalized_sports_titles(
    mock_fetch_events,
    mock_get_or_create_place,
    mock_find_existing,
    mock_smart_update,
    mock_insert_event,
) -> None:
    mock_fetch_events.return_value = {
        "page": {"totalPages": 1},
        "_embedded": {
            "events": [
                {
                    "id": "evt-1",
                    "name": "Atlanta Hawks v. Brooklyn Nets",
                    "url": "https://www.ticketmaster.com/event/evt-1",
                    "dates": {
                        "start": {
                            "localDate": "2026-03-12",
                            "localTime": "19:30:00",
                        }
                    },
                    "classifications": [
                        {
                            "segment": {"name": "Sports"},
                            "genre": {"name": "Basketball"},
                        }
                    ],
                    "_embedded": {
                        "venues": [
                            {
                                "name": "State Farm Arena",
                                "city": {"name": "Atlanta"},
                                "state": {"stateCode": "GA"},
                            }
                        ]
                    },
                }
            ]
        },
    }
    mock_find_existing.return_value = {
        "id": 1069,
        "title": "Atlanta Hawks v. Brooklyn Nets",
        "source_id": 11,
        "venue_id": 126,
        "start_date": "2026-03-12",
        "start_time": "19:30",
    }

    with patch("sources.ticketmaster.API_KEY", "test-key"):
        found, new, updated = crawl({"id": 11})

    assert (found, new, updated) == (1, 0, 1)
    mock_find_existing.assert_called_once()
    event_record = mock_find_existing.call_args.args[0]
    assert event_record["title"] == "Atlanta Hawks vs. Brooklyn Nets"
    mock_smart_update.assert_called_once_with(mock_find_existing.return_value, event_record)
    mock_insert_event.assert_not_called()


@patch("sources.ticketmaster.insert_event")
@patch("sources.ticketmaster.smart_update_existing_event")
@patch("sources.ticketmaster.find_existing_event_for_insert", return_value=None)
@patch("sources.ticketmaster.get_or_create_place", return_value=126)
@patch("sources.ticketmaster.fetch_events")
def test_crawl_persists_ticketmaster_quality_fields(
    mock_fetch_events,
    mock_get_or_create_place,
    mock_find_existing,
    mock_smart_update,
    mock_insert_event,
) -> None:
    mock_fetch_events.return_value = {
        "page": {"totalPages": 1},
        "_embedded": {
            "events": [
                {
                    "id": "evt-99",
                    "name": "Example Comic Live",
                    "url": "https://www.ticketmaster.com/event/evt-99",
                    "dates": {
                        "start": {
                            "localDate": "2026-03-20",
                            "localTime": "20:00:00",
                        }
                    },
                    "classifications": [
                        {
                            "segment": {"name": "Miscellaneous"},
                            "genre": {"name": "Comedy"},
                            "subGenre": {"name": "Comedy"},
                        }
                    ],
                    "_embedded": {
                        "venues": [
                            {
                                "name": "Atlanta Venue",
                                "city": {"name": "Atlanta"},
                                "state": {"stateCode": "GA"},
                            }
                        ],
                        "attractions": [
                            {"name": "Example Comic"},
                        ],
                    },
                    "priceRanges": [{"min": 25, "max": 45}],
                }
            ]
        },
    }

    with patch("sources.ticketmaster.API_KEY", "test-key"):
        found, new, updated = crawl({"id": 11})

    assert (found, new, updated) == (1, 1, 0)
    mock_insert_event.assert_called_once()
    event_record = mock_insert_event.call_args.args[0]
    assert event_record["category"] == "nightlife"
    assert event_record["genres"] == ["stand-up"]
    assert "stand-up" in event_record["tags"]
    assert event_record["price_min"] == 25
    assert event_record["price_max"] == 45
    assert event_record["_parsed_artists"][0]["name"] == "Example Comic"
    assert event_record["links"] == [
        {"type": "event", "url": "https://www.ticketmaster.com/event/evt-99"},
        {"type": "ticket", "url": "https://www.ticketmaster.com/event/evt-99"},
    ]
    mock_smart_update.assert_not_called()
