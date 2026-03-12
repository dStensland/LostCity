from datetime import datetime
from zoneinfo import ZoneInfo

from sources.atlanta_hawks import (
    build_event_title,
    build_game_page_url,
    parse_local_datetime,
    upcoming_home_games,
)


def test_parse_local_datetime_reads_eastern_schedule_time():
    game = {"etm": "2026-03-10T19:30:00"}

    assert parse_local_datetime(game) == datetime(2026, 3, 10, 19, 30, tzinfo=ZoneInfo("America/New_York"))


def test_build_event_title_matches_ticketmaster_format():
    game = {"v": {"tc": "Dallas", "tn": "Mavericks"}}

    assert build_event_title(game) == "Atlanta Hawks vs. Dallas Mavericks"


def test_build_game_page_url_uses_official_nba_game_route():
    game = {"gid": "0022500932"}

    assert build_game_page_url(game) == "https://www.nba.com/game/0022500932"


def test_upcoming_home_games_filters_to_future_hawks_home_games():
    games = [
        {
            "gid": "1",
            "etm": "2026-03-10T19:30:00",
            "h": {"ta": "ATL"},
            "v": {"tc": "Dallas", "tn": "Mavericks"},
        },
        {
            "gid": "2",
            "etm": "2026-03-12T19:30:00",
            "h": {"ta": "BKN"},
            "v": {"tc": "Atlanta", "tn": "Hawks"},
        },
        {
            "gid": "3",
            "etm": "2026-03-08T19:30:00",
            "h": {"ta": "ATL"},
            "v": {"tc": "Memphis", "tn": "Grizzlies"},
        },
    ]

    upcoming = upcoming_home_games(games, now=datetime(2026, 3, 10, 12, 0, tzinfo=ZoneInfo("America/New_York")))

    assert [game["gid"] for game in upcoming] == ["1"]
