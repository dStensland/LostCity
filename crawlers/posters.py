"""
Movie poster and metadata fetching utility for film events.
Fetches posters and metadata from OMDb, with Wikidata fallback.
"""

from __future__ import annotations

import re
import logging
import requests
from typing import Optional
from dataclasses import dataclass

from config import get_config

logger = logging.getLogger(__name__)

# Cache to avoid duplicate API calls in the same session
_poster_cache: dict[str, Optional[str]] = {}
_FILM_INSTANCE_IDS = {"Q11424", "Q24869"}


@dataclass
class FilmMetadata:
    """Film metadata for a matched movie."""

    title: str
    poster_url: str | None = None
    director: str | None = None
    runtime_minutes: int | None = None
    year: int | None = None
    rating: str | None = None  # "PG-13", "R"
    imdb_id: str | None = None
    genres: list[str] | None = None  # ["drama", "thriller"]
    plot: str | None = None  # -> series.description
    source: str | None = None  # "omdb" | "wikidata"


_metadata_cache: dict[str, Optional[FilmMetadata]] = {}


def extract_film_info(title: str) -> tuple[Optional[str], Optional[str]]:
    """
    Extract film title and year from an event title.

    Examples:
        "WeWatchStuff: Paper Moon (1973)" -> ("Paper Moon", "1973")
        "Plaza Theatre: Blade Runner (1982) - Director's Cut" -> ("Blade Runner", "1982")
        "The Godfather (1972)" -> ("The Godfather", "1972")
        "Movie Night: Jaws" -> ("Jaws", None)
        "Casablanca" -> ("Casablanca", None)

    Returns:
        Tuple of (film_title, year) - year may be None
    """
    prefixes_to_remove = [
        r"^WeWatchStuff:\s*",
        r"^Plaza Theatre:\s*",
        r"^Tara Theatre:\s*",
        r"^Landmark[^:]*:\s*",
        r"^Movie Night:\s*",
        r"^Film Screening:\s*",
        r"^[A-Z][a-z]+ Film Festival[^:]*:\s*",
        r"^Atlanta Film Festival[^:]*:\s*",
        r"^Classic Film:\s*",
        r"^Special Screening:\s*",
    ]

    cleaned = title
    for prefix in prefixes_to_remove:
        cleaned = re.sub(prefix, "", cleaned, flags=re.IGNORECASE)

    cleaned = re.sub(
        r"\s*\((?:2K|4K|35MM|70MM|Digital|DCP|Restored|New Restoration)\)\s*",
        " ",
        cleaned,
        flags=re.IGNORECASE,
    )
    cleaned = re.sub(
        r"\s*\((?:\d+)(?:mm|k)\s*(?:\+\s*Digital)?\)\s*",
        " ",
        cleaned,
        flags=re.IGNORECASE,
    )

    year_match = re.search(r"\((\d{4})\)", cleaned)
    year = year_match.group(1) if year_match else None

    if year_match:
        film_title = cleaned[: year_match.start()].strip()
    else:
        film_title = re.sub(
            r"\s*[-–—]\s*(Director's Cut|Extended|Remastered|Anniversary|Special).*$",
            "",
            cleaned,
            flags=re.IGNORECASE,
        )
        film_title = film_title.strip()

    film_title = re.sub(r"\s+", " ", film_title).strip()
    if not film_title or len(film_title) < 2:
        return None, None

    return film_title, year


def _parse_runtime(runtime_str: str | None) -> int | None:
    """Parse OMDb runtime string like '148 min' to integer minutes."""
    if not runtime_str or runtime_str == "N/A":
        return None
    match = re.match(r"(\d+)", runtime_str)
    return int(match.group(1)) if match else None


def _parse_genres(genre_str: str | None) -> list[str] | None:
    """Parse OMDb genre string like 'Drama, Sci-Fi' to lowercase list."""
    if not genre_str or genre_str == "N/A":
        return None
    return [g.strip().lower() for g in genre_str.split(",") if g.strip()]


def _clean_na(value: str | None) -> str | None:
    """Return None if OMDb value is 'N/A'."""
    if not value or value == "N/A":
        return None
    return value


def _normalize_title_for_match(value: str | None) -> str:
    if not value:
        return ""
    cleaned = re.sub(r"[^a-z0-9]+", " ", value.lower())
    return re.sub(r"\s+", " ", cleaned).strip()


def _parse_year_int(value: str | None) -> int | None:
    if not value:
        return None
    match = re.match(r"(\d{4})", value)
    return int(match.group(1)) if match else None


def _build_wikidata_queries(title: str) -> list[str]:
    """Build ranked title variants to improve film matching on noisy event titles."""
    base = re.sub(r"\s+", " ", (title or "").strip())
    if not base:
        return []

    variants: list[str] = [base]

    if ":" in base:
        variants.append(base.split(":", 1)[1].strip())
    if "~" in base:
        variants.append(base.split("~", 1)[1].strip())
    if " + " in base:
        variants.append(base.split(" + ", 1)[0].strip())

    cleaned = base
    cleaned = re.sub(r"\s+w/\s+.*$", "", cleaned, flags=re.IGNORECASE).strip()
    cleaned = re.sub(r"\s+@\s+.*$", "", cleaned).strip()
    cleaned = re.split(r"\s+[—-]\s+", cleaned, maxsplit=1)[0].strip()
    variants.append(cleaned)

    unique: list[str] = []
    for variant in variants:
        candidate = re.sub(r"\s+", " ", variant).strip()
        if len(candidate) < 2:
            continue
        if candidate not in unique:
            unique.append(candidate)
    return unique[:4]


def _wikidata_headers() -> dict[str, str]:
    user_agent = "LostCity/1.0 (https://lostcity.ai; events@lostcity.ai)"
    try:
        cfg = get_config()
        crawler_cfg = getattr(cfg, "crawler", None)
        configured_user_agent = getattr(crawler_cfg, "user_agent", None)
        if configured_user_agent:
            user_agent = configured_user_agent
    except Exception:
        pass
    return {"User-Agent": user_agent}


def _extract_wikidata_claim_string(claims: dict, property_id: str) -> str | None:
    for claim in claims.get(property_id, []):
        mainsnak = claim.get("mainsnak") or {}
        datavalue = mainsnak.get("datavalue") or {}
        value = datavalue.get("value")
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _extract_wikidata_claim_entity_ids(claims: dict, property_id: str) -> list[str]:
    ids: list[str] = []
    for claim in claims.get(property_id, []):
        mainsnak = claim.get("mainsnak") or {}
        datavalue = mainsnak.get("datavalue") or {}
        value = datavalue.get("value")
        if isinstance(value, dict):
            entity_id = (value.get("id") or "").strip()
            if entity_id and entity_id not in ids:
                ids.append(entity_id)
    return ids


def _extract_wikidata_year(claims: dict) -> int | None:
    for claim in claims.get("P577", []):
        mainsnak = claim.get("mainsnak") or {}
        datavalue = mainsnak.get("datavalue") or {}
        value = datavalue.get("value") or {}
        time_value = value.get("time")
        if isinstance(time_value, str):
            match = re.match(r"[+-]?(\d{4})-", time_value)
            if match:
                return int(match.group(1))
    return None


def _is_likely_film_entity(entity: dict) -> bool:
    descriptions = entity.get("descriptions") or {}
    for lang in ("en", "en-gb", "en-us"):
        description = (descriptions.get(lang) or {}).get("value", "")
        desc_lower = description.lower()
        if "film" in desc_lower or "movie" in desc_lower:
            return True
    claims = entity.get("claims") or {}
    instance_ids = set(_extract_wikidata_claim_entity_ids(claims, "P31"))
    return bool(instance_ids & _FILM_INSTANCE_IDS)


def _score_wikidata_candidate(entity: dict, query_title: str, query_year: Optional[str]) -> float:
    label = ((entity.get("labels") or {}).get("en") or {}).get("value", "")
    normalized_query = _normalize_title_for_match(query_title)
    normalized_label = _normalize_title_for_match(label)

    score = 0.0
    if normalized_label == normalized_query and normalized_label:
        score += 8.0
    elif normalized_query and normalized_query in normalized_label:
        score += 4.0
    elif normalized_label and normalized_label in normalized_query:
        score += 2.0

    if _is_likely_film_entity(entity):
        score += 3.0

    claims = entity.get("claims") or {}
    candidate_year = _extract_wikidata_year(claims)
    query_year_int = int(query_year) if query_year and query_year.isdigit() else None
    if query_year_int and candidate_year:
        if candidate_year == query_year_int:
            score += 4.0
        elif abs(candidate_year - query_year_int) == 1:
            score += 1.0

    if _extract_wikidata_claim_string(claims, "P345"):
        score += 1.0
    if _extract_wikidata_claim_entity_ids(claims, "P136"):
        score += 1.0

    return score


def _fetch_wikidata_labels(entity_ids: list[str]) -> dict[str, str]:
    if not entity_ids:
        return {}
    response = requests.get(
        "https://www.wikidata.org/w/api.php",
        params={
            "action": "wbgetentities",
            "format": "json",
            "ids": "|".join(entity_ids),
            "props": "labels",
            "languages": "en",
        },
        headers=_wikidata_headers(),
        timeout=10,
    )
    if response.status_code != 200:
        return {}
    payload = response.json() or {}
    entities = payload.get("entities") or {}
    labels: dict[str, str] = {}
    for entity_id, entity_data in entities.items():
        label = ((entity_data.get("labels") or {}).get("en") or {}).get("value")
        if label:
            labels[entity_id] = label.strip()
    return labels


def _fetch_from_omdb(title: str, year: Optional[str]) -> Optional[FilmMetadata]:
    api_key = get_config().api.omdb_api_key
    search_query = title.replace(" ", "+")
    if year:
        omdb_url = f"https://www.omdbapi.com/?t={search_query}&y={year}&plot=full&apikey={api_key}"
    else:
        omdb_url = f"https://www.omdbapi.com/?t={search_query}&plot=full&apikey={api_key}"

    response = requests.get(omdb_url, timeout=10)
    if response.status_code != 200:
        return None

    data = response.json()
    if data.get("Response") != "True":
        return None

    return FilmMetadata(
        title=data.get("Title", title),
        poster_url=_clean_na(data.get("Poster")),
        director=_clean_na(data.get("Director")),
        runtime_minutes=_parse_runtime(data.get("Runtime")),
        year=_parse_year_int(_clean_na(data.get("Year"))),
        rating=_clean_na(data.get("Rated")),
        imdb_id=_clean_na(data.get("imdbID")),
        genres=_parse_genres(data.get("Genre")),
        plot=_clean_na(data.get("Plot")),
        source="omdb",
    )


def _fetch_from_wikidata(title: str, year: Optional[str]) -> Optional[FilmMetadata]:
    queries = _build_wikidata_queries(title)
    if not queries:
        return None

    candidate_ids: list[str] = []
    query_rank: dict[str, int] = {}

    for query_index, query in enumerate(queries):
        search_response = requests.get(
            "https://www.wikidata.org/w/api.php",
            params={
                "action": "wbsearchentities",
                "format": "json",
                "language": "en",
                "type": "item",
                "limit": 8,
                "search": query,
            },
            headers=_wikidata_headers(),
            timeout=10,
        )
        if search_response.status_code != 200:
            continue

        search_data = search_response.json() or {}
        search_results = search_data.get("search") or []
        for item in search_results:
            entity_id = item.get("id")
            if not entity_id:
                continue
            if entity_id not in query_rank:
                query_rank[entity_id] = query_index
                candidate_ids.append(entity_id)

    if not candidate_ids:
        return None

    entities_response = requests.get(
        "https://www.wikidata.org/w/api.php",
        params={
            "action": "wbgetentities",
            "format": "json",
            "ids": "|".join(candidate_ids),
            "props": "labels|descriptions|claims",
            "languages": "en",
        },
        headers=_wikidata_headers(),
        timeout=10,
    )
    if entities_response.status_code != 200:
        return None

    entities_payload = entities_response.json() or {}
    entities = entities_payload.get("entities") or {}

    best_entity: dict | None = None
    best_score = -1.0
    for entity_id in candidate_ids:
        entity = entities.get(entity_id)
        if not isinstance(entity, dict):
            continue
        score = max(_score_wikidata_candidate(entity, query, year) for query in queries)
        score -= float(query_rank.get(entity_id, 0)) * 0.4
        if score > best_score:
            best_score = score
            best_entity = entity

    if not best_entity or best_score < 4.0:
        return None

    claims = best_entity.get("claims") or {}
    label = ((best_entity.get("labels") or {}).get("en") or {}).get("value") or title
    release_year = _extract_wikidata_year(claims)
    imdb_id = _extract_wikidata_claim_string(claims, "P345")
    description_text = (
        ((best_entity.get("descriptions") or {}).get("en") or {}).get("value") or ""
    ).lower()

    if imdb_id and not imdb_id.startswith("tt"):
        return None

    genre_ids = _extract_wikidata_claim_entity_ids(claims, "P136")
    genre_labels = _fetch_wikidata_labels(genre_ids)
    genres = [genre_labels[g].lower() for g in genre_ids if genre_labels.get(g)]
    genres = genres or None

    if "film" not in description_text and "movie" not in description_text:
        if not release_year and not (imdb_id and imdb_id.startswith("tt")):
            return None

    return FilmMetadata(
        title=label,
        poster_url=None,
        director=None,
        runtime_minutes=None,
        year=release_year,
        rating=None,
        imdb_id=imdb_id,
        genres=genres,
        plot=None,
        source="wikidata",
    )


def fetch_film_metadata(title: str, year: Optional[str] = None) -> Optional[FilmMetadata]:
    """
    Fetch full film metadata from OMDb, with Wikidata fallback.

    Args:
        title: Movie title
        year: Optional release year to improve search accuracy

    Returns:
        FilmMetadata or None if not found
    """
    cache_key = f"{title}|{year or ''}"
    if cache_key in _metadata_cache:
        return _metadata_cache[cache_key]

    metadata = None
    try:
        metadata = _fetch_from_omdb(title, year)
        if not metadata:
            metadata = _fetch_from_wikidata(title, year)
    except Exception as e:
        logger.debug(f"Error fetching metadata for '{title}': {e}")

    if metadata:
        _poster_cache[cache_key] = metadata.poster_url
    _metadata_cache[cache_key] = metadata
    return metadata


def fetch_movie_poster(title: str, year: Optional[str] = None) -> Optional[str]:
    """
    Fetch movie poster URL from metadata providers (OMDb + Wikidata fallback).
    Delegates to fetch_film_metadata() and returns just the poster URL.
    """
    cache_key = f"{title}|{year or ''}"
    if cache_key in _poster_cache:
        return _poster_cache[cache_key]

    metadata = fetch_film_metadata(title, year)
    if metadata:
        return metadata.poster_url

    _poster_cache[cache_key] = None
    return None


def get_metadata_for_film_event(
    title: str, existing_image: Optional[str] = None
) -> Optional[FilmMetadata]:
    """Get full metadata for a film event."""
    film_title, year = extract_film_info(title)
    if not film_title:
        return None

    metadata = fetch_film_metadata(film_title, year)
    if metadata and existing_image:
        metadata.poster_url = existing_image
    return metadata


def get_poster_for_film_event(
    title: str, existing_image: Optional[str] = None
) -> Optional[str]:
    """Get a poster for a film event if one isn't already provided."""
    if existing_image:
        return existing_image

    film_title, year = extract_film_info(title)
    if film_title:
        return fetch_movie_poster(film_title, year)
    return None


def clear_cache():
    """Clear all caches (useful for testing)."""
    global _poster_cache, _metadata_cache
    _poster_cache = {}
    _metadata_cache = {}
