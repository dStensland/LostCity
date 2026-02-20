"""Tests for planning_capabilities module."""

from datetime import datetime

from planning_capabilities import (
    attach_capability_metadata,
    derive_capability_snapshot,
    derive_source_reliability,
    extract_age_range,
    normalize_registration_status,
)


def test_normalize_registration_status_detects_waitlist():
    status = normalize_registration_status(
        ticket_status=None,
        title="Summer Robotics Camp",
        description="Registration is open. Join the waitlist for session 2.",
        tags=["stem"],
        has_ticket_url=True,
    )
    assert status == "waitlist"


def test_extract_age_range_from_text():
    result = extract_age_range(
        age_policy=None,
        title="Adventure Camp",
        description="Ages 6-12. Campers rotate through weekly themes.",
        tags=[],
    )
    assert result["age_min"] == 6
    assert result["age_max"] == 12
    assert result["age_band"] == "preteen_10_12"


def test_source_reliability_marks_aggregators_low():
    source_info = {
        "slug": "eventbrite-atlanta-camps",
        "url": "https://www.eventbrite.com/d/united-states--atlanta/kids-camps/",
        "source_type": "website",
    }
    assert derive_source_reliability(source_info) == "low"


def test_snapshot_includes_quality_and_planning_fields():
    event_data = {
        "title": "Junior Makers Camp",
        "description": "Ages 8-14. Registration is open now for summer sessions.",
        "start_date": "2026-06-15",
        "start_time": "09:00",
        "is_all_day": False,
        "category": "learning",
        "tags": ["family-friendly"],
        "is_free": False,
        "price_min": 150.0,
        "price_max": 250.0,
        "source_url": "https://example.org/camps/junior-makers",
        "ticket_url": "https://example.org/register",
        "venue_id": 101,
        "source_id": 5,
    }
    source_info = {
        "slug": "example-learning-center",
        "url": "https://example.org",
        "source_type": "organization",
    }

    snapshot = derive_capability_snapshot(
        event_data,
        source_info=source_info,
        now=datetime(2026, 2, 20, 12, 0, 0),
    )

    assert snapshot["registration_status"] == "open"
    assert snapshot["price_band"] == "premium"
    assert snapshot["schedule_bucket"] == "morning"
    assert snapshot["source_reliability"] == "high"
    assert snapshot["quality_score"] > 0
    assert snapshot["completeness_score"] > 0


def test_attach_capability_metadata_merges_existing_dicts():
    event_data = {
        "field_provenance": {"existing": {"value": "keep"}},
        "field_confidence": {"title": 0.8},
    }
    snapshot = {"version": "capability-v1", "quality_score": 88}

    attach_capability_metadata(
        event_data,
        snapshot,
        source_info={"slug": "sample-source", "url": "https://sample.test"},
        derived_at=datetime(2026, 2, 20, 0, 0, 0),
    )

    assert "existing" in event_data["field_provenance"]
    assert event_data["field_provenance"]["capabilities"]["source_slug"] == "sample-source"
    assert event_data["field_confidence"]["capabilities"]["quality_score"] == 88
