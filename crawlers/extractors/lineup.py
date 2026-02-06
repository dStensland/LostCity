"""
Helpers for extracting artist lineups from text.
"""

from __future__ import annotations

import re
from typing import Iterable


_PRIMARY_SPLIT_RE = re.compile(
    r"\s+(?:w/|with|feat\.?|ft\.?|featuring|support(?:ing)?|special guests?|openers?|opening)\s+",
    flags=re.IGNORECASE,
)
_SECONDARY_SPLIT_RE = re.compile(r"\s*[,+/|•]\s*")


def _normalize_name(name: str) -> str:
    return " ".join(name.strip().split())


def split_lineup_text(text: str) -> list[str]:
    if not text:
        return []

    cleaned = " ".join(text.split())
    parts: list[str] = []

    # First split on explicit support keywords.
    primary = [p for p in _PRIMARY_SPLIT_RE.split(cleaned) if p]
    for chunk in primary:
        for part in _SECONDARY_SPLIT_RE.split(chunk):
            name = _normalize_name(part)
            if name:
                parts.append(name)

    return parts


def dedupe_artists(artists: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for artist in artists:
        name = _normalize_name(artist)
        if not name:
            continue
        key = name.lower()
        if key in seen:
            continue
        seen.add(key)
        result.append(name)
    return result
