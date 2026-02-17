"""
Derive structured show metadata from event text + tags.

This normalizes commonly-needed music/comedy signal fields into first-class
event columns so frontend display does not rely only on runtime parsing.
"""

from __future__ import annotations

import re
from typing import Optional


_DOORS_PATTERN = re.compile(
    r"\b(?:doors?|door)\s*(?:open|opens|opening|at)?\s*[:\-]?\s*(\d{1,2}(?::\d{2})?\s*[ap]\.?m\.?)",
    re.IGNORECASE,
)
_TIME_TOKEN_PATTERN = re.compile(
    r"(\d{1,2})(?::(\d{2}))?\s*([ap])(?:\.?m\.?)?",
    re.IGNORECASE,
)
_SET_TIMES_PATTERN = re.compile(
    r"\b(?:set\s*times?|full\s*lineup\s*times?|1st\s*set|2nd\s*set|set\s*1|set\s*2|schedule\s*posted)\b",
    re.IGNORECASE,
)
_NO_REENTRY_PATTERN = re.compile(
    r"\bno\s*re[\s-]?entry\b|\bre[\s-]?entry\s*not\s*permitted\b",
    re.IGNORECASE,
)
_REENTRY_ALLOWED_PATTERN = re.compile(
    r"\bre[\s-]?entry\s*(?:allowed|welcome|permitted)\b",
    re.IGNORECASE,
)


def _normalize_text(*parts: Optional[str]) -> str:
    return " ".join([p for p in parts if p]).lower()


def _normalize_tags(tags: Optional[list]) -> set[str]:
    normalized: set[str] = set()
    for tag in tags or []:
        if not tag:
            continue
        normalized.add(str(tag).strip().lower())
    return normalized


def _normalize_time_value(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    token = str(value).strip()
    if not token:
        return None

    # Already 24h-like "HH:MM[:SS]"
    match_24h = re.match(r"^(\d{2}):(\d{2})(?::(\d{2}))?$", token)
    if match_24h:
        hh = int(match_24h.group(1))
        mm = int(match_24h.group(2))
        ss = int(match_24h.group(3) or "0")
        if 0 <= hh <= 23 and 0 <= mm <= 59 and 0 <= ss <= 59:
            return f"{hh:02d}:{mm:02d}:{ss:02d}"
        return None

    match_12h = _TIME_TOKEN_PATTERN.search(token)
    if not match_12h:
        return None

    hour_num = int(match_12h.group(1))
    minute_num = int(match_12h.group(2) or "0")
    period = (match_12h.group(3) or "").lower()
    if hour_num < 1 or hour_num > 12 or minute_num < 0 or minute_num > 59:
        return None

    hour_24 = hour_num % 12
    if period == "p":
        hour_24 += 12
    return f"{hour_24:02d}:{minute_num:02d}:00"


def _normalize_age_policy(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    raw = str(value).strip().lower()
    if not raw:
        return None
    mapping = {
        "21+": "21+",
        "21_plus": "21+",
        "21 plus": "21+",
        "18+": "18+",
        "18_plus": "18+",
        "18 plus": "18+",
        "all-ages": "all-ages",
        "all_ages": "all-ages",
        "all ages": "all-ages",
        "adults-only": "adults-only",
        "adults_only": "adults-only",
        "adults only": "adults-only",
    }
    return mapping.get(raw)


def _normalize_ticket_status(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    raw = str(value).strip().lower()
    if not raw:
        return None
    mapping = {
        "sold-out": "sold-out",
        "sold_out": "sold-out",
        "sold out": "sold-out",
        "low-tickets": "low-tickets",
        "low_tickets": "low-tickets",
        "low tickets": "low-tickets",
        "free": "free",
        "tickets-available": "tickets-available",
        "tickets_available": "tickets-available",
        "tickets available": "tickets-available",
        "available": "tickets-available",
    }
    return mapping.get(raw)


def _normalize_reentry_policy(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    raw = str(value).strip().lower()
    if not raw:
        return None
    mapping = {
        "no-reentry": "no-reentry",
        "no_reentry": "no-reentry",
        "no re-entry": "no-reentry",
        "no reentry": "no-reentry",
        "reentry-allowed": "reentry-allowed",
        "reentry_allowed": "reentry-allowed",
        "re-entry allowed": "reentry-allowed",
        "reentry allowed": "reentry-allowed",
    }
    return mapping.get(raw)


def _detect_age_policy(text: str, tags: set[str], is_adult: Optional[bool]) -> Optional[str]:
    if (
        "21+" in tags
        or re.search(r"\b21\+\b|\b21\s*(?:and|&)\s*(?:over|up)\b|\bmust\s*be\s*21\b", text)
    ):
        return "21+"

    if (
        "18+" in tags
        or re.search(r"\b18\+\b|\b18\s*(?:and|&)\s*(?:over|up)\b|\bmust\s*be\s*18\b", text)
    ):
        return "18+"

    if (
        "all-ages" in tags
        or "family-friendly" in tags
        or re.search(r"\ball[\s-]?ages\b|\bopen\s*to\s*all\s*ages\b", text)
    ):
        return "all-ages"

    if is_adult:
        return "adults-only"

    return None


def _detect_ticket_status(
    text: str,
    tags: set[str],
    is_free: Optional[bool],
    has_ticket_url: bool,
) -> Optional[str]:
    if "sold-out" in tags or re.search(r"\bsold[\s-]?out\b", text):
        return "sold-out"

    if (
        "limited-seating" in tags
        or re.search(
            r"\blow\s*tickets?\b|\bfew\s*tickets?\s*left\b|\blimited\s*tickets?\b|\balmost\s*sold\s*out\b",
            text,
        )
    ):
        return "low-tickets"

    if is_free or "free" in tags:
        return "free"

    if has_ticket_url or "ticketed" in tags:
        return "tickets-available"

    return None


def derive_show_signals(event_data: dict, preserve_existing: bool = True) -> dict:
    """
    Return normalized show metadata fields for events table.

    Keys:
      - doors_time (HH:MM:SS)
      - age_policy (21+ | 18+ | all-ages | adults-only)
      - ticket_status (sold-out | low-tickets | free | tickets-available)
      - reentry_policy (no-reentry | reentry-allowed)
      - set_times_mentioned (bool)
    """

    text = _normalize_text(
        event_data.get("title"),
        event_data.get("description"),
        event_data.get("price_note"),
    )
    tags = _normalize_tags(event_data.get("tags"))

    existing_doors = _normalize_time_value(event_data.get("doors_time"))
    existing_age = _normalize_age_policy(event_data.get("age_policy"))
    existing_ticket = _normalize_ticket_status(event_data.get("ticket_status"))
    existing_reentry = _normalize_reentry_policy(event_data.get("reentry_policy"))
    existing_set_times = event_data.get("set_times_mentioned")

    doors_match = _DOORS_PATTERN.search(text)
    extracted_doors = _normalize_time_value(doors_match.group(1) if doors_match else None)
    detected_age = _detect_age_policy(text, tags, event_data.get("is_adult"))
    detected_ticket = _detect_ticket_status(
        text,
        tags,
        event_data.get("is_free"),
        bool(event_data.get("ticket_url")),
    )

    detected_reentry: Optional[str] = None
    if _NO_REENTRY_PATTERN.search(text):
        detected_reentry = "no-reentry"
    elif _REENTRY_ALLOWED_PATTERN.search(text):
        detected_reentry = "reentry-allowed"

    detected_set_times = bool(_SET_TIMES_PATTERN.search(text))

    doors_time = existing_doors if preserve_existing and existing_doors else extracted_doors
    age_policy = existing_age if preserve_existing and existing_age else detected_age
    ticket_status = existing_ticket if preserve_existing and existing_ticket else detected_ticket
    reentry_policy = existing_reentry if preserve_existing and existing_reentry else detected_reentry

    if preserve_existing and isinstance(existing_set_times, bool):
        set_times_mentioned = existing_set_times
    else:
        set_times_mentioned = detected_set_times

    return {
        "doors_time": doors_time,
        "age_policy": age_policy,
        "ticket_status": ticket_status,
        "reentry_policy": reentry_policy,
        "set_times_mentioned": set_times_mentioned,
    }
