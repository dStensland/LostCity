from __future__ import annotations

from pathlib import Path


def test_hold_crawl_run_lock_blocks_second_writer(monkeypatch, tmp_path: Path):
    import crawl_lock as cl

    monkeypatch.setattr(cl, "LOCK_PATH", str(tmp_path / ".crawler_run.lock"))

    with cl.hold_crawl_run_lock(enabled=True, db_target="production") as info:
        assert info is not None
        assert info.db_target == "production"
        try:
            with cl.hold_crawl_run_lock(enabled=True, db_target="production"):
                raise AssertionError("Expected second lock acquisition to fail")
        except cl.CrawlRunLockError as exc:
            assert "already active" in str(exc)


def test_hold_crawl_run_lock_noops_when_disabled(monkeypatch, tmp_path: Path):
    import crawl_lock as cl

    monkeypatch.setattr(cl, "LOCK_PATH", str(tmp_path / ".crawler_run.lock"))

    with cl.hold_crawl_run_lock(enabled=False, db_target="production") as info:
        assert info is None
