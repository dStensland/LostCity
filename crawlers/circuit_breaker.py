"""
Circuit breaker pattern for crawler resilience.
Prevents repeated failures from wasting resources on consistently failing sources.
"""

import logging
import re
from datetime import datetime, timedelta
from typing import Optional
from dataclasses import dataclass
from db import get_client

logger = logging.getLogger(__name__)

# Circuit breaker thresholds
FAILURE_THRESHOLD = 3  # Number of consecutive failures before opening circuit
RECOVERY_TIMEOUT_HOURS = 6  # Hours to wait before retrying a failed source
LOOKBACK_HOURS = 24  # Hours to look back for failure history


@dataclass
class CircuitState:
    """State of a circuit breaker for a source."""
    source_id: int
    slug: str
    consecutive_failures: int
    last_failure: Optional[datetime]
    is_open: bool  # True = circuit is open (blocking), False = closed (allowing)
    reason: str


def get_source_health(source_id: int, slug: str) -> CircuitState:
    """
    Check the health of a source based on recent crawl history.

    Returns CircuitState indicating whether the source should be skipped.
    """
    client = get_client()

    lookback = datetime.utcnow() - timedelta(hours=LOOKBACK_HOURS)

    # Get recent crawl logs for this source
    result = client.table("crawl_logs") \
        .select("status, started_at, error_message") \
        .eq("source_id", source_id) \
        .gte("started_at", lookback.isoformat()) \
        .order("started_at", desc=True) \
        .limit(FAILURE_THRESHOLD + 1) \
        .execute()

    logs = result.data or []

    if not logs:
        # No recent history - allow crawl
        return CircuitState(
            source_id=source_id,
            slug=slug,
            consecutive_failures=0,
            last_failure=None,
            is_open=False,
            reason="no_history"
        )

    # Count consecutive failures from most recent
    consecutive_failures = 0
    last_failure = None

    for log in logs:
        if log["status"] == "error":
            consecutive_failures += 1
            if last_failure is None:
                ts = log["started_at"].replace("Z", "+00:00")
                # Normalize fractional seconds to 6 digits for Python 3.9 compat
                ts = re.sub(r'(\.\d{1,6})\d*', lambda m: m.group(1).ljust(7, '0'), ts)
                last_failure = datetime.fromisoformat(ts)
        else:
            break  # Hit a success, stop counting

    # Check if circuit should be open
    if consecutive_failures >= FAILURE_THRESHOLD:
        if last_failure:
            recovery_time = last_failure + timedelta(hours=RECOVERY_TIMEOUT_HOURS)
            if datetime.utcnow().replace(tzinfo=last_failure.tzinfo) < recovery_time:
                return CircuitState(
                    source_id=source_id,
                    slug=slug,
                    consecutive_failures=consecutive_failures,
                    last_failure=last_failure,
                    is_open=True,
                    reason=f"circuit_open_until_{recovery_time.isoformat()}"
                )

    return CircuitState(
        source_id=source_id,
        slug=slug,
        consecutive_failures=consecutive_failures,
        last_failure=last_failure,
        is_open=False,
        reason="healthy" if consecutive_failures == 0 else f"degraded_{consecutive_failures}_failures"
    )


def should_skip_source(source: dict) -> tuple[bool, str]:
    """
    Determine if a source should be skipped due to circuit breaker.

    Returns:
        (should_skip, reason) tuple
    """
    state = get_source_health(source["id"], source["slug"])

    if state.is_open:
        logger.warning(
            f"Circuit breaker OPEN for {source['slug']}: "
            f"{state.consecutive_failures} consecutive failures. "
            f"Reason: {state.reason}"
        )
        return True, state.reason

    if state.consecutive_failures > 0:
        logger.info(
            f"Circuit breaker warning for {source['slug']}: "
            f"{state.consecutive_failures} recent failures"
        )

    return False, state.reason


def get_all_circuit_states() -> list[CircuitState]:
    """
    Get circuit breaker states for all active sources.
    Useful for monitoring dashboard.
    """
    from db import get_active_sources

    sources = get_active_sources()
    states = []

    for source in sources:
        state = get_source_health(source["id"], source["slug"])
        states.append(state)

    return states


def reset_circuit(source_id: int) -> bool:
    """
    Manually reset a circuit breaker by marking a fake success.
    Used for admin override to retry a source.

    Note: This doesn't modify the database, it's just for documentation.
    The actual reset happens when a successful crawl is recorded.
    """
    logger.info(f"Circuit breaker reset requested for source_id={source_id}")
    return True
