"""
Crawler for Eater Atlanta editorial guide/map pages.

Extracts restaurant mentions from Eater's Best-of lists and maps (e.g.,
"The 38 Best Restaurants in Atlanta") and writes them as editorial_mentions
so they appear as editorial signals on place profiles.

Eater uses Vox Media's Chorus CMS rendered via Next.js. The full map data
is embedded in the page's __NEXT_DATA__ script tag inside a MapLayoutQuery
GraphQL response — no Playwright needed.

Strategy:
  - Fetch a curated set of high-signal guide URLs.
  - Parse mapPoints from __NEXT_DATA__ (name, address, lat/lng, description).
  - Look up the restaurant in our places table by exact name, then fallback
    to ilike, then skip (never create new places from editorial signal).
  - Upsert an editorial_mention for each matched place.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_client, upsert_editorial_mention
from db.client import retry_on_network_error, writes_enabled

logger = logging.getLogger(__name__)

SOURCE_KEY = "eater_atlanta"

BASE_URL = "https://atlanta.eater.com"

# Guides to crawl, ordered by editorial signal strength.
# Add new guides here as Eater publishes them.
GUIDE_URLS: list[dict] = [
    {
        "url": f"{BASE_URL}/maps/38-best-restaurants-in-atlanta",
        "mention_type": "best_of",
        "guide_name": "Atlanta's 38 Best Restaurants",
    },
    {
        "url": f"{BASE_URL}/maps/best-new-restaurants-atlanta-heatmap",
        "mention_type": "best_of",
        "guide_name": "Best New Restaurants in Atlanta",
    },
    {
        "url": f"{BASE_URL}/maps/best-restaurants-castleberry-hill-vine-city",
        "mention_type": "guide_inclusion",
        "guide_name": "Best Places to Eat Around Mercedes-Benz Stadium",
    },
    {
        "url": f"{BASE_URL}/maps/best-atlanta-rooftop-patios",
        "mention_type": "guide_inclusion",
        "guide_name": "Best Rooftop Bars and Restaurants in Atlanta",
    },
    {
        "url": f"{BASE_URL}/maps/best-restaurants-bars-midtown-atlanta",
        "mention_type": "guide_inclusion",
        "guide_name": "Best Restaurants in Midtown Atlanta",
    },
    {
        "url": f"{BASE_URL}/maps/best-pizza-atlanta",
        "mention_type": "guide_inclusion",
        "guide_name": "Best Pizza in Atlanta",
    },
    {
        "url": f"{BASE_URL}/maps/best-restaurants-buford-highway-atlanta",
        "mention_type": "guide_inclusion",
        "guide_name": "Best Buford Highway Restaurants",
    },
    {
        "url": f"{BASE_URL}/maps/best-coffee-shops-atlanta-map",
        "mention_type": "guide_inclusion",
        "guide_name": "Best Coffee Shops in Atlanta",
    },
    {
        "url": f"{BASE_URL}/maps/best-omakase-restaurants-atlanta",
        "mention_type": "guide_inclusion",
        "guide_name": "Best Omakase Restaurants in Atlanta",
    },
    {
        "url": f"{BASE_URL}/maps/best-kosher-restaurants-markets-atlanta",
        "mention_type": "guide_inclusion",
        "guide_name": "Best Kosher Restaurants in Atlanta",
    },
]

_WHITESPACE_RE = re.compile(r"\s+")

# Eater appends kosher prep-type notes as parenthetical suffixes to venue names
# (e.g. "Fuego Mundo (meat)", "Formaggio Mio (dairy)"). Strip these before
# DB lookup so we can find the cleaned place record we seeded.
_KOSHER_SUFFIX_RE = re.compile(
    r"\s*\([^)]*\b(meat|dairy)\b[^)]*\)\s*$",
    re.IGNORECASE,
)


def _clean_text(value: str) -> str:
    if not value:
        return ""
    return _WHITESPACE_RE.sub(" ", value).strip()


def _build_snippet(description_blocks: list[dict]) -> str:
    """Join description plaintext blocks, skipping short metadata lines."""
    parts: list[str] = []
    for block in description_blocks:
        text = _clean_text(block.get("plaintext", ""))
        if not text:
            continue
        # Skip pure metadata lines like "Open for: Dinner" and "Price range: $$"
        # (they're usually ≤50 chars and start with a bold label).
        if len(text) <= 60 and text.startswith(("Open for:", "Price range:", "Best for:")):
            continue
        parts.append(text)
    return " ".join(parts)[:500]


def _fetch_map_layout(url: str, session: requests.Session) -> Optional[dict]:
    """Fetch a guide URL and extract the MapLayoutQuery response from __NEXT_DATA__."""
    try:
        response = session.get(url, timeout=20)
        response.raise_for_status()
    except Exception as exc:
        logger.warning("Failed to fetch guide %s: %s", url, exc)
        return None

    soup = BeautifulSoup(response.text, "html.parser")
    script_tag = soup.find("script", id="__NEXT_DATA__")
    if not script_tag:
        logger.warning("No __NEXT_DATA__ found at %s", url)
        return None

    try:
        next_data = json.loads(script_tag.get_text())
    except json.JSONDecodeError as exc:
        logger.warning("__NEXT_DATA__ JSON parse failed at %s: %s", url, exc)
        return None

    responses = (
        next_data.get("props", {})
        .get("pageProps", {})
        .get("hydration", {})
        .get("responses", [])
    )
    for resp in responses:
        if resp.get("operationName") == "MapLayoutQuery":
            return resp.get("data", {}).get("node")

    logger.warning("MapLayoutQuery not found in __NEXT_DATA__ at %s", url)
    return None


@retry_on_network_error(max_retries=3, base_delay=1.0)
def _lookup_place_by_name(client, name: str) -> Optional[int]:
    """
    Look up a place by exact name match, then case-insensitive partial match.
    Returns place_id or None if not found.
    Never creates a new place — editorial signal only enriches existing records.

    Also tries a cleaned version of the name with kosher prep-type suffixes
    stripped (e.g. "Fuego Mundo (meat)" -> "Fuego Mundo") to match place
    records seeded with the cleaned name.
    """
    names_to_try = [name]
    cleaned = _KOSHER_SUFFIX_RE.sub("", name).strip()
    if cleaned != name:
        names_to_try.append(cleaned)

    for candidate in names_to_try:
        # 1. Exact name match (most reliable)
        result = (
            client.table("places")
            .select("id")
            .eq("name", candidate)
            .limit(1)
            .execute()
        )
        if result.data:
            return result.data[0]["id"]

        # 2. Case-insensitive exact match (handles capitalisation differences)
        result = (
            client.table("places")
            .select("id, name")
            .ilike("name", candidate)
            .eq("city", "Atlanta")
            .limit(1)
            .execute()
        )
        if result.data:
            logger.debug(
                "ilike name match: '%s' -> '%s' (id=%s)",
                candidate,
                result.data[0]["name"],
                result.data[0]["id"],
            )
            return result.data[0]["id"]

        # 3. Slug-based match — handles names with non-ASCII characters
        # (e.g. "LanZhou Ramen 兰州拉面" -> slug "lanzhou-ramen")
        slug = re.sub(r"[^a-z0-9]+", "-", candidate.lower()).strip("-")[:80]
        if slug:
            result = (
                client.table("places")
                .select("id, name")
                .eq("slug", slug)
                .limit(1)
                .execute()
            )
            if result.data:
                logger.debug(
                    "slug match: '%s' -> '%s' (id=%s)",
                    candidate,
                    result.data[0]["name"],
                    result.data[0]["id"],
                )
                return result.data[0]["id"]

    return None


@retry_on_network_error(max_retries=3, base_delay=1.0)
def _lookup_place_by_coords(
    client, lat: float, lng: float, radius_deg: float = 0.001
) -> Optional[int]:
    """
    Look up a place by proximity when name lookup fails.

    radius_deg ≈ 0.001 degrees ≈ 111 metres — tight enough to avoid false
    matches in dense areas.
    """
    result = (
        client.table("places")
        .select("id, name")
        .gte("lat", lat - radius_deg)
        .lte("lat", lat + radius_deg)
        .gte("lng", lng - radius_deg)
        .lte("lng", lng + radius_deg)
        .limit(1)
        .execute()
    )
    if result.data:
        logger.debug(
            "coord match at (%.6f, %.6f) -> '%s' (id=%s)",
            lat,
            lng,
            result.data[0]["name"],
            result.data[0]["id"],
        )
        return result.data[0]["id"]
    return None


def _lookup_place(
    client,
    name: str,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
) -> Optional[int]:
    """
    Find a matching place by name (with kosher-suffix stripping), then by
    coordinates if name lookup fails and coordinates are available.
    """
    place_id = _lookup_place_by_name(client, name)
    if place_id:
        return place_id

    if lat is not None and lng is not None:
        place_id = _lookup_place_by_coords(client, lat, lng)
        if place_id:
            return place_id

    return None


def _extract_published_date(node: dict) -> Optional[str]:
    """Return YYYY-MM-DD from publishedAt or updatedAt."""
    for key in ("updatedAt", "publishedAt", "originalPublishedAt"):
        raw = node.get(key, "")
        if raw:
            # ISO 8601: 2026-01-14T18:33:47+00:00
            return raw[:10]
    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Eater Atlanta guide/map pages and write editorial_mentions.

    Returns (mentions_found, mentions_matched, mentions_skipped).
    """
    mentions_found = 0
    mentions_matched = 0
    mentions_skipped = 0

    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
        }
    )

    client = get_client()

    for guide in GUIDE_URLS:
        guide_url = guide["url"]
        mention_type = guide["mention_type"]
        guide_name = guide["guide_name"]

        logger.info("Fetching Eater guide: %s", guide_url)
        node = _fetch_map_layout(guide_url, session)
        if not node:
            logger.warning("Skipping guide (no data): %s", guide_url)
            continue

        article_title = node.get("title", "") or guide_name
        published_at = _extract_published_date(node)
        map_points: list[dict] = node.get("mapPoints", [])

        logger.info(
            "Guide '%s': %d map points",
            article_title,
            len(map_points),
        )

        for point in map_points:
            name = _clean_text(point.get("name", ""))
            if not name:
                continue

            mentions_found += 1

            # Look up existing place — try by name, fall back to coordinates
            loc = point.get("location") or {}
            lat = loc.get("latitude")
            lng = loc.get("longitude")

            place_id = _lookup_place(client, name, lat=lat, lng=lng)
            if not place_id:
                logger.debug("No place match for '%s' — skipping", name)
                mentions_skipped += 1
                continue

            # Build snippet from description blocks
            description_blocks = point.get("description") or []
            snippet = _build_snippet(description_blocks)

            mention_data = {
                "source_key": SOURCE_KEY,
                "article_url": guide_url,
                "article_title": article_title,
                "mention_type": mention_type,
                "guide_name": guide_name,
                "snippet": snippet or None,
                "published_at": published_at,
                "is_active": True,
            }

            result = upsert_editorial_mention(place_id, mention_data)
            if result:
                mentions_matched += 1
                logger.debug(
                    "Editorial mention upserted: place_id=%s name='%s' guide='%s'",
                    place_id,
                    name,
                    guide_name,
                )
            else:
                mentions_skipped += 1
                logger.warning(
                    "Editorial mention upsert failed: place_id=%s name='%s'",
                    place_id,
                    name,
                )

    logger.info(
        "Eater guides crawl complete: %d found, %d matched, %d skipped",
        mentions_found,
        mentions_matched,
        mentions_skipped,
    )
    # Return signature matches the standard tuple: (found, new/matched, skipped)
    return mentions_found, mentions_matched, mentions_skipped
