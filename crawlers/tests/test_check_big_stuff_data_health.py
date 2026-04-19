"""
Tests for scripts.check_big_stuff_data_health — pure-logic functions only.

DB access and HTTP HEAD checks are integration surface; we don't exercise them here.
What matters: the tournament-cluster pattern matches the real FIFA title shape,
the near-duplicate grouper handles the normalization we actually use, and the
date arithmetic matches the loader's 6-month horizon.
"""

from datetime import date

from scripts.check_big_stuff_data_health import (
    _add_months_iso,
    _cluster_tentpoles,
    _near_duplicates,
    _normalize_title,
)


def test_normalize_title_strips_non_alphanumeric_and_lowercases() -> None:
    assert _normalize_title("Atlanta Caribbean Carnival™") == "atlantacaribbeancarnival"
    assert _normalize_title("FIFA World Cup 26") == "fifaworldcup26"
    assert _normalize_title("  FIFA — World Cup ") == "fifaworldcup"


def test_normalize_title_collapses_near_duplicate_spellings() -> None:
    # The real bug pattern: two crawl passes producing near-identical titles
    # that differ only in whitespace / punctuation.
    assert _normalize_title("Atlanta Caribbean Carnival™") == _normalize_title(
        "Atlanta Caribbean Carnival"
    )
    assert _normalize_title("SEC Championship 2026") == _normalize_title(
        "SEC Championship - 2026"
    )


def test_add_months_iso_handles_year_rollover() -> None:
    # Feb → Aug (6 months forward in same year)
    assert _add_months_iso(date(2026, 2, 18), 6) == date(2026, 8, 18)
    # Nov → May (rolls into next year)
    assert _add_months_iso(date(2026, 11, 15), 6) == date(2027, 5, 15)


def test_add_months_iso_clamps_day_to_safe_end_of_month() -> None:
    # Day > 28 clamped so e.g. Jan 31 + 1 month doesn't land on a non-existent Feb 31.
    # We clamp to 28 (diagnostic doesn't need exact day precision).
    assert _add_months_iso(date(2026, 1, 31), 1) == date(2026, 2, 28)


def test_cluster_tentpoles_groups_fifa_world_cup_matches() -> None:
    tentpoles = [
        {
            "id": 1001,
            "title": "FIFA World Cup 26 - Group Stage Match 1",
            "start_date": "2026-06-15",
            "source_id": 12,
        },
        {
            "id": 1002,
            "title": "FIFA World Cup 26 - Group Stage Match 2",
            "start_date": "2026-06-18",
            "source_id": 12,
        },
        {
            "id": 1003,
            "title": "FIFA  World  Cup  26 - Round of 32",
            "start_date": "2026-06-28",
            "source_id": 12,
        },
        {
            "id": 2001,
            "title": "Atlanta Jazz Festival",  # should not match
            "start_date": "2026-05-24",
            "source_id": 3,
        },
    ]

    buckets = _cluster_tentpoles(tentpoles)

    assert len(buckets) == 1
    fifa = buckets[0]
    assert fifa.cluster_key == "fifa-world-cup-26"
    assert len(fifa.rows) == 3
    assert {r["id"] for r in fifa.rows} == {1001, 1002, 1003}


def test_cluster_tentpoles_ignores_singleton_matches() -> None:
    # Single-match "cluster" isn't a dedup problem — no bucket reported.
    tentpoles = [
        {
            "id": 3001,
            "title": "SEC Championship Game 2026",
            "start_date": "2026-12-05",
            "source_id": 5,
        }
    ]

    assert _cluster_tentpoles(tentpoles) == []


def test_near_duplicates_groups_festival_and_tentpole_on_same_normalized_title_and_date() -> (
    None
):
    festivals = [
        {
            "id": "caribbean-carnival",
            "name": "Atlanta Caribbean Carnival",
            "announced_start": "2026-05-24",
        },
    ]
    tentpoles = [
        {
            "id": 4001,
            "title": "Atlanta Caribbean Carnival™",
            "start_date": "2026-05-24",
        },
        {
            "id": 4002,
            "title": "Atlanta Jazz Festival",
            "start_date": "2026-05-24",
        },
    ]

    dupes = _near_duplicates(festivals, tentpoles)

    assert len(dupes) == 1
    group = dupes[0]
    assert group["normalized_title"] == "atlantacaribbeancarnival"
    assert group["start_date"] == "2026-05-24"
    kinds = sorted(r["kind"] for r in group["rows"])
    assert kinds == ["festival", "tentpole"]


def test_near_duplicates_ignores_same_title_on_different_dates() -> None:
    # Legitimately recurring tentpole (e.g., Atlanta Streets Alive on 4 separate
    # dates across the year) must NOT register as a duplicate cluster.
    tentpoles = [
        {"id": 5001, "title": "Atlanta Streets Alive", "start_date": "2026-03-22"},
        {"id": 5002, "title": "Atlanta Streets Alive", "start_date": "2026-04-19"},
        {"id": 5003, "title": "Atlanta Streets Alive", "start_date": "2026-05-17"},
    ]

    assert _near_duplicates([], tentpoles) == []


def test_near_duplicates_ignores_unique_titles() -> None:
    festivals = [
        {"id": "one", "name": "Unique Festival", "announced_start": "2026-06-01"}
    ]
    tentpoles = [{"id": 1, "title": "Another Thing", "start_date": "2026-06-01"}]

    assert _near_duplicates(festivals, tentpoles) == []
