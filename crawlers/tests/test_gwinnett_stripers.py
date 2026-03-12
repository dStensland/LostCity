from datetime import datetime
from zoneinfo import ZoneInfo

from sources.gwinnett_stripers import STRIPERS_TEAM_ID, build_matchup_participants


def test_stripers_team_id_matches_live_milb_api_team():
    assert STRIPERS_TEAM_ID == 431


def test_milb_game_time_converts_from_utc_to_atlanta_local():
    game_dt = datetime.fromisoformat("2026-03-27T23:05:00+00:00")
    local_dt = game_dt.astimezone(ZoneInfo("America/New_York"))

    assert local_dt.strftime("%Y-%m-%d") == "2026-03-27"
    assert local_dt.strftime("%H:%M") == "19:05"


def test_home_game_filter_shape_matches_stripers_schedule_payload():
    games = [
        {
            "gameDate": "2026-03-27T23:05:00Z",
            "teams": {
                "home": {"team": {"name": "Gwinnett Stripers"}},
                "away": {"team": {"name": "Memphis Redbirds"}},
            },
        },
        {
            "gameDate": "2026-03-28T23:05:00Z",
            "teams": {
                "home": {"team": {"name": "Jacksonville Jumbo Shrimp"}},
                "away": {"team": {"name": "Gwinnett Stripers"}},
            },
        },
    ]

    home_games = [
        game
        for game in games
        if "gwinnett" in game["teams"]["home"]["team"]["name"].lower()
        or "stripers" in game["teams"]["home"]["team"]["name"].lower()
    ]

    assert len(home_games) == 1
    assert home_games[0]["teams"]["away"]["team"]["name"] == "Memphis Redbirds"


def test_build_matchup_participants_uses_home_team_and_opponent():
    assert build_matchup_participants("Memphis Redbirds") == [
        {"name": "Gwinnett Stripers", "role": "team", "billing_order": 1},
        {"name": "Memphis Redbirds", "role": "team", "billing_order": 2},
    ]
