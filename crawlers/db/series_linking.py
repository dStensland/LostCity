"""
Series day-of-week correction helper.
Named series_linking.py to avoid conflict with top-level series.py module.
"""

import logging

logger = logging.getLogger(__name__)


def _force_update_series_day(
    client, series_id: str, day_of_week: str
) -> None:
    """Overwrite a series' day_of_week when the crawler's value is verified correct.

    Unlike update_series_metadata (which only fills NULL), this forces an update
    so that stale values get corrected when a venue changes its recurring night.
    """
    try:
        existing = client.table("series").select("day_of_week").eq("id", series_id).execute()
        if not existing.data:
            return
        current = (existing.data[0].get("day_of_week") or "").strip().lower()
        incoming = day_of_week.strip().lower()
        if current and current != incoming:
            client.table("series").update({"day_of_week": incoming}).eq("id", series_id).execute()
            logger.info(
                "Corrected series %s day_of_week: %s → %s",
                series_id[:8], current, incoming,
            )
    except Exception as exc:
        logger.debug("Failed to force-update series day_of_week: %s", exc)
