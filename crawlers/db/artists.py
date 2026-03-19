"""
Artist parsing, sanitization, and event_artists CRUD.
"""

import re
import logging
from typing import Optional

from db.client import (
    get_client,
    writes_enabled,
    _log_write_skip,
)

logger = logging.getLogger(__name__)

# Nightlife genres that never have real performers (participatory events).
_NIGHTLIFE_SKIP_GENRES = {"karaoke", "trivia", "bar-games", "poker", "bingo"}

_GENERIC_EVENT_TITLE_RE = re.compile(
    r"^("
    r"(?:(?:mon|tue|wed|thu|fri|sat|sun)\w*\s+(?:jazz|blues|soul|funk|karaoke|r&b|dj|latin|salsa|country|rock|reggae|hip\s*hop|open\s+mic|brunch|dance|acoustic|comedy|trivia|bingo)(?:\s+(?:night|session|sessions|jam|party|hour|social|series|show|set)s?)?)"
    r"|"
    r"(?:(?:jazz|blues|soul|funk|karaoke|r&b|dj|latin|salsa|country|rock|reggae|hip\s*hop|open\s+mic|comedy|trivia|bingo)\s+(?:mon|tue|wed|thu|fri|sat|sun)\w*(?:\s+(?:night|session|sessions|jam|party|hour|social|series|show|set)s?)?)"
    r"|"
    r"(?:live\s+music(?:\s+(?:mon|tue|wed|thu|fri|sat|sun)\w*)?(?:\s+(?:night|session|sessions|happy\s+hour)s?)?)"
    r"|"
    r"(?:(?:mardi\s+gras|new\s+year'?s?\s+eve|valentine'?s?\s+day|st\.?\s+patrick'?s?\s+day|cinco\s+de\s+mayo|halloween|christmas|nye)\s+(?:party|bash|celebration|event|gala|special|night|show|concert))"
    r"|"
    r"(?:\w+\s+(?:nightclub|lounge|bar|club|tavern|pub)\s+(?:mon|tue|wed|thu|fri|sat|sun)\w*s?)"
    r"|"
    r"(?:(?:ladies|industry|college|singles|vip)\s+night(?:\s+(?:mon|tue|wed|thu|fri|sat|sun)\w*)?)"
    r"|"
    r"(?:(?:happy\s+hour|day\s+party|pool\s+party|brunch\s+party|after\s*party|bottle\s+service)(?:\s+(?:mon|tue|wed|thu|fri|sat|sun)\w*)?)"
    r"|"
    r"(?:(?:karaoke|trivia|bingo|poker\s+night)(?:\s+(?:night|nite|lounge|party))?)"
    r"|"
    r"(?:(?:mon|tue|wed|thu|fri|sat|sun)\w*\s+night(?:\s+(?:djs?|country|two-step|at\s+\w[\w\s]*?))?)"
    r"|"
    r"(?:(?:salsa|bachata|reggaeton|latin|country|emo|goth|punk|drag|r&b|hip\s*hop|dance|rock)\s+(?:night|nite)s?)"
    r")$",
    flags=re.IGNORECASE,
)

_DATE_SUFFIX_RE = re.compile(
    r"\s*[-–—]\s+(?:january|february|march|april|may|june|july|august|"
    r"september|october|november|december)\s+\d{1,2}(?:,?\s+\d{4})?\s*$",
    flags=re.IGNORECASE,
)

_PURE_YEAR_RE = re.compile(r"^(19|20)\d{2}$")
_MONTH_FRAGMENT_RE = re.compile(
    r"^(?:january|february|march|april|may|june|july|august|"
    r"september|october|november|december)(?:\s+\d{1,2})?$",
    flags=re.IGNORECASE,
)

_PARTICIPANT_DESCRIPTOR_RE = re.compile(
    r"(?:\bwith\b|\bw/\b|\bfeat\.?\b|\bfeaturing\b|\bvs\.?\b|\bversus\b|:|\btour\b|\bnight\b|\bopen mic\b)",
    flags=re.IGNORECASE,
)

_PARTICIPANT_BOILERPLATE_RE = re.compile(
    r"(open mic|comedy night|home game|parking|ticket package|item voucher|voucher|presented by|"
    r"premium seating|"
    r"nightclub\s+(?:mon|tue|wed|thu|fri|sat|sun)\w*|"
    r"(?:mon|tue|wed|thu|fri|sat|sun)\w*\s+night\s+party|"
    r"(?:running|book|wine|supper)\s+club|"
    r"ladies\s+night|industry\s+night|bottle\s+service|vip\s+night|"
    r"day\s+party|pool\s+party|brunch\s+party|after\s*party|happy\s+hour|"
    r"\bkaraoke\b|\btrivia\b|\bbingo\b|\bpoker\s+night\b|\bbowling\b|\bcurling\b|"
    r"\bimprov\w*\b|sketch\s+show|"
    r"comedy\s+(?:workshop|showcase)|stand-?up\s+showcase)",
    flags=re.IGNORECASE,
)


def _normalize_participant_text(value: Optional[str]) -> str:
    return re.sub(
        r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", (value or "").lower())
    ).strip()


def _normalize_team_entity(value: Optional[str]) -> str:
    normalized = _normalize_participant_text(value)
    normalized = re.sub(
        r"\b(fc|sc|club|team|women|womens|men|mens|athletics)\b", " ", normalized
    )
    return re.sub(r"\s+", " ", normalized).strip()


def _title_has_participant_descriptors(value: str) -> bool:
    return bool(_PARTICIPANT_DESCRIPTOR_RE.search(value or ""))


def _looks_like_participant_boilerplate(value: str) -> bool:
    return bool(_PARTICIPANT_BOILERPLATE_RE.search(value or ""))


def _clean_team_name(value: str) -> str:
    cleaned = re.sub(r"\s*\([^)]*\)\s*", " ", value or "")
    cleaned = re.sub(
        r"\s*\*\s*(?:premium\s+seating|vip|parking|packages?|tickets?)\s*\*.*$",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )
    cleaned = re.sub(
        r"\s*(?:\||-|–|—)\s*(?:suite|suites|parking|vip|package|packages|tickets?).*$",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )
    cleaned = re.sub(
        r"\s*(?:\||-|–|—)\s*(?:updated date|rescheduled|postponed|cancelled|canceled).*$",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )
    return " ".join(cleaned.split()).strip()


def _parse_sports_teams_from_title(title: Optional[str]) -> list[str]:
    raw = (title or "").strip()
    if not raw:
        return []

    patterns = (
        r"^(?P<a>.+?)\s+(?:vs\.?|v\.?|versus)\s+(?P<b>.+)$",
        r"^(?P<a>.+?)\s+@\s+(?P<b>.+)$",
        r"^(?P<a>.+?)\s+at\s+(?P<b>.+)$",
    )

    for pattern in patterns:
        match = re.match(pattern, raw, flags=re.IGNORECASE)
        if not match:
            continue

        team_a = _clean_team_name(match.group("a"))
        team_b = _clean_team_name(match.group("b"))
        if not team_a or not team_b:
            continue
        if _normalize_participant_text(team_a) == _normalize_participant_text(team_b):
            continue
        return [team_a, team_b]

    return []


def parse_lineup_from_title(title: str) -> list[dict]:
    """Parse artist lineup from event title.

    Returns list of dicts: [{name, role, billing_order, is_headliner}, ...]
    """
    from extractors.lineup import (
        split_lineup_text_with_roles,
        dedupe_artist_entries,
    )
    from artist_images import extract_artist_from_title, _ARTIST_BLOCKLIST

    def _extract_colon_headliner(value: str) -> Optional[str]:
        if ":" not in value:
            return None
        left, right = [segment.strip() for segment in value.split(":", 1)]
        if not left or not right:
            return None
        left_norm = left.lower()
        right_norm = right.lower()

        if re.search(r"\bpresents?\b|\bpresented by\b", left_norm, flags=re.IGNORECASE):
            candidate = right
            if ":" in candidate:
                candidate = candidate.split(":", 1)[0].strip()
        elif re.search(r"\b(tour|experience)\b", right_norm, flags=re.IGNORECASE):
            candidate = left
        elif "show" in left_norm and re.match(r"^(ms\.?|mr\.?|mrs\.?|dj\b|dr\.?\b)", right_norm):
            candidate = right
        elif (
            re.search(r"\b(orchestra|band|ensemble|quartet|trio|choir|show)\b", left_norm)
            and re.search(
                r"\b(and more|our lives|happiest days|celebration|symphony|music|hits|greatest|best)\b",
                right_norm,
            )
        ):
            candidate = left
        else:
            return None

        candidate = " ".join(candidate.split()).strip(" -\u2013\u2014")
        if not candidate:
            return None
        if _looks_like_participant_boilerplate(candidate):
            return None
        if re.search(
            r"\b(session|party|brunch|jam|worship|eucharist|trivia|karaoke|open mic)\b",
            candidate,
            flags=re.IGNORECASE,
        ):
            return None
        return candidate

    cleaned_title = title.strip()
    if _GENERIC_EVENT_TITLE_RE.match(cleaned_title):
        return []

    cleaned_title = _DATE_SUFFIX_RE.sub("", cleaned_title).strip()
    if not cleaned_title:
        return []

    parsed_entries = dedupe_artist_entries(split_lineup_text_with_roles(cleaned_title))

    if len(parsed_entries) == 1:
        only_name = str(parsed_entries[0].get("name") or "").strip()
        headliner = extract_artist_from_title(cleaned_title)
        if (
            headliner
            and _normalize_participant_text(headliner)
            and _normalize_participant_text(headliner) != _normalize_participant_text(only_name)
        ):
            parsed_entries = [{"name": headliner, "role": "headliner"}]
        elif _normalize_participant_text(only_name) == _normalize_participant_text(cleaned_title):
            colon_headliner = _extract_colon_headliner(cleaned_title)
            if colon_headliner:
                parsed_entries = [{"name": colon_headliner, "role": "headliner"}]

    if not parsed_entries:
        colon_headliner = _extract_colon_headliner(cleaned_title)
        if colon_headliner:
            parsed_entries = [{"name": colon_headliner, "role": "headliner"}]

    if not parsed_entries:
        headliner = extract_artist_from_title(cleaned_title)
        if headliner:
            parsed_entries = [{"name": headliner, "role": "headliner"}]

    if not parsed_entries:
        return []

    filtered_entries: list[dict] = []
    normalized_title = _normalize_participant_text(title)
    has_title_descriptors = _title_has_participant_descriptors(title)

    for entry in parsed_entries:
        name = str(entry.get("name") or "").strip()
        if not name:
            continue
        if name.lower() in _ARTIST_BLOCKLIST:
            continue
        if len(name) < 4 and " " not in name:
            token = name.strip().upper()
            if not (
                re.fullmatch(r"[A-Z0-9]{3,4}", token)
                and token not in {"TBA", "TBD", "VIP", "RSVP"}
            ):
                continue
        if _PURE_YEAR_RE.match(name):
            continue
        if _MONTH_FRAGMENT_RE.match(name):
            continue
        if re.search(
            r"\bkaraoke\b|\btrivia\b|\bbingo\b|\bimprov\w*\b", name, re.IGNORECASE
        ):
            continue
        normalized_name = _normalize_participant_text(name)
        is_title_mirror = bool(
            normalized_title and normalized_name and normalized_name == normalized_title
        )
        if is_title_mirror and (len(parsed_entries) > 1 or has_title_descriptors):
            continue
        if _looks_like_participant_boilerplate(name) and (is_title_mirror or has_title_descriptors):
            continue
        filtered_entries.append({"name": name, "role": entry.get("role")})

    if not filtered_entries:
        fallback = extract_artist_from_title(cleaned_title)
        if (
            fallback
            and fallback.lower() not in _ARTIST_BLOCKLIST
            and not _looks_like_participant_boilerplate(fallback)
        ):
            filtered_entries = [{"name": fallback, "role": "headliner"}]
        else:
            return []

    has_explicit_headliner = any(
        str(entry.get("role") or "").lower() == "headliner"
        for entry in filtered_entries
    )

    result: list[dict] = []
    for idx, entry in enumerate(filtered_entries, 1):
        role = str(entry.get("role") or "").lower() or (
            "headliner" if idx == 1 else "support"
        )
        if role not in {"headliner", "support", "opener"}:
            role = "headliner" if idx == 1 else "support"

        is_headliner = role == "headliner"
        if not has_explicit_headliner and idx == 1:
            is_headliner = True
            role = "headliner"

        result.append(
            {
                "name": entry["name"],
                "role": role,
                "billing_order": idx,
                "is_headliner": is_headliner,
            }
        )

    return result


def sanitize_event_artists(
    event_title: Optional[str],
    event_category: Optional[str],
    artists: list,
    pre_parsed: bool = False,
) -> list[dict]:
    """Normalize and de-junk participant rows before inserting into event_artists."""
    title = event_title or ""
    category = (event_category or "").strip().lower()
    title_norm = _normalize_participant_text(title)
    has_descriptors = _title_has_participant_descriptors(title)

    raw_cleaned: list[dict] = []
    seen: set[str] = set()
    for idx, entry in enumerate(artists, start=1):
        if isinstance(entry, dict):
            name = entry.get("name")
            role = entry.get("role")
            billing_order = entry.get("billing_order") or entry.get("order") or idx
            is_headliner = entry.get("is_headliner")
        else:
            name = entry
            role = None
            billing_order = idx
            is_headliner = None

        normalized_name = " ".join(str(name or "").split())
        if not normalized_name:
            continue

        key = normalized_name.lower()
        if key in seen:
            continue
        seen.add(key)

        raw_cleaned.append(
            {
                "name": normalized_name,
                "role": role,
                "billing_order": billing_order,
                "is_headliner": is_headliner if is_headliner is not None else None,
            }
        )

    if not raw_cleaned and category not in {"music", "comedy", "nightlife", "sports"}:
        return []

    raw_cleaned.sort(
        key=lambda item: (
            (
                item.get("billing_order")
                if item.get("billing_order") is not None
                else 10_000
            ),
            _normalize_participant_text(item.get("name")),
        )
    )

    filtered: list[dict] = []
    for row in raw_cleaned:
        name = row["name"]
        name_norm = _normalize_participant_text(name)
        if not name_norm:
            continue

        is_title_mirror = bool(title_norm and name_norm == title_norm)
        has_alt_name_in_title = any(
            _normalize_participant_text(other["name"])
            not in ("", name_norm, title_norm)
            and _normalize_participant_text(other["name"]) in title_norm
            for other in raw_cleaned
        )

        if _looks_like_participant_boilerplate(name) and (
            is_title_mirror or has_descriptors or category == "sports"
        ):
            continue

        if is_title_mirror and (
            has_descriptors
            or _looks_like_participant_boilerplate(name)
            or has_alt_name_in_title
        ):
            continue

        if category == "sports" and re.search(
            r"(home game|suites?|parking|ticket package|vip|presented by|premium seating)",
            name,
            flags=re.IGNORECASE,
        ):
            continue

        filtered.append(row)

    if category == "sports":
        parsed_teams = _parse_sports_teams_from_title(title)
        parsed_team_norms = {_normalize_team_entity(team) for team in parsed_teams}
        if parsed_team_norms:
            filtered = [
                row
                for row in filtered
                if _normalize_team_entity(row["name"]) in parsed_team_norms
            ]
        else:
            filtered = [
                row
                for row in filtered
                if _normalize_participant_text(row["name"]) != title_norm
                and not _looks_like_participant_boilerplate(row["name"])
            ]

        existing = {_normalize_team_entity(row["name"]) for row in filtered}
        for idx, team in enumerate(parsed_teams, start=1):
            norm_team = _normalize_team_entity(team)
            if not norm_team or norm_team in existing:
                continue
            existing.add(norm_team)
            filtered.append(
                {
                    "name": team,
                    "role": "home" if idx == 1 else "away",
                    "billing_order": idx,
                    "is_headliner": idx == 1,
                }
            )

    if not pre_parsed and category in {"music", "comedy", "nightlife"} and len(filtered) == 1:
        only_name_norm = _normalize_participant_text(filtered[0].get("name"))
        if only_name_norm and only_name_norm == title_norm:
            reparsed = parse_lineup_from_title(title)
            if len(reparsed) > 1:
                filtered = [
                    {
                        "name": str(item.get("name") or "").strip(),
                        "role": item.get("role"),
                        "billing_order": item.get("billing_order"),
                        "is_headliner": item.get("is_headliner"),
                    }
                    for item in reparsed
                    if str(item.get("name") or "").strip()
                ]

    if not pre_parsed and not filtered and category in {"music", "comedy", "nightlife"}:
        filtered = parse_lineup_from_title(title)

    if not filtered:
        return []

    if category in {"music", "comedy", "nightlife"}:
        from extractors.lineup import _looks_like_band_with_ampersand

        expanded: list[dict] = []
        for row in filtered:
            name = row["name"]
            if " & " in name:
                # "X & the Y" is almost always a single band
                if _looks_like_band_with_ampersand(name):
                    expanded.append(row)
                    continue
                parts = [p.strip() for p in name.split(" & ")]
                if all(len(p.split()) >= 2 for p in parts) and all(parts):
                    from artists import slugify_artist, get_artist_by_slug

                    slug = slugify_artist(name)
                    existing = get_artist_by_slug(slug) if slug else None
                    is_verified = existing and any(
                        existing.get(k)
                        for k in ("spotify_id", "musicbrainz_id", "deezer_id", "bio")
                    )
                    if not is_verified:
                        for part in parts:
                            expanded.append({**row, "name": part})
                        continue
            expanded.append(row)
        filtered = expanded

    result: list[dict] = []
    has_explicit_headliner = any(
        str(item.get("role") or "").lower() in {"headliner", "home"}
        or bool(item.get("is_headliner"))
        for item in filtered
    )

    filtered.sort(
        key=lambda item: (
            (
                item.get("billing_order")
                if item.get("billing_order") is not None
                else 10_000
            ),
            _normalize_participant_text(item.get("name")),
        )
    )

    for idx, item in enumerate(filtered, start=1):
        role_value = str(item.get("role") or "").strip().lower()
        if not role_value:
            if category == "sports":
                role_value = "home" if idx == 1 else "away"
            else:
                role_value = "headliner" if idx == 1 else "support"

        is_headliner = item.get("is_headliner")
        if is_headliner is None:
            is_headliner = role_value in {"headliner", "home"}
        if not has_explicit_headliner and idx == 1:
            is_headliner = True
            if category != "sports":
                role_value = "headliner"

        result.append(
            {
                "name": item["name"],
                "role": role_value,
                "billing_order": idx,
                "is_headliner": bool(is_headliner),
            }
        )

    return result


def upsert_event_artists(
    event_id: int, artists: list, link_canonical: bool = True, pre_parsed: bool = False,
) -> None:
    """Replace event artists for an event, preserving billing order."""
    if not artists:
        return
    if not writes_enabled():
        _log_write_skip(f"upsert event_artists event_id={event_id}")
        return

    client = get_client()
    event_row = (
        client.table("events")
        .select("title, category_id")
        .eq("id", event_id)
        .maybe_single()
        .execute()
    ).data or {}
    event_title = event_row.get("title")
    event_category = event_row.get("category_id")

    cleaned = sanitize_event_artists(event_title, event_category, artists, pre_parsed=pre_parsed)

    client.table("event_artists").delete().eq("event_id", event_id).execute()

    if not cleaned:
        return

    payload = []
    for item in cleaned:
        payload.append(
            {
                "event_id": event_id,
                "name": item["name"],
                "role": item.get("role"),
                "billing_order": item.get("billing_order"),
                "is_headliner": item.get("is_headliner"),
            }
        )

    client.table("event_artists").insert(payload).execute()

    if link_canonical:
        try:
            from artists import resolve_and_link_event_artists

            resolve_and_link_event_artists(event_id, category=event_category)
        except Exception as e:
            logger.warning(f"Artist resolution failed for event {event_id}: {e}")
