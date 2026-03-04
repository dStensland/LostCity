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
_SECONDARY_SPLIT_RE = re.compile(r"\s*[/|•]\s*")
_SECONDARY_SUPPORT_SPLIT_RE = re.compile(r"\s*[\+/|•]\s*")
_SECONDARY_COMMA_SPLIT_RE = re.compile(r"\s*,\s*")
_BRACKET_CONTENT_RE = re.compile(r"\s*\[[^\]]*\]\s*")

# Title prefixes where "with" introduces the artist, not a support act.
# "An Evening With Ben Strawn" → headliner is "Ben Strawn", not support.
# Only matches "with", not "of" — "An Evening of Jazz" is a genre descriptor, not an artist.
_EVENING_PREFIX_RE = re.compile(
    r"^(?:an?\s+)?(?:evening|night|afternoon|intimate\s+evening)\s+with\s+",
    flags=re.IGNORECASE,
)


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


def _looks_like_multi_artist_comma_list(chunk: str) -> bool:
    if chunk.count(",") < 2:
        return False
    parts = [_normalize_name(part) for part in _SECONDARY_COMMA_SPLIT_RE.split(chunk)]
    parts = [part for part in parts if part]
    if len(parts) < 3:
        return False
    # Avoid splitting long prose-like segments.
    if any(len(part.split()) > 6 for part in parts):
        return False
    # Require multiple alphabetic segments to avoid numeric/date comma chunks.
    alpha_parts = [part for part in parts if re.search(r"[A-Za-z]", part)]
    return len(alpha_parts) >= 3


def _split_ampersand_coheadliners(chunk: str) -> list[str]:
    """Split 'Artist A & Artist B' into co-headliners when both sides are multi-word.

    Preserves band names like 'Simon & Garfunkel' or 'Mumford & Sons' where
    at least one side is a single word.
    """
    if " & " not in chunk:
        return [chunk]
    parts = [p.strip() for p in chunk.split(" & ")]
    # Only split if ALL parts are multi-word (2+ words each)
    if all(len(p.split()) >= 2 for p in parts) and all(p for p in parts):
        return parts
    return [chunk]


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

    # Strip bracket metadata (e.g. [FREE ENTRY W/ RSVP]) before delimiter matching
    cleaned = _BRACKET_CONTENT_RE.sub(" ", cleaned).strip()
    if not cleaned:
        return []

    # Strip "An Evening With" / "A Night With" prefixes — the "with" here
    # introduces the headliner, not a support act.
    stripped = _EVENING_PREFIX_RE.sub("", cleaned)
    evening_prefix_stripped = stripped != cleaned
    cleaned = stripped.strip()
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
        if role == "headliner" and _looks_like_multi_artist_comma_list(chunk):
            comma_parts = [
                _normalize_name(part)
                for part in _SECONDARY_COMMA_SPLIT_RE.split(chunk)
                if _normalize_name(part)
            ]
            for idx, name in enumerate(comma_parts):
                entries.append(
                    {
                        "name": name,
                        "role": "headliner" if idx == 0 else "support",
                    }
                )
            continue

        split_re = _SECONDARY_SUPPORT_SPLIT_RE if role in {"support", "opener"} else _SECONDARY_SPLIT_RE
        for part in split_re.split(chunk):
            # After "An Evening With" prefix strip, we know the remainder is
            # artist names, so split "Artist A & Artist B" into co-headliners.
            if role == "headliner" and evening_prefix_stripped:
                sub_parts = _split_ampersand_coheadliners(part)
            else:
                sub_parts = [part]
            for sub in sub_parts:
                name = _normalize_name(sub)
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

    # Strip bracket metadata before delimiter matching
    cleaned = _BRACKET_CONTENT_RE.sub(" ", cleaned).strip()
    if not cleaned:
        return []

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
