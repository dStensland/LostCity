"""
Local single-run lock for crawler write jobs.

Prevents overlapping production write runs from stepping on each other.
The lock is advisory and process-scoped: if a process exits, the OS releases it.
"""

from __future__ import annotations

import fcntl
import json
import os
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Iterator, Optional


LOCK_PATH = os.path.join(os.path.dirname(__file__), ".crawler_run.lock")


@dataclass
class CrawlRunLockInfo:
    pid: int
    started_at: str
    command: str
    db_target: str
    cwd: str


class CrawlRunLockError(RuntimeError):
    """Raised when a production write crawl is already active."""


def _read_lock_info(lock_file) -> Optional[CrawlRunLockInfo]:
    lock_file.seek(0)
    raw = lock_file.read().strip()
    if not raw:
        return None
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        return None
    try:
        return CrawlRunLockInfo(
            pid=int(payload.get("pid") or 0),
            started_at=str(payload.get("started_at") or ""),
            command=str(payload.get("command") or ""),
            db_target=str(payload.get("db_target") or ""),
            cwd=str(payload.get("cwd") or ""),
        )
    except (TypeError, ValueError):
        return None


def _write_lock_info(lock_file, *, db_target: str) -> CrawlRunLockInfo:
    info = CrawlRunLockInfo(
        pid=os.getpid(),
        started_at=datetime.now(timezone.utc).isoformat(),
        command=" ".join(os.path.basename(part) if idx == 0 else part for idx, part in enumerate(os.sys.argv)),
        db_target=db_target,
        cwd=os.getcwd(),
    )
    lock_file.seek(0)
    lock_file.truncate()
    json.dump(info.__dict__, lock_file)
    lock_file.flush()
    os.fsync(lock_file.fileno())
    return info


@contextmanager
def hold_crawl_run_lock(*, enabled: bool, db_target: str) -> Iterator[Optional[CrawlRunLockInfo]]:
    """
    Hold the crawler run lock for the duration of a write-enabled run.

    Only enabled for production write runs. Raises CrawlRunLockError when another
    process already holds the lock.
    """
    if not enabled:
        yield None
        return

    os.makedirs(os.path.dirname(LOCK_PATH), exist_ok=True)
    with open(LOCK_PATH, "a+", encoding="utf-8") as lock_file:
        try:
            fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as exc:
            existing = _read_lock_info(lock_file)
            if existing:
                raise CrawlRunLockError(
                    "Another production write crawl is already active "
                    f"(pid={existing.pid}, started_at={existing.started_at}, "
                    f"db_target={existing.db_target}, cwd={existing.cwd}, command={existing.command}). "
                    "If this is intentional, rerun with --skip-run-lock."
                ) from exc
            raise CrawlRunLockError(
                "Another production write crawl is already active. "
                "If this is intentional, rerun with --skip-run-lock."
            ) from exc

        info = _write_lock_info(lock_file, db_target=db_target)
        try:
            yield info
        finally:
            lock_file.seek(0)
            lock_file.truncate()
            lock_file.flush()
            try:
                os.fsync(lock_file.fileno())
            except OSError:
                pass
            fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)
