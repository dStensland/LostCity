"""
Crawler: Children's Museum of Atlanta — permanent exhibits + traveling exhibitions.
childrensmuseumatlanta.org

Produces:
  - venue_features: permanent interactive exhibits included with admission
  - exhibitions: time-boxed traveling/special exhibits with date ranges

Permanent exhibit data is hard-coded from childrensmuseumatlanta.org/exhibits/
(sourced April 2026; the six permanent galleries are stable).

Traveling exhibits are live-scraped from the same page — each exhibit card
contains a date range, title, and description inline in the anchor tag.
The page is server-rendered (no Playwright required for the exhibits listing).

Source slug: childrens-museum-atlanta-features
Crawl frequency: monthly
"""

from __future__ import annotations

import logging
import re
import urllib.request
from datetime import date
from typing import Optional

from bs4 import BeautifulSoup

from db import get_or_create_place
from db.client import get_client
from entity_lanes import SourceEntityCapabilities, TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope
from exhibition_utils import build_exhibition_record

logger = logging.getLogger(__name__)

BASE_URL = "https://childrensmuseumatlanta.org"
EXHIBITS_URL = f"{BASE_URL}/exhibits/"

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    destinations=True,
    venue_features=True,
    exhibitions=True,
)

# ---------------------------------------------------------------------------
# Place data
# ---------------------------------------------------------------------------

PLACE_DATA = {
    "name": "Children's Museum of Atlanta",
    "slug": "childrens-museum-of-atlanta",
    "address": "275 Centennial Olympic Park Dr NW",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30313",
    "lat": 33.7627,
    "lng": -84.3933,
    "place_type": "museum",
    "spot_type": "museum",
    "website": BASE_URL,
    "hours": {
        "monday": "10:00-17:00",
        "tuesday": "10:00-17:00",
        "wednesday": "10:00-17:00",
        "thursday": "10:00-17:00",
        "friday": "10:00-17:00",
        "saturday": "10:00-17:00",
        "sunday": "12:00-17:00",
    },
    "vibes": [
        "family-friendly",
        "kids",
        "interactive",
        "educational",
        "downtown",
        "all-ages",
        "rainy-day",
    ],
    "description": (
        "Children's Museum of Atlanta is a hands-on discovery space in Downtown Atlanta "
        "built for kids 10 months through 8 years. Six permanent interactive exhibits "
        "cover food science, global cultures, art, early literacy, STEM, and engineering, "
        "with traveling special exhibitions throughout the year."
    ),
}

# ---------------------------------------------------------------------------
# Permanent venue features — hard-coded from childrensmuseumatlanta.org/exhibits/
# Verified April 2026. Descriptions >= 100 chars; feature_type = "experience"
# for all (every exhibit is hands-on interactive, not passive observation).
# admission_type = "included" — all come with general admission.
# ---------------------------------------------------------------------------

_PERMANENT_FEATURES: list[dict] = [
    {
        "slug": "cma-gateway-to-the-world",
        "title": "Gateway to the World",
        "feature_type": "experience",
        "description": (
            "Gateway to the World is the museum's newest and largest permanent exhibit, spanning "
            "six continents through hands-on play. Kids visit an international marketplace, launch "
            "a rocket into space, and climb through the layers of the Earth in a multi-level "
            "structure that makes global cultures tangible for young explorers."
        ),
        "image_url": "https://childrensmuseumatlanta.org/wp-content/uploads/2025/08/GATEWAY-2.png",
        "admission_type": "included",
        "source_url": f"{BASE_URL}/experiences/gateway-to-the-world/",
        "sort_order": 10,
        "tags": ["global-cultures", "geography", "stem", "space", "play", "family-friendly"],
    },
    {
        "slug": "cma-let-your-creativity-flow",
        "title": "Let Your Creativity Flow",
        "feature_type": "experience",
        "description": (
            "Let Your Creativity Flow is the museum's art studio exhibit, inviting kids to discover "
            "colors and sounds while exploring artists from around the world. Hands-on creation "
            "stations include painting, sculpting, and mixed media — everything is designed for "
            "making, not just looking."
        ),
        "image_url": "https://childrensmuseumatlanta.org/wp-content/uploads/2025/08/CREATIVITY.png",
        "admission_type": "included",
        "source_url": f"{BASE_URL}/experiences/let-your-creativity-flow/",
        "sort_order": 20,
        "tags": ["art", "creativity", "studio", "hands-on", "painting", "family-friendly"],
    },
    {
        "slug": "cma-fundamentally-food",
        "title": "Fundamentally Food",
        "feature_type": "experience",
        "description": (
            "Fundamentally Food teaches kids about nutrition, agriculture, and cooking through "
            "play. Visitors can milk a life-size model cow named Buttercup, trace food from farm "
            "to store to table, and role-play in a market and kitchen setting that makes healthy "
            "eating tangible and fun for toddlers through early elementary age."
        ),
        "image_url": "https://childrensmuseumatlanta.org/wp-content/uploads/2025/08/FOOD.png",
        "admission_type": "included",
        "source_url": f"{BASE_URL}/experiences/fundamentally-food/",
        "sort_order": 30,
        "tags": ["food", "nutrition", "farming", "cooking", "play", "family-friendly"],
    },
    {
        "slug": "cma-leaping-into-learning",
        "title": "Leaping into Learning",
        "feature_type": "experience",
        "description": (
            "Leaping into Learning is designed specifically for the museum's youngest visitors — "
            "babies through five years old. The exhibit features a reading nook, puppet theater, "
            "storytelling spaces, and sensory-friendly play elements scaled for toddlers and "
            "preschoolers discovering language, movement, and imagination."
        ),
        "image_url": "https://childrensmuseumatlanta.org/wp-content/uploads/2025/08/LEAPING.png",
        "admission_type": "included",
        "source_url": f"{BASE_URL}/experiences/leaping-into-learning/",
        "sort_order": 40,
        "tags": ["babies", "toddlers", "literacy", "puppets", "storytelling", "sensory"],
    },
    {
        "slug": "cma-step-up-to-science",
        "title": "Step Up To Science",
        "feature_type": "experience",
        "description": (
            "Step Up To Science lets kids explore the inner workings of the human body, the "
            "wonder of light and optics, and the technology behind robotics. STEM challenges "
            "are designed for ages 2 through 8, with building and engineering stations that "
            "let kids test hypotheses through play-based experimentation."
        ),
        "image_url": "https://childrensmuseumatlanta.org/wp-content/uploads/2025/08/SCIENCE.png",
        "admission_type": "included",
        "source_url": f"{BASE_URL}/experiences/step-up-to-science/",
        "sort_order": 50,
        "tags": ["stem", "science", "engineering", "robotics", "human-body", "family-friendly"],
    },
    {
        "slug": "cma-tools-for-solutions",
        "title": "Tools For Solutions",
        "feature_type": "experience",
        "description": (
            "Tools For Solutions puts kids in the role of builder and problem-solver. The exhibit "
            "includes a Build It Lab, a Construction House where visitors learn about plumbing and "
            "electricity, and a giant ball machine that challenges kids to direct the flow using "
            "ramps, gates, and simple machines. Geared to ages 10 months through 8 years."
        ),
        "image_url": "https://childrensmuseumatlanta.org/wp-content/uploads/2025/08/TOOLS-3.png",
        "admission_type": "included",
        "source_url": f"{BASE_URL}/experiences/tools-for-solutions/",
        "sort_order": 60,
        "tags": ["building", "engineering", "simple-machines", "construction", "problem-solving"],
    },
]

# ---------------------------------------------------------------------------
# Date parsing for traveling exhibit cards
# Format observed: "January 17 - May 10, 2026" or "May 23 - September 13, 2026"
# or cross-year: "September 26, 2026 - January 10, 2027"
# ---------------------------------------------------------------------------

_MONTHS = {
    "january": 1, "february": 2, "march": 3, "april": 4,
    "may": 5, "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12,
    "jan": 1, "feb": 2, "mar": 3, "apr": 4,
    "jun": 6, "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}

# Matches: "Month Day[, Year] - Month Day, Year" (with optional nbsp)
_DATE_RANGE_RE = re.compile(
    r"(\w+)\s+(\d{1,2})(?:,?\s*(\d{4}))?\s*[-\u2013\u00a0 ]+\s*(\w+)\s+(\d{1,2}),?\s*(\d{4})",
    re.IGNORECASE,
)


def _parse_exhibit_dates(text: str) -> tuple[Optional[str], Optional[str]]:
    """
    Extract opening_date and closing_date from an exhibit card text block.
    Returns (opening_iso, closing_iso) or (None, None) if not found.
    """
    # Normalise non-breaking spaces
    text = text.replace("\xa0", " ").replace("\x02", "")

    m = _DATE_RANGE_RE.search(text)
    if not m:
        return None, None

    start_month_name = m.group(1).lower()
    start_day = int(m.group(2))
    start_year_raw = m.group(3)
    end_month_name = m.group(4).lower()
    end_day = int(m.group(5))
    end_year = int(m.group(6))

    start_month = _MONTHS.get(start_month_name)
    end_month = _MONTHS.get(end_month_name)
    if not start_month or not end_month:
        return None, None

    # If start year not given explicitly, infer from end year
    start_year = int(start_year_raw) if start_year_raw else end_year

    try:
        opening_date = date(start_year, start_month, start_day).isoformat()
        closing_date = date(end_year, end_month, end_day).isoformat()
    except ValueError:
        return None, None

    return opening_date, closing_date


# ---------------------------------------------------------------------------
# Live scrape: traveling/featured exhibits from exhibits page
# The page is server-rendered; requests + BeautifulSoup is sufficient.
# ---------------------------------------------------------------------------

_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36"
)


def _fetch_html(url: str, timeout: int = 15) -> Optional[str]:
    req = urllib.request.Request(url, headers={"User-Agent": _USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.read().decode("utf-8", errors="replace")
    except Exception as exc:
        logger.warning("CMA features: failed to fetch %s: %s", url, exc)
        return None


def _scrape_traveling_exhibits(
    venue_id: int,
    source_id: int,
    portal_id: Optional[str],
) -> list[dict]:
    """
    Scrape current traveling/featured exhibits from the exhibits page.
    Returns exhibition records ready for TypedEntityEnvelope.
    """
    records: list[dict] = []
    html = _fetch_html(EXHIBITS_URL)
    if not html:
        logger.warning("CMA features: exhibits page fetch failed; skipping traveling exhibits")
        return records

    soup = BeautifulSoup(html, "html.parser")
    today_iso = date.today().isoformat()
    seen: set[str] = set()

    # Traveling exhibit cards: <a href="...traveling-exhibits/..."> containing
    # date range + description + title inline.
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "traveling-exhibits" not in href and "doc-mcstuffins" not in href:
            continue

        full_text = a.get_text(separator=" ")
        opening_date, closing_date = _parse_exhibit_dates(full_text)

        # Skip exhibits that have already closed
        if closing_date and closing_date < today_iso:
            logger.debug("CMA features: skipping closed exhibit at %s", href)
            continue

        # Extract title — it is the last non-whitespace h3/strong text or
        # the text after the date+description in the anchor.
        # The pattern is: "Date range + Description + Title"
        # We look for the h3 sibling or parse from the anchor's child h3.
        title: Optional[str] = None
        h3 = a.find("h3")
        if h3:
            title = h3.get_text(strip=True)
        else:
            # Fall back: last line of the cleaned text
            lines = [ln.strip() for ln in full_text.splitlines() if ln.strip()]
            if lines:
                title = lines[-1]

        if not title or len(title) < 4:
            logger.debug("CMA features: could not extract title from %s", href)
            continue

        dedup_key = f"{title}|{opening_date}"
        if dedup_key in seen:
            continue
        seen.add(dedup_key)

        # Description: text between the date range line and the title
        # Strip the date-range prefix and the title suffix from full_text
        description: Optional[str] = None
        date_m = _DATE_RANGE_RE.search(full_text)
        if date_m:
            after_date = full_text[date_m.end():].strip()
            # Remove title from the tail
            title_pos = after_date.lower().rfind(title.lower())
            if title_pos > 0:
                desc_raw = after_date[:title_pos].strip()
            else:
                desc_raw = after_date.strip()
            # Clean control chars
            desc_raw = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x02]", "", desc_raw).strip()
            if len(desc_raw) >= 40:
                description = desc_raw[:600]

        # Image: look for <img> inside this anchor
        image_url: Optional[str] = None
        img = a.find("img", src=True)
        if img:
            src = img["src"]
            if src.startswith("http"):
                image_url = src
            elif src.startswith("/"):
                image_url = BASE_URL + src

        # Canonical source URL
        source_url = href if href.startswith("http") else BASE_URL + href

        rec, artists = build_exhibition_record(
            title=title,
            venue_id=venue_id,
            source_id=source_id,
            opening_date=opening_date,
            closing_date=closing_date,
            venue_name=PLACE_DATA["name"],
            description=description,
            image_url=image_url,
            source_url=source_url,
            portal_id=portal_id,
            admission_type="ticketed",
            tags=["childrens-museum", "traveling-exhibit", "downtown", "family-friendly", "kids"],
            exhibition_type="special-exhibit",
        )
        records.append(rec)
        logger.info(
            "CMA features: queued traveling exhibit %r (%s – %s)",
            title,
            opening_date or "open",
            closing_date or "tbd",
        )

    return records


# ---------------------------------------------------------------------------
# Source registration
# ---------------------------------------------------------------------------

_SOURCE_SLUG = "childrens-museum-atlanta-features"


def _ensure_source_record() -> Optional[dict]:
    """Return or create the sources row for this crawler."""
    client = get_client()
    try:
        result = (
            client.table("sources")
            .select("id,slug,is_active,name")
            .eq("slug", _SOURCE_SLUG)
            .limit(1)
            .execute()
        )
        if result.data:
            return result.data[0]

        from db.client import writes_enabled, _log_write_skip

        if not writes_enabled():
            _log_write_skip(f"insert sources slug={_SOURCE_SLUG}")
            return {
                "id": -1,
                "slug": _SOURCE_SLUG,
                "is_active": True,
                "name": "Children's Museum of Atlanta Features",
            }

        new_source = {
            "slug": _SOURCE_SLUG,
            "name": "Children's Museum of Atlanta — Exhibits & Exhibitions",
            "url": EXHIBITS_URL,
            "source_type": "scrape",
            "crawl_frequency": "monthly",
            "is_active": True,
        }
        ins = client.table("sources").insert(new_source).execute()
        if ins.data:
            logger.info(
                "Created source record for %s (id=%s)", _SOURCE_SLUG, ins.data[0]["id"]
            )
            return ins.data[0]

        logger.warning("Source insert returned no data for %s", _SOURCE_SLUG)
        return None

    except Exception as exc:
        logger.error("Failed to ensure source record for %s: %s", _SOURCE_SLUG, exc)
        return None


# ---------------------------------------------------------------------------
# Main crawl function
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Children's Museum of Atlanta permanent features + current traveling exhibitions.

    Returns (found, new, updated) counting both venue_features and exhibitions.
    """
    source_id = source["id"]
    portal_id = source.get("portal_id")

    found = 0
    new = 0
    updated = 0

    # 1. Resolve (or create) the venue record
    venue_id = get_or_create_place(PLACE_DATA)
    logger.info("CMA features: venue_id=%s", venue_id)

    # 2. Build venue_features envelope from hard-coded permanent exhibit data
    features_envelope = TypedEntityEnvelope()
    features_envelope.add("destinations", {**PLACE_DATA})

    for feat in _PERMANENT_FEATURES:
        record = {
            "place_id": venue_id,
            "slug": feat["slug"],
            "title": feat["title"],
            "feature_type": feat["feature_type"],
            "description": feat["description"],
            "image_url": feat.get("image_url"),
            "url": feat.get("source_url"),
            "source_url": feat.get("source_url"),
            "admission_type": feat.get("admission_type", "included"),
            "is_free": False,
            "sort_order": feat.get("sort_order", 0),
            "tags": feat.get("tags"),
            "source_id": source_id,
            "portal_id": portal_id,
            "is_seasonal": False,
            "metadata": {
                "last_verified": "2026-04",
                "source": "childrensmuseumatlanta.org/exhibits/",
            },
        }
        features_envelope.add("venue_features", record)
        found += 1

    persist_result = persist_typed_entity_envelope(features_envelope)
    new_features = persist_result.persisted.get("venue_features", 0)
    skip_features = persist_result.skipped.get("venue_features", 0)
    new += new_features
    logger.info(
        "CMA features: %d permanent features processed (%d persisted, %d skipped)",
        len(_PERMANENT_FEATURES),
        new_features,
        skip_features,
    )

    # 3. Scrape current traveling exhibits
    exhibition_envelope = TypedEntityEnvelope()
    traveling_exhibits = _scrape_traveling_exhibits(venue_id, source_id, portal_id)

    for ex in traveling_exhibits:
        exhibition_envelope.add("exhibitions", ex)
    found += len(traveling_exhibits)

    if exhibition_envelope.exhibitions:
        ex_persist = persist_typed_entity_envelope(exhibition_envelope)
        ex_new = ex_persist.persisted.get("exhibitions", 0)
        ex_skip = ex_persist.skipped.get("exhibitions", 0)
        new += ex_new
        logger.info(
            "CMA features: %d traveling exhibits queued (%d persisted, %d skipped)",
            len(exhibition_envelope.exhibitions),
            ex_new,
            ex_skip,
        )
    else:
        logger.info("CMA features: no current traveling exhibits found on exhibits page")

    logger.info(
        "CMA features crawl complete: %d found, %d new, %d updated",
        found,
        new,
        updated,
    )
    return found, new, updated
