from datetime import datetime, timezone

from sources.atlanta_united_fc import (
    TEAM_SPORTEC_ID,
    build_matchup_participants,
    build_event_title,
    build_match_page_url,
    parse_match_datetime,
    upcoming_home_matches,
)


def test_parse_match_datetime_handles_seven_digit_fractional_seconds():
    parsed = parse_match_datetime("2026-03-08T00:30:00.0000000Z")

    assert parsed == datetime(2026, 3, 8, 0, 30, tzinfo=timezone.utc)


def test_build_match_page_url_uses_official_competition_path():
    match = {
        "competition": {"slug": "mls-regular-season"},
        "season": {"name": "2026"},
        "slug": "atlvsrsl-03-07-2026",
    }

    assert (
        build_match_page_url(match)
        == "https://www.atlutd.com/competitions/mls-regular-season/2026/matches/atlvsrsl-03-07-2026/"
    )


def test_build_event_title_uses_fc_title_format():
    match = {"away": {"fullName": "Philadelphia Union"}}

    assert build_event_title(match) == "Atlanta United FC vs. Philadelphia Union"


def test_upcoming_home_matches_filters_home_regular_season_future_matches():
    matches = [
        {
            "competition": {"name": "MLS Regular Season"},
            "home": {"sportecId": TEAM_SPORTEC_ID},
            "away": {"fullName": "Philadelphia Union"},
            "matchDate": "2026-03-14T19:15:00.0000000Z",
            "slug": "atlvsphi-03-14-2026",
            "season": {"name": "2026"},
        },
        {
            "competition": {"name": "MLS Regular Season"},
            "home": {"sportecId": "MLS-CLU-OTHER"},
            "away": {"fullName": "Atlanta United"},
            "matchDate": "2026-03-21T23:30:00.0000000Z",
            "slug": "dcvsatl-03-21-2026",
            "season": {"name": "2026"},
        },
        {
            "competition": {"name": "MLS Preseason Friendlies"},
            "home": {"sportecId": TEAM_SPORTEC_ID},
            "away": {"fullName": "FC Dallas"},
            "matchDate": "2026-02-14T17:00:00.0000000Z",
            "slug": "atlvsdal-02-14-2026",
            "season": {"name": "2026"},
        },
        {
            "competition": {"name": "MLS Regular Season"},
            "home": {"sportecId": TEAM_SPORTEC_ID},
            "away": {"fullName": "D.C. United"},
            "matchDate": "2026-03-21T23:30:00.0000000Z",
            "slug": "atlvsdc-03-21-2026",
            "season": {"name": "2026"},
        },
    ]

    upcoming = upcoming_home_matches(matches, now=datetime(2026, 3, 15, tzinfo=timezone.utc))

    assert [match["slug"] for match in upcoming] == ["atlvsdc-03-21-2026"]


def test_build_matchup_participants_uses_explicit_opponent_field():
    match = {"away": {"fullName": "Philadelphia Union"}}

    assert build_matchup_participants(match) == [
        {"name": "Atlanta United FC", "role": "team", "billing_order": 1},
        {"name": "Philadelphia Union", "role": "team", "billing_order": 2},
    ]
