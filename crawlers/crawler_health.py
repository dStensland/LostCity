"""
Crawler Health Tracking and Self-Healing System.

Tracks crawl results, classifies errors, calculates health scores,
and provides adaptive rate limiting recommendations.

Uses SQLite for local storage to ensure reliability tracking works
even when network/database is unstable.
"""

import sqlite3
import os
import logging
from datetime import datetime, timedelta
from dataclasses import dataclass
from typing import Optional
from contextlib import contextmanager

logger = logging.getLogger(__name__)

# SQLite database path (local file for reliability)
HEALTH_DB_PATH = os.path.join(os.path.dirname(__file__), "crawler_health.db")


@dataclass
class ErrorClassification:
    """Classification of an error type."""
    error_type: str
    is_transient: bool
    retry_after_seconds: int
    description: str


@dataclass
class SourceHealth:
    """Health summary for a source."""
    source_slug: str
    health_score: float
    consecutive_failures: int
    total_crawls: int
    successful_crawls: int
    success_rate: float
    last_success_at: Optional[str]
    last_failure_at: Optional[str]
    last_error_type: Optional[str]
    recommended_delay_seconds: float


# Error classification map
ERROR_CLASSIFICATIONS = {
    "network": ErrorClassification(
        error_type="network",
        is_transient=True,
        retry_after_seconds=60,
        description="Network connectivity issues (timeouts, DNS, connection refused)"
    ),
    "rate_limit": ErrorClassification(
        error_type="rate_limit",
        is_transient=True,
        retry_after_seconds=300,
        description="Rate limiting or throttling by target site"
    ),
    "auth": ErrorClassification(
        error_type="auth",
        is_transient=False,
        retry_after_seconds=86400,
        description="Authentication or authorization failures"
    ),
    "parse": ErrorClassification(
        error_type="parse",
        is_transient=False,
        retry_after_seconds=86400,
        description="HTML/JSON parsing failures (likely site structure changed)"
    ),
    "socket": ErrorClassification(
        error_type="socket",
        is_transient=True,
        retry_after_seconds=30,
        description="Socket exhaustion or resource limits (Errno 35 on macOS)"
    ),
    "timeout": ErrorClassification(
        error_type="timeout",
        is_transient=True,
        retry_after_seconds=120,
        description="Request or operation timeout"
    ),
    "captcha": ErrorClassification(
        error_type="captcha",
        is_transient=True,
        retry_after_seconds=3600,
        description="CAPTCHA or bot detection triggered"
    ),
    "unknown": ErrorClassification(
        error_type="unknown",
        is_transient=False,
        retry_after_seconds=3600,
        description="Unclassified error"
    ),
}


def classify_error(error_message: str) -> ErrorClassification:
    """Classify an error message into a known category."""
    error_lower = error_message.lower()

    # Socket exhaustion (macOS Errno 35, Linux Errno 11)
    if any(x in error_lower for x in [
        "resource temporarily unavailable",
        "errno 35",
        "errno 11",
        "socket",
        "too many open files"
    ]):
        return ERROR_CLASSIFICATIONS["socket"]

    # Rate limiting
    if any(x in error_lower for x in ["429", "rate limit", "too many requests", "throttl"]):
        return ERROR_CLASSIFICATIONS["rate_limit"]

    # CAPTCHA/Bot detection
    if any(x in error_lower for x in ["captcha", "bot", "cloudflare", "challenge"]):
        return ERROR_CLASSIFICATIONS["captcha"]

    # Network errors
    if any(x in error_lower for x in [
        "connection", "dns", "network", "unreachable", "refused",
        "reset by peer", "broken pipe"
    ]):
        return ERROR_CLASSIFICATIONS["network"]

    # Timeouts
    if any(x in error_lower for x in ["timeout", "timed out"]):
        return ERROR_CLASSIFICATIONS["timeout"]

    # Auth errors
    if any(x in error_lower for x in ["401", "403", "forbidden", "unauthorized", "auth"]):
        return ERROR_CLASSIFICATIONS["auth"]

    # Parse errors
    if any(x in error_lower for x in [
        "parse", "json", "html", "selector", "element not found",
        "no events found", "structure changed"
    ]):
        return ERROR_CLASSIFICATIONS["parse"]

    return ERROR_CLASSIFICATIONS["unknown"]


@contextmanager
def get_db():
    """Get a database connection with automatic cleanup."""
    conn = sqlite3.connect(HEALTH_DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def init_health_db():
    """Initialize the health tracking database schema."""
    with get_db() as conn:
        cursor = conn.cursor()

        # Crawl runs - one row per crawl attempt
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS crawl_runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source_slug TEXT NOT NULL,
                started_at TEXT NOT NULL,
                completed_at TEXT,
                duration_seconds REAL,
                status TEXT NOT NULL,
                events_found INTEGER DEFAULT 0,
                events_new INTEGER DEFAULT 0,
                events_updated INTEGER DEFAULT 0,
                error_message TEXT,
                error_type TEXT,
                is_transient BOOLEAN DEFAULT FALSE
            )
        """)

        # Source health - aggregated health per source
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS source_health (
                source_slug TEXT PRIMARY KEY,
                consecutive_failures INTEGER DEFAULT 0,
                total_crawls INTEGER DEFAULT 0,
                successful_crawls INTEGER DEFAULT 0,
                last_success_at TEXT,
                last_failure_at TEXT,
                last_error_type TEXT,
                health_score REAL DEFAULT 100.0,
                updated_at TEXT NOT NULL
            )
        """)

        # Indexes
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_runs_slug ON crawl_runs(source_slug)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_runs_started ON crawl_runs(started_at)")

        conn.commit()
        logger.debug("Health database initialized")


def record_crawl_start(source_slug: str) -> int:
    """Record the start of a crawl. Returns the run ID."""
    init_health_db()
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO crawl_runs (source_slug, started_at, status)
            VALUES (?, ?, 'running')
        """, (source_slug, datetime.utcnow().isoformat()))
        conn.commit()
        return cursor.lastrowid


def record_crawl_success(
    run_id: int,
    events_found: int,
    events_new: int,
    events_updated: int
):
    """Record a successful crawl completion."""
    with get_db() as conn:
        cursor = conn.cursor()
        now = datetime.utcnow().isoformat()

        # Get start time and source
        cursor.execute("SELECT started_at, source_slug FROM crawl_runs WHERE id = ?", (run_id,))
        row = cursor.fetchone()
        if not row:
            return

        started_at = datetime.fromisoformat(row["started_at"])
        source_slug = row["source_slug"]
        duration = (datetime.utcnow() - started_at).total_seconds()

        # Update crawl run
        cursor.execute("""
            UPDATE crawl_runs
            SET completed_at = ?, duration_seconds = ?, status = 'success',
                events_found = ?, events_new = ?, events_updated = ?
            WHERE id = ?
        """, (now, duration, events_found, events_new, events_updated, run_id))

        # Update source health - reset failures, boost score
        cursor.execute("""
            INSERT INTO source_health (source_slug, consecutive_failures, total_crawls,
                                       successful_crawls, last_success_at, health_score, updated_at)
            VALUES (?, 0, 1, 1, ?, 100.0, ?)
            ON CONFLICT(source_slug) DO UPDATE SET
                consecutive_failures = 0,
                total_crawls = total_crawls + 1,
                successful_crawls = successful_crawls + 1,
                last_success_at = excluded.last_success_at,
                health_score = MIN(100.0, health_score + 5.0),
                updated_at = excluded.updated_at
        """, (source_slug, now, now))

        conn.commit()
        logger.debug(f"Recorded success for {source_slug}: {events_found} events")


def record_crawl_failure(run_id: int, error_message: str):
    """Record a failed crawl."""
    error_class = classify_error(error_message)

    with get_db() as conn:
        cursor = conn.cursor()
        now = datetime.utcnow().isoformat()

        # Get source slug and calculate duration
        cursor.execute("SELECT started_at, source_slug FROM crawl_runs WHERE id = ?", (run_id,))
        row = cursor.fetchone()
        if not row:
            return

        started_at = datetime.fromisoformat(row["started_at"])
        source_slug = row["source_slug"]
        duration = (datetime.utcnow() - started_at).total_seconds()

        # Update crawl run
        cursor.execute("""
            UPDATE crawl_runs
            SET completed_at = ?, duration_seconds = ?, status = 'failed',
                error_message = ?, error_type = ?, is_transient = ?
            WHERE id = ?
        """, (now, duration, error_message[:500], error_class.error_type,
              error_class.is_transient, run_id))

        # Calculate health penalty - transient errors penalize less
        health_penalty = 5.0 if error_class.is_transient else 15.0

        # Update source health
        cursor.execute("""
            INSERT INTO source_health (source_slug, consecutive_failures, total_crawls,
                                       last_failure_at, last_error_type, health_score, updated_at)
            VALUES (?, 1, 1, ?, ?, ?, ?)
            ON CONFLICT(source_slug) DO UPDATE SET
                consecutive_failures = consecutive_failures + 1,
                total_crawls = total_crawls + 1,
                last_failure_at = excluded.last_failure_at,
                last_error_type = excluded.last_error_type,
                health_score = MAX(0.0, health_score - ?),
                updated_at = excluded.updated_at
        """, (source_slug, now, error_class.error_type, 100.0 - health_penalty,
              now, health_penalty))

        conn.commit()
        logger.debug(f"Recorded failure for {source_slug}: {error_class.error_type}")


def get_source_health(source_slug: str) -> Optional[SourceHealth]:
    """Get health information for a source."""
    init_health_db()

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM source_health WHERE source_slug = ?
        """, (source_slug,))
        row = cursor.fetchone()

        if not row:
            return None

        total = row["total_crawls"] or 1
        success = row["successful_crawls"] or 0
        failures = row["consecutive_failures"] or 0

        # Calculate recommended delay based on health and failure pattern
        base_delay = 1.0
        if failures >= 5:
            recommended_delay = base_delay * 10  # 10 second delay for frequently failing
        elif failures >= 3:
            recommended_delay = base_delay * 5
        elif failures >= 1:
            recommended_delay = base_delay * 2
        else:
            recommended_delay = base_delay

        return SourceHealth(
            source_slug=source_slug,
            health_score=row["health_score"],
            consecutive_failures=failures,
            total_crawls=total,
            successful_crawls=success,
            success_rate=success / total if total > 0 else 0.0,
            last_success_at=row["last_success_at"],
            last_failure_at=row["last_failure_at"],
            last_error_type=row["last_error_type"],
            recommended_delay_seconds=recommended_delay
        )


def get_all_source_health() -> list[SourceHealth]:
    """Get health information for all tracked sources."""
    init_health_db()

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT source_slug FROM source_health ORDER BY health_score ASC")
        slugs = [row["source_slug"] for row in cursor.fetchall()]

    return [h for slug in slugs if (h := get_source_health(slug)) is not None]


def get_unhealthy_sources(min_failures: int = 3) -> list[SourceHealth]:
    """Get sources with consecutive failures above threshold."""
    init_health_db()

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT source_slug FROM source_health
            WHERE consecutive_failures >= ?
            ORDER BY consecutive_failures DESC
        """, (min_failures,))
        slugs = [row["source_slug"] for row in cursor.fetchall()]

    return [h for slug in slugs if (h := get_source_health(slug)) is not None]


def get_recommended_workers() -> int:
    """
    Get recommended number of parallel workers based on recent failure rate.

    If many sources are failing due to socket exhaustion, reduce workers.
    If everything is healthy, allow more parallelism.
    """
    init_health_db()

    # Check recent socket/resource errors
    cutoff = (datetime.utcnow() - timedelta(hours=1)).isoformat()

    with get_db() as conn:
        cursor = conn.cursor()

        # Count recent socket errors
        cursor.execute("""
            SELECT COUNT(*) as socket_errors
            FROM crawl_runs
            WHERE started_at >= ? AND error_type = 'socket'
        """, (cutoff,))
        socket_errors = cursor.fetchone()["socket_errors"] or 0

        # Count recent total crawls
        cursor.execute("""
            SELECT COUNT(*) as total FROM crawl_runs WHERE started_at >= ?
        """, (cutoff,))
        total_recent = cursor.fetchone()["total"] or 0

    # If more than 10% socket errors in last hour, reduce workers
    if total_recent > 10:
        socket_rate = socket_errors / total_recent
        if socket_rate > 0.2:
            return 1  # Severe socket exhaustion - go sequential
        elif socket_rate > 0.1:
            return 2  # Moderate issues
        elif socket_rate > 0.05:
            return 3

    # Default: check system-wide health
    all_health = get_all_source_health()
    if not all_health:
        return 2  # No data yet, be conservative

    avg_health = sum(h.health_score for h in all_health) / len(all_health)
    if avg_health < 50:
        return 2
    elif avg_health < 70:
        return 3
    else:
        return 4  # Good health, allow more parallelism


def get_recommended_delay(source_slug: str) -> float:
    """Get recommended delay before crawling this source."""
    health = get_source_health(source_slug)
    if health:
        return health.recommended_delay_seconds
    return 1.0  # Default delay for unknown sources


def should_skip_crawl(source_slug: str) -> tuple[bool, str]:
    """
    Determine if a source should be skipped based on health.

    Returns (should_skip, reason).
    """
    health = get_source_health(source_slug)

    if not health:
        return False, ""  # No data, allow crawl

    # Skip if health score is critically low
    if health.health_score < 10:
        return True, f"health_score={health.health_score:.0f}"

    # Skip if too many consecutive failures (unless transient)
    if health.consecutive_failures >= 5:
        # Check if last error was transient
        if health.last_error_type in ["socket", "network", "timeout"]:
            # Allow retry with warning
            return False, ""
        else:
            return True, f"consecutive_failures={health.consecutive_failures}"

    return False, ""


def get_system_health_summary() -> dict:
    """Get overall system health summary."""
    init_health_db()

    with get_db() as conn:
        cursor = conn.cursor()

        # Today's stats
        today = datetime.utcnow().strftime("%Y-%m-%d")
        cursor.execute("""
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
                SUM(events_found) as events
            FROM crawl_runs
            WHERE started_at LIKE ?
        """, (f"{today}%",))
        today_stats = cursor.fetchone()

        # Error type breakdown for today
        cursor.execute("""
            SELECT error_type, COUNT(*) as count
            FROM crawl_runs
            WHERE started_at LIKE ? AND error_type IS NOT NULL
            GROUP BY error_type
            ORDER BY count DESC
        """, (f"{today}%",))
        error_breakdown = {row["error_type"]: row["count"] for row in cursor.fetchall()}

        # Health distribution
        cursor.execute("""
            SELECT
                SUM(CASE WHEN health_score >= 80 THEN 1 ELSE 0 END) as healthy,
                SUM(CASE WHEN health_score >= 50 AND health_score < 80 THEN 1 ELSE 0 END) as degraded,
                SUM(CASE WHEN health_score < 50 THEN 1 ELSE 0 END) as unhealthy,
                COUNT(*) as total
            FROM source_health
        """)
        health_dist = cursor.fetchone()

    total = today_stats["total"] or 0
    success = today_stats["success"] or 0

    return {
        "today": {
            "total_crawls": total,
            "successful": success,
            "failed": today_stats["failed"] or 0,
            "success_rate": success / total if total > 0 else 0.0,
            "events_found": today_stats["events"] or 0,
            "error_breakdown": error_breakdown,
        },
        "sources": {
            "healthy": health_dist["healthy"] or 0,
            "degraded": health_dist["degraded"] or 0,
            "unhealthy": health_dist["unhealthy"] or 0,
            "total_tracked": health_dist["total"] or 0,
        },
        "recommended_workers": get_recommended_workers(),
    }


def cleanup_old_data(days_to_keep: int = 30):
    """Remove data older than specified days."""
    cutoff = (datetime.utcnow() - timedelta(days=days_to_keep)).isoformat()

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM crawl_runs WHERE started_at < ?", (cutoff,))
        deleted = cursor.rowcount
        conn.commit()
        logger.info(f"Cleaned up {deleted} crawl runs older than {days_to_keep} days")


def print_health_report():
    """Print a formatted health report to stdout."""
    summary = get_system_health_summary()

    print("\n" + "=" * 60)
    print("CRAWLER HEALTH REPORT")
    print("=" * 60)

    today = summary["today"]
    print(f"\nToday's Crawls:")
    print(f"  Total: {today['total_crawls']}")
    print(f"  Successful: {today['successful']} ({today['success_rate']:.1%})")
    print(f"  Failed: {today['failed']}")
    print(f"  Events Found: {today['events_found']}")

    if today["error_breakdown"]:
        print(f"\n  Error Breakdown:")
        for error_type, count in today["error_breakdown"].items():
            print(f"    {error_type}: {count}")

    sources = summary["sources"]
    print(f"\nSource Health Distribution:")
    print(f"  🟢 Healthy (80-100): {sources['healthy']}")
    print(f"  🟡 Degraded (50-79): {sources['degraded']}")
    print(f"  🔴 Unhealthy (<50): {sources['unhealthy']}")
    print(f"  Total tracked: {sources['total_tracked']}")

    print(f"\nRecommended workers: {summary['recommended_workers']}")

    # Show unhealthy sources
    unhealthy = get_unhealthy_sources(min_failures=3)
    if unhealthy:
        print(f"\n⚠️  Sources with 3+ consecutive failures:")
        for h in unhealthy[:10]:  # Show top 10
            print(f"  {h.source_slug}: {h.consecutive_failures} failures, "
                  f"score={h.health_score:.0f}, last_error={h.last_error_type}")

    print("\n" + "=" * 60)


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "cleanup":
        days = int(sys.argv[2]) if len(sys.argv) > 2 else 30
        cleanup_old_data(days)
    else:
        print_health_report()
