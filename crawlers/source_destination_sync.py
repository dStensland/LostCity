"""
Shared destination enrichment helpers for source crawlers.

These helpers let event-led crawlers also hydrate venue-level signals during the
same pass: specials from the venue website, plus planning/description/image
fields that make destination pages actually useful.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any, Optional

from db.client import _log_write_skip, get_client, writes_enabled

logger = logging.getLogger(__name__)

_VENUE_SELECT = (
    "id,name,slug,website,venue_type,description,short_description,image_url,"
    "planning_notes,last_verified_at"
)


def _parse_iso_datetime(value: Optional[str]) -> Optional[datetime]:
    raw = (value or "").strip()
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        return None


def _fetch_venue_row(venue_id: int) -> Optional[dict[str, Any]]:
    client = get_client()
    result = (
        client.table("venues")
        .select(_VENUE_SELECT)
        .eq("id", venue_id)
        .limit(1)
        .execute()
    )
    rows = result.data or []
    if not rows:
        return None
    return rows[0]


def ensure_venue_destination_fields(
    venue_id: int,
    *,
    planning_notes: Optional[str] = None,
    description: Optional[str] = None,
    short_description: Optional[str] = None,
    image_url: Optional[str] = None,
    force: bool = False,
) -> bool:
    """Fill destination-facing venue fields when the crawler has better source-of-truth copy."""
    venue = _fetch_venue_row(venue_id)
    if not venue:
        logger.warning("ensure_venue_destination_fields: venue_id=%s not found", venue_id)
        return False

    updates: dict[str, Any] = {}

    if description and (force or not (venue.get("description") or "").strip()):
        updates["description"] = description.strip()

    if short_description and (force or not (venue.get("short_description") or "").strip()):
        updates["short_description"] = short_description.strip()

    if image_url and (force or not (venue.get("image_url") or "").strip()):
        updates["image_url"] = image_url.strip()

    existing_planning = (venue.get("planning_notes") or "").strip()
    if planning_notes:
        normalized = planning_notes.strip()
        if force or not existing_planning:
            updates["planning_notes"] = normalized

    if not updates:
        return False

    updates["last_verified_at"] = datetime.utcnow().isoformat()

    if not writes_enabled():
        _log_write_skip(f"update venues id={venue_id} destination fields")
        return True

    get_client().table("venues").update(updates).eq("id", venue_id).execute()
    logger.info(
        "Updated venue destination fields for %s",
        venue.get("slug") or venue.get("name") or venue_id,
    )
    return True


def refresh_venue_specials_from_website(
    venue_id: int,
    *,
    max_age_days: int = 7,
    force: bool = False,
    include_social_bios: bool = False,
) -> dict[str, Any]:
    """
    Run the existing venue-site enrichment pass from inside a crawler.

    This is the correct path for bars/restaurants/breweries that should capture
    specials, hours, images, and descriptive venue metadata in the same pass as
    their event crawl.
    """
    from scrape_place_specials import get_venues, scrape_venue, upsert_results

    venues = get_venues(venue_ids=[venue_id], limit=1)
    if not venues:
        return {"skipped": "missing_venue"}

    venue = venues[0]
    if not (venue.get("website") or "").strip():
        return {"skipped": "missing_website"}

    last_verified = _parse_iso_datetime(venue.get("last_verified_at"))
    if (
        not force
        and last_verified
        and datetime.utcnow() - last_verified < timedelta(days=max_age_days)
    ):
        return {"skipped": "fresh"}

    try:
        data = scrape_venue(
            venue,
            use_playwright=True,
            include_social_bios=include_social_bios,
        )
    except Exception as exc:
        logger.warning(
            "Venue-site enrichment failed for %s: %s",
            venue.get("slug") or venue.get("name") or venue_id,
            exc,
        )
        return {"skipped": "extract_failed", "error": str(exc)}

    if not data:
        return {"skipped": "no_data"}

    try:
        stats = upsert_results(
            venue,
            data,
            dry_run=not writes_enabled(),
            skip_specials=False,
            force_update=force,
        )
        logger.info(
            "Venue-site enrichment complete for %s: specials=%s updated=%s",
            venue.get("slug") or venue.get("name") or venue_id,
            stats.get("specials_added", 0),
            stats.get("venue_updated", False),
        )
        return stats
    except Exception as exc:
        logger.warning(
            "Venue-site upsert failed for %s: %s",
            venue.get("slug") or venue.get("name") or venue_id,
            exc,
        )
        return {"skipped": "upsert_failed", "error": str(exc)}
