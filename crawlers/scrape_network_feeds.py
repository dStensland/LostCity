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
"""

import sys
import time
import logging
import argparse
from datetime import datetime, timezone
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

# ── Per-post classification ──────────────────────────────────────────

# Valid filter categories for the network feed
VALID_CATEGORIES = {"news", "culture", "arts", "food", "music", "community", "civic", "politics"}

# Keywords that signal a post belongs to a given category.
# Checked against lowercased title + summary.
CATEGORY_KEYWORDS = {
    "news": [
        "development", "zoning", "transit", "startup", "investigation",
        "officials", "breaking", "report", "announced", "update",
    ],
    "arts": [
        "gallery", "museum", "sculpture", "theater", "theatre",
        "performance", "photography", "exhibition", "mural", "visual art",
    ],
    "culture": [
        "festival", "literary", "book", "film", "screening", "poetry",
        "open mic", "culture", "heritage", "documentary",
    ],
    "food": [
        "restaurant", "chef", "dining", "brunch", "cocktail", "brewery",
        "grand opening", "now open", "menu", "food hall", "tasting", "recipe",
        "bakery", "cafe", "distillery",
    ],
    "music": [
        "concert", "band", "album", "dj", "hip-hop", "hip hop", "jazz",
        "live music", "vinyl", "rapper", "singer", "songwriter", "tour",
    ],
    "community": [
        "volunteer", "nonprofit", "mutual aid", "neighborhood",
        "grassroots", "community", "fundraiser", "donation",
    ],
    "civic": [
        "city council", "election", "ballot", "zoning", "budget",
        "public hearing", "ordinance", "infrastructure", "marta",
    ],
    "politics": [
        "political", "campaign", "governor", "legislature", "protest",
        "crime", "policy", "democrat", "republican", "senator",
    ],
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
    2. Keyword matching against title + summary
    3. Fall back to the source's categories
    """
    matched = set()

    # 1. RSS tags — feedparser exposes <category> as entry["tags"]
    rss_tags = entry.get("tags") or []
    for tag_obj in rss_tags:
        term = (tag_obj.get("term") or "").strip().lower()
        if term in VALID_CATEGORIES:
            matched.add(term)
        # Also check if a tag keyword-maps to a category
        for cat, keywords in CATEGORY_KEYWORDS.items():
            if any(kw in term for kw in keywords):
                matched.add(cat)

    # 2. Keyword matching on title + summary
    text = (title + " " + (summary or "")).lower()
    for cat, keywords in CATEGORY_KEYWORDS.items():
        if any(kw in text for kw in keywords):
            matched.add(cat)

    # 3. Fallback to source categories if nothing matched
    if not matched:
        matched = {c for c in (source_categories or []) if c in VALID_CATEGORIES}

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


def extract_summary(entry: dict) -> Optional[str]:
    """Extract a clean text summary from a feed entry."""
    # Prefer summary over full content
    for key in ("summary", "description"):
        value = entry.get(key)
        if isinstance(value, str) and value.strip():
            clean = strip_html(value)
            if clean and len(clean) > 20:
                return truncate(clean, 500)

    # Fall back to content
    content = entry.get("content")
    if isinstance(content, list) and content:
        value = content[0].get("value", "")
        clean = strip_html(value)
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


def parse_feed_entries(
    raw_xml: str,
    source: dict,
    existing_guids: set,
    existing_urls: set,
    limit: int = 20,
) -> list:
    """Parse RSS/Atom feed and return list of new post dicts ready for insert."""
    feed = feedparser.parse(raw_xml)

    if feed.bozo and not feed.entries:
        logger.warning(f"  Feed parse error: {feed.bozo_exception}")
        return []

    new_posts = []
    skipped_dup = 0

    for entry in feed.entries:
        title = (entry.get("title") or "").strip()
        link = (entry.get("link") or entry.get("id") or "").strip()

        if not title or not link:
            continue

        # Dedup by guid first, then URL
        guid = (entry.get("id") or entry.get("guid") or "").strip() or None
        if guid and guid in existing_guids:
            skipped_dup += 1
            continue
        if link in existing_urls:
            skipped_dup += 1
            continue

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
            "published_at": parse_published_date(entry),
            "raw_description": extract_raw_description(entry),
            "categories": categories,
        }

        new_posts.append(post)

        # Track for within-batch dedup
        if guid:
            existing_guids.add(guid)
        existing_urls.add(link)

        if len(new_posts) >= limit:
            break

    if skipped_dup:
        logger.info(f"  Skipped {skipped_dup} already-known posts")

    return new_posts


# ── Main ─────────────────────────────────────────────────────────────


def process_source(source: dict, limit: int = 20, dry_run: bool = False) -> tuple:
    """Fetch and process a single network source. Returns (found, new)."""
    name = source["name"]
    feed_url = source["feed_url"]

    logger.info(f"\n{'─' * 60}")
    logger.info(f"  {name}")
    logger.info(f"  {feed_url}")

    raw_xml = fetch_feed(feed_url)
    if not raw_xml:
        if not dry_run:
            update_source_status(source["id"], error="Fetch failed")
        return 0, 0

    existing_guids = set() if dry_run else get_existing_guids(source["id"])
    existing_urls = set() if dry_run else get_existing_urls(source["id"])

    new_posts = parse_feed_entries(raw_xml, source, existing_guids, existing_urls, limit)

    feed = feedparser.parse(raw_xml)
    total_entries = len(feed.entries or [])
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

    logger.info(f"Network Feed Crawler")
    logger.info(f"Sources: {len(sources)}")
    if args.dry_run:
        logger.info("Mode: DRY RUN (no writes)")
    logger.info(f"Limit: {args.limit} posts per source")

    total_found = 0
    total_new = 0
    errors = 0

    for source in sources:
        try:
            found, new = process_source(source, limit=args.limit, dry_run=args.dry_run)
            total_found += found
            total_new += new
        except Exception as e:
            logger.error(f"  ERROR processing {source['name']}: {e}")
            errors += 1
            if not args.dry_run:
                update_source_status(source["id"], error=str(e)[:200])

        # Be polite between sources
        time.sleep(1)

    logger.info(f"\n{'=' * 60}")
    logger.info(f"Done!")
    logger.info(f"  Sources processed: {len(sources)}")
    logger.info(f"  Feed entries found: {total_found}")
    logger.info(f"  New posts imported: {total_new}")
    if errors:
        logger.info(f"  Errors: {errors}")
    if args.dry_run:
        logger.info(f"  (dry run — nothing written)")


if __name__ == "__main__":
    main()
