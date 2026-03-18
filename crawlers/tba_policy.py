"""
Shared policy for distinguishing actionable TBA rows from intentional/date-only rows.
"""

from __future__ import annotations

import re
from typing import Optional
from urllib.parse import parse_qs, urlparse


LISTING_URL_PATTERNS = (
    r"/calendar/?$",
    r"/events/?$",
    r"/schedule/?$",
)


def classify_tba_event(event: dict) -> tuple[bool, Optional[str]]:
    """
    Return (actionable, reason).

    actionable=False means the row is structurally or intentionally date-only,
    so hydration and operator counts should not treat it like a recoverable
    first-pass crawler defect.
    """
    detail_url = event.get("source_url") or event.get("ticket_url") or ""
    if not detail_url or not str(detail_url).startswith("http"):
        return False, "missing_detail_url"

    parsed = urlparse(str(detail_url))
    domain = (parsed.netloc or "").lower().replace("www.", "")
    path = (parsed.path or "").rstrip("/").lower()

    if domain == "docs.google.com":
        return False, "generic_hub_url"
    if domain == "classes.inquicker.com":
        query = parse_qs(parsed.query or "")
        if path in {"", "/"} or not query.get("ClassID") or not query.get("OccurrenceID"):
            return False, "generic_hub_url"
    if domain == "cscatl.gnosishosting.net" and path == "/events/calendar":
        return False, "shared_calendar_url"
    if domain == "dream.wnba.com" and path == "/2026-schedule-release":
        return False, "official_date_only_schedule"
    if domain.endswith("vimeo.com") and "showcase" in path:
        return False, "video_showcase_url"
    if "instagram.com" in domain:
        return False, "social_profile_url"

    for pattern in LISTING_URL_PATTERNS:
        if re.search(pattern, detail_url):
            return False, "listing_url"

    return True, None
