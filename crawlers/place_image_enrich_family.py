#!/usr/bin/env python3
"""
Venue image enrichment for the Family Portal.

Fetches og:image (and fallbacks) from venue websites for family-portal venues
that currently have no image_url. Operates in --dry-run mode by default;
pass --apply to write changes to the database.

Usage:
    python venue_image_enrich_family.py                 # dry-run, first 100
    python venue_image_enrich_family.py --limit 50      # dry-run, first 50
    python venue_image_enrich_family.py --apply         # write to DB
    python venue_image_enrich_family.py --apply --limit 200
"""

from __future__ import annotations

import argparse
import logging
import sys
import time
from pathlib import Path
from typing import Optional
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

# Load .env from repo root before importing db/config
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

sys.path.insert(0, str(Path(__file__).parent))
from db.client import get_client  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# HTTP settings
# ---------------------------------------------------------------------------

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}

REQUEST_TIMEOUT = 12  # seconds
POLITE_DELAY = 1.0  # seconds between requests

# ---------------------------------------------------------------------------
# Image filtering
# ---------------------------------------------------------------------------

# Domains that produce useless social/CDN images
_SKIP_DOMAINS = frozenset(
    {
        "facebook.com",
        "twitter.com",
        "instagram.com",
        "linkedin.com",
        "google.com",
        "gstatic.com",
        "googleusercontent.com",
        "gravatar.com",
        "wordpress.com",
        "wp.com",
    }
)

# URL substrings that signal logos / icons / tracking pixels
_SKIP_PATTERNS = (
    "logo",
    "icon",
    "favicon",
    "sprite",
    "arrow",
    "facebook",
    "twitter",
    "instagram",
    "linkedin",
    "pinterest",
    "share",
    "social",
    "email",
    "rss",
    "placeholder",
    "default",
    "blank",
    "spacer",
    "1x1",
    "pixel",
    "tracking",
    "graphic_",  # SVG graphic assets (e.g. graphic_maintag.svg)
    ".svg",       # SVG files are usually icons/logos, not photos
)

# Structural HTML containers that indicate nav / chrome (skip images inside)
_NAV_CONTAINERS = ("nav", "footer", "sidebar", "menu", "widget")


def _is_valid_image_url(url: str) -> bool:
    """Return True if url looks like a real content image worth storing."""
    if not url:
        return False
    url_lower = url.lower()
    if not url_lower.startswith(("http://", "https://")):
        return False
    for pat in _SKIP_PATTERNS:
        if pat in url_lower:
            return False
    try:
        domain = urlparse(url).netloc.lower()
        for skip in _SKIP_DOMAINS:
            if skip in domain:
                return False
    except Exception:
        return False
    image_exts = (".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif")
    has_ext = any(url_lower.endswith(e) or f"{e}?" in url_lower for e in image_exts)
    has_image_path = any(
        p in url_lower for p in ("/image", "/photo", "/img", "/media", "/uploads", "/assets")
    )
    return has_ext or has_image_path or "cdn" in url_lower


# ---------------------------------------------------------------------------
# Extraction helpers
# ---------------------------------------------------------------------------


def _og_image(soup: BeautifulSoup, base_url: str) -> Optional[str]:
    """Extract og:image or twitter:image from parsed page."""
    for attr, name in (
        ("property", "og:image"),
        ("name", "twitter:image"),
        ("name", "twitter:image:src"),
    ):
        tag = soup.find("meta", {attr: name})
        if tag and tag.get("content"):
            raw = tag["content"].strip()
            for candidate in (raw, urljoin(base_url, raw)):
                if _is_valid_image_url(candidate):
                    return candidate
    return None


def _hero_image(soup: BeautifulSoup, base_url: str) -> Optional[str]:
    """Look for a hero/banner image using common structural selectors."""
    selectors = (
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
    )
    for sel in selectors:
        try:
            tag = soup.select_one(sel)
            if not tag:
                continue
            src = tag.get("src") or tag.get("data-src") or tag.get("data-lazy-src")
            if src:
                candidate = urljoin(base_url, str(src))
                if _is_valid_image_url(candidate):
                    return candidate
        except Exception:
            continue
    return None


def _first_large_image(soup: BeautifulSoup, base_url: str) -> Optional[str]:
    """Return the first image on the page that isn't tucked inside nav/footer chrome."""
    for img in soup.find_all("img")[:25]:
        src = img.get("src") or img.get("data-src") or img.get("data-lazy-src")
        if not src:
            continue
        candidate = urljoin(base_url, str(src))
        if not _is_valid_image_url(candidate):
            continue

        # Skip images embedded in navigation chrome
        parent = img.parent
        in_chrome = False
        for _ in range(6):
            if parent is None:
                break
            cls = " ".join(parent.get("class", []))
            pid = parent.get("id", "")
            if any(x in cls.lower() or x in pid.lower() for x in _NAV_CONTAINERS):
                in_chrome = True
                break
            parent = parent.parent
        if not in_chrome:
            return candidate

    return None


def fetch_image_from_website(url: str) -> Optional[str]:
    """Fetch a venue website and extract the best available image URL.

    Returns None on any HTTP error (4xx / 5xx / timeout).
    """
    if not url.startswith("http"):
        url = "https://" + url

    try:
        resp = requests.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT, allow_redirects=True)
        if resp.status_code >= 400:
            logger.debug("  HTTP %d: %s", resp.status_code, url)
            return None
        soup = BeautifulSoup(resp.text, "html.parser")
    except requests.exceptions.Timeout:
        logger.debug("  Timeout: %s", url)
        return None
    except requests.exceptions.RequestException as exc:
        logger.debug("  Request error: %s — %s", url, exc)
        return None
    except Exception as exc:
        logger.debug("  Parse error: %s — %s", url, exc)
        return None

    return _og_image(soup, url) or _hero_image(soup, url) or _first_large_image(soup, url)


# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------

FAMILY_PORTAL_SLUG = "atlanta-families"


def get_family_portal_venue_ids(client) -> list[int]:
    """Return all unique venue IDs touched by active family portal events.

    Uses small per-source batches to avoid statement timeouts on the events
    table, which is very large and benefits from tight source_id constraints.
    """
    portal_resp = (
        client.table("portals")
        .select("id")
        .eq("slug", FAMILY_PORTAL_SLUG)
        .single()
        .execute()
    )
    if not portal_resp.data:
        raise RuntimeError(f"Portal '{FAMILY_PORTAL_SLUG}' not found")
    portal_id = portal_resp.data["id"]

    subs_resp = (
        client.table("source_subscriptions")
        .select("source_id")
        .eq("subscriber_portal_id", portal_id)
        .execute()
    )
    source_ids = [s["source_id"] for s in (subs_resp.data or [])]
    if not source_ids:
        return []

    venue_ids: set[int] = set()
    # Small batches (10) to stay well inside the statement timeout window.
    batch_size = 10
    for i in range(0, len(source_ids), batch_size):
        batch = source_ids[i : i + batch_size]
        try:
            events_resp = (
                client.table("events")
                .select("place_id")
                .in_("source_id", batch)
                .eq("is_active", True)
                .limit(5000)  # cap per batch; sources are single-venue mostly
                .execute()
            )
            for e in events_resp.data or []:
                if e.get("place_id"):
                    venue_ids.add(e["place_id"])
        except Exception as exc:
            logger.warning("  Batch %d–%d failed: %s — skipping", i, i + batch_size, exc)

    return list(venue_ids)


def get_venues_needing_images(venue_ids: list[int], limit: int) -> list[dict]:
    """Return venues (from the given ID set) that have a website but no image_url."""
    results: list[dict] = []
    batch_size = 200
    for i in range(0, len(venue_ids), batch_size):
        batch = venue_ids[i : i + batch_size]
        resp = (
            client_global.table("places")
            .select("id, name, slug, website, image_url")
            .in_("id", batch)
            .is_("image_url", "null")
            .not_.is_("website", "null")
            .eq("is_active", True)
            .execute()
        )
        results.extend(resp.data or [])
        if len(results) >= limit:
            break

    return results[:limit]


def update_venue_image(client, venue_id: int, image_url: str) -> bool:
    """Write image_url to the venues table."""
    try:
        client.table("places").update({"image_url": image_url}).eq("id", venue_id).execute()
        return True
    except Exception as exc:
        logger.error("  DB update failed for venue_id=%d: %s", venue_id, exc)
        return False


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

# Module-level client so helpers can share it
client_global = None


def main() -> None:
    global client_global

    parser = argparse.ArgumentParser(
        description="Enrich family portal venues with og:image from their websites"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        default=True,
        help="Preview without writing to DB (default)",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Actually write image URLs to the database",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=100,
        help="Max venues to process (default: 100)",
    )
    args = parser.parse_args()

    apply = args.apply
    dry_run = not apply

    client_global = get_client()

    logger.info("=" * 60)
    logger.info("Family Portal Venue Image Enrichment")
    logger.info("Mode: %s", "DRY RUN" if dry_run else "APPLY")
    logger.info("=" * 60)

    # Resolve family portal venues
    logger.info("Resolving family portal venues...")
    venue_ids = get_family_portal_venue_ids(client_global)
    logger.info("  Total family portal venues: %d", len(venue_ids))

    venues = get_venues_needing_images(venue_ids, args.limit)
    logger.info("  Venues with website, no image: %d (showing up to %d)", len(venues), args.limit)
    logger.info("")

    found = 0
    skipped = 0
    written = 0
    errors = 0

    for venue in venues:
        name = venue["name"]
        website = venue["website"] or ""
        venue_id = venue["id"]

        logger.info("Checking: %s", name)
        logger.info("  Website: %s", website[:70])

        image_url = fetch_image_from_website(website)

        if image_url:
            found += 1
            logger.info("  Found:   %s", image_url[:80])
            if apply:
                ok = update_venue_image(client_global, venue_id, image_url)
                if ok:
                    written += 1
                    logger.info("  Written to DB.")
                else:
                    errors += 1
        else:
            skipped += 1
            logger.info("  No image found — skipping.")

        time.sleep(POLITE_DELAY)

    logger.info("")
    logger.info("=" * 60)
    logger.info("Summary")
    logger.info("  Venues checked:    %d", len(venues))
    logger.info("  Images found:      %d", found)
    logger.info("  No image found:    %d", skipped)
    if apply:
        logger.info("  Written to DB:     %d", written)
        logger.info("  DB errors:         %d", errors)
    else:
        logger.info("  (Dry run — nothing written)")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
