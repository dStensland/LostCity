"""Deactivate exhibitions whose closing_date has passed.

Run as standalone script or called from post_crawl_report.
Does NOT deactivate exhibitions with NULL closing_date (permanent/ongoing).
"""

import logging
from datetime import date

from db.client import get_client, writes_enabled

logger = logging.getLogger(__name__)


def deactivate_past_exhibitions() -> int:
    """Deactivate exhibitions where closing_date < today. Returns count deactivated."""
    if not writes_enabled():
        logger.info("[DRY RUN] Would deactivate past exhibitions")
        return 0

    client = get_client()
    today = date.today().isoformat()

    result = (
        client.table("exhibitions")
        .update({"is_active": False})
        .eq("is_active", True)
        .lt("closing_date", today)
        .execute()
    )

    count = len(result.data) if result.data else 0
    if count:
        logger.info("Deactivated %d past exhibitions (closing_date < %s)", count, today)
    return count


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    deactivated = deactivate_past_exhibitions()
    print(f"Deactivated {deactivated} past exhibitions")
