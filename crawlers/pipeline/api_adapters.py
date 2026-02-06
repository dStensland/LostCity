"""
API adapters for the pipeline.
"""

from __future__ import annotations

import logging
from typing import Any

import requests

from sources import ticketmaster as tm

logger = logging.getLogger(__name__)


def discover_events(adapter: str, limit: int | None = None) -> list[dict[str, Any]]:
    if adapter == "ticketmaster":
        return _discover_ticketmaster(limit=limit)
    raise ValueError(f"Unknown API adapter: {adapter}")


def _discover_ticketmaster(limit: int | None = None) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    page = 0
    size = 200

    while True:
        try:
            data = tm.fetch_events(page=page, size=size)
        except requests.HTTPError as e:
            status = getattr(e.response, "status_code", None)
            if status == 400:
                logger.warning(
                    "Ticketmaster returned 400 on page %s; stopping pagination",
                    page,
                )
                break
            raise
        embedded = data.get("_embedded", {}) if isinstance(data, dict) else {}
        raw_events = embedded.get("events", []) if embedded else []

        for raw in raw_events:
            parsed = tm.parse_event(raw)
            if parsed:
                events.append(parsed)
                if limit and len(events) >= limit:
                    return events

        page_info = data.get("page", {}) if isinstance(data, dict) else {}
        total_pages = page_info.get("totalPages")
        if total_pages is None:
            break
        if page >= total_pages - 1:
            break
        page += 1

    return events
