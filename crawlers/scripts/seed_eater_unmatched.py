"""
Seed unmatched Eater Atlanta restaurants into the places table.

Eater Atlanta guides reference ~181 restaurants; ~60 of them didn't match any
existing place record. This script:
  1. Fetches all Eater guide map data (same as eater_atlanta_guides crawler).
  2. Identifies which restaurant names have no matching place.
  3. Creates place records using the rich data already embedded in Eater's
     map points: coordinates, address, website, image, phone.
  4. Does NOT call the Google Places API — Eater's data is sufficient.

After seeding, re-run the Eater crawler to attach editorial_mentions to the
newly created place records:
  python3 main.py --source eater-atlanta-guides --allow-production-writes

Usage:
  # Dry run — show what would be created without writing
  python3 -m scripts.seed_eater_unmatched --dry-run

  # Write to DB
  python3 -m scripts.seed_eater_unmatched
"""

from __future__ import annotations

import argparse
import logging
import re
import sys
import os

import requests

# Ensure project root on path for imports
_repo_root = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, _repo_root)

from dotenv import load_dotenv

load_dotenv(os.path.join(_repo_root, "..", ".env"))
load_dotenv(os.path.join(_repo_root, "..", "web", ".env.local"), override=False)

from db import get_client, get_or_create_place
from db.client import configure_write_mode
from neighborhood_lookup import infer_neighborhood_from_coords
from sources.eater_atlanta_guides import (
    GUIDE_URLS,
    _fetch_map_layout,
    _lookup_place_by_name,
    _clean_text,
    _build_snippet,
)

logger = logging.getLogger(__name__)

# ─────────────────────────────── helpers ──────────────────────────────────

_WHITESPACE_RE = re.compile(r"\s+")

# Cities in the metro area that appear in Eater Atlanta guides
_METRO_CITIES = {
    "Atlanta", "Doraville", "Smyrna", "Dunwoody", "Sandy Springs",
    "Decatur", "Lilburn", "Roswell", "Berkeley Lake", "Johns Creek",
}

_CITY_PATTERN = re.compile(
    r"\b(" + "|".join(re.escape(c) for c in _METRO_CITIES) + r")\b",
    re.IGNORECASE,
)

_ZIP_PATTERN = re.compile(r"\b(\d{5})\b")

# Names that look like operating parenthetical suffixes — strip them
# e.g. "Ghee Indian Kitchen - West Midtown" → "Ghee Indian Kitchen"
# We keep the original name for DB but use stripped for slug generation
# Parenthetical suffixes Eater adds to distinguish kosher prep-type variants.
# These are editorial annotations, not part of the venue name.
# Matches any trailing parenthetical that contains "meat" or "dairy" as a word.
_STRIP_NAME_SUFFIXES = re.compile(
    r"\s*\([^)]*\b(meat|dairy)\b[^)]*\)\s*$",
    re.IGNORECASE,
)

# Pop-up entries with no permanent address — skip seeding them because they
# have no fixed location and would produce low-quality place records.
_POPUP_KEYWORDS = re.compile(r"\bpop[-\s]?up\b", re.IGNORECASE)

_PLACE_TYPE_RESTAURANT = "restaurant"
_PLACE_TYPE_COFFEE = "coffee_shop"
_PLACE_TYPE_BAR = "bar"
_PLACE_TYPE_BREWERY = "brewery"


def _clean_venue_name(raw_name: str) -> str:
    """Strip editorial annotation suffixes from venue names.

    Eater occasionally appends prep-type notes in parentheses for kosher
    establishments, e.g. "Fuego Mundo (meat)". These should not appear in our
    place records.
    """
    return _STRIP_NAME_SUFFIXES.sub("", raw_name).strip()


def _infer_place_type(name: str, website: str) -> str:
    """Heuristically infer a place_type from name and website."""
    lower = name.lower()
    if any(k in lower for k in ("coffee", "café", "cafe", "roast", "espresso", "brew co")):
        return _PLACE_TYPE_COFFEE
    if any(k in lower for k in ("brewing", "brewery", "beer", "taproom")):
        return _PLACE_TYPE_BREWERY
    if any(k in lower for k in ("bar", "pub", "tavern", "lounge", "wine", "cocktail")):
        return _PLACE_TYPE_BAR
    return _PLACE_TYPE_RESTAURANT


def _parse_address_components(full_addr: str) -> dict:
    """
    Extract street, city, state, zip from a full address string.

    Handles several Eater formats:
      '1059 Ralph David Abernathy Blvd, Atlanta, GA 30310, USA'
      '870 Inman Village Pkwy NE, Atlanta, GA, 30307, US'
      '670 Trabert Avenue Northwest, GA, 30318'
      'Atlanta, Georgia, United States'   ← no street info

    Returns a dict with keys: street, city, state, zip (all may be None).
    """
    if not full_addr:
        return {}

    # Strip trailing country
    addr = re.sub(r",?\s*(USA|US|United States)\s*$", "", full_addr).strip()
    # Normalise "Georgia" → "GA"
    addr = re.sub(r"\bGeorgia\b", "GA", addr)

    parts = [p.strip() for p in addr.split(",")]
    if not parts:
        return {}

    # ZIP
    zip_code = None
    for p in reversed(parts):
        m = _ZIP_PATTERN.search(p)
        if m:
            zip_code = m.group(1)
            break

    # State
    state = "GA"

    # City
    city = "Atlanta"
    for p in parts:
        m = _CITY_PATTERN.search(p)
        if m:
            city = m.group(1).title()
            break

    # Street — first part only if it looks like an actual street
    raw_street = parts[0] if parts else None
    # If the first part matches a city name alone, it's no-street data
    if raw_street and (
        _CITY_PATTERN.fullmatch(raw_street.strip())
        or raw_street.strip() in {"Atlanta", "GA"}
    ):
        raw_street = None

    return {
        "street": raw_street,
        "city": city,
        "state": state,
        "zip": zip_code,
    }


def _make_slug(name: str) -> str:
    """Generate a URL-safe slug from a restaurant name."""
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    # Limit length
    return slug[:80]


def _extract_image_url(point: dict) -> str | None:
    """Pull the horizontal thumbnail from ledeMedia, if present."""
    lede = point.get("ledeMedia") or {}
    img = lede.get("image") or {}
    thumbs = img.get("thumbnails") or {}
    horiz = thumbs.get("horizontal") or {}
    return horiz.get("url") or None


def _extract_description(point: dict) -> str | None:
    """Build a snippet from description blocks, skipping metadata lines."""
    blocks = point.get("description") or []
    snippet = _build_snippet(blocks)
    return snippet or None


# ─────────────────────── main seeding logic ───────────────────────────────


def collect_unmatched_points(client) -> list[dict]:
    """
    Fetch all Eater guide pages, identify map points with no matching place,
    and return the raw point data for each.

    Deduplicates by restaurant name — the same restaurant may appear in
    multiple guides.
    """
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

    unmatched: list[dict] = []
    seen_names: set[str] = set()

    for guide in GUIDE_URLS:
        logger.info("Fetching guide: %s", guide["url"])
        node = _fetch_map_layout(guide["url"], session)
        if not node:
            logger.warning("No data from guide: %s", guide["url"])
            continue

        for point in node.get("mapPoints", []):
            name = _clean_text(point.get("name", ""))
            if not name or name in seen_names:
                continue

            place_id = _lookup_place_by_name(client, name)
            if place_id:
                logger.debug("Already matched: '%s' (place_id=%s)", name, place_id)
                continue

            seen_names.add(name)
            unmatched.append(point)
            logger.debug("Unmatched: '%s'", name)

    logger.info("Found %d unmatched restaurants across all guides", len(unmatched))
    return unmatched


def build_venue_data(point: dict) -> dict | None:
    """
    Convert an Eater map point to a venue_data dict for get_or_create_place().

    Returns None for points with no actionable address data and no coordinates,
    and for pop-up entries that have no permanent location.
    """
    raw_name = _clean_text(point.get("name", ""))
    if not raw_name:
        return None

    # Strip editorial annotation suffixes (e.g. kosher prep notes)
    name = _clean_venue_name(raw_name)

    # Skip pop-ups without a fixed address — they're ephemeral
    raw_address = _clean_text(point.get("address", "") or "")
    if _POPUP_KEYWORDS.search(name) and not raw_address:
        logger.info("Skipping pop-up '%s' — no fixed address", name)
        return None

    loc = point.get("location") or {}
    lat = loc.get("latitude")
    lng = loc.get("longitude")

    parsed = _parse_address_components(raw_address)

    # Require at least coordinates OR a street address to create a useful record
    has_coords = lat is not None and lng is not None
    has_street = bool(parsed.get("street"))
    if not has_coords and not has_street:
        logger.warning("Skipping '%s' — no address or coordinates", name)
        return None

    # Infer neighborhood from coordinates if available
    neighborhood = None
    if has_coords:
        try:
            neighborhood = infer_neighborhood_from_coords(lat, lng)
        except Exception:
            pass

    city = parsed.get("city") or "Atlanta"
    state = parsed.get("state") or "GA"

    website = (point.get("url") or "").strip() or None
    phone = _clean_text(point.get("phone") or "")
    image_url = _extract_image_url(point)
    description = _extract_description(point)

    place_type = _infer_place_type(name, website or "")
    slug = _make_slug(name)

    return {
        "name": name,
        "slug": slug,
        "address": parsed.get("street"),
        "neighborhood": neighborhood,
        "city": city,
        "state": state,
        "zip": parsed.get("zip"),
        "lat": lat,
        "lng": lng,
        "place_type": place_type,
        "spot_type": place_type,
        "website": website,
        "phone": phone or None,
        "description": description,
        "image_url": image_url,
        "vibes": [],
    }


def seed_unmatched(dry_run: bool) -> tuple[int, int, int]:
    """
    Seed all unmatched Eater Atlanta restaurants.

    Returns (candidates, seeded, skipped).
    """
    client = get_client()
    unmatched_points = collect_unmatched_points(client)

    candidates = len(unmatched_points)
    seeded = 0
    skipped = 0

    for point in unmatched_points:
        name = _clean_text(point.get("name", ""))
        venue_data = build_venue_data(point)

        if not venue_data:
            logger.info("Skipping '%s' — insufficient data", name)
            skipped += 1
            continue

        if dry_run:
            display_name = venue_data.get("name") or name
            addr = venue_data.get("address") or "(no street)"
            hood = venue_data.get("neighborhood") or "?"
            has_img = "img" if venue_data.get("image_url") else "no-img"
            has_url = "url" if venue_data.get("website") else "no-url"
            print(
                f"  [DRY RUN] {display_name:<50s} "
                f"{addr[:35]:<35s} "
                f"{hood:<25s} "
                f"{has_img} {has_url}"
            )
            seeded += 1
        else:
            place_id = get_or_create_place(venue_data)
            if place_id:
                logger.info(
                    "Seeded '%s' → place_id=%s (%s, %s)",
                    name,
                    place_id,
                    venue_data.get("neighborhood"),
                    venue_data.get("city"),
                )
                seeded += 1
            else:
                logger.warning("Failed to seed '%s'", name)
                skipped += 1

    return candidates, seeded, skipped


# ─────────────────────────────── CLI ──────────────────────────────────────


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Seed unmatched Eater Atlanta restaurants into the places table"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Fetch data and print what would be created, without writing to DB",
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s — %(message)s",
        datefmt="%H:%M:%S",
    )

    if args.dry_run:
        configure_write_mode(False, "dry-run")
        logger.info("DRY RUN — no DB writes will occur")
    else:
        configure_write_mode(True, "seed_eater_unmatched")

    candidates, seeded, skipped = seed_unmatched(dry_run=args.dry_run)

    action = "would be created" if args.dry_run else "seeded"
    print(
        f"\nDone: {candidates} candidates, {seeded} {action}, {skipped} skipped."
    )
    if not args.dry_run and seeded > 0:
        print(
            "\nNext step: re-run the Eater crawler to attach editorial mentions:"
        )
        print(
            "  python3 main.py --source eater-atlanta-guides --allow-production-writes"
        )


if __name__ == "__main__":
    main()
