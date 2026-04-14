from db import screenings as screenings_module


def test_build_screening_bundle_groups_times_under_one_title_and_run():
    bundle = screenings_module.build_screening_bundle_from_event_rows(
        source_id=88,
        source_slug="plaza-theatre",
        events=[
            {
                "id": 100,
                "title": "Sinners (2026)",
                "description": "A thriller.",
                "start_date": "2026-04-10",
                "start_time": "19:00:00",
                "end_time": "21:15:00",
                "image_url": "https://example.com/sinners.jpg",
                "source_url": "https://example.com/showtime-1",
                "ticket_url": "https://example.com/tickets-1",
                "tags": ["showtime", "imax"],
                "category_id": "film",
                "place_id": 44,
                "festival_id": None,
            },
            {
                "id": 101,
                "title": "Sinners - IMAX",
                "description": "A thriller.",
                "start_date": "2026-04-11",
                "start_time": "21:30:00",
                "end_time": "23:45:00",
                "image_url": "https://example.com/sinners.jpg",
                "source_url": "https://example.com/showtime-2",
                "ticket_url": "https://example.com/tickets-2",
                "tags": ["showtime"],
                "category_id": "film",
                "place_id": 44,
                "festival_id": None,
            },
        ],
    )

    assert len(bundle["titles"]) == 1
    assert len(bundle["runs"]) == 1
    assert len(bundle["times"]) == 2
    assert bundle["titles"][0]["canonical_title"] == "Sinners"
    assert bundle["runs"][0]["start_date"] == "2026-04-10"
    assert bundle["runs"][0]["end_date"] == "2026-04-11"
    assert bundle["times"][0]["format_labels"] == ["IMAX"]


def test_build_screening_bundle_keeps_special_screenings_distinct():
    bundle = screenings_module.build_screening_bundle_from_event_rows(
        source_id=91,
        source_slug="atlanta-film-festival",
        events=[
            {
                "id": 500,
                "title": "Opening Night Shorts Block",
                "description": "Festival kickoff.",
                "start_date": "2026-04-23",
                "start_time": None,
                "end_time": None,
                "image_url": None,
                "source_url": "https://example.com/opening-night",
                "ticket_url": None,
                "tags": ["festival"],
                "category_id": "film",
                "place_id": 77,
                "festival_id": "atlanta-film-festival",
            }
        ],
    )

    assert bundle["titles"][0]["canonical_title"] == "Opening Night Shorts Block"
    assert bundle["runs"][0]["is_special_event"] is True
    assert bundle["times"] == []


def test_persist_screening_bundle_orders_title_run_time_and_cleans_up(monkeypatch):
    calls = []

    monkeypatch.setattr(screenings_module, "screenings_support_tables", lambda: True)
    monkeypatch.setattr(
        screenings_module,
        "upsert_screening_title",
        lambda row: calls.append(("title", row["source_key"])) or f"title-id:{row['source_key']}",
    )
    monkeypatch.setattr(
        screenings_module,
        "upsert_screening_run",
        lambda row: calls.append(("run", row["source_key"], row["screening_title_id"])) or f"run-id:{row['source_key']}",
    )
    monkeypatch.setattr(
        screenings_module,
        "upsert_screening_time",
        lambda row: calls.append(("time", row["source_key"], row["screening_run_id"])) or f"time-id:{row['source_key']}",
    )
    monkeypatch.setattr(
        screenings_module,
        "remove_stale_source_screenings",
        lambda **kwargs: calls.append(("cleanup", kwargs["source_id"])) or {"times_deleted": 1, "runs_deleted": 0, "titles_deleted": 0},
    )

    summary = screenings_module.persist_screening_bundle(
        {
            "source_id": 88,
            "source_slug": "plaza-theatre",
            "titles": [{"source_key": "plaza|title|sinners", "canonical_title": "Sinners", "slug": "sinners", "kind": "film"}],
            "runs": [{"source_key": "plaza|run|sinners|place:44", "title_source_key": "plaza|title|sinners", "place_id": 44, "festival_id": None, "source_id": 88, "label": "Sinners", "start_date": "2026-04-10", "end_date": "2026-04-10", "buy_url": None, "info_url": None, "is_special_event": False, "metadata": {}}],
            "times": [{"source_key": "plaza|time|sinners|2026-04-10|19:00|100", "run_source_key": "plaza|run|sinners|place:44", "event_id": 100, "start_date": "2026-04-10", "start_time": "19:00:00", "end_time": None, "ticket_url": None, "source_url": None, "format_labels": [], "status": "scheduled"}],
        }
    )

    assert summary["persisted"] == 3
    assert calls == [
        ("title", "plaza|title|sinners"),
        ("run", "plaza|run|sinners|place:44", "title-id:plaza|title|sinners"),
        ("time", "plaza|time|sinners|2026-04-10|19:00|100", "run-id:plaza|run|sinners|place:44"),
        ("cleanup", 88),
    ]


def test_sync_source_screenings_from_events_uses_event_rows(monkeypatch):
    monkeypatch.setattr(screenings_module, "screenings_support_tables", lambda: True)
    monkeypatch.setattr(
        screenings_module,
        "_select_event_rows_for_screenings",
        lambda source_id: [
            {
                "id": 100,
                "title": "Sinners",
                "description": "A thriller.",
                "start_date": "2026-04-10",
                "start_time": "19:00:00",
                "end_time": "21:10:00",
                "image_url": "https://example.com/sinners.jpg",
                "source_url": "https://example.com/showtime-1",
                "ticket_url": "https://example.com/tickets-1",
                "tags": ["showtime"],
                "category_id": "film",
                "place_id": 44,
                "festival_id": None,
            }
        ],
    )
    monkeypatch.setattr(
        screenings_module,
        "persist_screening_bundle",
        lambda bundle: {"titles": len(bundle["titles"]), "runs": len(bundle["runs"]), "times": len(bundle["times"])},
    )

    summary = screenings_module.sync_source_screenings_from_events(
        source_id=88,
        source_slug="plaza-theatre",
    )

    assert summary == {"titles": 1, "runs": 1, "times": 1}
