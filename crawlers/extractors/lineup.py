"""
Helpers for extracting artist lineups from text.
"""

from __future__ import annotations

import re
from typing import Iterable, Optional


_PRIMARY_SPLIT_RE = re.compile(
    r"\s+(?:w/|with|feat\.?|ft\.?|featuring|support(?:ing)?|special guests?|openers?|opening)\s+",
    flags=re.IGNORECASE,
)
_PRIMARY_WITH_GROUP_RE = re.compile(
    r"\s+(w/|with|feat\.?|ft\.?|featuring|support(?:ing)?|special guests?|openers?|opening)\s+",
    flags=re.IGNORECASE,
)
_SECONDARY_SPLIT_RE = re.compile(r"\s*[,+/|•]\s*")


def _normalize_name(name: str) -> str:
    return " ".join(name.strip().split())


def normalize_artist_role(role: Optional[str]) -> Optional[str]:
    if not role:
        return None
    normalized = role.strip().lower()
    if not normalized:
        return None
    if normalized in {"headliner", "headline", "main", "main-act"}:
        return "headliner"
    if normalized in {"support", "supporting", "guest", "featured"}:
        return "support"
    if normalized in {"opener", "opening", "openers"}:
        return "opener"
    return None


def _role_from_keyword(keyword: str | None) -> str:
    token = (keyword or "").strip().lower()
    if token in {"openers", "opener", "opening"}:
        return "opener"
    if token in {"w/", "with", "feat.", "feat", "ft.", "ft", "featuring", "support", "supporting", "special guests"}:
        return "support"
    return "headliner"


def split_lineup_text_with_roles(text: str) -> list[dict[str, str]]:
    """Split lineup text into artist entries with inferred role.

    Returns:
        [{"name": "Headliner", "role": "headliner"}, {"name": "Support", "role": "support"}]
    """
    if not text:
        return []

    cleaned = " ".join(text.split())
    if not cleaned:
        return []

    segments: list[tuple[str, str]] = []
    cursor = 0
    current_role = "headliner"

    for match in _PRIMARY_WITH_GROUP_RE.finditer(cleaned):
        chunk = cleaned[cursor:match.start()].strip()
        if chunk:
            segments.append((chunk, current_role))
        current_role = _role_from_keyword(match.group(1))
        cursor = match.end()

    tail = cleaned[cursor:].strip()
    if tail:
        segments.append((tail, current_role))

    if not segments:
        segments = [(cleaned, "headliner")]

    entries: list[dict[str, str]] = []
    for chunk, role in segments:
        for part in _SECONDARY_SPLIT_RE.split(chunk):
            name = _normalize_name(part)
            if name:
                entries.append({"name": name, "role": role})

    # Guarantee at least one headliner.
    if entries and not any(e.get("role") == "headliner" for e in entries):
        entries[0]["role"] = "headliner"

    return entries


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


def dedupe_artist_entries(entries: Iterable[dict | str]) -> list[dict[str, str]]:
    """Dedupe artist entries while preserving order and strongest role signal."""
    seen_index: dict[str, int] = {}
    deduped: list[dict[str, str]] = []
    role_priority = {"headliner": 3, "opener": 2, "support": 1}

    for entry in entries:
        if isinstance(entry, dict):
            raw_name = entry.get("name")
            raw_role = entry.get("role")
        else:
            raw_name = entry
            raw_role = None

        name = _normalize_name(str(raw_name or ""))
        if not name:
            continue

        role = normalize_artist_role(str(raw_role) if raw_role is not None else None) or "support"
        key = name.lower()

        if key in seen_index:
            idx = seen_index[key]
            existing = deduped[idx]
            existing_role = normalize_artist_role(existing.get("role")) or "support"
            if role_priority.get(role, 0) > role_priority.get(existing_role, 0):
                existing["role"] = role
            continue

        seen_index[key] = len(deduped)
        deduped.append({"name": name, "role": role})

    if deduped and not any(e.get("role") == "headliner" for e in deduped):
        deduped[0]["role"] = "headliner"

    return deduped


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
