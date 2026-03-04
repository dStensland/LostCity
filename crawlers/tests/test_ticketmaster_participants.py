from unittest.mock import patch

from sources.ticketmaster import (
    _build_parsed_artists,
    _fetch_detail_description,
    _should_skip_event_title,
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
    assert _should_skip_event_title("POST GAME ACCESS ONLY vs Nets")
    assert _should_skip_event_title("Star Wars Item Voucher")
    assert _should_skip_event_title("Lit Lounge Hospitality Add-on - Ally ACC WBBT")
    assert _should_skip_event_title("Bryce Crawford VIP Q&A Add-Ons - Not a Concert Ticket")


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


@patch("sources.ticketmaster.requests.get")
@patch("sources.ticketmaster.extract_jsonld_event_fields")
@patch("sources.ticketmaster.extract_open_graph_fields")
def test_fetch_detail_description_returns_jsonld_description(
    mock_extract_og,
    mock_extract_jsonld,
    mock_get,
) -> None:
    mock_get.return_value.ok = True
    mock_get.return_value.text = "<html></html>"
    mock_extract_jsonld.return_value = {"description": "Long Ticketmaster detail description."}
    mock_extract_og.return_value = {}

    description = _fetch_detail_description("https://www.ticketmaster.com/event/test")

    assert description == "Long Ticketmaster detail description."
