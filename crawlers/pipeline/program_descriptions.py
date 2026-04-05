"""Compact factual description builders for classes, camps, and programs."""

from __future__ import annotations

from typing import Iterable, Optional


def _normalize(value: Optional[str]) -> str:
    return " ".join((value or "").split()).strip(" ,")


def _sentence(value: Optional[str]) -> Optional[str]:
    cleaned = _normalize(value)
    if not cleaned:
        return None
    return f"{cleaned.rstrip('.')}."


def build_program_description(
    title: str,
    *,
    venue_name: Optional[str] = None,
    audience: Optional[str] = None,
    summary: Optional[str] = None,
    facts: Optional[Iterable[Optional[str]]] = None,
) -> Optional[str]:
    """Build compact factual copy for structured program/camp/class rows."""
    title_clean = _normalize(title)
    venue_clean = _normalize(venue_name)
    audience_clean = _normalize(audience)

    if not title_clean:
        return None

    lead = title_clean
    if venue_clean:
        lead = f"{lead} at {venue_clean}"

    parts: list[str] = []
    seen: set[str] = set()

    for sentence in [
        _sentence(lead),
        _sentence(f"For {audience_clean}") if audience_clean else None,
        _sentence(summary),
        *[_sentence(item) for item in (facts or [])],
    ]:
        if not sentence or sentence in seen:
            continue
        seen.add(sentence)
        parts.append(sentence)

    return " ".join(parts) if parts else None
