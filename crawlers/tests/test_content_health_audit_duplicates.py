from scripts.content_health_audit import _group_duplicate_metrics


def test_learning_sections_with_different_times_are_not_cross_source_duplicates() -> None:
    rows = [
        {
            "title": "Wheel - All Levels",
            "start_date": "2026-03-30",
            "start_time": "10:00:00",
            "place_id": 329,
            "source_id": 808,
            "category_id": "learning",
        },
        {
            "title": "Wheel - All Levels",
            "start_date": "2026-03-30",
            "start_time": "19:00:00",
            "place_id": 329,
            "source_id": 325,
            "category_id": "learning",
        },
    ]

    metrics = _group_duplicate_metrics(rows)

    assert metrics["cross_source_groups"] == 0
    assert metrics["cross_source_duplicate_rows"] == 0


def test_music_events_same_date_time_and_venue_still_count_as_cross_source_duplicates() -> None:
    rows = [
        {
            "title": "THE EARLY NOVEMBER & HELLOGOODBYE: 20 Years Young",
            "start_date": "2026-03-19",
            "start_time": "19:30:00",
            "place_id": 114,
            "source_id": 95,
            "category_id": "music",
        },
        {
            "title": "THE EARLY NOVEMBER & HELLOGOODBYE: 20 Years Young",
            "start_date": "2026-03-19",
            "start_time": "19:30:00",
            "place_id": 114,
            "source_id": 11,
            "category_id": "music",
        },
    ]

    metrics = _group_duplicate_metrics(rows)

    assert metrics["cross_source_groups"] == 1
    assert metrics["cross_source_duplicate_rows"] == 1
