"""
Centralized exhibition lifecycle management.

Marks exhibitions as inactive when:
- closing_date < today
- No closing_date + opening_date > 6 months ago + not permanent

Run as post-crawl hook or on schedule.

Run: cd crawlers && python3 scripts/exhibition_lifecycle.py
"""

import logging
from datetime import date, timedelta

from db.client import get_client

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


def sweep():
    client = get_client()
    today = date.today().isoformat()
    six_months_ago = (date.today() - timedelta(days=180)).isoformat()

    # 1. Past closing date
    result = client.table("exhibitions").update(
        {"is_active": False}
    ).eq("is_active", True).lt("closing_date", today).execute()
    expired = len(result.data) if result.data else 0

    # 2. No closing date + old opening + not permanent
    all_null_close = client.table("exhibitions").select(
        "id, opening_date, exhibition_type"
    ).eq("is_active", True).is_("closing_date", "null").lt(
        "opening_date", six_months_ago
    ).execute()

    stale_count = 0
    for ex in all_null_close.data or []:
        if ex.get("exhibition_type") == "permanent":
            continue
        client.table("exhibitions").update(
            {"is_active": False}
        ).eq("id", ex["id"]).execute()
        stale_count += 1

    logger.info(
        "Lifecycle sweep: %d expired (past closing_date), %d stale (no closing_date, >6mo old)",
        expired, stale_count,
    )


if __name__ == "__main__":
    sweep()
