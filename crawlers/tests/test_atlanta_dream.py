from datetime import datetime

from sources.atlanta_dream import (
    HOME_SCHEDULE,
    OPPONENT_NAME_BY_LABEL,
    build_matchup_participants,
    build_event_title,
    upcoming_home_games,
)


def test_home_schedule_has_expected_event_count():
    assert len(HOME_SCHEDULE) == 22


def test_build_event_title_uses_full_official_team_name():
    assert build_event_title("Las Vegas") == "Atlanta Dream vs Las Vegas Aces"
    assert build_event_title("Golden State") == "Atlanta Dream vs Golden State Valkyries"


def test_upcoming_home_games_filters_past_dates():
    games = upcoming_home_games(datetime(2026, 7, 12))
    assert games[0]["date"] == "2026-07-13"
    assert games[-1]["date"] == "2026-09-19"


def test_all_schedule_labels_have_team_name_mapping():
    labels = {game["opponent_label"] for game in HOME_SCHEDULE}
    assert labels <= set(OPPONENT_NAME_BY_LABEL)


def test_build_matchup_participants_uses_structured_home_and_opponent_names():
    assert build_matchup_participants("Las Vegas") == [
        {"name": "Atlanta Dream", "role": "team", "billing_order": 1},
        {"name": "Las Vegas Aces", "role": "team", "billing_order": 2},
    ]
