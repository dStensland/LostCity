from datetime import date

from sources.atlanta_hustle import build_matchup_participants, parse_games


def test_parse_games_extracts_future_home_games_only():
    payload = {
        "games": [
            {
                "gameID": "2026-05-16-CAR-ATL",
                "awayTeamID": "flyers",
                "awayTeamCity": "Carolina",
                "awayTeamName": "Flyers",
                "homeTeamID": "hustle",
                "homeTeamCity": "Atlanta",
                "homeTeamName": "Hustle",
                "status": "Upcoming",
                "week": "week-4",
                "ticketURL": "shop.atlantahustle.com",
                "streamingURL": "https://watchufa.tv/events/carolina-at-atlanta-5-16-2026",
                "locationName": "Silverbacks Park",
                "startTimestamp": "2026-05-16T19:00:00-04:00",
                "startTimeTBD": None,
            },
            {
                "gameID": "2026-05-23-ATL-CAR",
                "awayTeamID": "hustle",
                "awayTeamCity": "Atlanta",
                "awayTeamName": "Hustle",
                "homeTeamID": "flyers",
                "homeTeamCity": "Carolina",
                "homeTeamName": "Flyers",
                "status": "Upcoming",
                "week": "week-5",
                "ticketURL": "https://example.com/away",
                "streamingURL": "https://watchufa.tv/events/atlanta-at-carolina-5-23-2026",
                "locationName": "Durham County Memorial Stadium",
                "startTimestamp": "2026-05-23T19:00:00-04:00",
                "startTimeTBD": None,
            },
            {
                "gameID": "2026-05-01-OLD",
                "awayTeamID": "flyers",
                "awayTeamCity": "Carolina",
                "awayTeamName": "Flyers",
                "homeTeamID": "hustle",
                "homeTeamCity": "Atlanta",
                "homeTeamName": "Hustle",
                "status": "Upcoming",
                "week": "week-2",
                "ticketURL": "shop.atlantahustle.com",
                "streamingURL": "https://watchufa.tv/events/carolina-at-atlanta-5-1-2026",
                "locationName": "Silverbacks Park",
                "startTimestamp": "2026-05-01T19:00:00-04:00",
                "startTimeTBD": None,
            },
        ]
    }

    games = parse_games(payload, today=date(2026, 5, 10))

    assert games == [
        {
            "title": "Atlanta Hustle vs Carolina Flyers",
            "opponent": "Carolina Flyers",
            "start_date": "2026-05-16",
            "start_time": "19:00",
            "source_url": "https://www.watchufa.com/hustle/game/2026-05-16-CAR-ATL",
            "ticket_url": "https://shop.atlantahustle.com",
            "stream_url": "https://watchufa.tv/events/carolina-at-atlanta-5-16-2026",
            "location_name": "Silverbacks Park",
            "week": "week-4",
            "game_id": "2026-05-16-CAR-ATL",
        }
    ]


def test_build_matchup_participants_uses_home_team_and_opponent():
    assert build_matchup_participants("Carolina Flyers") == [
        {"name": "Atlanta Hustle", "role": "team", "billing_order": 1},
        {"name": "Carolina Flyers", "role": "team", "billing_order": 2},
    ]
