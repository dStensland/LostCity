"""
Shared writes for volunteer_opportunities.

This gives HelpATL's structured opportunity family the same shared persistence
contract as other typed entity lanes instead of keeping it trapped inside
source-specific SQL snippets.
"""

import logging
import re
from typing import Optional

from db.client import (
    _log_write_skip,
    get_client,
    retry_on_network_error,
    writes_enabled,
)

logger = logging.getLogger(__name__)

_VOLUNTEER_OPPORTUNITY_COLUMNS = {
    "slug",
    "organization_id",
    "source_id",
    "portal_id",
    "event_id",
    "title",
    "summary",
    "description",
    "commitment_level",
    "time_horizon",
    "onboarding_level",
    "schedule_summary",
    "location_summary",
    "skills_required",
    "language_support",
    "physical_demand",
    "min_age",
    "family_friendly",
    "group_friendly",
    "remote_allowed",
    "accessibility_notes",
    "background_check_required",
    "training_required",
    "capacity_total",
    "capacity_remaining",
    "urgency_level",
    "starts_on",
    "ends_on",
    "application_url",
    "source_url",
    "metadata",
    "is_active",
}

_SLUG_RE = re.compile(r"[^\w\s-]")


def _slugify(text: str) -> str:
    slug = _SLUG_RE.sub("", text.lower())
    slug = re.sub(r"[\s_]+", "-", slug)
    slug = re.sub(r"-+", "-", slug).strip("-")
    return slug


@retry_on_network_error(max_retries=4, base_delay=0.5)
def _resolve_organization_id_by_slug(client, organization_slug: str):
    return (
        client.table("organizations")
        .select("id")
        .eq("slug", organization_slug)
        .limit(1)
        .execute()
    )


@retry_on_network_error(max_retries=4, base_delay=0.5)
def _upsert_volunteer_opportunity_record(client, row: dict):
    return client.table("volunteer_opportunities").upsert(
        row,
        on_conflict="slug",
    ).execute()


@retry_on_network_error(max_retries=4, base_delay=0.5)
def _select_active_source_opportunities(client, source_id: int):
    return (
        client.table("volunteer_opportunities")
        .select("id,slug")
        .eq("source_id", source_id)
        .eq("is_active", True)
        .execute()
    )


@retry_on_network_error(max_retries=4, base_delay=0.5)
def _deactivate_source_opportunities(client, stale_ids: list[str]):
    return (
        client.table("volunteer_opportunities")
        .update({"is_active": False})
        .in_("id", stale_ids)
        .execute()
    )


def upsert_volunteer_opportunity(opportunity_data: dict) -> Optional[str]:
    """Insert or update a structured volunteer opportunity matched by slug."""
    slug = (opportunity_data.get("slug") or "").strip()
    title = (opportunity_data.get("title") or "").strip()
    application_url = (opportunity_data.get("application_url") or "").strip()
    organization_id = opportunity_data.get("organization_id")
    organization_slug = (opportunity_data.get("organization_slug") or "").strip()

    if not slug:
        if title:
            slug = _slugify(title)[:120]
        else:
            logger.warning("upsert_volunteer_opportunity: missing slug and title")
            return None
    if not title:
        logger.warning("upsert_volunteer_opportunity: missing title for slug=%s", slug)
        return None
    if not application_url:
        logger.warning(
            "upsert_volunteer_opportunity: missing application_url for slug=%s",
            slug,
        )
        return None

    client = get_client()
    if not organization_id:
        if not organization_slug:
            logger.warning(
                "upsert_volunteer_opportunity: missing organization reference for slug=%s",
                slug,
            )
            return None
        try:
            organization_rows = (
                _resolve_organization_id_by_slug(client, organization_slug).data or []
            )
        except Exception:
            logger.exception(
                "Failed to resolve organization slug=%s for volunteer opportunity slug=%s",
                organization_slug,
                slug,
            )
            return None
        if not organization_rows:
            logger.warning(
                "upsert_volunteer_opportunity: unknown organization_slug=%s for slug=%s",
                organization_slug,
                slug,
            )
            return None
        organization_id = organization_rows[0]["id"]

    row = {
        "slug": slug,
        "organization_id": organization_id,
        **{
            key: value
            for key, value in opportunity_data.items()
            if key in _VOLUNTEER_OPPORTUNITY_COLUMNS
            and key not in {"slug", "organization_id"}
        },
    }
    row["title"] = title
    row["application_url"] = application_url
    row["commitment_level"] = row.get("commitment_level") or "ongoing"
    row["metadata"] = row.get("metadata") or {}
    if "is_active" not in row:
        row["is_active"] = True

    if not writes_enabled():
        _log_write_skip(
            f"upsert volunteer_opportunities slug={slug} organization_id={organization_id}"
        )
        return slug

    try:
        result = _upsert_volunteer_opportunity_record(client, row)
        if result.data:
            record_id = result.data[0].get("id")
            if isinstance(record_id, str) and record_id:
                return record_id
            return slug
    except Exception:
        logger.exception(
            "Failed to upsert volunteer opportunity slug=%s organization_id=%s",
            slug,
            organization_id,
        )
        return None

    return None


def deactivate_stale_volunteer_opportunities(
    source_id: int,
    active_slugs: set[str],
) -> int:
    """Deactivate active source-owned opportunities missing from the current run."""
    client = get_client()
    rows = (_select_active_source_opportunities(client, source_id).data or [])
    stale_ids = [row["id"] for row in rows if row["slug"] not in active_slugs]
    if not stale_ids or not writes_enabled():
        return len(stale_ids)

    try:
        _deactivate_source_opportunities(client, stale_ids)
        return len(stale_ids)
    except Exception:
        logger.exception(
            "Failed to deactivate stale volunteer opportunities for source_id=%s",
            source_id,
        )
        return 0
