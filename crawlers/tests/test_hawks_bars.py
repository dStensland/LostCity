from datetime import date

from sources.hawks_bars import parse_watch_parties


def test_parse_watch_parties_uses_schedule_tipoff_for_start_time():
    events_payload = {
        "gen_events": [
            {
                "id": 20,
                "name": "Watch Party: Hawks vs. Mavericks",
                "type": "wp",
                "business_id": 19,
                "event_start": "2026-03-18 20:30:00",
                "gid_simple": "20260318_dal_a",
                "is_bar_network_event": 1,
                "description": "Come hang out with the Hawks Entertainment team and fellow fans.",
                "img_url": "https://cdn.nba.com/logos/nba/1610612742/primary/L/logo.svg",
            }
        ]
    }
    businesses_payload = {
        "gen_businesses": [
            {
                "id": 19,
                "is_in_bar_network": 1,
                "name": "The Beverly",
                "addr1": "790 Glenwood Ave SE",
                "addr2": "Atlanta, GA 30316",
                "web_url": "https://www.thebeverlyatl.com/",
                "logo_url": "https://cdn.nba.com/teams/uploads/sites/1610612737/2023/12/the_beverly_logo.jpg",
            }
        ]
    }
    schedule_payload = {
        "schedule": {
            "games": [
                {
                    "gid_simple": "20260318_dal_a",
                    "datetime_eastern": "2026-03-18 20:30:00",
                    "opp_tc": "Dallas",
                    "opp_tn": "Mavericks",
                    "opp_logo_url": "https://cdn.nba.com/logos/nba/1610612742/primary/L/logo.svg",
                }
            ]
        }
    }

    parties = parse_watch_parties(
        events_payload, businesses_payload, schedule_payload, today=date(2026, 3, 10)
    )

    assert parties == [
        {
            "title": "Atlanta Hawks Watch Party vs. Dallas Mavericks at The Beverly",
            "opponent": "Dallas Mavericks",
            "venue_name": "The Beverly",
            "venue_data": {
                "name": "The Beverly",
                "slug": "the-beverly",
                "address": "790 Glenwood Ave SE",
                "city": "Atlanta",
                "state": "GA",
                "zip": "30316",
                "place_type": "sports_bar",
                "spot_type": "sports_bar",
                "website": "https://www.thebeverlyatl.com/",
            },
            "start_date": "2026-03-18",
            "start_time": "20:00",
            "tipoff_time": "20:30",
            "description": "Come hang out with the Hawks Entertainment team and fellow fans.",
            "source_url": "https://www.nba.com/hawks/barnetwork",
            "image_url": "https://cdn.nba.com/logos/nba/1610612742/primary/L/logo.svg",
            "gid_simple": "20260318_dal_a",
            "event_id": 20,
        }
    ]


def test_parse_watch_parties_filters_past_and_non_bar_network_items():
    events_payload = {
        "gen_events": [
            {
                "id": 19,
                "name": "Watch Party: Hawks vs. 76ers",
                "type": "wp",
                "business_id": 17,
                "event_start": "2026-02-19 19:00:00",
                "gid_simple": "20260219_phi_a",
                "is_bar_network_event": 1,
                "description": "Past event",
                "img_url": "",
            },
            {
                "id": 99,
                "name": "Community Pop-Up",
                "type": "gen",
                "business_id": 17,
                "event_start": "2026-03-20 14:00:00",
                "gid_simple": "",
                "is_bar_network_event": 0,
                "description": "Not a bar-network watch party",
                "img_url": "",
            },
        ]
    }
    businesses_payload = {
        "gen_businesses": [
            {
                "id": 17,
                "is_in_bar_network": 1,
                "name": "McCray's Tavern Smyrna",
                "addr1": "4500 Village Pl SE",
                "addr2": "Smyrna, GA 30080",
                "web_url": "https://www.mccraystavern.com/",
                "logo_url": "",
            }
        ]
    }
    schedule_payload = {
        "schedule": {
            "games": [
                {
                    "gid_simple": "20260219_phi_a",
                    "datetime_eastern": "2026-02-19 19:00:00",
                    "opp_tc": "Philadelphia",
                    "opp_tn": "76ers",
                    "opp_logo_url": "",
                }
            ]
        }
    }

    parties = parse_watch_parties(
        events_payload, businesses_payload, schedule_payload, today=date(2026, 3, 10)
    )

    assert parties == []
