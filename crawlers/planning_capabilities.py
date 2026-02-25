"""
Capability metadata derivation for family/event planning experiences.

This module is intentionally crawler-agnostic so future content categories
can reuse the same normalization and scoring primitives.
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any, Optional

_AGGREGATOR_SLUG_PREFIXES = ("ticketmaster", "eventbrite", "mobilize")
_AGGREGATOR_SLUGS = {
    "atlanta-recurring-social",
    "instagram-captions",
    "creative-loafing",
}
_AGGREGATOR_HOST_TOKENS = (
    "eventbrite",
    "ticketmaster",
    "facebook",
    "instagram",
    "allevents",
    "mommypoppins",
    "kidsoutandabout",
    "nextdoor",
    "patch.",
    "campsearch",
    "mykidcamp",
    "winnie.com",
)

_REG_STATUS_MAP = {
    "sold-out": "sold_out",
    "sold_out": "sold_out",
    "sold out": "sold_out",
    "low-tickets": "open",
    "low_tickets": "open",
    "low tickets": "open",
    "tickets-available": "open",
    "tickets_available": "open",
    "tickets available": "open",
    "available": "open",
    "free": "open",
}

_TIME_RE = re.compile(r"^(\d{1,2}):(\d{2})(?::\d{2})?$")
_AGE_RANGE_RE = re.compile(r"\bages?\s*(\d{1,2})\s*(?:-|to)\s*(\d{1,2})\b", re.IGNORECASE)
_AGE_PLUS_RE = re.compile(r"\bages?\s*(\d{1,2})\s*\+\b", re.IGNORECASE)


def _normalize_text(*parts: Optional[str]) -> str:
    return " ".join([str(part).strip().lower() for part in parts if part]).strip()


def normalize_registration_status(
    *,
    ticket_status: Optional[str],
    title: Optional[str] = None,
    description: Optional[str] = None,
    price_note: Optional[str] = None,
    tags: Optional[list[str]] = None,
    has_ticket_url: bool = False,
    is_free: Optional[bool] = None,
) -> str:
    """Normalize registration/ticket state to one of:
    open, waitlist, sold_out, cancelled, unknown.
    """
    mapped = _REG_STATUS_MAP.get(str(ticket_status or "").strip().lower())
    if mapped:
        return mapped

    text = _normalize_text(title, description, price_note)
    normalized_tags = {str(tag).strip().lower() for tag in (tags or [])}

    if re.search(r"\bcancel+ed\b|\bpostponed\b|\brescheduled\b", text):
        return "cancelled"
    if "waitlist" in normalized_tags or re.search(r"\bwait[\s-]?list\b|\bjoin the waitlist\b", text):
        return "waitlist"
    if "sold-out" in normalized_tags or re.search(r"\bsold[\s-]?out\b", text):
        return "sold_out"
    if (
        "registration-open" in normalized_tags
        or re.search(r"\bregistration (?:is )?open\b|\benroll now\b|\bregister now\b", text)
    ):
        return "open"
    if has_ticket_url or is_free:
        return "open"

    return "unknown"


def extract_age_range(
    *,
    age_policy: Optional[str],
    title: Optional[str] = None,
    description: Optional[str] = None,
    tags: Optional[list[str]] = None,
) -> dict[str, Any]:
    """Extract age bounds and normalized age band from text/policy."""
    policy = str(age_policy or "").strip().lower()
    text = _normalize_text(title, description)
    normalized_tags = {str(tag).strip().lower() for tag in (tags or [])}

    if policy in {"all-ages", "all ages", "all_ages"} or "all-ages" in normalized_tags:
        return {"age_min": None, "age_max": None, "age_band": "all_ages"}
    if policy in {"21+", "adults-only", "adults only", "adults_only"}:
        return {"age_min": 21, "age_max": None, "age_band": "adults_21_plus"}
    if policy in {"18+", "18 plus", "18_plus"}:
        return {"age_min": 18, "age_max": None, "age_band": "adults_18_plus"}

    age_min: Optional[int] = None
    age_max: Optional[int] = None

    range_match = _AGE_RANGE_RE.search(text)
    if range_match:
        age_min = int(range_match.group(1))
        age_max = int(range_match.group(2))
        if age_min > age_max:
            age_min, age_max = age_max, age_min
    else:
        plus_match = _AGE_PLUS_RE.search(text)
        if plus_match:
            age_min = int(plus_match.group(1))

    if age_min is None and age_max is None:
        return {"age_min": None, "age_max": None, "age_band": "unknown"}

    return {"age_min": age_min, "age_max": age_max, "age_band": _age_band(age_min, age_max)}


def _age_band(age_min: Optional[int], age_max: Optional[int]) -> str:
    if age_min is not None and age_min >= 21:
        return "adults_21_plus"
    if age_min is not None and age_min >= 18:
        return "adults_18_plus"
    if age_max is not None and age_max <= 4:
        return "toddlers_0_4"
    if age_max is not None and age_max <= 9:
        return "kids_5_9"
    if age_max is not None and age_max <= 12:
        return "preteen_10_12"
    if age_max is not None and age_max <= 17:
        return "teens_13_17"
    if age_min is not None and age_min <= 17 and age_max is None:
        return "youth_open_upper"
    return "mixed_ages"


def derive_schedule_bucket(start_time: Optional[str], is_all_day: Optional[bool]) -> str:
    if is_all_day:
        return "all_day"
    if not start_time:
        return "unknown"

    match = _TIME_RE.match(str(start_time).strip())
    if not match:
        return "unknown"

    hour = int(match.group(1))
    if hour < 6:
        return "late_night"
    if hour < 12:
        return "morning"
    if hour < 17:
        return "afternoon"
    if hour < 21:
        return "evening"
    return "night"


def derive_price_band(
    *,
    is_free: Optional[bool],
    price_min: Optional[float],
    price_max: Optional[float],
    price_note: Optional[str] = None,
) -> str:
    note = str(price_note or "").lower()
    if is_free or "free" in note or "no cost" in note:
        return "free"

    benchmark = price_max if price_max is not None else price_min
    if benchmark is None:
        return "unknown"
    if benchmark <= 25:
        return "budget"
    if benchmark <= 75:
        return "moderate"
    return "premium"


def derive_freshness(start_date: Optional[str], now: Optional[datetime] = None) -> dict[str, Any]:
    now_dt = now or datetime.utcnow()
    if not start_date:
        return {"freshness_tier": "unknown", "days_until_start": None}
    try:
        event_date = datetime.strptime(str(start_date), "%Y-%m-%d").date()
    except ValueError:
        return {"freshness_tier": "unknown", "days_until_start": None}

    days_until = (event_date - now_dt.date()).days
    if days_until < -1:
        tier = "stale_past"
    elif days_until <= 14:
        tier = "imminent"
    elif days_until <= 60:
        tier = "upcoming"
    else:
        tier = "long_range"
    return {"freshness_tier": tier, "days_until_start": days_until}


def derive_source_reliability(source_info: Optional[dict]) -> str:
    if not source_info:
        return "medium"

    slug = str(source_info.get("slug") or "").strip().lower()
    source_url = str(source_info.get("url") or "").strip().lower()
    source_type = str(source_info.get("source_type") or "").strip().lower()
    integration_method = str(source_info.get("integration_method") or "").strip().lower()

    if slug.startswith(_AGGREGATOR_SLUG_PREFIXES) or slug in _AGGREGATOR_SLUGS:
        return "low"
    if any(token in source_url for token in _AGGREGATOR_HOST_TOKENS):
        return "low"

    if integration_method in {"api", "rss"}:
        return "medium"

    if source_type in {"venue", "organization", "school", "museum", "library", "park", "community"}:
        return "high"

    return "medium"


def derive_completeness_score(event_data: dict[str, Any]) -> int:
    """Weighted completeness score from 0-100."""
    score = 0
    if event_data.get("title"):
        score += 10
    if event_data.get("start_date"):
        score += 10
    if event_data.get("source_url"):
        score += 10
    if event_data.get("venue_id") or event_data.get("venue_name"):
        score += 10
    if event_data.get("description"):
        score += 10
    if event_data.get("start_time"):
        score += 5
    if event_data.get("category"):
        score += 5
    if event_data.get("tags"):
        score += 5
    if event_data.get("image_url"):
        score += 10
    if event_data.get("ticket_url"):
        score += 10
    if event_data.get("price_min") is not None or event_data.get("price_max") is not None:
        score += 5
    if event_data.get("age_policy"):
        score += 5
    if event_data.get("is_free") is not None:
        score += 5
    return min(score, 100)


def derive_quality_score(
    *,
    completeness_score: int,
    source_reliability: str,
    freshness_tier: str,
) -> int:
    reliability_score = {"high": 100, "medium": 70, "low": 40}.get(source_reliability, 60)
    freshness_score = {
        "imminent": 100,
        "upcoming": 85,
        "long_range": 70,
        "stale_past": 25,
        "unknown": 50,
    }.get(freshness_tier, 50)

    score = (completeness_score * 0.45) + (reliability_score * 0.35) + (freshness_score * 0.20)
    return int(round(score))


def derive_capability_snapshot(
    event_data: dict[str, Any],
    *,
    source_info: Optional[dict] = None,
    now: Optional[datetime] = None,
) -> dict[str, Any]:
    """Derive normalized planning + quality metadata for one event."""
    registration_status = normalize_registration_status(
        ticket_status=event_data.get("ticket_status"),
        title=event_data.get("title"),
        description=event_data.get("description"),
        price_note=event_data.get("price_note"),
        tags=event_data.get("tags"),
        has_ticket_url=bool(event_data.get("ticket_url")),
        is_free=event_data.get("is_free"),
    )

    age = extract_age_range(
        age_policy=event_data.get("age_policy"),
        title=event_data.get("title"),
        description=event_data.get("description"),
        tags=event_data.get("tags"),
    )
    schedule_bucket = derive_schedule_bucket(
        event_data.get("start_time"),
        event_data.get("is_all_day"),
    )
    price_band = derive_price_band(
        is_free=event_data.get("is_free"),
        price_min=event_data.get("price_min"),
        price_max=event_data.get("price_max"),
        price_note=event_data.get("price_note"),
    )
    freshness = derive_freshness(event_data.get("start_date"), now=now)
    source_reliability = derive_source_reliability(source_info)
    completeness_score = derive_completeness_score(event_data)
    quality_score = derive_quality_score(
        completeness_score=completeness_score,
        source_reliability=source_reliability,
        freshness_tier=freshness["freshness_tier"],
    )

    return {
        "version": "capability-v1",
        "registration_status": registration_status,
        "age_min": age["age_min"],
        "age_max": age["age_max"],
        "age_band": age["age_band"],
        "schedule_bucket": schedule_bucket,
        "price_band": price_band,
        "freshness_tier": freshness["freshness_tier"],
        "days_until_start": freshness["days_until_start"],
        "source_reliability": source_reliability,
        "completeness_score": completeness_score,
        "quality_score": quality_score,
    }


def attach_capability_metadata(
    event_data: dict[str, Any],
    snapshot: dict[str, Any],
    *,
    source_info: Optional[dict] = None,
    derived_at: Optional[datetime] = None,
) -> None:
    """Attach capability metadata into JSON columns before event insert."""
    provenance = event_data.get("field_provenance")
    if not isinstance(provenance, dict):
        provenance = {}

    confidence = event_data.get("field_confidence")
    if not isinstance(confidence, dict):
        confidence = {}

    derived = derived_at or datetime.utcnow()
    provenance["capabilities"] = {
        "version": snapshot.get("version"),
        "derived_at": derived.isoformat(),
        "source_slug": (source_info or {}).get("slug"),
        "source_url": (source_info or {}).get("url"),
    }
    confidence["capabilities"] = snapshot

    event_data["field_provenance"] = provenance
    event_data["field_confidence"] = confidence
