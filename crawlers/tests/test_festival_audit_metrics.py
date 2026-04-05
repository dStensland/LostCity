from datetime import date

from festival_audit_metrics import compute_festival_audit_snapshot


def test_compute_festival_audit_snapshot_ignores_inactive_events(monkeypatch) -> None:
    def fake_fetch_rows(table, _fields, *, query_builder=None, order_column="id", page_size=1000):
        if table == "festivals":
            return [
                {
                    "id": "test-fest",
                    "slug": "test-fest",
                    "name": "Test Fest",
                    "announced_start": "2026-06-01",
                    "announced_end": "2026-06-02",
                    "pending_start": None,
                    "pending_end": None,
                    "last_year_start": None,
                    "last_year_end": None,
                    "description": "x" * 120,
                    "date_source": None,
                    "date_confidence": None,
                    "image_url": None,
                    "website": None,
                    "festival_type": "festival",
                    "primary_type": "music_festival",
                    "typical_duration_days": 2,
                }
            ]
        if table == "series":
            return [
                {
                    "id": "series-1",
                    "title": "Test Fest 2026",
                    "slug": "test-fest-2026",
                    "series_type": "festival_program",
                    "festival_id": "test-fest",
                    "description": "x" * 120,
                    "is_active": True,
                }
            ]
        if table == "events":
            return [
                {
                    "id": 1,
                    "title": "Active Event",
                    "series_id": "series-1",
                    "festival_id": None,
                    "start_date": "2026-06-01",
                    "end_date": None,
                    "description": "y" * 140,
                    "source_id": 10,
                    "place_id": 20,
                    "is_live": True,
                    "is_class": False,
                    "is_tentpole": False,
                    "is_active": True,
                },
                {
                    "id": 2,
                    "title": "Inactive Event",
                    "series_id": "series-1",
                    "festival_id": None,
                    "start_date": "2026-06-01",
                    "end_date": None,
                    "description": "too short",
                    "source_id": 10,
                    "place_id": 20,
                    "is_live": True,
                    "is_class": False,
                    "is_tentpole": False,
                    "is_active": False,
                },
            ]
        if table == "sources":
            return [{"id": 10, "slug": "test-source", "name": "Test Source"}]
        raise AssertionError(f"Unexpected table: {table}")

    monkeypatch.setattr("festival_audit_metrics._fetch_rows", fake_fetch_rows)

    snapshot = compute_festival_audit_snapshot(today=None)

    assert snapshot["counts"]["festival_linked_events_in_scope"] == 1
    assert snapshot["description_quality"]["festival_events_short_description_lt120"] == 0
    assert snapshot["description_quality"]["top_short_description_sources"] == []


def test_compute_festival_audit_snapshot_aggregates_structural_counts(monkeypatch) -> None:
    def fake_fetch_rows(table, _fields, *, query_builder=None, order_column="id", page_size=1000):
        if table == "festivals":
            return [
                {
                    "id": "fest-1",
                    "slug": "fest-1",
                    "name": "Fest 1",
                    "announced_start": "2026-06-01",
                    "announced_end": "2026-06-02",
                    "pending_start": None,
                    "pending_end": None,
                    "last_year_start": None,
                    "last_year_end": None,
                    "description": "x" * 120,
                    "date_source": None,
                    "date_confidence": None,
                    "image_url": None,
                    "website": None,
                    "festival_type": "festival",
                    "primary_type": "music_festival",
                    "typical_duration_days": 2,
                }
            ]
        if table == "series":
            return [
                {
                    "id": "ghost-series",
                    "title": "Ghost Program",
                    "slug": "ghost-program",
                    "series_type": "festival_program",
                    "festival_id": "fest-1",
                    "description": None,
                    "is_active": True,
                },
                {
                    "id": "single-series",
                    "title": "Single Program",
                    "slug": "single-program",
                    "series_type": "festival_program",
                    "festival_id": "fest-1",
                    "description": "short",
                    "is_active": True,
                },
            ]
        if table == "events":
            return [
                {
                    "id": 1,
                    "title": "Single Event",
                    "series_id": "single-series",
                    "festival_id": None,
                    "start_date": "2026-06-01",
                    "end_date": None,
                    "description": "y" * 140,
                    "source_id": 10,
                    "place_id": 20,
                    "is_live": True,
                    "is_class": False,
                    "is_tentpole": False,
                    "is_active": True,
                }
            ]
        if table == "sources":
            return [{"id": 10, "slug": "test-source", "name": "Test Source"}]
        raise AssertionError(f"Unexpected table: {table}")

    monkeypatch.setattr("festival_audit_metrics._fetch_rows", fake_fetch_rows)

    snapshot = compute_festival_audit_snapshot(today=None)

    assert snapshot["schedule_quality"]["top_ghost_program_festivals"] == [
        {
            "festival_id": "fest-1",
            "slug": "fest-1",
            "ghost_program_series": 1,
        }
    ]
    assert snapshot["schedule_quality"]["top_orphan_program_festivals"] == [
        {
            "festival_id": "fest-1",
            "slug": "fest-1",
            "orphan_program_series": 2,
            "ghost_program_series": 1,
            "single_program_series": 1,
        }
    ]
    assert snapshot["description_quality"]["top_series_description_gap_festivals"] == [
        {
            "festival_id": "fest-1",
            "slug": "fest-1",
            "series_description_gaps": 2,
            "series_missing_description": 1,
            "series_short_description": 1,
        }
    ]


def test_compute_festival_audit_snapshot_excludes_past_cycle_pending_only_from_missing_announced(
    monkeypatch,
) -> None:
    def fake_fetch_rows(table, _fields, *, query_builder=None, order_column="id", page_size=1000):
        if table == "festivals":
            return [
                {
                    "id": "past-fest",
                    "slug": "past-fest",
                    "name": "Past Fest",
                    "announced_start": None,
                    "announced_end": None,
                    "pending_start": "2026-02-20",
                    "pending_end": "2026-02-22",
                    "last_year_start": None,
                    "last_year_end": None,
                    "description": "x" * 120,
                    "date_source": "auto-demoted-stale",
                    "date_confidence": 20,
                    "image_url": None,
                    "website": "https://example.com",
                    "festival_type": "festival",
                    "primary_type": "expo",
                    "typical_duration_days": 3,
                }
            ]
        if table == "series":
            return []
        if table == "events":
            return []
        if table == "sources":
            return []
        raise AssertionError(f"Unexpected table: {table}")

    monkeypatch.setattr("festival_audit_metrics._fetch_rows", fake_fetch_rows)

    snapshot = compute_festival_audit_snapshot(today=date(2026, 4, 3))

    assert snapshot["date_quality"]["festival_missing_announced_start"] == 0
    assert snapshot["date_quality"]["festival_past_cycle_pending_only"] == 1
    assert snapshot["samples"]["festival_missing_announced_start"] == []
    assert snapshot["samples"]["festival_past_cycle_pending_only"] == [
        {
            "slug": "past-fest",
            "name": "Past Fest",
            "pending_start": "2026-02-20",
            "pending_end": "2026-02-22",
            "date_source": "auto-demoted-stale",
        }
    ]


def test_compute_festival_audit_snapshot_ignores_inactive_series_without_active_events(
    monkeypatch,
) -> None:
    def fake_fetch_rows(table, _fields, *, query_builder=None, order_column="id", page_size=1000):
        if table == "festivals":
            return [
                {
                    "id": "fest-1",
                    "slug": "fest-1",
                    "name": "Fest 1",
                    "announced_start": "2026-06-01",
                    "announced_end": "2026-06-02",
                    "pending_start": None,
                    "pending_end": None,
                    "last_year_start": None,
                    "last_year_end": None,
                    "description": "x" * 120,
                    "date_source": None,
                    "date_confidence": None,
                    "image_url": None,
                    "website": None,
                    "festival_type": "festival",
                    "primary_type": "music_festival",
                    "typical_duration_days": 2,
                }
            ]
        if table == "series":
            return [
                {
                    "id": "inactive-series",
                    "title": "Inactive Wrapper",
                    "slug": "inactive-wrapper",
                    "series_type": "recurring_show",
                    "festival_id": "fest-1",
                    "description": None,
                    "is_active": False,
                }
            ]
        if table == "events":
            return [
                {
                    "id": 1,
                    "title": "Inactive Event",
                    "series_id": "inactive-series",
                    "festival_id": None,
                    "start_date": "2026-06-01",
                    "end_date": None,
                    "description": "y" * 140,
                    "source_id": 10,
                    "place_id": 20,
                    "is_live": True,
                    "is_class": False,
                    "is_tentpole": False,
                    "is_active": False,
                }
            ]
        if table == "sources":
            return [{"id": 10, "slug": "test-source", "name": "Test Source"}]
        raise AssertionError(f"Unexpected table: {table}")

    monkeypatch.setattr("festival_audit_metrics._fetch_rows", fake_fetch_rows)

    snapshot = compute_festival_audit_snapshot(today=None)

    assert snapshot["counts"]["festival_linked_series"] == 0
    assert snapshot["counts"]["festival_linked_series_in_scope"] == 0
    assert snapshot["description_quality"]["series_missing_description"] == 0
    assert snapshot["description_quality"]["top_series_description_gap_festivals"] == []


def test_compute_festival_audit_snapshot_treats_zero_event_festivals_as_insufficient_data(
    monkeypatch,
) -> None:
    def fake_fetch_rows(table, _fields, *, query_builder=None, order_column="id", page_size=1000):
        if table == "festivals":
            return [
                {
                    "id": "conf-1",
                    "slug": "conf-1",
                    "name": "Conference 1",
                    "announced_start": "2026-06-01",
                    "announced_end": "2026-06-03",
                    "pending_start": None,
                    "pending_end": None,
                    "last_year_start": None,
                    "last_year_end": None,
                    "description": "x" * 120,
                    "date_source": None,
                    "date_confidence": None,
                    "image_url": None,
                    "website": None,
                    "festival_type": "conference",
                    "primary_type": "conference",
                    "typical_duration_days": 3,
                }
            ]
        if table == "series":
            return []
        if table == "events":
            return []
        if table == "sources":
            return []
        raise AssertionError(f"Unexpected table: {table}")

    monkeypatch.setattr("festival_audit_metrics._fetch_rows", fake_fetch_rows)

    snapshot = compute_festival_audit_snapshot(today=None)

    assert snapshot["model_fit"]["tentpole_fit_candidate_count"] == 0
    assert snapshot["model_fit"]["insufficient_data_count"] == 1
    assert snapshot["samples"]["tentpole_fit_candidates"] == []
