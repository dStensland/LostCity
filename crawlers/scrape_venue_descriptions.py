#!/usr/bin/env python3
"""
Scrape short descriptions from venue websites using meta tags.

Extracts from (in priority order):
1. <meta name="description">
2. <meta property="og:description">
3. <meta name="twitter:description">

Usage:
    python3 scrape_venue_descriptions.py --limit 200
    python3 scrape_venue_descriptions.py --venue-type bar --limit 50
    python3 scrape_venue_descriptions.py --dry-run
"""

import sys
import time
import logging
import argparse
import requests
from pathlib import Path
from typing import Optional
from bs4 import BeautifulSoup
from dotenv import load_dotenv

env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

sys.path.insert(0, str(Path(__file__).parent))
from db import get_client

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}

# Junk descriptions to skip (generic CMS boilerplate, etc.)
JUNK_PATTERNS = [
    "website", "home page", "official site", "welcome to",
    "wordpress", "squarespace", "wix", "godaddy",
    "just another", "coming soon", "under construction",
    "page not found", "404", "access denied", "403",
    "log in", "sign in", "sign up",
]

MIN_LENGTH = 30
MAX_LENGTH = 500


def clean_description(text: Optional[str]) -> Optional[str]:
    """Clean and validate a description string."""
    if not text:
        return None

    text = text.strip()

    if len(text) < MIN_LENGTH:
        return None

    # Check for junk patterns
    text_lower = text.lower()
    for pattern in JUNK_PATTERNS:
        if text_lower.startswith(pattern):
            return None

    # Truncate if too long
    if len(text) > MAX_LENGTH:
        # Try to cut at a sentence boundary
        cut = text[:MAX_LENGTH].rfind(". ")
        if cut > MIN_LENGTH:
            text = text[:cut + 1]
        else:
            text = text[:MAX_LENGTH].rsplit(" ", 1)[0] + "..."

    return text


def extract_description(url: str) -> Optional[str]:
    """Fetch a URL and extract description from meta tags."""
    try:
        resp = requests.get(url, headers=HEADERS, timeout=10, allow_redirects=True)
        resp.raise_for_status()

        soup = BeautifulSoup(resp.text, "html.parser")

        # Priority 1: meta description
        meta = soup.find("meta", attrs={"name": "description"})
        if meta and meta.get("content"):
            desc = clean_description(meta["content"])
            if desc:
                return desc

        # Priority 2: og:description
        meta = soup.find("meta", attrs={"property": "og:description"})
        if meta and meta.get("content"):
            desc = clean_description(meta["content"])
            if desc:
                return desc

        # Priority 3: twitter:description
        meta = soup.find("meta", attrs={"name": "twitter:description"})
        if meta and meta.get("content"):
            desc = clean_description(meta["content"])
            if desc:
                return desc

        return None

    except Exception as e:
        logger.debug(f"  Error fetching {url}: {e}")
        return None


def scrape_descriptions(
    limit: int = 200,
    venue_type: Optional[str] = None,
    dry_run: bool = False,
) -> dict:
    """Scrape descriptions for venues that have websites but no descriptions."""
    client = get_client()

    # Build query: active venues with website, missing description
    query = (
        client.table("venues")
        .select("id,name,slug,website,venue_type,description")
        .eq("active", True)
        .not_.is_("website", "null")
        .is_("description", "null")
    )

    if venue_type:
        query = query.eq("venue_type", venue_type)

    result = query.order("name").limit(limit).execute()
    venues = result.data or []

    stats = {"total": len(venues), "found": 0, "failed": 0, "skipped": 0}

    logger.info(f"Found {len(venues)} venues with websites but no description")
    logger.info("=" * 60)

    for i, v in enumerate(venues, 1):
        name = v["name"][:50]
        website = v.get("website", "")
        logger.info(f"[{i}/{len(venues)}] {name}")

        if not website:
            stats["skipped"] += 1
            continue

        desc = extract_description(website)

        if desc:
            logger.info(f"  FOUND: {desc[:80]}...")
            if not dry_run:
                client.table("venues").update({"description": desc}).eq("id", v["id"]).execute()
            stats["found"] += 1
        else:
            logger.info(f"  No description found")
            stats["failed"] += 1

        time.sleep(0.5)

    logger.info(f"\n{'=' * 60}")
    logger.info(f"RESULTS")
    logger.info(f"{'=' * 60}")
    logger.info(f"Total processed: {stats['total']}")
    logger.info(f"Descriptions found: {stats['found']}")
    logger.info(f"No description: {stats['failed']}")
    logger.info(f"Skipped: {stats['skipped']}")

    return stats


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Scrape venue descriptions from websites")
    parser.add_argument("--limit", type=int, default=200, help="Max venues to process")
    parser.add_argument("--venue-type", type=str, help="Filter by venue type")
    parser.add_argument("--dry-run", action="store_true", help="Don't update database")
    args = parser.parse_args()

    scrape_descriptions(limit=args.limit, venue_type=args.venue_type, dry_run=args.dry_run)
