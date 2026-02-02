#!/usr/bin/env python3
"""
Scrape hero images from venue websites.

Looks for:
1. og:image meta tag (most reliable)
2. twitter:image meta tag
3. Large hero/banner images

Usage:
    python scrape_venue_images.py --limit 50
    python scrape_venue_images.py --venue-type bar --limit 20
    python scrape_venue_images.py --dry-run
"""

import os
import sys
import time
import logging
import argparse
import requests
from pathlib import Path
from typing import Optional
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
from dotenv import load_dotenv

# Load .env file from project root
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

# Add parent to path for db module
sys.path.insert(0, str(Path(__file__).parent))
from db import get_client

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

# Request settings
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}

# Minimum image dimensions to consider
MIN_WIDTH = 400
MIN_HEIGHT = 300

# Skip these domains (CDNs without useful images, social media, etc.)
SKIP_DOMAINS = {
    "facebook.com", "twitter.com", "instagram.com", "linkedin.com",
    "google.com", "gstatic.com", "googleusercontent.com",
    "gravatar.com", "wp.com", "wordpress.com",
}

# Skip images with these patterns (logos, icons, etc.)
SKIP_PATTERNS = [
    "logo", "icon", "favicon", "sprite", "button", "arrow",
    "facebook", "twitter", "instagram", "linkedin", "pinterest",
    "share", "social", "email", "print", "rss",
    "placeholder", "default", "blank", "spacer",
    "1x1", "pixel", "tracking",
]


def is_valid_image_url(url: str) -> bool:
    """Check if URL looks like a valid image we want."""
    if not url:
        return False

    url_lower = url.lower()

    # Must be http/https
    if not url_lower.startswith(("http://", "https://")):
        return False

    # Check for skip patterns
    for pattern in SKIP_PATTERNS:
        if pattern in url_lower:
            return False

    # Check domain
    try:
        domain = urlparse(url).netloc.lower()
        for skip in SKIP_DOMAINS:
            if skip in domain:
                return False
    except:
        return False

    # Should look like an image
    image_extensions = (".jpg", ".jpeg", ".png", ".webp", ".gif")
    has_extension = any(url_lower.endswith(ext) or f"{ext}?" in url_lower for ext in image_extensions)
    has_image_path = "/image" in url_lower or "/photo" in url_lower or "/img" in url_lower

    return has_extension or has_image_path or "cdn" in url_lower


def get_og_image(soup: BeautifulSoup, base_url: str) -> Optional[str]:
    """Extract og:image or twitter:image from page."""
    # Try og:image first (most common)
    og_image = soup.find("meta", property="og:image")
    if og_image and og_image.get("content"):
        url = og_image["content"]
        if is_valid_image_url(url):
            return url
        # Try making it absolute
        absolute = urljoin(base_url, url)
        if is_valid_image_url(absolute):
            return absolute

    # Try twitter:image
    twitter_image = soup.find("meta", {"name": "twitter:image"})
    if twitter_image and twitter_image.get("content"):
        url = twitter_image["content"]
        if is_valid_image_url(url):
            return url
        absolute = urljoin(base_url, url)
        if is_valid_image_url(absolute):
            return absolute

    return None


def get_hero_image(soup: BeautifulSoup, base_url: str) -> Optional[str]:
    """Try to find a hero/banner image in the page."""
    # Common hero image selectors
    hero_selectors = [
        "header img",
        ".hero img",
        ".banner img",
        ".header-image img",
        ".hero-image img",
        "#hero img",
        ".jumbotron img",
        ".cover img",
        ".featured-image img",
        "main img",
        "article img",
    ]

    for selector in hero_selectors:
        try:
            img = soup.select_one(selector)
            if img:
                src = img.get("src") or img.get("data-src") or img.get("data-lazy-src")
                if src:
                    absolute = urljoin(base_url, src)
                    if is_valid_image_url(absolute):
                        return absolute
        except:
            continue

    return None


def get_large_image(soup: BeautifulSoup, base_url: str) -> Optional[str]:
    """Find the first large image on the page."""
    images = soup.find_all("img")

    for img in images[:20]:  # Only check first 20 images
        src = img.get("src") or img.get("data-src") or img.get("data-lazy-src")
        if not src:
            continue

        absolute = urljoin(base_url, src)
        if not is_valid_image_url(absolute):
            continue

        # Check dimensions if available
        width = img.get("width", "0")
        height = img.get("height", "0")

        try:
            w = int(str(width).replace("px", ""))
            h = int(str(height).replace("px", ""))
            if w >= MIN_WIDTH and h >= MIN_HEIGHT:
                return absolute
        except:
            pass

        # If no dimensions, check if it looks like a content image
        # (not in nav, footer, sidebar)
        parent = img.parent
        skip = False
        for _ in range(5):
            if parent is None:
                break
            parent_class = " ".join(parent.get("class", []))
            parent_id = parent.get("id", "")
            if any(x in parent_class.lower() or x in parent_id.lower()
                   for x in ["nav", "footer", "sidebar", "menu", "widget"]):
                skip = True
                break
            parent = parent.parent

        if not skip:
            return absolute

    return None


def scrape_image_from_website(url: str) -> Optional[str]:
    """Scrape a hero/og image from a website."""
    try:
        response = requests.get(
            url,
            headers=HEADERS,
            timeout=10,
            allow_redirects=True
        )
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")

        # Try methods in order of reliability
        image = get_og_image(soup, url)
        if image:
            return image

        image = get_hero_image(soup, url)
        if image:
            return image

        image = get_large_image(soup, url)
        if image:
            return image

        return None

    except requests.exceptions.Timeout:
        logger.debug(f"    Timeout: {url}")
        return None
    except requests.exceptions.RequestException as e:
        logger.debug(f"    Request error: {e}")
        return None
    except Exception as e:
        logger.debug(f"    Error: {e}")
        return None


def get_venues_needing_images(
    venue_type: Optional[str] = None,
    limit: int = 50,
) -> list[dict]:
    """Get venues that have websites but no images."""
    client = get_client()

    query = client.table("venues").select(
        "id, name, slug, website, image_url, venue_type"
    ).eq("active", True)

    # Must have website
    query = query.not_.is_("website", "null")

    # Must not have image
    query = query.is_("image_url", "null")

    if venue_type:
        query = query.eq("venue_type", venue_type)

    query = query.limit(limit)

    result = query.execute()
    return result.data or []


def update_venue_image(venue_id: int, image_url: str, dry_run: bool = False) -> bool:
    """Update venue with scraped image."""
    if dry_run:
        return True

    client = get_client()
    try:
        client.table("venues").update({"image_url": image_url}).eq("id", venue_id).execute()
        return True
    except Exception as e:
        logger.error(f"    Update error: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Scrape images from venue websites")
    parser.add_argument("--venue-type", help="Filter by venue type (bar, restaurant, etc.)")
    parser.add_argument("--limit", type=int, default=50, help="Max venues to process")
    parser.add_argument("--dry-run", action="store_true", help="Preview without updating")
    args = parser.parse_args()

    logger.info("=" * 60)
    logger.info("Scraping Venue Images from Websites")
    logger.info("=" * 60)

    venues = get_venues_needing_images(args.venue_type, args.limit)
    logger.info(f"Found {len(venues)} venues with websites but no images")
    logger.info("")

    scraped = 0
    failed = 0

    for venue in venues:
        name = venue["name"]
        website = venue["website"]

        if not website:
            continue

        # Ensure URL has protocol
        if not website.startswith("http"):
            website = "https://" + website

        image_url = scrape_image_from_website(website)

        if image_url:
            if args.dry_run:
                logger.info(f"  FOUND: {name}")
                logger.info(f"         {image_url[:80]}...")
            else:
                success = update_venue_image(venue["id"], image_url)
                if success:
                    logger.info(f"  SCRAPED: {name}")
                    scraped += 1
                else:
                    logger.info(f"  ERROR: {name}")
                    failed += 1
        else:
            logger.info(f"  NO IMAGE: {name} ({website[:40]}...)")
            failed += 1

        # Be nice to servers
        time.sleep(1)

    logger.info("")
    logger.info("=" * 60)
    logger.info(f"Done! Scraped: {scraped}, Failed/Skipped: {failed}")
    if args.dry_run:
        logger.info("(Dry run - no changes made)")


if __name__ == "__main__":
    main()
