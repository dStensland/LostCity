#!/usr/bin/env python3
"""
Editorial Mentions Ingestion Pipeline.

Aggregates restaurant/venue reviews and guide inclusions from Atlanta food
publications. Links out to original articles — we never reproduce their content.

Sources:
- Eater Atlanta (sitemap index — monthly sub-sitemaps)
- The Infatuation Atlanta (full sitemap — 1,700+ Atlanta articles)
- Rough Draft Atlanta (RSS)
- Atlanta Eats (RSS)
- Atlanta Magazine (RSS)
- Thrillist Atlanta (sitemap with /atlanta filter)
- What Now Atlanta (sitemap index — monthly sub-sitemaps)
- Axios Atlanta (RSS via tag feed)
- ATL Bucket List (RSS — venue-rich listicles)

Phase 1: Discover articles via RSS/sitemap/sitemap-index
Phase 2: Fetch each article page, extract body text, match venue names

Usage:
    python editorial_ingest.py                          # All sources
    python editorial_ingest.py --source eater_atlanta   # Single source
    python editorial_ingest.py --dry-run                # No DB writes
    python editorial_ingest.py --verbose                # Debug logging
    python editorial_ingest.py --days 14                # Last 14 days only
    python editorial_ingest.py --skip-fetch             # Skip page fetching (fast mode)
"""

from __future__ import annotations

import argparse
import logging
import re
import sys
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional
from xml.etree import ElementTree

import feedparser
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

# Load .env from repo root so this runs standalone
load_dotenv(Path(__file__).parent.parent / ".env")
load_dotenv(Path(__file__).parent.parent / "web" / ".env.local")

sys.path.insert(0, str(Path(__file__).parent))
from db import get_client, writes_enabled, configure_write_mode

logging.basicConfig(level=logging.INFO, format="%(levelname)-5s %(message)s")
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Source definitions
# ---------------------------------------------------------------------------

EDITORIAL_SOURCES: dict[str, dict] = {
    "eater_atlanta": {
        "method": "sitemap_index",
        "sitemap_index_url": "https://atlanta.eater.com/sitemaps",
        "display_name": "Eater Atlanta",
        # Sitemap index has 181+ monthly sub-sitemaps; we fetch recent ones
        "max_sub_sitemaps": 12,  # ~6 months of coverage
    },
    "rough_draft_atlanta": {
        "feed_url": "https://roughdraftatlanta.com/feed/",
        "method": "rss",
        "display_name": "Rough Draft Atlanta",
    },
    "atlanta_eats": {
        "feed_url": "https://www.atlantaeats.com/blog/feed/",
        "method": "rss",
        "display_name": "Atlanta Eats",
    },
    "infatuation_atlanta": {
        "sitemap_url": "https://www.theinfatuation.com/sitemap-1.xml",
        "method": "sitemap",
        "display_name": "The Infatuation",
        "url_filter": "/atlanta/",
    },
    "atlanta_magazine": {
        "feed_url": "https://www.atlantamagazine.com/feed/",
        "method": "rss",
        "display_name": "Atlanta Magazine",
    },
    "thrillist_atlanta": {
        "sitemap_url": "https://www.thrillist.com/sitemap/articles/1.xml",
        "method": "sitemap",
        "display_name": "Thrillist",
        "url_filter": "/atlanta",
    },
    "whatnow_atlanta": {
        "method": "sitemap_index",
        "sitemap_index_url": "https://whatnow.com/atlanta-sitemap.xml",
        "display_name": "What Now Atlanta",
        "max_sub_sitemaps": 6,  # ~6 months, ~40-90 articles/month
    },
    "axios_atlanta": {
        "feed_url": "https://api.axios.com/feed/tag/atlanta",
        "method": "rss",
        "display_name": "Axios Atlanta",
    },
    "atl_bucket_list": {
        "feed_url": "https://atlbucketlist.com/feed/",
        "method": "rss",
        "display_name": "ATL Bucket List",
    },
}

# Sitemaps use this namespace
_SITEMAP_NS = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}

# HTTP headers for all outbound requests
_HEADERS = {
    "User-Agent": "LostCity/1.0 (https://lostcity.ai; events@lostcity.ai)",
    "Accept": "text/html, application/rss+xml, application/xml, */*",
}

# Maximum snippet length allowed by the DB constraint
_SNIPPET_MAX = 500

# Minimum venue name length to attempt matching (avoids "The", "Bar", etc.)
_MIN_NAME_CHARS = 4

# Minimum word count for a venue name to be matched in body text
_MIN_WORDS_FOR_BODY_MATCH = 2

# Delay between page fetches (be polite)
_FETCH_DELAY_SECONDS = 1.5

# Venue names that are too generic to match (city names, common words)
_VENUE_NAME_BLOCKLIST = frozenset([
    # Cities
    "atlanta", "nashville", "birmingham", "savannah", "athens",
    "decatur", "marietta", "roswell", "alpharetta", "sandy springs",
    "brookhaven", "dunwoody", "johns creek", "smyrna", "kennesaw",
    "lawrenceville", "duluth", "tucker", "chamblee", "doraville",
    # Neighborhoods / areas (exist as park/event_space venues)
    "buckhead", "midtown", "downtown", "westside", "eastside",
    "midtown atlanta", "old fourth ward", "inman park", "grant park",
    "east atlanta", "west end", "candler park", "virginia-highland",
    "virginia highland", "little five points", "edgewood",
    "reynoldstown", "cabbagetown", "kirkwood", "east lake",
    "poncey-highland", "west midtown", "summerhill", "adair park",
    "english avenue", "vine city", "collier hills", "ansley park",
    "piedmont heights", "morningside", "druid hills", "avondale estates",
    "decatur square",
    # Parks & streets that get mentioned as locations
    "piedmont park", "centennial olympic park", "grant park",
    "peachtree street", "ponce de leon", "memorial drive",
    "the beltline", "atlanta beltline", "roswell, ga",
    # Markets/districts (mentioned as locations, not individual venues)
    "colony square", "ponce city market", "krog street market",
    "atlantic station",
    # Developments / streets / buildings
    "castleberry hill", "centennial yards", "moreland ave",
    "1100 peachtree", "main street", "atlanta area",
    # Too generic
    "the bar", "the restaurant", "the kitchen", "the cafe",
])

# ---------------------------------------------------------------------------
# Title → mention_type + guide_name classification
# ---------------------------------------------------------------------------

_TYPE_RULES: list[tuple[re.Pattern, str]] = [
    (re.compile(r"/reviews?/", re.IGNORECASE), "review"),
    (re.compile(r"/guides?/", re.IGNORECASE), "guide_inclusion"),
    (
        re.compile(r"\b(opening|now open|just opened|soft open)\b", re.IGNORECASE),
        "opening",
    ),
    (
        re.compile(
            r"\b(closing|closed|shutting down|last day|shut down)\b", re.IGNORECASE
        ),
        "closing",
    ),
    (
        re.compile(
            r"\b(best|top \d+|\d+ best|ranked|must-?try|you need to|essential|don'?t miss)\b",
            re.IGNORECASE,
        ),
        "best_of",
    ),
    (re.compile(r"\bguide\b", re.IGNORECASE), "guide_inclusion"),
    (re.compile(r"\breview\b", re.IGNORECASE), "review"),
]


def classify_mention(
    title: str, url: str, source_key: str
) -> tuple[str, Optional[str]]:
    """Return (mention_type, guide_name) for an article."""
    for pattern, mtype in _TYPE_RULES[:2]:
        if pattern.search(url):
            guide_name = _extract_guide_name(title, mtype)
            return mtype, guide_name

    for pattern, mtype in _TYPE_RULES[2:]:
        if pattern.search(title):
            guide_name = _extract_guide_name(title, mtype)
            return mtype, guide_name

    return "feature", None


def _extract_guide_name(title: str, mention_type: str) -> Optional[str]:
    """Extract a clean guide/list name from the article title."""
    if mention_type not in ("best_of", "guide_inclusion"):
        return None
    cleaned = re.sub(r"^\s*(the\s+)?\d+\s+", "", title, flags=re.IGNORECASE).strip()
    cleaned = re.sub(r"[,\s—-]+ranked\.?$", "", cleaned, flags=re.IGNORECASE).strip()
    return cleaned if cleaned else title


# ---------------------------------------------------------------------------
# Venue cache + matching
# ---------------------------------------------------------------------------


class VenueCache:
    """Bulk-loaded lookup of all active Atlanta venues."""

    def __init__(self) -> None:
        self._name_map: dict[str, int] = {}
        self._alias_map: dict[str, int] = {}
        self._norm_map: dict[str, int] = {}
        self._type_map: dict[int, str] = {}  # venue_id → venue_type
        self._loaded = False

    def _normalise(self, name: str) -> str:
        n = name.lower().strip()
        n = re.sub(r"^the\s+", "", n)
        n = re.sub(r"'s?\b", "", n)
        n = re.sub(r"[^a-z0-9 ]", "", n)
        n = re.sub(r"\s+", " ", n).strip()
        return n

    def load(self) -> None:
        if self._loaded:
            return

        logger.info("Loading venue cache from database...")
        client = get_client()
        result = (
            client.table("venues")
            .select("id, name, aliases, venue_type")
            .eq("city", "Atlanta")
            .eq("active", True)
            .execute()
        )
        rows = result.data or []

        for row in rows:
            vid = row["id"]
            name = row["name"] or ""
            aliases = row.get("aliases") or []
            venue_type = row.get("venue_type") or ""

            if len(name) < _MIN_NAME_CHARS:
                continue

            lname = name.lower()
            if lname in _VENUE_NAME_BLOCKLIST:
                continue

            self._name_map[lname] = vid
            self._norm_map[self._normalise(name)] = vid
            if venue_type:
                self._type_map[vid] = venue_type

            for alias in aliases:
                if alias and len(alias) >= _MIN_NAME_CHARS:
                    la = alias.lower()
                    if la not in _VENUE_NAME_BLOCKLIST:
                        self._alias_map[la] = vid
                        self._norm_map[self._normalise(alias)] = vid

        self._loaded = True
        logger.info(
            "Venue cache loaded: %d names, %d aliases, %d normalised forms, %d with venue_type",
            len(self._name_map),
            len(self._alias_map),
            len(self._norm_map),
            len(self._type_map),
        )

    def get_venue_type(self, venue_id: int) -> Optional[str]:
        """Return the venue_type for a cached venue, or None."""
        if not self._loaded:
            self.load()
        return self._type_map.get(venue_id)

    def match_in_text(self, text: str, restrict_to_title: bool = False) -> list[int]:
        """Return venue IDs found in text."""
        if not self._loaded:
            self.load()

        lower_text = text.lower()
        matched: set[int] = set()

        for lookup_map in (self._name_map, self._alias_map, self._norm_map):
            for name_key, vid in lookup_map.items():
                if len(name_key) < _MIN_NAME_CHARS:
                    continue

                word_count = len(name_key.split())
                if not restrict_to_title and word_count < _MIN_WORDS_FOR_BODY_MATCH:
                    continue

                try:
                    pattern = r"\b" + re.escape(name_key) + r"\b"
                    if re.search(pattern, lower_text):
                        matched.add(vid)
                except re.error:
                    if name_key in lower_text:
                        matched.add(vid)

        return sorted(matched)


_venue_cache = VenueCache()


def match_venues(title: str, body_text: str) -> tuple[set[int], set[int]]:
    """Return (title_matched_ids, body_only_ids).

    Title-matched venues are almost certainly subjects of the article.
    Body-only-matched venues may be incidental mentions.
    """
    title_ids = set(_venue_cache.match_in_text(title, restrict_to_title=True))

    body_ids: set[int] = set()
    if body_text:
        body_ids = set(_venue_cache.match_in_text(body_text, restrict_to_title=False))

    body_only_ids = body_ids - title_ids
    return title_ids, body_only_ids


# ---------------------------------------------------------------------------
# Relevance classification (primary vs incidental)
# ---------------------------------------------------------------------------

# Guide topic keyword → venue types that are coherent with that topic.
# If a venue's type is NOT in the set, it's likely an incidental mention.
_GUIDE_TOPIC_VENUE_TYPES: dict[str, set[str]] = {
    "hotel": {"hotel"},
    "restaurant": {"restaurant", "food_hall", "cafe"},
    "bar": {"bar", "sports_bar", "nightclub", "brewery", "distillery", "winery", "rooftop", "restaurant"},
    "cocktail": {"bar", "sports_bar", "nightclub", "restaurant", "rooftop", "hotel"},
    "coffee": {"coffee_shop", "cafe", "bakery", "restaurant"},
    "brewery": {"brewery", "bar", "restaurant"},
    "pizza": {"restaurant", "food_hall"},
    "bakery": {"restaurant", "bakery", "cafe", "coffee_shop"},
    "brunch": {"restaurant", "bar", "hotel", "cafe", "coffee_shop"},
    "taco": {"restaurant", "food_hall"},
    "burger": {"restaurant", "food_hall", "bar", "sports_bar"},
    "sushi": {"restaurant"},
    "ramen": {"restaurant"},
    "bbq": {"restaurant"},
    "steakhouse": {"restaurant"},
    "wine": {"bar", "restaurant", "winery"},
    "club": {"nightclub", "bar"},
    "museum": {"museum", "gallery"},
    "gallery": {"gallery", "museum"},
    "park": {"park", "garden"},
    "theater": {"venue", "event_space"},
    "patio": {"restaurant", "bar", "brewery", "rooftop", "sports_bar"},
    "rooftop": {"rooftop", "bar", "restaurant", "hotel"},
    "distiller": {"distillery", "bar"},
    "winer": {"winery", "bar", "restaurant"},
    "food hall": {"food_hall", "restaurant"},
    "ice cream": {"restaurant", "cafe", "food_hall"},
    "doughnut": {"restaurant", "bakery", "cafe", "coffee_shop"},
    "donut": {"restaurant", "bakery", "cafe", "coffee_shop"},
}


def _guide_compatible_with_venue(guide_name: Optional[str], venue_type: Optional[str]) -> bool:
    """Check if a venue type is compatible with the guide topic.

    Returns True if compatible or if there's insufficient signal to determine.
    Returns False only when there's a clear mismatch (museum in a hotel guide).
    """
    if not guide_name or not venue_type:
        return True  # No signal → assume compatible

    guide_lower = guide_name.lower()
    for topic, compatible_types in _GUIDE_TOPIC_VENUE_TYPES.items():
        if topic in guide_lower:
            return venue_type in compatible_types

    # No topic keyword matched → can't determine incompatibility
    return True


def determine_relevance(
    venue_id: int,
    title_matched: bool,
    mention_type: str,
    guide_name: Optional[str],
) -> str:
    """Determine if a venue mention is 'primary' or 'incidental'.

    Primary = venue is a subject of the article.
    Incidental = venue is casually mentioned (e.g., "near the High Museum").

    Signals:
    1. Title-match: venue appears in the article title → almost always primary.
    2. Category coherence: venue type aligns with guide topic → primary.
       Mismatch (museum in a hotel guide) → incidental.
    3. Mention type: reviews/openings/closings are about specific venues → primary.
    """
    # Reviews, openings, closings are inherently about the venue
    if mention_type in ("review", "opening", "closing"):
        return "primary"

    # Title-matched venues are almost always subjects
    if title_matched:
        return "primary"

    # For best_of/guide_inclusion: check category coherence
    if mention_type in ("best_of", "guide_inclusion") and guide_name:
        venue_type = _venue_cache.get_venue_type(venue_id)
        if not _guide_compatible_with_venue(guide_name, venue_type):
            return "incidental"

    # Default: primary (body-matched feature with no counter-signal)
    return "primary"


# ---------------------------------------------------------------------------
# Page fetching + text extraction
# ---------------------------------------------------------------------------

# CSS selectors to find article body content, tried in order
_CONTENT_SELECTORS = [
    "article .c-entry-content",       # Vox Media (Eater)
    ".c-entry-content",               # Vox Media fallback
    "[class*='review-body']",         # Infatuation
    "[class*='guide-body']",          # Infatuation guides
    ".longform-body",                 # Thrillist
    ".article__body",                 # Atlanta Magazine
    ".entry-content",                 # WordPress (Atlanta Magazine, Rough Draft, ATL Bucket List)
    ".single-post-content",          # What Now Atlanta
    "[class*='story-body']",         # Axios
    "article [class*='body']",        # Generic article body
    "[class*='article-body']",        # Common pattern
    "[class*='post-content']",        # WordPress
    "[class*='entry-content']",       # WordPress classic
    "article",                        # Semantic article tag
    "main",                           # Main content area
    "[role='main']",                  # ARIA main
]


def fetch_article_text(url: str) -> tuple[Optional[str], Optional[str], Optional[str]]:
    """Fetch an article page and extract title, body text, and snippet.

    Returns (real_title, body_text, snippet) or (None, None, None) on failure.
    """
    try:
        resp = requests.get(url, headers=_HEADERS, timeout=15, allow_redirects=True)
        resp.raise_for_status()
    except requests.RequestException as exc:
        logger.debug("Failed to fetch %s: %s", url, exc)
        return None, None, None

    soup = BeautifulSoup(resp.text, "html.parser")

    # --- Extract real title ---
    title = None
    og_title = soup.find("meta", property="og:title")
    if og_title and og_title.get("content"):
        title = og_title["content"].strip()
    elif soup.title and soup.title.string:
        title = soup.title.string.strip()
        # Strip site name suffixes like " - Eater Atlanta"
        title = re.sub(r"\s*[-|–—]\s*(Eater|The Infatuation|Atlanta Eats|Atlanta Magazine|Thrillist|What Now|Axios|ATL Bucket List).*$", "", title)

    # --- Extract og:description as snippet ---
    snippet = None
    og_desc = soup.find("meta", property="og:description")
    if og_desc and og_desc.get("content"):
        snippet = og_desc["content"].strip()[:_SNIPPET_MAX]

    # --- Extract body text ---
    # Remove script, style, nav, footer, aside elements first
    for tag in soup.find_all(["script", "style", "nav", "footer", "aside", "header"]):
        tag.decompose()

    body_text = ""
    for selector in _CONTENT_SELECTORS:
        try:
            content = soup.select_one(selector)
        except Exception:
            continue
        if content:
            body_text = content.get_text(separator=" ", strip=True)
            if len(body_text) > 200:  # Got meaningful content
                break

    if not body_text or len(body_text) < 200:
        # Fallback: concatenate all paragraph text
        paragraphs = soup.find_all("p")
        body_text = " ".join(p.get_text(strip=True) for p in paragraphs)

    return title, body_text, snippet


# ---------------------------------------------------------------------------
# RSS feed ingestion
# ---------------------------------------------------------------------------


def fetch_rss_entries(source_config: dict, cutoff_dt: datetime) -> list[dict]:
    """Parse RSS feed and return list of article dicts."""
    feed_url = source_config["feed_url"]
    display_name = source_config["display_name"]
    category_filter: list[str] = source_config.get("category_filter", [])

    logger.info("Fetching %s RSS feed: %s", display_name, feed_url)
    try:
        response = requests.get(feed_url, headers=_HEADERS, timeout=20)
        response.raise_for_status()
        feed = feedparser.parse(response.content)
    except requests.RequestException as exc:
        logger.error("Failed to fetch %s RSS: %s", display_name, exc)
        return []
    except Exception as exc:
        logger.error("Failed to parse %s RSS: %s", display_name, exc)
        return []

    entries: list[dict] = []
    for entry in feed.entries:
        if category_filter:
            tags = [t.get("term", "") for t in getattr(entry, "tags", [])]
            if not any(t in category_filter for t in tags):
                continue

        published_at: Optional[datetime] = None
        if hasattr(entry, "published_parsed") and entry.published_parsed:
            try:
                published_at = datetime(
                    *entry.published_parsed[:6], tzinfo=timezone.utc
                )
            except (TypeError, ValueError):
                pass
        if (
            published_at is None
            and hasattr(entry, "updated_parsed")
            and entry.updated_parsed
        ):
            try:
                published_at = datetime(*entry.updated_parsed[:6], tzinfo=timezone.utc)
            except (TypeError, ValueError):
                pass

        if published_at and published_at < cutoff_dt:
            continue

        title = entry.get("title", "").strip()
        url = entry.get("link", "").strip()
        if not title or not url:
            continue

        snippet_raw = entry.get("summary", "") or ""
        if not snippet_raw and hasattr(entry, "content") and entry.content:
            snippet_raw = entry.content[0].get("value", "")

        snippet = _clean_snippet(snippet_raw)

        entries.append(
            {
                "title": title,
                "url": url,
                "published_at": published_at,
                "snippet": snippet,
            }
        )

    logger.info("Found %d articles from %s", len(entries), display_name)
    return entries


# ---------------------------------------------------------------------------
# Eater archive scraping
# ---------------------------------------------------------------------------


def fetch_eater_archive_entries(
    source_config: dict, cutoff_dt: datetime, max_pages: int = 3
) -> list[dict]:
    """Scrape Eater Atlanta archive pages for article URLs beyond what RSS provides.

    Returns article dicts with url and title. Page fetching fills in the rest.
    """
    archive_url = source_config.get("archive_url")
    if not archive_url:
        return []

    display_name = source_config["display_name"]
    logger.info("Scraping %s archive: %s (up to %d pages)", display_name, archive_url, max_pages)

    entries: list[dict] = []
    seen_urls: set[str] = set()

    for page in range(1, max_pages + 1):
        page_url = archive_url if page == 1 else f"{archive_url}/{page}"
        try:
            resp = requests.get(page_url, headers=_HEADERS, timeout=15)
            resp.raise_for_status()
        except requests.RequestException as exc:
            logger.warning("Failed to fetch archive page %d: %s", page, exc)
            break

        soup = BeautifulSoup(resp.text, "html.parser")

        # Eater archive links are in h2 > a tags within the archive listing
        found_on_page = 0
        for link in soup.select("h2 a[href]"):
            url = link.get("href", "").strip()
            title = link.get_text(strip=True)

            if not url or not title:
                continue
            # Only include article URLs (not category/tag pages)
            if "/archives" in url or not url.startswith("http"):
                continue
            if url in seen_urls:
                continue

            seen_urls.add(url)
            found_on_page += 1
            entries.append(
                {
                    "title": title,
                    "url": url,
                    "published_at": None,  # Will be extracted from page
                    "snippet": None,
                }
            )

        logger.info("  Archive page %d: %d articles", page, found_on_page)
        if found_on_page == 0:
            break
        time.sleep(_FETCH_DELAY_SECONDS)

    logger.info("Found %d archive articles from %s", len(entries), display_name)
    return entries


# ---------------------------------------------------------------------------
# Sitemap ingestion (Infatuation)
# ---------------------------------------------------------------------------


def fetch_sitemap_entries(source_config: dict, cutoff_dt: datetime) -> list[dict]:
    """Fetch and parse XML sitemap, return article dicts."""
    sitemap_url = source_config["sitemap_url"]
    url_filter: str = source_config.get("url_filter", "")
    display_name = source_config["display_name"]

    logger.info("Fetching %s sitemap: %s", display_name, sitemap_url)
    try:
        response = requests.get(sitemap_url, headers=_HEADERS, timeout=30)
        response.raise_for_status()
        xml_content = response.content
    except requests.RequestException as exc:
        logger.error("Failed to fetch %s sitemap: %s", display_name, exc)
        return []

    try:
        root = ElementTree.fromstring(xml_content)
    except ElementTree.ParseError as exc:
        logger.error("Failed to parse %s sitemap XML: %s", display_name, exc)
        return []

    entries: list[dict] = []
    urls = root.findall("sm:url", _SITEMAP_NS) or root.findall("url")
    if not urls:
        urls = root.findall(".//url")

    for url_el in urls:
        # IMPORTANT: Never use `or` fallback with ElementTree find() —
        # childless Elements evaluate as falsy.
        loc_el = url_el.find("sm:loc", _SITEMAP_NS)
        if loc_el is None:
            loc_el = url_el.find("loc")
        lastmod_el = url_el.find("sm:lastmod", _SITEMAP_NS)
        if lastmod_el is None:
            lastmod_el = url_el.find("lastmod")

        if loc_el is None or loc_el.text is None:
            continue

        url = loc_el.text.strip()

        if url_filter and url_filter not in url:
            continue

        published_at: Optional[datetime] = None
        if lastmod_el is not None and lastmod_el.text:
            try:
                raw = lastmod_el.text.strip()
                if len(raw) == 10:
                    raw += "T00:00:00+00:00"
                published_at = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            except ValueError:
                pass

        if published_at is not None and published_at < cutoff_dt:
            continue

        # Use URL slug as preliminary title — page fetch replaces it
        title = _slug_to_title(url)

        entries.append(
            {
                "title": title,
                "url": url,
                "published_at": published_at,
                "snippet": None,
            }
        )

    logger.info("Found %d Atlanta articles from %s", len(entries), display_name)
    return entries


# ---------------------------------------------------------------------------
# Sitemap index ingestion (Eater — monthly sub-sitemaps)
# ---------------------------------------------------------------------------


def fetch_sitemap_index_entries(
    source_config: dict, cutoff_dt: datetime
) -> list[dict]:
    """Fetch a sitemap index, iterate sub-sitemaps, collect article URLs.

    Eater's sitemap index at /sitemaps lists monthly sub-sitemaps like
    /sitemaps/entries/2026/3. We fetch the N most recent and extract URLs.
    """
    index_url = source_config["sitemap_index_url"]
    max_subs = source_config.get("max_sub_sitemaps", 12)
    display_name = source_config["display_name"]

    logger.info("Fetching %s sitemap index: %s", display_name, index_url)
    try:
        resp = requests.get(index_url, headers=_HEADERS, timeout=30)
        resp.raise_for_status()
    except requests.RequestException as exc:
        logger.error("Failed to fetch %s sitemap index: %s", display_name, exc)
        return []

    try:
        root = ElementTree.fromstring(resp.content)
    except ElementTree.ParseError as exc:
        logger.error("Failed to parse %s sitemap index XML: %s", display_name, exc)
        return []

    # Extract sub-sitemap URLs from the index
    all_sub_urls: list[str] = []
    ns = _SITEMAP_NS
    sitemaps = root.findall("sm:sitemap", ns) or root.findall("sitemap")
    if not sitemaps:
        sitemaps = root.findall(".//{http://www.sitemaps.org/schemas/sitemap/0.9}sitemap")

    for sm in sitemaps:
        loc_el = sm.find("sm:loc", ns)
        if loc_el is None:
            loc_el = sm.find("loc")
        if loc_el is None:
            loc_el = sm.find("{http://www.sitemaps.org/schemas/sitemap/0.9}loc")
        if loc_el is not None and loc_el.text:
            all_sub_urls.append(loc_el.text.strip())

    if not all_sub_urls:
        logger.warning("No sub-sitemaps found in %s index", display_name)
        return []

    # Filter to article entry sitemaps only (skip /groups, /authors, /video, /google_news)
    entry_urls = [u for u in all_sub_urls if "/entries/" in u]
    if not entry_urls:
        # Fallback: use all URLs if none match /entries/ pattern
        entry_urls = all_sub_urls

    # Eater lists newest first — take the first N
    sub_urls = entry_urls[:max_subs]
    logger.info(
        "Found %d sub-sitemaps (%d entry), fetching %d most recent",
        len(all_sub_urls), len(entry_urls), len(sub_urls),
    )

    all_entries: list[dict] = []
    for sub_url in sub_urls:  # Already newest first
        logger.info("  Fetching sub-sitemap: %s", sub_url.split("/sitemaps/")[-1] if "/sitemaps/" in sub_url else sub_url)
        try:
            resp = requests.get(sub_url, headers=_HEADERS, timeout=20)
            resp.raise_for_status()
        except requests.RequestException as exc:
            logger.warning("Failed to fetch sub-sitemap %s: %s", sub_url, exc)
            continue

        try:
            sub_root = ElementTree.fromstring(resp.content)
        except ElementTree.ParseError:
            logger.warning("Failed to parse sub-sitemap XML: %s", sub_url)
            continue

        urls = sub_root.findall("sm:url", ns) or sub_root.findall("url")
        if not urls:
            urls = sub_root.findall(".//{http://www.sitemaps.org/schemas/sitemap/0.9}url")

        sub_count = 0
        for url_el in urls:
            loc_el = url_el.find("sm:loc", ns)
            if loc_el is None:
                loc_el = url_el.find("loc")
            if loc_el is None:
                loc_el = url_el.find("{http://www.sitemaps.org/schemas/sitemap/0.9}loc")
            lastmod_el = url_el.find("sm:lastmod", ns)
            if lastmod_el is None:
                lastmod_el = url_el.find("lastmod")
            if lastmod_el is None:
                lastmod_el = url_el.find("{http://www.sitemaps.org/schemas/sitemap/0.9}lastmod")

            if loc_el is None or loc_el.text is None:
                continue

            article_url = loc_el.text.strip()

            # Skip non-article URLs (tag pages, category pages, etc.)
            if "/archives" in article_url or "/authors/" in article_url:
                continue

            published_at: Optional[datetime] = None
            if lastmod_el is not None and lastmod_el.text:
                try:
                    raw = lastmod_el.text.strip()
                    if len(raw) == 10:
                        raw += "T00:00:00+00:00"
                    published_at = datetime.fromisoformat(raw.replace("Z", "+00:00"))
                except ValueError:
                    pass

            if published_at is not None and published_at < cutoff_dt:
                continue

            title = _slug_to_title(article_url)
            all_entries.append(
                {
                    "title": title,
                    "url": article_url,
                    "published_at": published_at,
                    "snippet": None,
                }
            )
            sub_count += 1

        logger.info("    → %d articles", sub_count)
        time.sleep(0.5)  # Polite delay between sub-sitemap fetches

    logger.info("Found %d total articles from %s sitemap index", len(all_entries), display_name)
    return all_entries


def _slug_to_title(url: str) -> str:
    """Convert a URL slug to a human-readable title."""
    path = url.rstrip("/").split("/")
    slug_parts = [
        p for p in path
        if p and p not in ("atlanta", "guides", "reviews", "features", "")
    ]
    if not slug_parts:
        return url
    slug = slug_parts[-1]
    title = slug.replace("-", " ").replace("_", " ").title()
    return title


# ---------------------------------------------------------------------------
# Snippet cleaning
# ---------------------------------------------------------------------------


def _clean_snippet(raw: str) -> Optional[str]:
    """Strip HTML tags from a feed summary and truncate to DB limit."""
    if not raw:
        return None
    text = re.sub(r"<[^>]+>", " ", raw)
    text = re.sub(r"\s+", " ", text).strip()
    text = (
        text.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", '"')
        .replace("&#39;", "'")
        .replace("&nbsp;", " ")
    )
    text = text.strip()
    if not text:
        return None
    return text[:_SNIPPET_MAX]


# ---------------------------------------------------------------------------
# DB operations
# ---------------------------------------------------------------------------


def upsert_mention(mention: dict) -> bool:
    """Insert or update a single editorial mention row.

    Uses (article_url, venue_id) as the composite conflict key for matched venues.
    Uses article_url partial index for unmatched (venue_id IS NULL) articles.
    """
    if not writes_enabled():
        vid = mention.get("venue_id", "NULL")
        logger.info("DRY RUN: would upsert: venue=%s  %s", vid, mention["article_url"])
        return False

    client = get_client()
    try:
        if mention.get("venue_id") is not None:
            # Matched venue — composite unique (article_url, venue_id)
            result = (
                client.table("editorial_mentions")
                .upsert(mention, on_conflict="article_url,venue_id")
                .execute()
            )
        else:
            # Unmatched — partial unique on article_url WHERE venue_id IS NULL
            # Try insert; if conflict, update the existing row
            result = (
                client.table("editorial_mentions")
                .upsert(mention, on_conflict="article_url")
                .execute()
            )
        return bool(result.data)
    except Exception as exc:
        # Log but don't crash — conflicts for existing rows are expected
        err_str = str(exc)
        if "duplicate key" not in err_str and "conflict" not in err_str.lower():
            logger.warning("DB error for %s: %s", mention.get("article_url", "?"), exc)
        return False


def get_existing_article_urls(source_key: str) -> set[str]:
    """Return set of article_url strings already in DB for this source."""
    client = get_client()
    result = (
        client.table("editorial_mentions")
        .select("article_url")
        .eq("source_key", source_key)
        .execute()
    )
    return {row["article_url"] for row in (result.data or [])}


# ---------------------------------------------------------------------------
# Per-source orchestration
# ---------------------------------------------------------------------------


def ingest_source(
    source_key: str,
    source_config: dict,
    cutoff_dt: datetime,
    skip_fetch: bool = False,
    reprocess: bool = False,
) -> tuple[int, int, int]:
    """Ingest one source.

    Returns (articles_found, mentions_upserted, venues_matched).
    """
    method = source_config["method"]

    # Phase 1: Discover article URLs
    if method == "rss":
        raw_entries = fetch_rss_entries(source_config, cutoff_dt)
    elif method == "sitemap":
        raw_entries = fetch_sitemap_entries(source_config, cutoff_dt)
    elif method == "sitemap_index":
        raw_entries = fetch_sitemap_index_entries(source_config, cutoff_dt)
    else:
        logger.error("Unknown method '%s' for source '%s'", method, source_key)
        return 0, 0, 0

    articles_found = len(raw_entries)
    if articles_found == 0:
        return 0, 0, 0

    # Check which URLs we already have in the DB
    existing_urls = get_existing_article_urls(source_key)
    if reprocess:
        new_entries = raw_entries  # Re-process everything
        logger.info(
            "%d articles discovered, reprocessing all (%d already in DB)",
            articles_found,
            len(existing_urls),
        )
    else:
        new_entries = [e for e in raw_entries if e["url"] not in existing_urls]
        logger.info(
            "%d articles discovered, %d already in DB, %d new to process",
            articles_found,
            len(raw_entries) - len(new_entries),
            len(new_entries),
        )

    mentions_upserted = 0
    venues_matched_total = 0

    for i, entry in enumerate(new_entries):
        title = entry["title"]
        url = entry["url"]
        published_at: Optional[datetime] = entry.get("published_at")
        snippet: Optional[str] = entry.get("snippet")
        body_text = ""

        # Phase 2: Fetch the actual article page
        if not skip_fetch:
            real_title, page_body, page_snippet = fetch_article_text(url)

            if real_title:
                title = real_title
            if page_body:
                body_text = page_body
            if page_snippet and not snippet:
                snippet = page_snippet

            # Polite delay between fetches
            if i < len(new_entries) - 1:
                time.sleep(_FETCH_DELAY_SECONDS)

        mention_type, guide_name = classify_mention(title, url, source_key)

        # Match venues in title + full body text
        title_matched_ids, body_only_ids = match_venues(
            title, body_text or snippet or ""
        )
        all_matched_ids = title_matched_ids | body_only_ids

        if all_matched_ids:
            # Compute relevance for each matched venue
            venue_relevance: dict[int, str] = {}
            for vid in all_matched_ids:
                venue_relevance[vid] = determine_relevance(
                    vid,
                    title_matched=(vid in title_matched_ids),
                    mention_type=mention_type,
                    guide_name=guide_name,
                )

            n_primary = sum(1 for r in venue_relevance.values() if r == "primary")
            n_incidental = len(venue_relevance) - n_primary

            logger.info(
                '"%s" → %d venue(s) (%d primary, %d incidental)',
                title[:80],
                len(all_matched_ids),
                n_primary,
                n_incidental,
            )
            venues_matched_total += len(all_matched_ids)

            # If reprocessing, delete the old unmatched row (venue_id IS NULL)
            if reprocess and url in existing_urls and writes_enabled():
                try:
                    get_client().table("editorial_mentions").delete().eq(
                        "article_url", url
                    ).is_("venue_id", "null").execute()
                except Exception:
                    pass  # Best effort — may not exist

            # Create one mention row per matched venue with relevance
            for vid in all_matched_ids:
                mention = _build_mention_payload(
                    source_key, url, title, mention_type,
                    guide_name, published_at, snippet,
                    venue_id=vid, relevance=venue_relevance[vid],
                )
                if upsert_mention(mention):
                    mentions_upserted += 1
        else:
            logger.debug("Unmatched: %s", title[:80])
            # Store without venue link for future re-matching
            mention = _build_mention_payload(
                source_key, url, title, mention_type,
                guide_name, published_at, snippet, venue_id=None,
            )
            if upsert_mention(mention):
                mentions_upserted += 1

    return articles_found, mentions_upserted, venues_matched_total


def _build_mention_payload(
    source_key: str,
    url: str,
    title: str,
    mention_type: str,
    guide_name: Optional[str],
    published_at: Optional[datetime],
    snippet: Optional[str],
    venue_id: Optional[int],
    relevance: str = "primary",
) -> dict:
    payload: dict = {
        "source_key": source_key,
        "article_url": url,
        "article_title": title,
        "mention_type": mention_type,
        "relevance": relevance,
        "is_active": True,
    }
    if venue_id is not None:
        payload["venue_id"] = venue_id
    if guide_name is not None:
        payload["guide_name"] = guide_name
    if published_at is not None:
        payload["published_at"] = published_at.isoformat()
    if snippet is not None:
        payload["snippet"] = snippet
    return payload


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Ingest editorial mentions from Atlanta food/culture publications"
    )
    parser.add_argument(
        "--source",
        metavar="SOURCE_KEY",
        choices=list(EDITORIAL_SOURCES.keys()),
        help="Run a single source (default: all)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Fetch and classify but make no DB writes",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable DEBUG logging",
    )
    parser.add_argument(
        "--days",
        type=int,
        default=90,
        metavar="N",
        help="Only process articles from the last N days (default: 90)",
    )
    parser.add_argument(
        "--skip-fetch",
        action="store_true",
        help="Skip page fetching — only use RSS/sitemap metadata (fast mode)",
    )
    parser.add_argument(
        "--reprocess",
        action="store_true",
        help="Re-fetch and re-match existing articles (use after pipeline upgrades)",
    )
    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    if args.dry_run:
        configure_write_mode(False, "editorial_ingest --dry-run")

    cutoff_dt = datetime.now(timezone.utc) - timedelta(days=args.days)
    logger.info(
        "Editorial ingestion | lookback: %d days | fetch pages: %s | dry-run: %s",
        args.days,
        not args.skip_fetch,
        args.dry_run,
    )
    logger.info("Cutoff: %s", cutoff_dt.strftime("%Y-%m-%d"))

    _venue_cache.load()

    sources_to_run = (
        {args.source: EDITORIAL_SOURCES[args.source]}
        if args.source
        else EDITORIAL_SOURCES
    )

    total_articles = 0
    total_upserted = 0
    total_venue_matches = 0
    source_count = 0

    for source_key, source_config in sources_to_run.items():
        logger.info("-" * 60)
        articles, upserted, matched = ingest_source(
            source_key, source_config, cutoff_dt,
            skip_fetch=args.skip_fetch,
            reprocess=args.reprocess,
        )
        total_articles += articles
        total_upserted += upserted
        total_venue_matches += matched
        source_count += 1
        if len(sources_to_run) > 1:
            time.sleep(1)

    logger.info("=" * 60)
    logger.info(
        "Summary: %d articles from %d source(s), %d mention(s) upserted, "
        "%d venue match(es)",
        total_articles,
        source_count,
        total_upserted,
        total_venue_matches,
    )
    if args.dry_run:
        logger.info("(dry-run — no rows written)")


if __name__ == "__main__":
    main()
