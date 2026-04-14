"""Backfill screening_titles with TMDB metadata (director, runtime, rating, genres).

Uses the TMDB API to search by canonical_title + year, then fetches movie details
including credits. Updates screening_titles rows that are missing metadata.

Usage:
    python3 scripts/backfill_screening_metadata.py [--dry-run] [--limit N]
"""

import argparse
import logging
import os
import sys
import time
from typing import Optional

import requests

# Add parent dir to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from db.client import get_client

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

TMDB_BASE = "https://api.themoviedb.org/3"
TMDB_API_KEY = os.environ.get("TMDB_API_KEY") or "a44c879063f1312e1530e976daa9480e"
RATE_LIMIT_SECONDS = 0.25  # TMDB allows 40 req/10s


def search_tmdb(title: str, year: Optional[int] = None) -> Optional[dict]:
    """Search TMDB for a movie by title, optionally filtering by year."""
    params = {
        "api_key": TMDB_API_KEY,
        "query": title,
        "include_adult": "false",
        "language": "en-US",
    }
    if year:
        params["year"] = str(year)

    try:
        resp = requests.get(f"{TMDB_BASE}/search/movie", params=params, timeout=8)
        resp.raise_for_status()
        results = resp.json().get("results", [])
        if results:
            return results[0]  # Best match
    except Exception as e:
        logger.debug("TMDB search failed for '%s': %s", title, e)
    return None


def get_tmdb_details(tmdb_id: int) -> Optional[dict]:
    """Fetch full movie details + credits from TMDB."""
    params = {
        "api_key": TMDB_API_KEY,
        "append_to_response": "credits,release_dates",
    }
    try:
        resp = requests.get(f"{TMDB_BASE}/movie/{tmdb_id}", params=params, timeout=8)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        logger.debug("TMDB details failed for %d: %s", tmdb_id, e)
    return None


def extract_mpaa_rating(release_dates: dict) -> Optional[str]:
    """Extract US MPAA rating from TMDB release_dates response."""
    for country in release_dates.get("results", []):
        if country.get("iso_3166_1") == "US":
            for rd in country.get("release_dates", []):
                cert = rd.get("certification")
                if cert and cert in ("G", "PG", "PG-13", "R", "NC-17", "NR"):
                    return cert
    return None


def extract_director(credits: dict) -> Optional[str]:
    """Extract director name from TMDB credits."""
    for crew in credits.get("crew", []):
        if crew.get("job") == "Director":
            return crew.get("name")
    return None


def clean_title(canonical_title: str) -> str:
    """Clean a screening title for TMDB search."""
    title = canonical_title
    # Remove common suffixes
    for suffix in [
        "(35mm)", "(4K)", "(35mm/", "(Digital)", "(DCP)",
        "- Early Access", "- 4/15 Early Access",
    ]:
        title = title.replace(suffix, "")
    # Remove "Plazadrome:", "Plazamania:", "Soul Cinema Sunday:" prefixes
    for prefix in ["Plazadrome:", "Plazamania:", "Soul Cinema Sunday:", "Behind The Slate:", "Reel Friends:"]:
        if title.startswith(prefix):
            title = title[len(prefix):]
    return title.strip()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Don't write to DB")
    parser.add_argument("--limit", type=int, default=500, help="Max titles to process")
    args = parser.parse_args()

    sb = get_client()

    # Get screening_titles missing metadata
    res = sb.table("screening_titles").select(
        "id, canonical_title, year, tmdb_id, director, runtime_minutes, rating"
    ).is_("director", "null").limit(args.limit).execute()

    titles = res.data or []
    logger.info("Found %d screening_titles needing metadata", len(titles))

    enriched = 0
    not_found = 0
    already_done = 0

    for t in titles:
        canonical = t.get("canonical_title", "")
        if not canonical or len(canonical) < 2:
            continue

        # Skip non-film entries (conversations, panels, etc.)
        skip_patterns = ["conversation with", "q&a", "panel:", "workshop:", "masterclass"]
        if any(p in canonical.lower() for p in skip_patterns):
            not_found += 1
            continue

        clean = clean_title(canonical)
        year = t.get("year")
        tmdb_id = t.get("tmdb_id")

        # Search TMDB if we don't have a tmdb_id
        if not tmdb_id:
            result = search_tmdb(clean, year)
            time.sleep(RATE_LIMIT_SECONDS)
            if not result:
                # Try without year
                if year:
                    result = search_tmdb(clean)
                    time.sleep(RATE_LIMIT_SECONDS)
            if result:
                tmdb_id = result["id"]
            else:
                logger.debug("Not found on TMDB: %s (%s)", clean, year)
                not_found += 1
                continue

        # Fetch full details
        details = get_tmdb_details(tmdb_id)
        time.sleep(RATE_LIMIT_SECONDS)
        if not details:
            not_found += 1
            continue

        director = extract_director(details.get("credits", {}))
        runtime = details.get("runtime")
        rating = extract_mpaa_rating(details.get("release_dates", {}))
        tmdb_year = int(details["release_date"].split("-")[0]) if details.get("release_date") else None
        genres = [g["name"].lower() for g in details.get("genres", [])]
        poster = details.get("poster_path")
        poster_url = f"https://image.tmdb.org/t/p/w500{poster}" if poster else None

        updates = {}
        if director:
            updates["director"] = director
        if runtime and runtime > 0:
            updates["runtime_minutes"] = runtime
        if rating:
            updates["rating"] = rating
        if tmdb_year and not t.get("year"):
            updates["year"] = tmdb_year
        if genres:
            updates["genres"] = genres
        if tmdb_id and not t.get("tmdb_id"):
            updates["tmdb_id"] = tmdb_id
        if poster_url and not t.get("poster_image_url"):
            updates["poster_image_url"] = poster_url

        if not updates:
            not_found += 1
            continue

        if args.dry_run:
            logger.info("[DRY RUN] %s → %s", canonical, list(updates.keys()))
        else:
            sb.table("screening_titles").update(updates).eq("id", t["id"]).execute()
            logger.info("Enriched: %s → dir=%s, runtime=%s, rating=%s", canonical, director, runtime, rating)

        enriched += 1

    logger.info("Done: %d enriched, %d not found, %d already done", enriched, not_found, already_done)


if __name__ == "__main__":
    main()
