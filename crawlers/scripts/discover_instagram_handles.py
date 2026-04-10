#!/usr/bin/env python3
"""
Automated Instagram handle discovery for venues missing them.

Searches DuckDuckGo for each venue's Instagram profile, validates the handle
against the Instagram profile page, and optionally writes the result to
places.instagram.

Usage:
    cd crawlers && python3 -m scripts.discover_instagram_handles --venue-type bar --limit 50 --dry-run
    cd crawlers && python3 -m scripts.discover_instagram_handles --venue-type nightclub --limit 38 --dry-run
    cd crawlers && python3 -m scripts.discover_instagram_handles --venue-type bar --limit 50
"""

from __future__ import annotations

import argparse
import logging
import re
import sys
import time
from pathlib import Path
from typing import Optional
from urllib.parse import quote_plus

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from db.client import get_client

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

SEARCH_DELAY = 3.0  # seconds between DuckDuckGo requests
INSTAGRAM_FETCH_DELAY = 1.5  # seconds between Instagram profile requests
REQUEST_TIMEOUT = 15

# Handles that belong to aggregators / media orgs, not individual venues
BLOCKLIST_HANDLES = {
    "discoveratlanta",
    "atlantamagazine",
    "eateryatl",
    "atlnightlife",
    "atlbars",
    "atlantarestaurants",
    "thrillist",
    "yelp",
    "zagat",
    "eater",
    "eateratl",
    "atlanta",
    "atlantaga",
    "visitatlanta",
    "accessatlanta",
    "creativeloafing",
    "clatl",
    "punchbowlsocial",
    "timeout",
    "timeoutatlanta",
}

# A valid Instagram handle: 1–30 alphanumeric/underscore/period characters
_HANDLE_RE = re.compile(r"^[\w][\w.]{0,29}$", re.ASCII)

# Pattern to find instagram.com/<handle> in text / HTML
_IG_URL_RE = re.compile(
    r"instagram\.com/([A-Za-z0-9_][A-Za-z0-9_.]{0,28}[A-Za-z0-9_]?)/?",
)

# Instagram paths that are not user handles
_IG_NON_USER_PATHS = {
    "p",
    "reel",
    "reels",
    "stories",
    "explore",
    "accounts",
    "tv",
    "share",
    "tags",
    "about",
    "privacy",
    "legal",
    "help",
    "blog",
    "press",
    "api",
    "oauth",
}

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)


# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------


def get_venues_missing_instagram(
    venue_type: Optional[str] = None,
    venue_ids: Optional[list[int]] = None,
    limit: int = 100,
) -> list[dict]:
    """Return places rows that have no Instagram handle set."""
    client = get_client()

    query = (
        client.table("places")
        .select(
            "id, name, slug, place_type, address, neighborhood, city, website, instagram"
        )
        .is_("instagram", "null")
        .neq("is_active", False)
        .eq("city", "Atlanta")
    )

    if venue_ids:
        query = query.in_("id", venue_ids)
    elif venue_type:
        query = query.eq("place_type", venue_type)

    result = query.order("name").limit(limit).execute()
    return result.data or []


def update_instagram_handle(venue_id: int, handle: str, dry_run: bool = True) -> None:
    """Write the handle to places.instagram (stripped of @ prefix)."""
    clean = handle.lstrip("@")
    if dry_run:
        return
    client = get_client()
    client.table("places").update({"instagram": clean}).eq("id", venue_id).execute()


# ---------------------------------------------------------------------------
# Search
# ---------------------------------------------------------------------------


def _search_duckduckgo(query: str, session: requests.Session) -> str:
    """
    Run a DuckDuckGo HTML search and return the raw result HTML.
    Returns empty string on failure.
    """
    url = f"https://html.duckduckgo.com/html/?q={quote_plus(query)}"
    try:
        resp = session.get(url, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        return resp.text
    except requests.RequestException as exc:
        logger.warning(f"  DDG search failed: {exc}")
        return ""


def _extract_handles_from_html(html: str) -> list[str]:
    """
    Pull all instagram.com/<handle> matches from HTML, deduplicated and ordered
    by first appearance.
    """
    seen: dict[str, int] = {}
    for m in _IG_URL_RE.finditer(html):
        handle = m.group(1).rstrip("/").lower()
        if handle not in seen:
            seen[handle] = m.start()

    # Filter out non-user path segments
    valid = [
        h for h in seen if h not in _IG_NON_USER_PATHS and h not in BLOCKLIST_HANDLES
    ]
    return sorted(valid, key=lambda h: seen[h])


def search_for_instagram_handle(
    venue_name: str,
    city: str,
    session: requests.Session,
) -> list[str]:
    """
    Search DuckDuckGo for the venue's Instagram profile.
    Returns a ranked list of candidate handles (may be empty).
    """
    query = f'"{venue_name}" {city} site:instagram.com'
    html = _search_duckduckgo(query, session)
    candidates = _extract_handles_from_html(html)

    if not candidates:
        # Broader fallback without site: restriction
        query_broad = f'"{venue_name}" {city} instagram'
        html_broad = _search_duckduckgo(query_broad, session)
        candidates = _extract_handles_from_html(html_broad)

    return candidates


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------


def _fetch_instagram_profile_text(handle: str, session: requests.Session) -> str:
    """
    Fetch the public Instagram profile page for a handle.
    Returns whatever page text we can get; empty string on failure.

    Note: Instagram aggressively blocks scrapers. We extract what we can from
    the initial HTML before JavaScript renders — enough to get the bio / title.
    """
    url = f"https://www.instagram.com/{handle}/"
    try:
        resp = session.get(url, timeout=REQUEST_TIMEOUT)
        if resp.status_code in (404, 410):
            return ""
        # Even a 200 that's a login wall gives us some metadata
        return resp.text
    except requests.RequestException:
        return ""


def _bio_mentions_venue(
    profile_html: str, venue_name: str, neighborhood: Optional[str]
) -> bool:
    """
    Heuristic: does the Instagram profile bio/title mention the venue name
    or its neighborhood?  We treat a match as confirmation the account belongs
    to the venue, not a random person who posted about it.
    """
    if not profile_html:
        return False

    soup = BeautifulSoup(profile_html, "html.parser")

    # Collect text from <title>, <meta description>, and the first few hundred
    # characters of visible body text — Instagram embeds some structured data here
    # even before JS runs.
    candidate_text_parts: list[str] = []

    title_tag = soup.find("title")
    if title_tag:
        candidate_text_parts.append(title_tag.get_text())

    for meta in soup.find_all("meta", attrs={"name": "description"}):
        candidate_text_parts.append(meta.get("content", ""))

    # Grab og:description which sometimes carries the bio
    for meta in soup.find_all("meta", property="og:description"):
        candidate_text_parts.append(meta.get("content", ""))
    for meta in soup.find_all("meta", attrs={"property": "og:description"}):
        candidate_text_parts.append(meta.get("content", ""))

    # Also grab structured JSON-LD if present
    for script in soup.find_all("script", type="application/ld+json"):
        candidate_text_parts.append(script.get_text())

    combined = " ".join(candidate_text_parts).lower()

    # Tokenize the venue name into significant words (>=4 chars)
    name_tokens = [t.lower() for t in re.split(r"\W+", venue_name) if len(t) >= 4]

    # At least one significant token from the name must appear
    for token in name_tokens:
        if token in combined:
            return True

    # Neighborhood match as a weaker signal (only used when name already partially matched)
    if neighborhood and neighborhood.lower() in combined:
        return True

    return False


def validate_handle(
    handle: str,
    venue_name: str,
    neighborhood: Optional[str],
    session: requests.Session,
) -> tuple[bool, str]:
    """
    Validate a candidate handle.

    Returns (is_valid, reason_string).
    - Checks the handle format
    - Checks against the blocklist
    - Fetches the Instagram profile and checks if the bio mentions the venue
    """
    clean = handle.lstrip("@").lower()

    if not _HANDLE_RE.match(clean):
        return False, "invalid handle format"

    if clean in BLOCKLIST_HANDLES:
        return False, "blocked aggregator handle"

    profile_html = _fetch_instagram_profile_text(clean, session)
    time.sleep(INSTAGRAM_FETCH_DELAY)

    if not profile_html:
        return False, "profile not found or blocked"

    # Check for 404 / login redirect signals in the page
    if "Sorry, this page" in profile_html or "Page Not Found" in profile_html:
        return False, "profile does not exist"

    if _bio_mentions_venue(profile_html, venue_name, neighborhood):
        # Extract the bio snippet for display
        soup = BeautifulSoup(profile_html, "html.parser")
        bio_snippet = ""
        for meta in soup.find_all("meta", attrs={"name": "description"}):
            bio_snippet = meta.get("content", "")[:80]
            break
        if not bio_snippet:
            for meta in soup.find_all("meta", attrs={"property": "og:description"}):
                bio_snippet = meta.get("content", "")[:80]
                break
        return True, bio_snippet or "bio match"

    return False, "bio doesn't mention venue"


# ---------------------------------------------------------------------------
# Main processing loop
# ---------------------------------------------------------------------------


def discover_handle_for_venue(
    venue: dict,
    session: requests.Session,
) -> tuple[Optional[str], str]:
    """
    Search for and validate an Instagram handle for a single venue.

    Returns (handle_or_None, status_message).
    """
    name = venue["name"]
    city = venue.get("city") or "Atlanta"
    neighborhood = venue.get("neighborhood")

    candidates = search_for_instagram_handle(name, city, session)
    time.sleep(SEARCH_DELAY)

    if not candidates:
        return None, "no Instagram results found"

    # Try each candidate in order until one validates
    for handle in candidates[:5]:  # cap at 5 to avoid hammering Instagram
        valid, reason = validate_handle(handle, name, neighborhood, session)
        if valid:
            return handle, reason

    # All candidates failed — report the first reject reason
    return None, f"no valid handle found (tried {len(candidates[:5])} candidates)"


def run(
    venue_type: Optional[str],
    venue_ids: Optional[list[int]],
    limit: int,
    dry_run: bool,
) -> None:
    """Main discovery loop."""
    venues = get_venues_missing_instagram(
        venue_type=venue_type,
        venue_ids=venue_ids,
        limit=limit,
    )

    if not venues:
        logger.info("No venues found matching criteria.")
        return

    logger.info(f"Processing {len(venues)} venues" f"{' (dry run)' if dry_run else ''}")

    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": USER_AGENT,
            "Accept-Language": "en-US,en;q=0.9",
        }
    )

    found_count = 0
    miss_count = 0
    skip_count = 0

    for venue in venues:
        name = venue["name"]
        handle, reason = discover_handle_for_venue(venue, session)

        if handle:
            found_count += 1
            logger.info(f'Found: {name} -> @{handle} (bio match: "{reason}")')
            if not dry_run:
                update_instagram_handle(venue["id"], handle, dry_run=False)
        elif "bio doesn't mention" in reason or "wrong venue" in reason:
            skip_count += 1
            logger.info(f"Skip: {name} -> {reason}")
        else:
            miss_count += 1
            logger.info(f"Miss: {name} -> {reason}")

    logger.info(
        f"\nDone. Found: {found_count} | Skipped (wrong venue): {skip_count} | No result: {miss_count}"
    )


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Discover Instagram handles for venues missing them."
    )
    parser.add_argument(
        "--venue-type",
        type=str,
        help="Filter by place_type (bar, nightclub, restaurant, etc.)",
    )
    parser.add_argument(
        "--venue-ids",
        type=str,
        help="Comma-separated place IDs to process",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=50,
        help="Maximum number of venues to process (default: 50)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print results without writing to the database",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable debug logging",
    )
    args = parser.parse_args()

    if args.verbose:
        logger.setLevel(logging.DEBUG)
        logging.getLogger().setLevel(logging.DEBUG)

    venue_ids: Optional[list[int]] = None
    if args.venue_ids:
        venue_ids = [int(v.strip()) for v in args.venue_ids.split(",") if v.strip()]

    run(
        venue_type=args.venue_type,
        venue_ids=venue_ids,
        limit=args.limit,
        dry_run=args.dry_run,
    )


if __name__ == "__main__":
    main()
