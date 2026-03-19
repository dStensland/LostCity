from __future__ import annotations

from datetime import datetime, timedelta


def _seed_health_row(ch, *, slug: str, failures: int, error_type: str, last_failure_at: str) -> None:
    ch.init_health_db()
    with ch.get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO source_health (
                source_slug,
                consecutive_failures,
                total_crawls,
                successful_crawls,
                last_success_at,
                last_failure_at,
                last_error_type,
                health_score,
                updated_at
            )
            VALUES (?, ?, 10, 2, NULL, ?, ?, 60.0, ?)
            ON CONFLICT(source_slug) DO UPDATE SET
                consecutive_failures = excluded.consecutive_failures,
                last_failure_at = excluded.last_failure_at,
                last_error_type = excluded.last_error_type,
                updated_at = excluded.updated_at
            """,
            (slug, failures, last_failure_at, error_type, datetime.utcnow().isoformat()),
        )
        conn.commit()


def test_should_skip_transient_captcha_within_retry_window(monkeypatch, tmp_path):
    import crawler_health as ch

    monkeypatch.setattr(ch, "HEALTH_DB_PATH", str(tmp_path / "crawler_health.db"))
    recent_failure = (datetime.utcnow() - timedelta(minutes=10)).isoformat()
    _seed_health_row(
        ch,
        slug="silverspot-cinema-atlanta",
        failures=7,
        error_type="captcha",
        last_failure_at=recent_failure,
    )

    should_skip, reason = ch.should_skip_crawl("silverspot-cinema-atlanta")

    assert should_skip is True
    assert reason.startswith("transient_backoff=captcha")


def test_should_allow_transient_captcha_after_retry_window(monkeypatch, tmp_path):
    import crawler_health as ch

    monkeypatch.setattr(ch, "HEALTH_DB_PATH", str(tmp_path / "crawler_health.db"))
    older_failure = (datetime.utcnow() - timedelta(hours=2)).isoformat()
    _seed_health_row(
        ch,
        slug="silverspot-cinema-atlanta",
        failures=7,
        error_type="captcha",
        last_failure_at=older_failure,
    )

    should_skip, reason = ch.should_skip_crawl("silverspot-cinema-atlanta")

    assert should_skip is False
    assert reason == ""


def test_should_skip_non_transient_after_many_failures(monkeypatch, tmp_path):
    import crawler_health as ch

    monkeypatch.setattr(ch, "HEALTH_DB_PATH", str(tmp_path / "crawler_health.db"))
    recent_failure = (datetime.utcnow() - timedelta(minutes=5)).isoformat()
    _seed_health_row(
        ch,
        slug="some-parse-broken-source",
        failures=6,
        error_type="parse",
        last_failure_at=recent_failure,
    )

    should_skip, reason = ch.should_skip_crawl("some-parse-broken-source")

    assert should_skip is True
    assert reason == "consecutive_failures=6"


def test_cancel_stale_runs_marks_old_running_rows_cancelled(monkeypatch, tmp_path):
    import crawler_health as ch

    monkeypatch.setattr(ch, "HEALTH_DB_PATH", str(tmp_path / "crawler_health.db"))
    ch.init_health_db()

    with ch.get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO crawl_runs (source_slug, started_at, status)
            VALUES (?, ?, 'running')
            """,
            ("stale-source", (datetime.utcnow() - timedelta(hours=3)).isoformat()),
        )
        cursor.execute(
            """
            INSERT INTO crawl_runs (source_slug, started_at, status)
            VALUES (?, ?, 'running')
            """,
            ("fresh-source", datetime.utcnow().isoformat()),
        )
        conn.commit()

    cancelled = ch.cancel_stale_runs(max_age_minutes=120)

    assert cancelled == 1
    with ch.get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT source_slug, status, error_type FROM crawl_runs ORDER BY source_slug"
        )
        rows = cursor.fetchall()

    assert rows[0]["source_slug"] == "fresh-source"
    assert rows[0]["status"] == "running"
    assert rows[1]["source_slug"] == "stale-source"
    assert rows[1]["status"] == "cancelled"
    assert rows[1]["error_type"] == "cancelled"
