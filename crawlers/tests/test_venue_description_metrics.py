from venue_description_metrics import (
    _description_issue,
    build_venue_description_gate,
    compute_venue_description_snapshot,
)


def test_description_issue_prioritizes_missing_and_short() -> None:
    assert _description_issue(None)[0] == "missing_description"
    assert _description_issue("Short but real.")[0] == "short_description"


def test_compute_venue_description_snapshot_filters_to_website_backed_tier_one(monkeypatch) -> None:
    def fake_fetch_rows(*_args, **_kwargs):
        return [
            {
                "id": 1,
                "name": "Good Place",
                "slug": "good-place",
                "city": "Atlanta",
                "place_type": "bar",
                "website": "https://example.com",
                "description": "A neighborhood bar with a real, source-grounded description that easily clears the quality threshold.",
                "is_active": True,
            },
            {
                "id": 2,
                "name": "Missing Place",
                "slug": "missing-place",
                "city": "Atlanta",
                "place_type": "bar",
                "website": "https://example.com",
                "description": "",
                "is_active": True,
            },
            {
                "id": 3,
                "name": "No Website",
                "slug": "no-website",
                "city": "Atlanta",
                "place_type": "bar",
                "website": None,
                "description": "",
                "is_active": True,
            },
            {
                "id": 4,
                "name": "Tier Zero Org",
                "slug": "tier-zero",
                "city": "Atlanta",
                "place_type": "organization",
                "website": "https://example.org",
                "description": "",
                "is_active": True,
            },
        ]

    monkeypatch.setattr("venue_description_metrics._fetch_rows", fake_fetch_rows)

    snapshot = compute_venue_description_snapshot()

    assert snapshot["counts"]["eligible_places"] == 2
    assert snapshot["counts"]["pilot_candidate_count"] == 1
    assert snapshot["counts"]["monitor_only_count"] == 0
    assert snapshot["metrics"]["healthy_description_pct"] == 50.0
    assert snapshot["issues"]["candidates"][0]["name"] == "Missing Place"
    assert snapshot["issues"]["pilot_candidates"][0]["queue_type"] == "pilot_candidate"


def test_compute_venue_description_snapshot_splits_monitor_only_low_signal_rows(monkeypatch) -> None:
    def fake_fetch_rows(*_args, **_kwargs):
        return [
            {
                "id": 1,
                "name": "Look Cinemas",
                "slug": "look-cinemas",
                "city": "Atlanta",
                "place_type": "cinema",
                "website": "https://www.lookcinemas.com/brookhaven/home/",
                "description": "Brookhaven luxury theater with food and drinks on every visit.",
                "is_active": True,
            },
            {
                "id": 2,
                "name": "Urban Grind",
                "slug": "urban-grind",
                "city": "Atlanta",
                "place_type": "restaurant",
                "website": "https://urbangrindatlanta.com",
                "description": "Coffee shop.",
                "is_active": True,
            },
        ]

    monkeypatch.setattr("venue_description_metrics._fetch_rows", fake_fetch_rows)

    snapshot = compute_venue_description_snapshot()

    assert snapshot["counts"]["pilot_candidate_count"] == 1
    assert snapshot["counts"]["monitor_only_count"] == 1
    assert snapshot["issues"]["pilot_candidates"][0]["slug"] == "urban-grind"
    assert snapshot["issues"]["monitor_only"][0]["slug"] == "look-cinemas"
    assert snapshot["issues"]["monitor_only"][0]["queue_type"] == "monitor_only"


def test_compute_venue_description_snapshot_marks_aggregator_domain_monitor_only(monkeypatch) -> None:
    def fake_fetch_rows(*_args, **_kwargs):
        return [
            {
                "id": 1,
                "name": "Selig Family Black Box Theatre",
                "slug": "selig-family-black-box-theatre",
                "city": "Atlanta",
                "place_type": "theater",
                "website": "https://www.artsatl.org/venue/selig-family-black-box-theatre/",
                "description": "Flexible performance venue for intimate productions and events.",
                "is_active": True,
            }
        ]

    monkeypatch.setattr("venue_description_metrics._fetch_rows", fake_fetch_rows)

    snapshot = compute_venue_description_snapshot()

    assert snapshot["counts"]["pilot_candidate_count"] == 0
    assert snapshot["counts"]["monitor_only_count"] == 1
    assert snapshot["issues"]["monitor_only"][0]["slug"] == "selig-family-black-box-theatre"


def test_compute_venue_description_snapshot_marks_repeated_low_signal_domains_monitor_only(monkeypatch) -> None:
    def fake_fetch_rows(*_args, **_kwargs):
        return [
            {
                "id": 1,
                "name": "Truist Park",
                "slug": "truist-park",
                "city": "Atlanta",
                "place_type": "stadium",
                "website": "https://www.mlb.com/braves/ballpark",
                "description": "Classic ballpark feel with modern amenities and southern hospitality.",
                "is_active": True,
            },
            {
                "id": 2,
                "name": "The Flatiron",
                "slug": "the-flatiron",
                "city": "Atlanta",
                "place_type": "bar",
                "website": "https://flatironatl.com/",
                "description": "Flatiron Atlanta Flatiron Atlanta Flatiron Atlanta",
                "is_active": True,
            },
            {
                "id": 3,
                "name": "Atlanta Expo Center",
                "slug": "atlanta-expo-center",
                "city": "Atlanta",
                "place_type": "amphitheater",
                "website": "http://www.atlantaexpocenter.com/",
                "description": "The most desirable show destination in Georgia.",
                "is_active": True,
            },
        ]

    monkeypatch.setattr("venue_description_metrics._fetch_rows", fake_fetch_rows)

    snapshot = compute_venue_description_snapshot()

    assert snapshot["counts"]["pilot_candidate_count"] == 0
    assert snapshot["counts"]["monitor_only_count"] == 3
    assert {row["slug"] for row in snapshot["issues"]["monitor_only"]} == {"truist-park", "the-flatiron", "atlanta-expo-center"}


def test_compute_venue_description_snapshot_marks_repeated_low_signal_slugs_monitor_only(monkeypatch) -> None:
    def fake_fetch_rows(*_args, **_kwargs):
        return [
            {
                "id": 1,
                "name": "Martin Luther King Jr. National Historical Park",
                "slug": "mlk-national-historical-park",
                "city": "Atlanta",
                "place_type": "museum",
                "website": "https://www.nps.gov/malu/index.htm",
                "description": "",
                "is_active": True,
            },
            {
                "id": 2,
                "name": "Wolf Creek Amphitheater",
                "slug": "wolf-creek-amphitheater",
                "city": "Atlanta",
                "place_type": "amphitheater",
                "website": "http://wolfcreekamphitheater.com/",
                "description": "",
                "is_active": True,
            },
        ]

    monkeypatch.setattr("venue_description_metrics._fetch_rows", fake_fetch_rows)

    snapshot = compute_venue_description_snapshot()

    assert snapshot["counts"]["pilot_candidate_count"] == 0
    assert snapshot["counts"]["monitor_only_count"] == 2
    assert {row["slug"] for row in snapshot["issues"]["monitor_only"]} == {
        "mlk-national-historical-park",
        "wolf-creek-amphitheater",
    }


def test_compute_venue_description_snapshot_uses_cycle_history_to_demote_repeat_failures(monkeypatch) -> None:
    def fake_fetch_rows(*_args, **_kwargs):
        return [
            {
                "id": 1,
                "name": "Paris on Ponce",
                "slug": "paris-on-ponce",
                "city": "Atlanta",
                "place_type": "gallery",
                "website": "http://www.parisonponce.com/",
                "description": "Short gallery description.",
                "is_active": True,
            }
        ]

    monkeypatch.setattr("venue_description_metrics._fetch_rows", fake_fetch_rows)
    monkeypatch.setattr(
        "venue_description_metrics._load_cycle_history",
        lambda: {
            "generated_at": "2026-04-04T05:00:00Z",
            "slugs": {
                "paris-on-ponce": {
                    "prep_fail_count": 0,
                    "prep_skip_count": 0,
                    "grounding_fail_count": 2,
                    "history": [],
                }
            },
        },
    )

    snapshot = compute_venue_description_snapshot()

    assert snapshot["counts"]["pilot_candidate_count"] == 0
    assert snapshot["counts"]["monitor_only_count"] == 1
    assert snapshot["issues"]["monitor_only"][0]["slug"] == "paris-on-ponce"
    assert snapshot["issues"]["monitor_only"][0]["queue_reason"] == "Repeated prep/grounding failures with no stable source-grounded path"


def test_build_venue_description_gate_is_pilot_ready() -> None:
    gate = build_venue_description_gate(
        {
            "generated_at": "2026-04-03T23:59:00Z",
            "counts": {"pilot_candidate_count": 3, "monitor_only_count": 2},
            "metrics": {"healthy_description_pct": 80.0},
            "issues": {
                "candidates": [{"name": "A"}, {"name": "B"}],
                "pilot_candidates": [{"name": "A"}, {"name": "B"}],
                "monitor_only": [{"name": "C"}],
            },
        }
    )

    assert gate["decision"] == "PILOT_READY"
    assert gate["ready_for_pilot"] is True


def test_build_venue_description_gate_can_drop_to_monitor_only() -> None:
    gate = build_venue_description_gate(
        {
            "generated_at": "2026-04-03T23:59:00Z",
            "counts": {"pilot_candidate_count": 0, "monitor_only_count": 4},
            "metrics": {"healthy_description_pct": 90.0},
            "issues": {
                "candidates": [],
                "pilot_candidates": [],
                "monitor_only": [{"name": "Look Cinemas"}],
            },
        }
    )

    assert gate["decision"] == "MONITOR_ONLY"
    assert gate["ready_for_pilot"] is False
