#!/usr/bin/env python3
"""
Scrape descriptions for T1+ venues that are missing them.

Extraction order:
1. og:description meta tag
2. meta name="description" tag
3. JSON-LD description field
4. First meaningful paragraph in page body

Boilerplate descriptions are rejected.
Descriptions truncated to 500 chars.

Usage:
    python3 scrape_venue_descriptions.py
    python3 scrape_venue_descriptions.py --limit 100
    python3 scrape_venue_descriptions.py --dry-run
"""

import sys
import time
import json
import re
import logging
import argparse
from pathlib import Path
from typing import Optional

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

# Load .env from project root
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

sys.path.insert(0, str(Path(__file__).parent))
from db.client import get_client

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

T1_TYPES = {
    "restaurant", "bar", "hotel", "coffee_shop", "gallery", "fitness_center",
    "park", "brewery", "theater", "music_venue", "bookstore", "library",
    "studio", "cinema", "nightclub", "entertainment", "historic_site",
    "arts_center", "landmark", "attraction", "games", "gaming", "food_hall",
    "escape_room", "comedy_club", "wine_bar", "sports_bar", "record_store",
    "dance_studio", "amphitheater", "distillery", "nature_center", "lounge",
    "outdoor_venue", "garden", "club", "rooftop", "museum", "arena",
    "stadium", "convention_center", "aquarium", "zoo", "farmers_market",
}

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}

MAX_DESCRIPTION_LEN = 500

# Boilerplate patterns — reject descriptions containing any of these (case-insensitive)
BOILERPLATE_PATTERNS = [
    r"welcome to our website",
    r"cookie(s| notice| policy| consent)",
    r"we use cookies",
    r"javascript (is )?required",
    r"please enable javascript",
    r"this site requires javascript",
    r"^home\s*[\|\-–]",
    r"^(home|index|page not found|404|error)$",
    r"meetings archive",
    r"^just another wordpress",
    r"^wordpress site",
    r"sign (in|up) to",
    r"login (to|required)",
    r"your (cart|basket) is empty",
    r"^loading\.\.\.",
    r"coming soon",
    r"under construction",
    r"page not found",
    r"access denied",
    r"permission denied",
    r"^\s*$",
    # Generic site titles with no content value
    r"^\w[\w\s]+ \| (home|official site|website)$",
    # Learn More / CTA fragments (nav or button text)
    r"^learn more\b",
    # UUID-like strings (hex blobs, GUIDs)
    r"^[0-9a-f]{8}[-_][0-9a-f]{4}",
    # Contact/assistance snippets that aren't descriptions
    r"^for assistance\b",
    r"^please contact\b",
    r"^to (report|contact|request)\b",
    # UI control label fragments (sliders, carousels, buttons)
    r"\b(slideshow|carousel)\b.*(arrow|button|prev|next)",
    r"^(prev|next|previous|left arrow|right arrow)\s*[\|\-]?\s*(prev|next|slide|arrow)?$",
    r"^skip to (main|content|navigation)",
    # Redirect/moved notices
    r"our (website|site|page) has (moved|relocated)",
    r"^(this page|we('ve| have)) (moved|relocated)",
    # HTML entities left in text (HTML parsing failure)
    r"&amp;|&lt;|&gt;|&nbsp;|&#\d+;",
    # Address-only content (just a street address with no other text)
    r"^[A-Z][^,]{2,50},?\s+\d{3,5}\s+[A-Za-z\s]+(?:Road|Street|Ave|Avenue|Blvd|Drive|Dr|Rd|St|Way|Lane|Ln|Pkwy)\b",
    r"^park entrance\b",
    r"^\w[\w\s]+ address\s*[-–:]\s*\d+",
    # Hours/info lines that aren't descriptions
    r"^(open today|hours?|hours? &|today:?)\b",
    # CTA/donate fragments
    r"^(donate|support|help support|click here|read on|learn more|see more)\b",
    # Award/event promo headlines that aren't venue descriptions
    r"\bpresent[s]?\s+\d{4}\b",
    r"\bdesigner[s]? of the year\b",
    # Download/CTA/update fragments (news items, not descriptions)
    r"^(check out|download|view|get).{0,50}(map|trail map|brochure|pdf|available|here)",
    r"^a new\b.{0,80}\blist\b.{0,40}(available|now|is)",
    r"^(now available|available now)\b",
    # Phone number lines (staff/contact directory entries)
    r"(phone|tel|fax)\s*[-–:\s]+\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}",
    # Accessibility/screen reader boilerplate
    r"screen reader.{0,60}(problem|issue|trouble|difficulty)",
    r"^if you are (having|experiencing) (problem|issue|trouble|difficulty)",
    # Social media handle-only descriptions
    r"^@[\w.]+\s*$",
    # Navigation link fragments like "[More information] [Map]"
    r"^\[?more information\]?\s*(\[map\])?$",
    # PATH/trail listing items that are just location descriptions, not venue descriptions
    r"^path connecting\b",
]

_BOILERPLATE_RE = re.compile(
    "|".join(BOILERPLATE_PATTERNS), re.IGNORECASE | re.MULTILINE
)

# Nav/structural elements to skip when scanning body paragraphs
SKIP_TAGS = {"nav", "header", "footer", "aside", "script", "style", "noscript"}
SKIP_CLASS_FRAGMENTS = {
    "nav", "menu", "footer", "sidebar", "widget", "breadcrumb",
    "cookie", "consent", "banner", "advertisement", "social",
    "share", "newsletter", "subscribe",
}

# Minimum paragraph length to consider (chars)
MIN_PARA_LEN = 40


# ---------------------------------------------------------------------------
# Extraction helpers
# ---------------------------------------------------------------------------

def _clean(text: str) -> str:
    """Normalize whitespace."""
    return re.sub(r"\s+", " ", text).strip()


def _is_boilerplate(text: str) -> bool:
    """Return True if the text looks like generic boilerplate."""
    if not text or len(text.strip()) < 20:
        return True
    return bool(_BOILERPLATE_RE.search(text.strip()))


def _truncate(text: str) -> str:
    """Truncate to MAX_DESCRIPTION_LEN, breaking at a word boundary."""
    if len(text) <= MAX_DESCRIPTION_LEN:
        return text
    truncated = text[:MAX_DESCRIPTION_LEN].rsplit(" ", 1)[0]
    return truncated.rstrip(".,;:") + "..."


def _extract_og_description(soup: BeautifulSoup) -> Optional[str]:
    """og:description meta tag."""
    tag = soup.find("meta", property="og:description")
    if tag and tag.get("content"):
        return _clean(tag["content"])
    return None


def _extract_meta_description(soup: BeautifulSoup) -> Optional[str]:
    """meta name=description tag."""
    tag = soup.find("meta", attrs={"name": "description"})
    if tag and tag.get("content"):
        return _clean(tag["content"])
    return None


def _extract_jsonld_description(soup: BeautifulSoup) -> Optional[str]:
    """JSON-LD description field from any schema.org block."""
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
            # Handle arrays of schemas
            if isinstance(data, list):
                data = data[0] if data else {}
            desc = data.get("description")
            if desc and isinstance(desc, str):
                return _clean(desc)
        except (json.JSONDecodeError, AttributeError, KeyError):
            continue
    return None


def _is_structural_parent(tag) -> bool:
    """Return True if the tag is inside a nav/footer/etc. structural element."""
    parent = tag.parent
    depth = 0
    while parent and depth < 8:
        tag_name = getattr(parent, "name", "") or ""
        if tag_name in SKIP_TAGS:
            return True
        classes = " ".join(parent.get("class", [])).lower()
        pid = (parent.get("id") or "").lower()
        if any(frag in classes or frag in pid for frag in SKIP_CLASS_FRAGMENTS):
            return True
        parent = parent.parent
        depth += 1
    return False


def _extract_first_paragraph(soup: BeautifulSoup) -> Optional[str]:
    """Find the first meaningful non-structural paragraph."""
    # Try <p> tags first
    for p in soup.find_all("p"):
        text = _clean(p.get_text())
        if len(text) < MIN_PARA_LEN:
            continue
        if _is_structural_parent(p):
            continue
        if _is_boilerplate(text):
            continue
        return text

    # Fall back to <div> with direct text content that looks descriptive
    for div in soup.find_all(["div", "section"]):
        # Only divs with directly-contained text (not wrappers)
        direct_text = _clean(div.get_text(separator=" "))
        if len(direct_text) < MIN_PARA_LEN or len(direct_text) > 2000:
            continue
        if _is_structural_parent(div):
            continue
        if _is_boilerplate(direct_text):
            continue
        # Prefer divs that have no child block elements (paragraph-like)
        child_block_tags = div.find_all(["p", "div", "section", "article", "ul", "ol"])
        if child_block_tags:
            continue
        return direct_text

    return None


def scrape_description(url: str, venue_name: str = "") -> Optional[str]:
    """
    Fetch a venue website and extract a useful description.
    Returns the cleaned description or None if nothing useful found.
    """
    # Skip non-HTTP URLs (Instagram, etc.)
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    if "instagram.com" in url or "facebook.com" in url or "twitter.com" in url:
        logger.debug(f"  Skipping social URL: {url}")
        return None

    try:
        resp = requests.get(url, headers=HEADERS, timeout=12, allow_redirects=True)
        resp.raise_for_status()
        # Skip non-HTML responses
        content_type = resp.headers.get("content-type", "")
        if "html" not in content_type.lower():
            return None
    except requests.exceptions.Timeout:
        logger.debug(f"  Timeout: {url}")
        return None
    except requests.exceptions.RequestException as e:
        logger.debug(f"  Request error ({url}): {e}")
        return None

    try:
        soup = BeautifulSoup(resp.text, "html.parser")
    except Exception as e:
        logger.debug(f"  Parse error ({url}): {e}")
        return None

    # Extraction priority: og:description > meta description > JSON-LD > first paragraph
    for extractor in (
        _extract_og_description,
        _extract_meta_description,
        _extract_jsonld_description,
        _extract_first_paragraph,
    ):
        raw = extractor(soup)
        if not raw:
            continue
        if _is_boilerplate(raw):
            continue
        # Reject if the description is just the venue name (exact or near-exact match)
        if venue_name and raw.strip().lower() == venue_name.strip().lower():
            continue
        return _truncate(raw)

    return None


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

def get_venues_needing_descriptions(limit: int) -> list[dict]:
    """Return active T1+ venues with a website but no description."""
    client = get_client()
    result = (
        client.table("venues")
        .select("id, name, venue_type, website")
        .eq("active", True)
        .is_("description", "null")
        .not_.is_("website", "null")
        .in_("venue_type", list(T1_TYPES))
        .limit(limit)
        .execute()
    )
    return result.data or []


def update_venue_description(venue_id: int, description: str) -> bool:
    """Write the description to the venues table."""
    client = get_client()
    try:
        client.table("venues").update({"description": description}).eq("id", venue_id).execute()
        return True
    except Exception as e:
        logger.error(f"  DB update error (venue {venue_id}): {e}")
        return False


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Scrape descriptions for T1+ venues")
    parser.add_argument(
        "--limit", type=int, default=500,
        help="Max venues to process (default: 500 — enough to cover all missing)",
    )
    parser.add_argument("--dry-run", action="store_true", help="Print results without writing to DB")
    args = parser.parse_args()

    logger.info("=" * 65)
    logger.info("Venue Description Scraper — T1+ Tier Health Compliance")
    logger.info("=" * 65)

    venues = get_venues_needing_descriptions(args.limit)
    logger.info(f"Found {len(venues)} T1+ venues with website and no description")
    if args.dry_run:
        logger.info("(DRY RUN — no writes)")
    logger.info("")

    enriched = 0
    skipped_no_desc = 0
    skipped_boilerplate = 0
    errors = 0

    for i, venue in enumerate(venues, 1):
        vid = venue["id"]
        name = venue["name"]
        vtype = venue["venue_type"]
        website = venue["website"] or ""

        prefix = f"[{i:03d}/{len(venues)}]"

        desc = scrape_description(website, venue_name=name)

        if desc is None:
            logger.info(f"{prefix} NO DESC   {name} ({vtype}) — {website[:60]}")
            skipped_no_desc += 1
        else:
            if args.dry_run:
                logger.info(f"{prefix} FOUND     {name} ({vtype})")
                logger.info(f"           \"{desc[:120]}\"")
                enriched += 1
            else:
                ok = update_venue_description(vid, desc)
                if ok:
                    logger.info(f"{prefix} ENRICHED  {name} ({vtype})")
                    logger.info(f"           \"{desc[:100]}\"")
                    enriched += 1
                else:
                    logger.info(f"{prefix} DB ERROR   {name}")
                    errors += 1

        # Polite crawl delay
        time.sleep(0.75)

    logger.info("")
    logger.info("=" * 65)
    logger.info(f"Results: {enriched} enriched | {skipped_no_desc} no description found | {errors} DB errors")
    if args.dry_run:
        logger.info("(DRY RUN — nothing written)")


if __name__ == "__main__":
    main()
