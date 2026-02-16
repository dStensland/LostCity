#!/usr/bin/env python3
"""
Enrich skyline/architecture venue images with exterior building photos.

For the Resurgens track (Skyline & Architecture), we need photos that
show the OUTSIDE of the building — the view you'd see from the skyline.
Google Places often returns lobby/interior shots. Wikimedia Commons has
better architectural exterior photos.

Usage:
    python3 enrich_skyline_images.py --dry-run
    python3 enrich_skyline_images.py
"""

import os
import sys
import time
import argparse
import requests
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv

env_path = Path(__file__).parent / ".env"
load_dotenv(env_path)

sys.path.insert(0, str(Path(__file__).parent))
from db import get_client

WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"
THUMB_WIDTH = 1000  # Slightly larger for architectural detail

HEADERS = {
    "User-Agent": "LostCityBot/1.0 (https://lostcity.app; contact@lostcity.app)",
    "Accept": "application/json",
}

# Search terms optimized for EXTERIOR architectural photos
SKYLINE_SEARCHES = {
    "bank-of-america-plaza": {
        "wiki": "Bank of America Plaza Atlanta",
        "commons": "Bank of America Plaza Atlanta",
        "note": "Tallest building in Atlanta. Gold pyramidal crown.",
    },
    "atlanta-marriott-marquis": {
        "wiki": "Atlanta Marriott Marquis",
        "commons": "Marriott Marquis Atlanta exterior",
        "note": "John Portman's atrium masterpiece. Exterior is curved glass.",
    },
    "fox-theatre-atlanta": {
        "wiki": "Fox Theatre Atlanta",
        "commons": "Fox Theatre Atlanta",
        "note": "Moorish exterior with onion domes. Already has good image — skip if OK.",
    },
    "westin-peachtree-plaza": {
        "wiki": "Westin Peachtree Plaza Hotel",
        "commons": "Westin Peachtree Plaza Atlanta",
        "note": "73-story glass cylinder. Tallest hotel in Western Hemisphere when built.",
    },
    "one-atlantic-center": {
        "wiki": "One Atlantic Center",
        "commons": "One Atlantic Center Atlanta",
        "note": "Philip Johnson's pointy-topped postmodern tower.",
    },
    "georgia-pacific-tower": {
        "wiki": "Georgia-Pacific Tower",
        "commons": "Georgia-Pacific Tower Atlanta",
        "note": "Red Georgia marble. Distinctive dark red color on skyline.",
    },
    "191-peachtree-tower": {
        "wiki": "191 Peachtree Tower",
        "commons": "191 Peachtree Tower Atlanta",
        "note": "Philip Johnson + John Burgee. Two castle-like turrets at top.",
    },
    "king-and-queen-towers": {
        "wiki": "Concourse Corporate Center",
        "commons": "King and Queen towers Atlanta",
        "note": "The King and Queen of the I-285 perimeter skyline.",
    },
    "hyatt-regency-atlanta": {
        "wiki": "Hyatt Regency Atlanta",
        "commons": "Hyatt Regency Atlanta",
        "note": "John Portman's revolutionary atrium hotel. Blue flying saucer restaurant on top.",
    },
    # Skip Flatiron (restaurant, not a skyscraper)
    "candler-hotel": {
        "wiki": "Candler Building Atlanta",
        "commons": "Candler Building Atlanta Peachtree",
        "note": "1906 Beaux-Arts. Asa Candler's statement building.",
    },
    # Skip The Vick, Rhodes Hall, Rialto — not skyscrapers
}


def search_wikipedia_image(query: str) -> Optional[str]:
    """Search Wikipedia for exterior building photos."""
    params = {
        "action": "query",
        "list": "search",
        "srsearch": query,
        "srnamespace": 0,
        "srlimit": 3,
        "format": "json",
    }
    try:
        resp = requests.get(WIKIPEDIA_API, params=params, headers=HEADERS, timeout=10)
        resp.raise_for_status()
        results = resp.json().get("query", {}).get("search", [])
        for result in results:
            url = get_page_image(result["title"])
            if url:
                return url
    except Exception as e:
        print(f"    Wiki search error: {e}")
    return None


def get_page_image(title: str) -> Optional[str]:
    """Get lead image from Wikipedia article."""
    params = {
        "action": "query",
        "titles": title,
        "prop": "pageimages",
        "piprop": "thumbnail",
        "pithumbsize": THUMB_WIDTH,
        "format": "json",
    }
    try:
        resp = requests.get(WIKIPEDIA_API, params=params, headers=HEADERS, timeout=10)
        resp.raise_for_status()
        pages = resp.json().get("query", {}).get("pages", {})
        for page_id, page in pages.items():
            if page_id == "-1":
                continue
            thumb = page.get("thumbnail", {})
            if thumb.get("source"):
                return thumb["source"]
    except Exception as e:
        print(f"    Page image error: {e}")
    return None


def search_commons_image(query: str) -> Optional[str]:
    """Search Wikimedia Commons for building exterior photos."""
    params = {
        "action": "query",
        "list": "search",
        "srsearch": query,
        "srnamespace": 6,
        "srlimit": 5,
        "format": "json",
    }
    try:
        resp = requests.get(COMMONS_API, params=params, headers=HEADERS, timeout=10)
        resp.raise_for_status()
        results = resp.json().get("query", {}).get("search", [])
        for result in results:
            url = get_commons_thumbnail(result["title"])
            if url:
                return url
    except Exception as e:
        print(f"    Commons search error: {e}")
    return None


def get_commons_thumbnail(file_title: str) -> Optional[str]:
    """Get a thumbnail URL for a Wikimedia Commons file."""
    params = {
        "action": "query",
        "titles": file_title,
        "prop": "imageinfo",
        "iiprop": "url|extmetadata",
        "iiurlwidth": THUMB_WIDTH,
        "format": "json",
    }
    try:
        resp = requests.get(COMMONS_API, params=params, headers=HEADERS, timeout=10)
        resp.raise_for_status()
        pages = resp.json().get("query", {}).get("pages", {})
        for page_id, page in pages.items():
            if page_id == "-1":
                continue
            imageinfo = page.get("imageinfo", [{}])
            if imageinfo:
                info = imageinfo[0]
                meta = info.get("extmetadata", {})
                license_short = meta.get("LicenseShortName", {}).get("value", "").lower()
                allowed = ["cc", "public domain", "pd", "gfdl", "free"]
                if any(a in license_short for a in allowed) or not license_short:
                    return info.get("thumburl")
    except Exception as e:
        print(f"    Commons thumb error: {e}")
    return None


def main(dry_run: bool = False):
    client = get_client()

    # Get all venue slugs we want to update
    slugs = list(SKYLINE_SEARCHES.keys())
    result = client.table("venues").select(
        "id, name, slug, image_url"
    ).in_("slug", slugs).execute()

    venues = {v["slug"]: v for v in (result.data or [])}
    print(f"Found {len(venues)}/{len(slugs)} skyline venues\n")

    found = 0
    failed = 0

    for slug, config in SKYLINE_SEARCHES.items():
        venue = venues.get(slug)
        if not venue:
            print(f"  SKIP {slug} — not in DB")
            failed += 1
            continue

        current_img = venue.get("image_url", "")
        is_google = "googleusercontent.com" in (current_img or "")

        print(f"  {venue['name']}")
        print(f"    Current: {'Google Places' if is_google else 'Wikimedia' if 'wikimedia' in (current_img or '') else current_img[:50] if current_img else 'NONE'}...")
        print(f"    Goal: {config['note']}")

        # Try Wikipedia first
        print(f"    Searching Wiki: \"{config['wiki']}\"")
        img_url = search_wikipedia_image(config["wiki"])

        # Fallback to Commons
        if not img_url:
            print(f"    Trying Commons: \"{config['commons']}\"")
            img_url = search_commons_image(config["commons"])

        if img_url:
            print(f"    FOUND: {img_url[:80]}...")
            found += 1
            if not dry_run:
                client.table("venues").update(
                    {"image_url": img_url}
                ).eq("id", venue["id"]).execute()
                print(f"    Updated venue {venue['id']}")
        else:
            print(f"    NOT FOUND — keeping existing image")
            failed += 1

        time.sleep(1.0)

    print(f"\n{'DRY RUN ' if dry_run else ''}RESULTS:")
    print(f"  Found:  {found}")
    print(f"  Failed: {failed}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    main(dry_run=args.dry_run)
