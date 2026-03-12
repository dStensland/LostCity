from datetime import datetime

from sources.college_park_skyhawks import (
    HOME_SCHEDULE,
    OPPONENT_NAME_BY_LABEL,
    build_event_title,
    upcoming_home_games,
)


def test_home_schedule_has_expected_event_count():
    assert len(HOME_SCHEDULE) == 24


def test_build_event_title_uses_existing_gateway_center_title_format():
    assert build_event_title("CCG") == "College Park Skyhawks vs. Capital City Go-Go"
    assert build_event_title("OSC") == "College Park Skyhawks vs. Osceola Magic"


def test_upcoming_home_games_filters_past_dates():
    games = upcoming_home_games(datetime(2026, 3, 10))
    assert games == [
        {"date": "2026-03-17", "time": "19:00", "opponent_label": "AUS"},
        {"date": "2026-03-25", "time": "19:00", "opponent_label": "OSC"},
    ]


def test_all_schedule_labels_have_team_name_mapping():
    labels = {game["opponent_label"] for game in HOME_SCHEDULE}
    assert labels <= set(OPPONENT_NAME_BY_LABEL)
