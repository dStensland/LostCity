from scripts.content_health_audit import summarize_crawl_freshness


def test_summarize_crawl_freshness_uses_latest_status_per_source():
    logs = [
        {"source_id": 1, "status": "error", "started_at": "2026-03-17T00:10:00"},
        {"source_id": 1, "status": "success", "started_at": "2026-03-17T00:20:00"},
        {"source_id": 2, "status": "error", "started_at": "2026-03-17T00:15:00"},
        {"source_id": 3, "status": "success", "started_at": "2026-03-17T00:25:00"},
    ]

    summary = summarize_crawl_freshness(
        logs,
        {
            1: "source-one",
            2: "source-two",
            3: "source-three",
        },
    )

    assert summary["attempt_status_counts"] == {"error": 2, "success": 2}
    assert summary["attempt_error_rate_pct"] == 50.0
    assert summary["final_status_counts"] == {"success": 2, "error": 1}
    assert summary["error_rate_pct"] == 33.3
    assert summary["unresolved_sources_last_24h"] == 1
    assert summary["recovered_sources_last_24h"] == 1
    assert summary["top_error_sources_last_24h"] == [
        {"source_id": 2, "source": "source-two", "errors": 1}
    ]
    assert summary["recovered_error_sources_last_24h"] == [
        {"source_id": 1, "source": "source-one", "errors": 1}
    ]
