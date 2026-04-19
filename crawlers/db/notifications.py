"""
Event update notifications.
"""

import logging
from typing import Optional

from db.client import (
    get_client,
    writes_enabled,
    _log_write_skip,
    _normalize_image_url,
    events_support_show_signal_columns,
)
from show_signals import derive_show_signals

logger = logging.getLogger(__name__)

_CANCEL_KEYWORDS = ("canceled", "cancelled", "postponed")


def _event_looks_cancelled(title: Optional[str], description: Optional[str]) -> bool:
    text = f"{title or ''} {description or ''}".lower()
    return any(word in text for word in _CANCEL_KEYWORDS)


def format_event_update_message(
    title: str,
    changes: list[str],
    cancelled: bool = False,
) -> str:
    if cancelled:
        return f"Update: {title} was canceled."
    if changes:
        change_summary = "; ".join(changes)
        return f"Update: {title} changed — {change_summary}."
    return f"Update: {title} has new details."


def _filter_users_with_event_updates(user_ids: list[str]) -> list[str]:
    """Filter users by notification_settings.event_updates (default true)."""
    if not user_ids:
        return []
    client = get_client()
    try:
        result = (
            client.table("profiles")
            .select("id,notification_settings")
            .in_("id", user_ids)
            .execute()
        )
    except Exception as e:
        logger.warning(
            "Failed to load notification_settings; defaulting to all users",
            exc_info=e,
        )
        return user_ids
    allowed: list[str] = []
    for row in result.data or []:
        settings = row.get("notification_settings") or {}
        if settings.get("event_updates", True):
            allowed.append(row["id"])
    return allowed


def create_event_update_notifications(event_id: int, message: str) -> int:
    """Create in-app notifications for users with RSVPs or saved items."""
    if not writes_enabled():
        _log_write_skip(f"insert notifications event_id={event_id}")
        return 0

    client = get_client()

    rsvp_result = (
        client.table("plan_invitees")
        .select("user_id,rsvp_status,plans!inner(anchor_event_id,anchor_type)")
        .eq("plans.anchor_event_id", event_id)
        .eq("plans.anchor_type", "event")
        .in_("rsvp_status", ["going", "interested"])
        .execute()
    )
    rsvp_users = {
        row["user_id"]
        for row in (rsvp_result.data or [])
        if row.get("user_id")
    }

    saved_result = (
        client.table("saved_items").select("user_id").eq("event_id", event_id).execute()
    )
    saved_users = {
        row["user_id"] for row in (saved_result.data or []) if row.get("user_id")
    }

    user_ids = list(rsvp_users | saved_users)
    user_ids = _filter_users_with_event_updates(user_ids)

    if not user_ids:
        return 0

    payload = [
        {
            "user_id": user_id,
            "type": "event_update",
            "event_id": event_id,
            "message": message,
        }
        for user_id in user_ids
    ]

    client.table("notifications").insert(payload).execute()
    return len(payload)


def compute_event_update(
    existing: dict, incoming: dict
) -> tuple[dict, list[str], bool]:
    """Compute update fields and a change summary for notifications."""
    update_data: dict = {}
    changes: list[str] = []
    incoming_with_signals = {
        **incoming,
        **derive_show_signals(incoming, preserve_existing=False),
    }

    if incoming_with_signals.get("start_date") and incoming_with_signals.get(
        "start_date"
    ) != existing.get("start_date"):
        changes.append(
            f"date {existing.get('start_date')} → {incoming_with_signals.get('start_date')}"
        )
        update_data["start_date"] = incoming_with_signals.get("start_date")
    if incoming_with_signals.get("start_time") and incoming_with_signals.get(
        "start_time"
    ) != existing.get("start_time"):
        changes.append(
            f"time {existing.get('start_time') or 'TBA'} → {incoming_with_signals.get('start_time')}"
        )
        update_data["start_time"] = incoming_with_signals.get("start_time")
    if incoming_with_signals.get("end_date") and incoming_with_signals.get(
        "end_date"
    ) != existing.get("end_date"):
        update_data["end_date"] = incoming_with_signals.get("end_date")
    if incoming_with_signals.get("end_time") and incoming_with_signals.get(
        "end_time"
    ) != existing.get("end_time"):
        update_data["end_time"] = incoming_with_signals.get("end_time")

    _new_place_id = incoming_with_signals.get("place_id") or incoming_with_signals.get("venue_id")
    _existing_place_id = existing.get("place_id") or existing.get("venue_id")
    if _new_place_id and _new_place_id != _existing_place_id:
        changes.append("venue updated")
        update_data["place_id"] = _new_place_id

    incoming_title = incoming_with_signals.get("title")
    if incoming_title and incoming_title != existing.get("title"):
        if _event_looks_cancelled(
            incoming_title, incoming_with_signals.get("description")
        ):
            update_data["title"] = incoming_title

    incoming_desc = incoming_with_signals.get("description")
    if incoming_desc and (
        not existing.get("description")
        or len(incoming_desc) > len(existing.get("description", ""))
    ):
        update_data["description"] = incoming_desc

    existing_img = existing.get("image_url")
    incoming_img = _normalize_image_url(incoming_with_signals.get("image_url"))
    from db.events import _should_use_incoming_image
    if _should_use_incoming_image(existing_img, incoming_img):
        update_data["image_url"] = incoming_img

    for field in ("ticket_url", "price_note"):
        if incoming_with_signals.get(field) and not existing.get(field):
            update_data[field] = incoming_with_signals.get(field)
    for field in ("price_min", "price_max"):
        if incoming_with_signals.get(field) is not None and existing.get(field) is None:
            update_data[field] = incoming_with_signals.get(field)

    if events_support_show_signal_columns():
        for field in ("doors_time", "age_policy", "ticket_status", "reentry_policy"):
            incoming_value = incoming_with_signals.get(field)
            if incoming_value and incoming_value != existing.get(field):
                update_data[field] = incoming_value

        incoming_set_times = incoming_with_signals.get("set_times_mentioned")
        if incoming_set_times is True and not existing.get("set_times_mentioned"):
            update_data["set_times_mentioned"] = True

    cancelled = _event_looks_cancelled(
        incoming_with_signals.get("title"), incoming_with_signals.get("description")
    ) and not _event_looks_cancelled(existing.get("title"), existing.get("description"))

    return update_data, changes, cancelled
