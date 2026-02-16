#!/usr/bin/env python3
"""
Enrich artifact venue images from Wikimedia Commons (copyright-safe).

Uses Wikipedia's PageImages API to find freely-licensed lead images
for venues on the Artefacts track that are missing image_url.

All images are from Wikimedia Commons (CC-BY-SA, CC-BY, or public domain).

Usage:
    python enrich_artifact_images.py --dry-run
    python enrich_artifact_images.py
    python enrich_artifact_images.py --limit 20
"""

import os
import sys
import time
import json
import argparse
import logging
import requests
from pathlib import Path
from typing import Optional
from urllib.parse import quote
from dotenv import load_dotenv

env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

sys.path.insert(0, str(Path(__file__).parent))
from db import get_client

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": "LostCityBot/1.0 (https://lostcity.app; contact@lostcity.app)",
    "Accept": "application/json",
}

# Wikipedia API for page images
WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php"

# Wikimedia Commons API for direct search
COMMONS_API = "https://commons.wikimedia.org/w/api.php"

# Thumbnail width (good quality without being huge)
THUMB_WIDTH = 800

# Manual search term overrides for venues whose names don't match Wikipedia
SEARCH_OVERRIDES = {
    "the-big-chicken": "Big Chicken Marietta",
    "crypt-of-civilization": "Crypt of Civilization",
    "the-cyclorama": "Atlanta Cyclorama",
    "two-headed-calf-moon-rocks": None,  # Too obscure for Wikipedia
    "dolls-head-trail": "Doll's Head Trail",
    "autoeater": None,  # Local art, no Wikipedia
    "vortex-laughing-skull": "The Vortex Bar and Grill",
    "zero-mile-post": "Zero Milepost Atlanta",
    "the-great-fish": None,  # Restaurant sculpture
    "noguchi-playscape": "Playscapes Piedmont Park",
    "bobby-jones-grave": "Bobby Jones golfer",
    "jack-smith-armchair-statue": None,  # Too obscure
    "pemberton-statue": "John Pemberton",
    "fountain-of-rings": "Fountain of Rings Centennial Olympic Park Atlanta",
    "the-varsity-neon-sign": "The Varsity restaurant",
    "the-storyteller-stag-man": None,  # Local art
    "giant-hands-of-dr-sid": None,  # Local art
    "phoenix-rising-sculpture": "Phoenix sculpture Atlanta",
    "sope-creek-paper-mill-ruins": "Sope Creek",
    "millennium-gate": "Millennium Gate Museum",
    "whittier-mill-tower": None,  # Local landmark
    "world-athletes-monument": None,  # Too generic
    "folk-art-park": "Folk Art Park Atlanta",
    "hoo-hoo-monument": None,  # Obscure
    "rhodes-hall": "Rhodes Hall Atlanta",
    "underground-atlanta": "Underground Atlanta",
    "monster-mansion-monsters": "Monster Mansion Six Flags",
    "riverview-carousel": "Riverview Carousel Six Flags",
    "stone-mountain-carving": "Stone Mountain carving",
    "lion-of-atlanta": "Lion of Atlanta Oakland Cemetery",
    "margaret-mitchells-grave": "Margaret Mitchell",
    "the-general-locomotive": "The General locomotive",
    "waffle-house-museum": "Waffle House Museum",
    "roswell-mill-ruins": "Roswell Mill Ruins Georgia",
    "southeastern-railway-museum": "Southeastern Railway Museum",
    "kennesaw-mountain-cannons": "Kennesaw Mountain",
    "concord-covered-bridge": "Concord Covered Bridge",
    "bulloch-hall": "Bulloch Hall",
    "bradley-observatory": "Bradley Observatory Agnes Scott",
    "covington-clock-tower": "Covington Georgia square courthouse",
    "chick-fil-a-dwarf-house": "Chick-fil-A original Dwarf House Hapeville",
    "avondale-tudor-village": "Avondale Estates Georgia",
    "marietta-national-cemetery": "Marietta National Cemetery",
    "indian-seats-sawnee-mountain": "Sawnee Mountain",
    "bellwood-quarry-reservoir": "Bellwood Quarry Atlanta",
    "asa-candler-mausoleum": "Asa Griggs Candler",
    "monastery-bonsai-garden": "Monastery of the Holy Spirit Conyers",
    "peachtree-city-golf-cart-tunnels": "Peachtree City golf carts",
    "stately-oaks-plantation": "Stately Oaks Plantation",
    "ramblin-wreck": "Ramblin' Wreck",
    "coca-cola-vault": "World of Coca-Cola vault",
    "willie-b-statue": "Willie B gorilla",
    "54-columns": None,  # Too obscure for Wikipedia
    "sideways-the-dogs-grave": None,  # Campus obscurity
    "lord-dooley-statue": "Dooley Emory University",
    "anti-gravity-monument": "Gravity Research Foundation monument",
    "fiddlin-john-carsons-grave": "Fiddlin' John Carson",
    "hank-aaron-home-run-wall": "Hank Aaron",
    "kermit-chaplin-statue": "Jim Henson Kermit statue",
    "spirit-of-delta": "Spirit of Delta Boeing 767",
    "one-person-jail-cell": None,  # Too obscure
    "adalanta-desert-plaque": "Kcymaerxthaere",
    "elvis-shrine-vault": None,  # Bar-specific
    "1895-exposition-steps": "Cotton States and International Exposition",
    "pink-trap-house-chevy": "2 Chainz Pink Trap House",
    "confessional-photobooth": None,  # Bar-specific
    "fulton-bag-mill-smokestacks": "Fulton Bag and Cotton Mills",
    "owl-rock": None,  # Cemetery obscurity
    "dr-bombays-underwater-tea-party": None,  # Local business
    "merci-boxcar": "Merci Train",
    "ww-king-covered-bridge": "Horace King bridge builder",
    "fdr-superb-railcar": "Franklin Roosevelt Warm Springs",
    "stone-mountain-grist-mill": "Stone Mountain Park",
    "cascade-springs-earthworks": None,  # Too obscure
    "the-dump-apartment": "Margaret Mitchell House",
    "maynard-jacksons-grave": "Maynard Jackson",
    "eav-totem-pole": None,  # Local art
    "the-clermont-lounge": "Clermont Lounge",
    "buford-highway-corridor": "Buford Highway",
    "bridge-over-nothing": None,  # Too obscure
    "dahlonega-gold-museum": "Dahlonega Gold Museum",
    "hank-aaron-statue": "Hank Aaron statue Truist Park Atlanta",
}


def search_wikipedia_image(query: str) -> Optional[str]:
    """
    Search Wikipedia for a page matching the query and return its lead image URL.
    Returns a Wikimedia Commons thumbnail URL or None.
    """
    # Step 1: Search for the article
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
        data = resp.json()
        results = data.get("query", {}).get("search", [])
        if not results:
            return None
    except Exception as e:
        logger.warning(f"  Wikipedia search error: {e}")
        return None

    # Step 2: Try each result for a page image
    for result in results:
        title = result["title"]
        img_url = get_page_image(title)
        if img_url:
            return img_url

    return None


def get_page_image(title: str) -> Optional[str]:
    """Get the lead image from a Wikipedia article."""
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
        data = resp.json()
        pages = data.get("query", {}).get("pages", {})
        for page_id, page in pages.items():
            if page_id == "-1":
                continue
            thumb = page.get("thumbnail", {})
            url = thumb.get("source")
            if url:
                return url
    except Exception as e:
        logger.warning(f"  Page image error for '{title}': {e}")
    return None


def search_commons_image(query: str) -> Optional[str]:
    """
    Search Wikimedia Commons directly for an image.
    Fallback when Wikipedia article doesn't have a lead image.
    """
    params = {
        "action": "query",
        "list": "search",
        "srsearch": f"{query} Atlanta Georgia",
        "srnamespace": 6,  # File namespace
        "srlimit": 5,
        "format": "json",
    }
    try:
        resp = requests.get(COMMONS_API, params=params, headers=HEADERS, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        results = data.get("query", {}).get("search", [])
        if not results:
            return None

        # Get the first result's image URL
        for result in results:
            file_title = result["title"]
            url = get_commons_thumbnail(file_title)
            if url:
                return url
    except Exception as e:
        logger.warning(f"  Commons search error: {e}")
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
        data = resp.json()
        pages = data.get("query", {}).get("pages", {})
        for page_id, page in pages.items():
            if page_id == "-1":
                continue
            imageinfo = page.get("imageinfo", [{}])
            if imageinfo:
                info = imageinfo[0]
                # Check license - only use freely licensed
                meta = info.get("extmetadata", {})
                license_short = meta.get("LicenseShortName", {}).get("value", "")
                license_lower = license_short.lower()
                # Accept CC licenses, public domain, GFDL
                allowed = ["cc", "public domain", "pd", "gfdl", "free"]
                if any(a in license_lower for a in allowed) or not license_short:
                    thumb_url = info.get("thumburl")
                    if thumb_url:
                        return thumb_url
    except Exception as e:
        logger.warning(f"  Commons thumbnail error: {e}")
    return None


def get_artifact_venues_missing_images() -> list[dict]:
    """Fetch all venues on the artefacts track that are missing images."""
    client = get_client()

    # Get track ID
    track = client.table("explore_tracks").select("id").eq(
        "slug", "artefacts-of-the-lost-city"
    ).single().execute()

    if not track.data:
        logger.error("Track not found")
        return []

    track_id = track.data["id"]

    # Get all track venues missing images
    result = client.table("explore_track_venues").select(
        "venue_id, sort_order, venue:venues(id, name, slug, image_url, hero_image_url, city, neighborhood)"
    ).eq("track_id", track_id).order("sort_order").execute()

    venues = []
    for mapping in result.data:
        v = mapping.get("venue")
        if not v:
            continue
        if not v.get("image_url") and not v.get("hero_image_url"):
            venues.append(v)

    return venues


def enrich_images(dry_run: bool = False, limit: int = 0):
    """Main enrichment function."""
    venues = get_artifact_venues_missing_images()
    logger.info(f"Found {len(venues)} artifact venues missing images\n")

    if limit > 0:
        venues = venues[:limit]

    client = get_client() if not dry_run else None
    found = 0
    not_found = 0
    skipped = 0

    for v in venues:
        slug = v.get("slug", "")
        name = v.get("name", "")
        city = v.get("city", "Atlanta")

        # Check for override
        override = SEARCH_OVERRIDES.get(slug, "USE_DEFAULT")

        if override is None:
            logger.info(f"  SKIP {name} — marked as too obscure for Wikipedia")
            skipped += 1
            time.sleep(0.2)
            continue

        search_term = override if override != "USE_DEFAULT" else f"{name} {city} Georgia"

        logger.info(f"  Searching: {name} -> \"{search_term}\"")

        # Try Wikipedia first
        img_url = search_wikipedia_image(search_term)

        # Fallback to Commons search
        if not img_url:
            logger.info(f"    No Wikipedia image, trying Commons...")
            img_url = search_commons_image(name)

        if img_url:
            logger.info(f"    FOUND: {img_url[:80]}...")
            found += 1
            if not dry_run and client:
                client.table("venues").update(
                    {"image_url": img_url}
                ).eq("id", v["id"]).execute()
                logger.info(f"    Updated venue {v['id']}")
        else:
            logger.info(f"    NOT FOUND")
            not_found += 1

        # Rate limit: Wikipedia asks for 1 req/sec for bots
        time.sleep(1.0)

    logger.info(f"\n{'DRY RUN ' if dry_run else ''}RESULTS:")
    logger.info(f"  Found:     {found}")
    logger.info(f"  Not found: {not_found}")
    logger.info(f"  Skipped:   {skipped}")
    logger.info(f"  Total:     {found + not_found + skipped}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Enrich artifact images from Wikimedia Commons")
    parser.add_argument("--dry-run", action="store_true", help="Don't update database")
    parser.add_argument("--limit", type=int, default=0, help="Max venues to process")
    args = parser.parse_args()

    enrich_images(dry_run=args.dry_run, limit=args.limit)
