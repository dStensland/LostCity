"""
Place vertical detail extension writes for venue_destination_details.

Renamed from destination_details.py (Task 8 — places refactor).
Keeps Adventure-style destination intelligence in a shared 1:1 place
extension instead of portal-specific seed scripts.
"""

import logging
from typing import Optional

from db.client import (
    _log_write_skip,
    get_client,
    retry_on_network_error,
    venues_support_destination_details_table,
    writes_enabled,
)

logger = logging.getLogger(__name__)

_DESTINATION_DETAILS_COLUMNS = {
    "venue_id",
    "destination_type",
    "commitment_tier",
    "primary_activity",
    "drive_time_minutes",
    "difficulty_level",
    "trail_distance_miles",
    "elevation_gain_ft",
    "surface_type",
    "best_seasons",
    "weather_fit_tags",
    "practical_notes",
    "conditions_notes",
    "accessibility_notes",
    "parking_type",
    "parking_capacity",
    "best_time_of_day",
    "family_suitability",
    "dog_friendly",
    "reservation_required",
    "permit_required",
    "fee_note",
    "seasonal_hazards",
    "source_url",
    "metadata",
}


@retry_on_network_error(max_retries=4, base_delay=0.5)
def _upsert_destination_details_record(client, row: dict):
    return client.table("venue_destination_details").upsert(
        row,
        on_conflict="venue_id",
    ).execute()


def upsert_place_vertical_details(venue_id: int, details: dict) -> Optional[int]:
    """Insert or update the 1:1 vertical-details extension for a place."""
    if not venues_support_destination_details_table():
        return None

    if not venue_id:
        logger.warning("upsert_place_vertical_details: missing venue_id")
        return None

    row = {
        "place_id": venue_id,
        **{
            key: value
            for key, value in details.items()
            if key in _DESTINATION_DETAILS_COLUMNS and key != "venue_id"
        },
    }

    if not writes_enabled():
        _log_write_skip(f"upsert venue_destination_details venue_id={venue_id}")
        return venue_id

    try:
        _upsert_destination_details_record(get_client(), row)
        return venue_id
    except Exception:
        logger.exception(
            "Failed to upsert place vertical details for venue_id=%s",
            venue_id,
        )
        return None

