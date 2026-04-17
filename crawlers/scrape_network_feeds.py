#!/usr/bin/env python3
"""
Fetch RSS feeds from independent Atlanta network sources and store posts.

Pulls from curated RSS/Atom feeds in the network_sources table, parses entries
with feedparser, deduplicates by guid/url, and inserts new posts into
network_posts.

Usage:
    # Fetch all active sources
    python3 scrape_network_feeds.py

    # Fetch a specific source
    python3 scrape_network_feeds.py --source rough-draft-atlanta

    # Dry run (fetch and parse but don't write to DB)
    python3 scrape_network_feeds.py --dry-run

    # Show what's in the DB
    python3 scrape_network_feeds.py --stats

    # Limit posts per source (default: 20)
    python3 scrape_network_feeds.py --limit 50

    # Prune stale posts (default retention: 7 days)
    python3 scrape_network_feeds.py --retention-days 7
"""

import sys
import time
import logging
import argparse
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional
from html import unescape
import re

env_path = Path(__file__).parent.parent / ".env"
from dotenv import load_dotenv
load_dotenv(env_path)

sys.path.insert(0, str(Path(__file__).parent))
from db import get_client

try:
    import feedparser
except ImportError:
    print("ERROR: feedparser not installed. Run: pip install feedparser")
    sys.exit(1)

try:
    import requests
except ImportError:
    print("ERROR: requests not installed. Run: pip install requests")
    sys.exit(1)

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": "LostCity/1.0 (https://lostcity.ai; events@lostcity.ai)",
    "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
}

# Max chars for raw_description storage
MAX_DESCRIPTION_CHARS = 5000
DEFAULT_RETENTION_DAYS = 30

# ── Per-post classification ──────────────────────────────────────────

# Valid filter categories for the network feed
VALID_CATEGORIES = {"news", "culture", "arts", "food", "music", "community", "civic", "politics", "sports"}

# Keywords that signal a post belongs to a given category.
# Checked against lowercased title + summary.
CATEGORY_KEYWORDS = {
    "news": [
        "development", "zoning", "transit", "startup", "investigation",
        "officials", "breaking", "report", "announced", "update",
        "construction", "demolition", "project", "planned", "proposed",
        "opening", "closing",
        "relocate", "relocated", "relocating", "relocation",
        "expansion",
        "redevelopment", "redeveloping", "redevelop",
        "real estate", "property", "skyscraper", "tower", "building",
        "makeover", "renovation", "business", "company",
        "headquarters", "headquartered", "headquartering", "headquarter",
    ],
    "arts": [
        "gallery", "museum", "sculpture", "theater", "theatre",
        "performance art", "photography", "exhibition", "mural", "visual art",
        "painting", "art installation", "curator", "artwork",
        "ballet", "opera", "symphony", "orchestra",
        "call for artists", "art show", "art exhibit",
    ],
    "culture": [
        "festival", "literary", "book", "film", "screening", "poetry",
        "open mic", "culture", "heritage", "documentary",
        "podcast", "magazine",
        "storyteller", "storytelling", "storytells",
        "oral history",
    ],
    "food": [
        "restaurant", "chef", "dining", "brunch", "cocktail", "brewery",
        "grand opening", "now open", "menu", "food hall", "tasting", "recipe",
        "bakery", "cafe", "distillery", "eatery", "kitchen",
        "burger", "pizza", "taco", "sushi", "ramen", "bbq", "barbecue",
        "coffee shop", "wine bar", "beer garden", "tavern", "grill",
        "drive-thru", "fast-casual", "food truck", "ice cream",
        "executive chef", "culinary", "taproom", "gastropub",
        "steakhouse", "diner", "winery", "rooftop bar",
    ],
    "music": [
        "concert", "band", "album", "hip-hop", "hip hop", "jazz",
        "live music", "vinyl", "rapper", "singer", "songwriter",
        "musician", "playlist", "record label", "r&b", "punk",
        "indie music", "folk music", "blues", "edm", "electronic music",
        " dj ", "dj set", "dj night",
    ],
    "community": [
        "volunteer", "nonprofit", "mutual aid", "neighborhood",
        "grassroots", "community", "fundraiser", "donation",
        "career expo", "job fair", "housing", "affordable",
        "school board", "school closure", "school district",
        "library", "parks", "recreation",
    ],
    "civic": [
        "city council", "election", "ballot", "zoning", "budget",
        "public hearing", "ordinance", "infrastructure", "marta",
        "county", "commission", "municipal", "public safety",
        "transit", "transportation", "traffic",
    ],
    "politics": [
        "political", "campaign", "governor", "legislature", "protest",
        "crime", "policy", "democrat", "republican", "senator",
        "gubernatorial", "candidate", "bill ", " bill", "passed",
        "healthcare", "law ", " law", "lawmaker", "regulation",
        "georgia house", "georgia senate", "state house",
    ],
    "sports": [
        # Teams (specific to Atlanta sports)
        "falcons", "braves", "hawks", "united fc", "atlanta united",
        "atlanta dream",
        # Roles / positions
        "rookie", "quarterback",
        # Sports-specific events / phrases (multi-word prevents false positives
        # from e.g. "Rough Draft" matching the publisher name)
        "nfl draft", "nba draft", "mlb draft", "draft pick", "draft round",
        "trade rumor", "trade deadline", "traded to",
        "playoff", "playoffs",
        "touchdown", "home run", "innings", "bullpen", "dugout",
        # Leagues
        "nba", "nfl", "mlb", "mls", "wnba", "college football",
    ],
}


# ── Per-source locality filter ───────────────────────────────────────
#
# GPB News (Georgia Public Broadcasting) syndicates a large share of NPR
# national wire stories (Strait of Hormuz, John Waters, etc.) alongside
# Georgia-specific reporting. We only want the Georgia coverage. If a post's
# title + summary doesn't mention Georgia/Atlanta/recognizable GA place or
# institution names, skip it at ingest time.

GA_LOCALITY_KEYWORDS = [
    # State & headline terms
    "georgia", "georgians", "atlanta", "gpb",
    # Capitol / state gov
    "state capitol", "state house", "state senate",
    "state senator", "state representative", "general assembly",
    "governor kemp", "raffensperger", "ossoff", "warnock",
    # Metro + infrastructure
    "marta", "beltline", "hartsfield",
    # Major cities
    "savannah", "augusta", "macon", "athens, ga", "columbus, ga",
    "roswell", "alpharetta", "sandy springs", "decatur",
    # Counties
    "fulton county", "dekalb county", "gwinnett county", "cobb county",
    "cherokee county", "forsyth county", "clayton county", "henry county",
    "chatham county", "bibb county",
    # Landmarks / universities
    "stone mountain", "okefenokee", "chattahoochee",
    "georgia tech", "emory", "morehouse", "spelman", "uga",
    "georgia state university", "georgia southern",
]


def has_ga_locality(title: str, summary: Optional[str]) -> bool:
    """True if title or summary mentions a Georgia-identifying term."""
    text = (title + " " + (summary or "")).lower()
    return any(kw in text for kw in GA_LOCALITY_KEYWORDS)


# Per-source slug → locality gate. Extend when other sources syndicate wires.
SOURCES_REQUIRING_GA_LOCALITY = {"gpb-news"}


# ── Sponsored content filter ─────────────────────────────────────────
#
# Local news sites monetize by publishing paid SEO placements — "buy X
# followers" affiliate lists, crypto casino roundups, CBD/kratom/VPN guides —
# that are categorically not local news. Reject these at ingest time so they
# never land in the feed. If a legitimate article ever trips the filter, add
# an allow-exception inline; these patterns are deliberately narrow.

SPONSORED_TITLE_PATTERNS = [
    re.compile(r"\bbest\s+(sites|places)\s+to\s+buy\b", re.IGNORECASE),
    re.compile(
        r"\bbuy\s+(youtube|tiktok|twitter|instagram|twitch|spotify|soundcloud)\s+"
        r"(followers|likes|views|subscribers|plays|shares)\b",
        re.IGNORECASE,
    ),
    re.compile(r"\b(crypto|bitcoin|btc|online|real\s*money)\s+casino", re.IGNORECASE),
    re.compile(r"\bbest\s+casinos?\b", re.IGNORECASE),
    re.compile(r"\bnon[-\s]?gamstop\b", re.IGNORECASE),
    re.compile(r"\bcasinos?\s+not\s+on\b", re.IGNORECASE),
    re.compile(r"\bbest\s+(slots|sportsbook|betting|gambling)\s+(sites|online)", re.IGNORECASE),
    re.compile(r"\bbest\s+slots\s+to\s+play\b", re.IGNORECASE),
    re.compile(
        r"\b(cbd|kratom|thc|delta[-\s]?8)\s+(gummies|products|review|brands)\b",
        re.IGNORECASE,
    ),
    re.compile(r"\bbest\s+vpn\b", re.IGNORECASE),
    re.compile(r"\bpress\s+release\b", re.IGNORECASE),
]

SPONSORED_URL_PATTERNS = [
    re.compile(
        r"/buy-(youtube|tiktok|twitter|instagram|twitch|spotify|soundcloud)-"
        r"(followers|likes|views|subscribers|plays)",
        re.IGNORECASE,
    ),
    re.compile(
        r"/best-(bitcoin|crypto|btc|us-online|real-money|online)-casinos?",
        re.IGNORECASE,
    ),
    re.compile(r"/crypto-casinos?-guide", re.IGNORECASE),
    re.compile(r"/best-real-money-slots", re.IGNORECASE),
    re.compile(r"/best-sites-to-buy-", re.IGNORECASE),
]


def is_sponsored_post(title: str, url: str) -> bool:
    """Return True if a post matches known paid-SEO / affiliate patterns."""
    if any(p.search(title) for p in SPONSORED_TITLE_PATTERNS):
        return True
    if any(p.search(url) for p in SPONSORED_URL_PATTERNS):
        return True
    return False


# Pre-compile category keywords as word-boundary regex. Substring matching was
# a systemic bug — "opera" matched "operates"/"operation", "mural" matched
# "intramural", "draft" matched "drafts", etc. Word-boundary matching closes
# that class of false positives. Stems are enumerated as full variants in
# CATEGORY_KEYWORDS above so we don't lose intentional stem coverage.
_CATEGORY_PATTERNS = {
    cat: re.compile(
        r"\b(?:" + "|".join(re.escape(kw) for kw in keywords) + r")\b",
        re.IGNORECASE,
    )
    for cat, keywords in CATEGORY_KEYWORDS.items()
}


def classify_post(
    entry: dict,
    source_categories: list,
    title: str,
    summary: Optional[str],
) -> list:
    """Classify a single post into network feed categories.

    Strategy (in priority order):
    1. RSS <category> tags from the feed entry
    2. Word-boundary keyword matching against title + summary
    3. Fall back to the source's PRIMARY category
    """
    matched = set()

    # 1. RSS tags — feedparser exposes <category> as entry["tags"]
    rss_tags = entry.get("tags") or []
    for tag_obj in rss_tags:
        term = (tag_obj.get("term") or "").strip().lower()
        if term in VALID_CATEGORIES:
            matched.add(term)
        # Also check if the RSS tag term contains a category keyword (word-bounded)
        for cat, pattern in _CATEGORY_PATTERNS.items():
            if pattern.search(term):
                matched.add(cat)

    # 2. Word-boundary keyword matching on title + summary
    text = title + " " + (summary or "")
    for cat, pattern in _CATEGORY_PATTERNS.items():
        if pattern.search(text):
            matched.add(cat)

    # 3. Fallback: use the source's PRIMARY category (first valid one),
    #    not ALL source categories — avoids over-tagging general articles.
    if not matched:
        for c in (source_categories or []):
            if c in VALID_CATEGORIES:
                matched.add(c)
                break  # only the primary category

    # Ensure at least "news" as a default
    if not matched:
        matched.add("news")

    return sorted(matched)


def strip_html(text: Optional[str]) -> Optional[str]:
    """Remove HTML tags and decode entities from feed content."""
    if not text:
        return None
    # Remove HTML tags
    clean = re.sub(r"<[^>]+>", " ", text)
    # Decode HTML entities
    clean = unescape(clean)
    # Collapse whitespace
    clean = re.sub(r"\s+", " ", clean).strip()
    return clean if clean else None


def truncate(text: Optional[str], max_len: int) -> Optional[str]:
    """Truncate text to max_len, adding ellipsis if needed."""
    if not text or len(text) <= max_len:
        return text
    return text[:max_len - 1] + "\u2026"


def extract_image_url(entry: dict) -> Optional[str]:
    """Extract the best image URL from a feed entry."""
    # media:content / media:thumbnail
    for key in ("media_content", "media_thumbnail"):
        media = entry.get(key)
        if isinstance(media, list) and media:
            url = media[0].get("url")
            if url:
                return url.strip()

    # image field
    image = entry.get("image")
    if isinstance(image, dict):
        url = image.get("href") or image.get("url")
        if url:
            return url.strip()

    # Fallback: first image in content HTML
    content_html = None
    content = entry.get("content")
    if isinstance(content, list) and content:
        content_html = content[0].get("value", "")
    elif entry.get("summary"):
        content_html = entry["summary"]

    if content_html:
        match = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', content_html)
        if match:
            return match.group(1).strip()

    return None


def parse_published_date(entry: dict) -> Optional[str]:
    """Extract published date as ISO string from a feed entry."""
    # Try parsed time tuples first (most reliable)
    for key in ("published_parsed", "updated_parsed"):
        parsed = entry.get(key)
        if parsed:
            try:
                dt = datetime(*parsed[:6], tzinfo=timezone.utc)
                return dt.isoformat()
            except Exception:
                continue

    # Fall back to string parsing
    for key in ("published", "updated"):
        value = entry.get(key)
        if isinstance(value, str) and value.strip():
            try:
                from dateutil import parser as dateparser
                dt = dateparser.parse(value)
                if dt:
                    if dt.tzinfo is None:
                        dt = dt.replace(tzinfo=timezone.utc)
                    return dt.isoformat()
            except Exception:
                continue

    return None


def extract_author(entry: dict) -> Optional[str]:
    """Extract author name from a feed entry."""
    author = entry.get("author")
    if author:
        return author.strip()

    # dc:creator
    for key in ("dc_creator", "creator"):
        val = entry.get(key)
        if val:
            return val.strip()

    return None


# Boilerplate patterns that bloat summaries with no editorial signal.
# Stripping these before storage improves both display cleanliness and
# classification accuracy (the "Rough Draft" publisher suffix was colliding
# with the "draft" sports keyword before we tightened it; general hygiene
# prevents the next collision of that class).
_BOILERPLATE_PATTERNS = [
    # "The post <title> appeared first on <publisher>." — ubiquitous WordPress footer
    re.compile(
        r"\s*The\s+post\s+.+?\s+(?:appeared\s+first|first\s+appeared)\s+on\s+[^.]+\.?\s*$",
        re.IGNORECASE | re.DOTALL,
    ),
    # "Continue reading ..." / "Read more at ..." tail links
    re.compile(r"\s*(?:Continue\s+reading|Read\s+more)\b.*$", re.IGNORECASE | re.DOTALL),
    # Urbanize-style byline injection: "Josh Green Mon, 04/07/2026 - 17:34"
    re.compile(
        r"\s+[A-Z][a-z]+ [A-Z][a-z]+ (?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), "
        r"\d{2}/\d{2}/\d{4}\s*-\s*\d{2}:\d{2}\s*",
    ),
    # Truncation brackets that don't add information
    re.compile(r"\s*\[\s*(?:\.\.\.|…|\u2026)\s*\]\s*"),
]


def normalize_title(title: Optional[str]) -> str:
    """Normalize a title for cross-source dedup.

    Rough Draft Atlanta and Reporter Newspapers are the same publisher and
    frequently post the same story twice under identical (or nearly-identical)
    headlines. Normalization makes those duplicates visible: lowercase,
    strip all non-alphanumeric characters, collapse whitespace.
    """
    if not title:
        return ""
    t = title.lower()
    t = re.sub(r"[^a-z0-9]+", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def strip_boilerplate(text: Optional[str]) -> Optional[str]:
    """Remove WordPress / newsletter boilerplate from a summary string."""
    if not text:
        return text
    cleaned = text
    for pattern in _BOILERPLATE_PATTERNS:
        cleaned = pattern.sub(" ", cleaned)
    # Collapse whitespace left over from substitutions
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned or None


def extract_summary(entry: dict) -> Optional[str]:
    """Extract a clean text summary from a feed entry."""
    # Prefer summary over full content
    for key in ("summary", "description"):
        value = entry.get(key)
        if isinstance(value, str) and value.strip():
            clean = strip_boilerplate(strip_html(value))
            if clean and len(clean) > 20:
                return truncate(clean, 500)

    # Fall back to content
    content = entry.get("content")
    if isinstance(content, list) and content:
        value = content[0].get("value", "")
        clean = strip_boilerplate(strip_html(value))
        if clean and len(clean) > 20:
            return truncate(clean, 500)

    return None


def extract_raw_description(entry: dict) -> Optional[str]:
    """Get the raw HTML description for storage."""
    for key in ("summary", "description"):
        value = entry.get(key)
        if isinstance(value, str) and value.strip():
            return truncate(value, MAX_DESCRIPTION_CHARS)

    content = entry.get("content")
    if isinstance(content, list) and content:
        value = content[0].get("value", "")
        if value.strip():
            return truncate(value, MAX_DESCRIPTION_CHARS)

    return None


# ── Database operations ──────────────────────────────────────────────


def get_active_sources(source_slug: Optional[str] = None) -> list:
    """Fetch active network sources from the DB."""
    client = get_client()
    q = (
        client.table("network_sources")
        .select("id, name, slug, feed_url, website_url, portal_id, categories")
        .eq("is_active", True)
    )
    if source_slug:
        q = q.eq("slug", source_slug)

    result = q.order("name").execute()
    return result.data or []


def get_existing_guids(source_id: int) -> set:
    """Get all known guids for a source to avoid re-inserting."""
    client = get_client()
    result = (
        client.table("network_posts")
        .select("guid")
        .eq("source_id", source_id)
        .not_.is_("guid", "null")
        .execute()
    )
    return {row["guid"] for row in (result.data or [])}


def get_existing_urls(source_id: int) -> set:
    """Get all known post URLs for a source."""
    client = get_client()
    result = (
        client.table("network_posts")
        .select("url")
        .eq("source_id", source_id)
        .execute()
    )
    return {row["url"] for row in (result.data or [])}


def get_recent_title_hashes(days: int = 14, portal_id: Optional[str] = None) -> set:
    """Return normalized titles of posts published within the last ``days``
    across all sources. Used for cross-source dedup so syndicated stories
    (Rough Draft + Reporter Newspapers carry the same piece) land once."""
    client = get_client()
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    query = (
        client.table("network_posts")
        .select("title")
        .gte("published_at", cutoff)
    )
    if portal_id:
        query = query.eq("portal_id", portal_id)
    result = query.execute()
    return {normalize_title(row["title"]) for row in (result.data or []) if row.get("title")}


def insert_posts(posts: list, dry_run: bool = False) -> int:
    """Insert new posts into network_posts. Returns count inserted."""
    if not posts or dry_run:
        return len(posts)

    client = get_client()
    # Insert in batches to avoid payload limits
    batch_size = 50
    inserted = 0
    for i in range(0, len(posts), batch_size):
        batch = posts[i:i + batch_size]
        try:
            client.table("network_posts").insert(batch).execute()
            inserted += len(batch)
        except Exception as e:
            logger.error(f"  Insert error: {e}")
            # Try one-by-one for partial success
            for post in batch:
                try:
                    client.table("network_posts").insert(post).execute()
                    inserted += 1
                except Exception as inner_e:
                    logger.error(f"  Skip post '{post.get('title', '?')[:50]}': {inner_e}")
    return inserted


def update_source_status(source_id: int, error: Optional[str] = None):
    """Update last_fetched_at (and optionally error) on a source."""
    client = get_client()
    update = {
        "last_fetched_at": datetime.now(timezone.utc).isoformat(),
        "fetch_error": error,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        client.table("network_sources").update(update).eq("id", source_id).execute()
    except Exception as e:
        logger.warning(f"  Could not update source status: {e}")


def prune_old_posts(
    retention_days: int,
    dry_run: bool = False,
    source_id: Optional[int] = None,
) -> int:
    """Delete stale network posts older than retention_days.

    Uses published_at when available. Falls back to created_at for rows with
    null published_at.
    """
    if retention_days <= 0:
        return 0

    cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)
    cutoff_iso = cutoff.isoformat()
    client = get_client()

    # 1) Rows with explicit published_at older than cutoff
    q_published = (
        client.table("network_posts")
        .select("id", count="exact")
        .lt("published_at", cutoff_iso)
    )
    if source_id:
        q_published = q_published.eq("source_id", source_id)
    old_published = q_published.execute().count or 0

    # 2) Rows with null published_at and stale created_at
    q_null_pub = (
        client.table("network_posts")
        .select("id", count="exact")
        .is_("published_at", "null")
        .lt("created_at", cutoff_iso)
    )
    if source_id:
        q_null_pub = q_null_pub.eq("source_id", source_id)
    old_null_pub = q_null_pub.execute().count or 0

    total_to_prune = old_published + old_null_pub
    if total_to_prune == 0:
        logger.info(
            f"  Retention cleanup: nothing older than {retention_days} days "
            f"(cutoff {cutoff.date().isoformat()})"
        )
        return 0

    logger.info(
        f"  Retention cleanup: {'would remove' if dry_run else 'removing'} "
        f"{total_to_prune} posts older than {retention_days} days "
        f"(cutoff {cutoff.date().isoformat()})"
    )

    if dry_run:
        return total_to_prune

    delete_published = client.table("network_posts").delete().lt("published_at", cutoff_iso)
    if source_id:
        delete_published = delete_published.eq("source_id", source_id)
    delete_published.execute()

    delete_null_pub = (
        client.table("network_posts")
        .delete()
        .is_("published_at", "null")
        .lt("created_at", cutoff_iso)
    )
    if source_id:
        delete_null_pub = delete_null_pub.eq("source_id", source_id)
    delete_null_pub.execute()

    return total_to_prune


# ── Feed fetching & parsing ──────────────────────────────────────────


def fetch_feed(feed_url: str, timeout: int = 30) -> Optional[str]:
    """Fetch raw feed content via HTTP."""
    try:
        resp = requests.get(feed_url, headers=HEADERS, timeout=timeout)
        resp.raise_for_status()
        return resp.text
    except requests.RequestException as e:
        logger.error(f"  Fetch failed: {e}")
        return None


def is_wp_json_endpoint(feed_url: str) -> bool:
    """WordPress REST API endpoint for posts — used as fallback when a site's
    RSS feed is broken or frozen (e.g., ArtsATL whose /feed/ is stuck on a
    single 2023 post but whose /wp-json/wp/v2/posts is daily-fresh)."""
    return "/wp-json/wp/v2/posts" in feed_url


def parse_wp_json_posts(json_text: str) -> list:
    """Transform WordPress REST API post JSON into feedparser-compatible
    entry dicts so the existing parse_feed_entries code path can consume
    them unchanged."""
    import json
    try:
        data = json.loads(json_text)
    except json.JSONDecodeError as e:
        logger.warning(f"  WP-JSON parse error: {e}")
        return []
    entries = []
    for post in data:
        # WP returns date in ISO like "2026-04-17T13:00:00"
        date_str = post.get("date_gmt") or post.get("date") or ""
        try:
            dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            published_parsed = dt.timetuple()
        except (ValueError, AttributeError):
            published_parsed = None

        title = (post.get("title") or {}).get("rendered") or ""
        summary_html = (post.get("excerpt") or {}).get("rendered") or ""
        content_html = (post.get("content") or {}).get("rendered") or ""
        link = post.get("link") or ""
        guid = str(post.get("id") or link)

        entry = {
            "title": strip_html(title),
            "link": link,
            "id": guid,
            "guid": guid,
            "summary": strip_html(summary_html),
            "description": summary_html,  # raw HTML preserved
            "content": [{"value": content_html}] if content_html else [],
            "published_parsed": published_parsed,
            "updated_parsed": published_parsed,
            "author": post.get("_embedded", {}).get("author", [{}])[0].get("name") if post.get("_embedded") else None,
            "tags": [],
        }
        entries.append(entry)
    return entries


class _SyntheticFeed:
    """Minimal feedparser.FeedParserDict stand-in for our WP-JSON path.
    Only exposes .entries and .bozo, which is all parse_feed_entries
    actually consumes."""
    def __init__(self, entries):
        self.entries = entries
        self.bozo = False
        self.feed = {}
        self.bozo_exception = None


def fetch_and_parse(feed_url: str):
    """Return a feedparser-like object for either RSS/Atom or WP-JSON sources."""
    raw = fetch_feed(feed_url)
    if raw is None:
        return None, None
    if is_wp_json_endpoint(feed_url):
        entries = parse_wp_json_posts(raw)
        return raw, _SyntheticFeed(entries)
    return raw, feedparser.parse(raw)


def parse_feed_entries(
    raw_xml: str,
    source: dict,
    existing_guids: set,
    existing_urls: set,
    limit: int = 20,
    min_published_at: Optional[datetime] = None,
    pre_parsed_feed=None,
    cross_source_title_hashes: Optional[set] = None,
) -> list:
    """Parse RSS/Atom feed and return list of new post dicts ready for insert.

    If ``pre_parsed_feed`` is provided (e.g., from the WP-JSON adapter), skip
    feedparser and use that object directly. It must have .entries and .bozo.

    ``cross_source_title_hashes`` is a set of normalized titles already in the
    DB from any source within the recent window; posts whose normalized title
    matches are skipped. This prevents syndicated duplicates between e.g.
    Rough Draft Atlanta and Reporter Newspapers.
    """
    feed = pre_parsed_feed if pre_parsed_feed is not None else feedparser.parse(raw_xml)

    if feed.bozo and not feed.entries:
        logger.warning(f"  Feed parse error: {feed.bozo_exception}")
        return []

    new_posts = []
    skipped_dup = 0
    skipped_old = 0
    skipped_sponsored = 0
    skipped_nonlocal = 0
    skipped_cross_dup = 0
    requires_ga = source.get("slug") in SOURCES_REQUIRING_GA_LOCALITY
    cross_titles = cross_source_title_hashes if cross_source_title_hashes is not None else set()

    for entry in feed.entries:
        title = (entry.get("title") or "").strip()
        link = (entry.get("link") or entry.get("id") or "").strip()

        if not title or not link:
            continue

        # Reject paid SEO / affiliate placements before any other work.
        if is_sponsored_post(title, link):
            skipped_sponsored += 1
            logger.info(f"  [sponsored] skipped: {title[:80]}")
            continue

        # Per-source locality gate (currently only GPB News).
        if requires_ga:
            summary_preview = extract_summary(entry)
            if not has_ga_locality(title, summary_preview):
                skipped_nonlocal += 1
                continue

        # Dedup by guid first, then URL
        guid = (entry.get("id") or entry.get("guid") or "").strip() or None
        if guid and guid in existing_guids:
            skipped_dup += 1
            continue
        if link in existing_urls:
            skipped_dup += 1
            continue

        # Cross-source dedup: syndicated stories from sibling publishers
        title_hash = normalize_title(title)
        if title_hash and title_hash in cross_titles:
            skipped_cross_dup += 1
            continue

        published_at = parse_published_date(entry)
        if min_published_at and published_at:
            try:
                published_dt = datetime.fromisoformat(published_at.replace("Z", "+00:00"))
                if published_dt < min_published_at:
                    skipped_old += 1
                    continue
            except Exception:
                pass

        summary = extract_summary(entry)
        source_categories = source.get("categories") or []
        categories = classify_post(entry, source_categories, title, summary)

        post = {
            "source_id": source["id"],
            "portal_id": source["portal_id"],
            "title": title,
            "url": link,
            "guid": guid,
            "author": extract_author(entry),
            "summary": summary,
            "image_url": extract_image_url(entry),
            "published_at": published_at,
            "raw_description": extract_raw_description(entry),
            "categories": categories,
        }

        new_posts.append(post)

        # Track for within-batch dedup
        if guid:
            existing_guids.add(guid)
        existing_urls.add(link)
        if title_hash:
            cross_titles.add(title_hash)

        if len(new_posts) >= limit:
            break

    if skipped_dup:
        logger.info(f"  Skipped {skipped_dup} already-known posts")
    if skipped_old:
        logger.info(f"  Skipped {skipped_old} older-than-window posts")
    if skipped_sponsored:
        logger.info(f"  Skipped {skipped_sponsored} sponsored / affiliate posts")
    if skipped_nonlocal:
        logger.info(f"  Skipped {skipped_nonlocal} non-Georgia wire posts")
    if skipped_cross_dup:
        logger.info(f"  Skipped {skipped_cross_dup} cross-source duplicates")

    return new_posts


# ── Main ─────────────────────────────────────────────────────────────


def process_source(
    source: dict,
    limit: int = 20,
    dry_run: bool = False,
    min_published_at: Optional[datetime] = None,
) -> tuple:
    """Fetch and process a single network source. Returns (found, new)."""
    name = source["name"]
    feed_url = source["feed_url"]

    logger.info(f"\n{'─' * 60}")
    logger.info(f"  {name}")
    logger.info(f"  {feed_url}")

    raw_xml, parsed_feed = fetch_and_parse(feed_url)
    if not raw_xml or parsed_feed is None:
        if not dry_run:
            update_source_status(source["id"], error="Fetch failed")
        return 0, 0

    existing_guids = set() if dry_run else get_existing_guids(source["id"])
    existing_urls = set() if dry_run else get_existing_urls(source["id"])
    # Scope cross-source dedup to the same portal so e.g. atlanta sources
    # don't collide with helpatl sources just because civic/atlanta stories
    # have similar headlines.
    cross_titles = (
        set()
        if dry_run
        else get_recent_title_hashes(days=14, portal_id=source.get("portal_id"))
    )

    new_posts = parse_feed_entries(
        raw_xml,
        source,
        existing_guids,
        existing_urls,
        limit,
        min_published_at=min_published_at,
        pre_parsed_feed=parsed_feed,
        cross_source_title_hashes=cross_titles,
    )

    total_entries = len(parsed_feed.entries or [])
    logger.info(f"  Feed entries: {total_entries}, new: {len(new_posts)}")

    if new_posts:
        action = "Would insert" if dry_run else "Inserting"
        logger.info(f"  {action} {len(new_posts)} posts:")
        for p in new_posts[:5]:
            pub = p.get("published_at", "?")[:10] if p.get("published_at") else "no date"
            logger.info(f"    [{pub}] {p['title'][:70]}")
        if len(new_posts) > 5:
            logger.info(f"    ... and {len(new_posts) - 5} more")

        inserted = insert_posts(new_posts, dry_run=dry_run)
        if not dry_run:
            update_source_status(source["id"])
        return total_entries, inserted

    if not dry_run:
        update_source_status(source["id"])
    return total_entries, 0


def show_stats():
    """Print current network feed stats."""
    client = get_client()

    sources = (
        client.table("network_sources")
        .select("id, name, slug, is_active, last_fetched_at, fetch_error, categories")
        .order("name")
        .execute()
    ).data or []

    logger.info(f"\nNetwork Sources: {len(sources)}")
    logger.info("=" * 70)

    for s in sources:
        status = "active" if s["is_active"] else "inactive"
        fetched = s.get("last_fetched_at", "never")[:19] if s.get("last_fetched_at") else "never"
        error = f" ERROR: {s['fetch_error']}" if s.get("fetch_error") else ""
        cats = ", ".join(s.get("categories") or [])

        # Count posts for this source
        count_result = (
            client.table("network_posts")
            .select("id", count="exact")
            .eq("source_id", s["id"])
            .execute()
        )
        post_count = count_result.count if count_result.count is not None else 0

        logger.info(f"  {s['name']}")
        logger.info(f"    slug: {s['slug']}  status: {status}  posts: {post_count}")
        logger.info(f"    categories: {cats}")
        logger.info(f"    last fetch: {fetched}{error}")


def main():
    parser = argparse.ArgumentParser(
        description="Fetch RSS feeds from independent Atlanta network sources"
    )
    parser.add_argument("--source", type=str, metavar="SLUG",
                        help="Fetch a specific source by slug")
    parser.add_argument("--limit", type=int, default=20,
                        help="Max posts to import per source (default: 20)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Fetch and parse but don't write to DB")
    parser.add_argument("--stats", action="store_true",
                        help="Show current network feed stats and exit")
    parser.add_argument("--verbose", action="store_true",
                        help="Enable debug logging")
    parser.add_argument(
        "--retention-days",
        type=int,
        default=DEFAULT_RETENTION_DAYS,
        help=f"Prune posts older than this many days (default: {DEFAULT_RETENTION_DAYS}, 0 disables)",
    )
    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    if args.stats:
        show_stats()
        return

    sources = get_active_sources(source_slug=args.source)
    if not sources:
        if args.source:
            logger.error(f"Source '{args.source}' not found or not active")
        else:
            logger.error("No active network sources found. Run the migration first.")
        sys.exit(1)

    logger.info("Network Feed Crawler")
    logger.info(f"Sources: {len(sources)}")
    if args.dry_run:
        logger.info("Mode: DRY RUN (no writes)")
    logger.info(f"Limit: {args.limit} posts per source")
    if args.retention_days > 0:
        logger.info(f"Retention: prune posts older than {args.retention_days} days")
    else:
        logger.info("Retention: disabled")

    total_found = 0
    total_new = 0
    errors = 0
    source_results = []

    min_published_at = None
    if args.retention_days > 0:
        min_published_at = datetime.now(timezone.utc) - timedelta(days=args.retention_days)

    for source in sources:
        try:
            found, new = process_source(
                source,
                limit=args.limit,
                dry_run=args.dry_run,
                min_published_at=min_published_at,
            )
            total_found += found
            total_new += new
            source_results.append({
                "name": source["name"],
                "slug": source["slug"],
                "found": found,
                "new": new,
            })
        except Exception as e:
            logger.error(f"  ERROR processing {source['name']}: {e}")
            errors += 1
            source_results.append({
                "name": source["name"],
                "slug": source["slug"],
                "found": 0,
                "new": 0,
            })
            if not args.dry_run:
                update_source_status(source["id"], error=str(e)[:200])

        # Be polite between sources
        time.sleep(1)

    source_id_for_prune = sources[0]["id"] if args.source and len(sources) == 1 else None
    pruned = prune_old_posts(
        retention_days=args.retention_days,
        dry_run=args.dry_run,
        source_id=source_id_for_prune,
    )

    logger.info(f"\n{'=' * 60}")
    logger.info("Done!")
    logger.info(f"  Sources processed: {len(sources)}")
    logger.info(f"  Feed entries found: {total_found}")
    logger.info(f"  New posts imported: {total_new}")
    logger.info(f"  Old posts pruned: {pruned}")
    logger.info("  New posts by source:")
    for item in sorted(source_results, key=lambda x: x["new"], reverse=True):
        logger.info(f"    {item['slug']}: +{item['new']} (entries: {item['found']})")
    if errors:
        logger.info(f"  Errors: {errors}")
    if args.dry_run:
        logger.info("  (dry run — nothing written)")


if __name__ == "__main__":
    main()
