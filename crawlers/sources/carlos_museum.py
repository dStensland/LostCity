"""
Crawler for Michael C. Carlos Museum at Emory (carlos.emory.edu).

The exhibitions index page (https://carlos.emory.edu/exhibitions) is a
Drupal 10 server-rendered page. All 13 exhibition cards are present in the
static HTML as <article class="content-card"> elements — no JavaScript
rendering required.

Each card contains:
  - <a class="content-card--link" href="/exhibition/SLUG">
  - <h2> or <h3> title element
  - <img src="..."> (Drupal image derivative)
  - Date range text in the card body

This crawler was converted from Playwright to requests+BeautifulSoup
on 2026-03-25 because the site is fully server-rendered Drupal.
"""

from __future__ import annotations

import logging
import re
from datetime import date, datetime
from typing import Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from db import get_or_create_venue
from entity_lanes import SourceEntityCapabilities, TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope
from exhibition_utils import build_exhibition_record

logger = logging.getLogger(__name__)

BASE_URL = "https://carlos.emory.edu"
EXHIBITIONS_URL = f"{BASE_URL}/exhibitions"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    events=True,
    destinations=True,
    destination_details=True,
    venue_features=True,
    venue_specials=True,
)

VENUE_DATA = {
    "name": "Michael C. Carlos Museum",
    "slug": "michael-c-carlos-museum",
    "address": "571 South Kilgo Cir",
    "neighborhood": "Emory",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30322",
    "lat": 33.7904,
    "lng": -84.3253,
    "venue_type": "museum",
    "spot_type": "museum",
    "website": BASE_URL,
    # description and image_url enriched from og: tags at crawl time
    # Hours verified 2026-03-11: Tue-Fri 10am-4pm, Sat 10am-5pm, Sun 12-5pm, Mon closed
    "hours": {
        "tuesday": "10:00-16:00",
        "wednesday": "10:00-16:00",
        "thursday": "10:00-16:00",
        "friday": "10:00-16:00",
        "saturday": "10:00-17:00",
        "sunday": "12:00-17:00",
    },
    "vibes": ["free", "educational", "cultural", "art", "historic", "university"],
}

# Date range patterns found on Carlos exhibition cards:
#   "January 31 - October 25, 2026"
#   "March 17, 2026 - March 4, 2029"
#   "September 13 - December 14, 2025"
#   "March 10-31, 2025"
_MONTH_NAMES = (
    "January|February|March|April|May|June|"
    "July|August|September|October|November|December"
)
_DATE_RANGE_RE = re.compile(
    rf"(?P<m1>{_MONTH_NAMES})\s+(?P<d1>\d{{1,2}})(?:,\s*(?P<y1>\d{{4}}))?"
    r"\s*[-–]\s*"
    rf"(?:(?P<m2>{_MONTH_NAMES})\s+)?(?P<d2>\d{{1,2}})(?:,\s*(?P<y2>\d{{4}}))?",
    re.IGNORECASE,
)

_MONTH_MAP = {
    "january": 1, "february": 2, "march": 3, "april": 4,
    "may": 5, "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12,
}


def _build_destination_envelope(venue_id: int) -> TypedEntityEnvelope:
    envelope = TypedEntityEnvelope()
    envelope.add(
        "destination_details",
        {
            "venue_id": venue_id,
            "destination_type": "art_museum",
            "commitment_tier": "hour",
            "primary_activity": "art and antiquities museum visit",
            "best_seasons": ["spring", "summer", "fall", "winter"],
            "weather_fit_tags": ["indoor", "rainy-day", "heat-day", "family-daytrip", "free-option"],
            "parking_type": "paid_lot",
            "best_time_of_day": "afternoon",
            "practical_notes": (
                "Carlos Museum works best as a compact Emory museum stop, especially for families "
                "who want a shorter culture outing instead of committing to a larger all-day museum campus."
            ),
            "accessibility_notes": (
                "Its indoor galleries and relatively contained footprint keep the visit lower-friction "
                "for strollers and shorter attention spans than larger museum outings."
            ),
            "family_suitability": "yes",
            "reservation_required": False,
            "permit_required": False,
            "fee_note": (
                "The museum remains one of Atlanta's stronger low-cost or free-feeling family culture "
                "stops depending on current admission policy and campus access."
            ),
            "source_url": BASE_URL,
            "metadata": {
                "source_type": "family_destination_enrichment",
                "venue_type": "art_museum",
                "city": "atlanta",
            },
        },
    )
    envelope.add(
        "venue_features",
        {
            "venue_id": venue_id,
            "slug": "free-emory-art-and-antiquities-anchor",
            "title": "Emory art and antiquities anchor",
            "feature_type": "amenity",
            "description": "Carlos Museum gives families an easier university-adjacent culture stop built around art, antiquities, and rotating exhibitions.",
            "url": BASE_URL,
            "is_free": True,
            "sort_order": 10,
        },
    )
    envelope.add(
        "venue_features",
        {
            "venue_id": venue_id,
            "slug": "compact-campus-museum-stop",
            "title": "Compact campus museum stop",
            "feature_type": "amenity",
            "description": "The museum's contained indoor layout makes it easier to fit into a shorter family outing than a larger destination museum day.",
            "url": BASE_URL,
            "is_free": True,
            "sort_order": 20,
        },
    )
    envelope.add(
        "venue_specials",
        {
            "venue_id": venue_id,
            "slug": "sunday-funday-free-admission",
            "title": "Sunday FUNday free admission",
            "description": "On the first Sunday of the month during the academic year, Sunday FUNdays offer free admission plus drop-in family art-making at the museum.",
            "price_note": "Free admission during Sunday FUNday programming.",
            "is_free": True,
            "source_url": f"{BASE_URL}/childrens-and-family-programs",
            "category": "admission",
        },
    )
    return envelope


def _fetch_soup(url: str) -> BeautifulSoup:
    """Fetch a URL and return a BeautifulSoup object."""
    response = requests.get(url, headers=HEADERS, timeout=30)
    response.raise_for_status()
    return BeautifulSoup(response.text, "html.parser")


def _enrich_venue_from_og(soup: BeautifulSoup) -> None:
    """Extract og: metadata from the homepage and inject into VENUE_DATA."""
    og_desc = soup.find("meta", property="og:description") or soup.find("meta", attrs={"name": "description"})
    og_image = soup.find("meta", property="og:image")
    if og_desc and og_desc.get("content") and not VENUE_DATA.get("description"):
        desc = re.sub(r"\s+", " ", og_desc["content"]).strip()
        if len(desc) >= 20:
            VENUE_DATA["description"] = desc
    if og_image and og_image.get("content") and not VENUE_DATA.get("image_url"):
        VENUE_DATA["image_url"] = og_image["content"].strip()


def _parse_date_range(text: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse a date range string from a Carlos exhibition card.

    Handles patterns like:
      "January 31 - October 25, 2026"
      "March 17, 2026 - March 4, 2029"
      "September 13 - December 14, 2025"
      "March 10-31, 2025"
    """
    m = _DATE_RANGE_RE.search(text)
    if not m:
        return None, None

    month1_name = m.group("m1").lower()
    month2_name = (m.group("m2") or m.group("m1")).lower()
    month1 = _MONTH_MAP.get(month1_name)
    month2 = _MONTH_MAP.get(month2_name)
    if not month1 or not month2:
        return None, None

    day1 = int(m.group("d1"))
    day2 = int(m.group("d2"))

    # Determine years
    today_year = date.today().year
    if m.group("y2"):
        year2 = int(m.group("y2"))
    elif m.group("y1"):
        year2 = int(m.group("y1"))
    else:
        year2 = today_year

    if m.group("y1"):
        year1 = int(m.group("y1"))
    else:
        # If start month > end month and no explicit year, start is prior year
        year1 = year2 - 1 if month1 > month2 else year2

    try:
        start_dt = date(year1, month1, day1)
        end_dt = date(year2, month2, day2)
    except ValueError:
        return None, None

    return start_dt.isoformat(), end_dt.isoformat()


def _extract_card_image(article: BeautifulSoup) -> Optional[str]:
    """Extract the best available image URL from a content-card article."""
    img = article.select_one("img")
    if not img:
        return None
    src = img.get("src") or ""
    if src and src.startswith("/"):
        return urljoin(BASE_URL, src)
    return src or None


def _parse_exhibition_cards(soup: BeautifulSoup) -> list[dict]:
    """
    Parse all <article class="content-card"> elements from the exhibitions index.
    Returns a list of raw exhibition dicts with title, href, dates, image.
    """
    today = date.today()
    results = []

    for article in soup.select("article.content-card"):
        link_el = article.select_one("a.content-card--link")
        if not link_el:
            continue
        href = link_el.get("href", "")
        if not href:
            continue
        source_url = urljoin(BASE_URL, href)

        # Title from h2, h3, or content-card--title
        title_el = article.select_one("h2, h3, .content-card--title")
        if not title_el:
            continue
        title = title_el.get_text(strip=True)
        if not title:
            continue

        # Date range from card body text
        card_text = article.get_text(" ", strip=True)
        opening_date, closing_date = _parse_date_range(card_text)

        # Filter: skip if closing date is in the past (more than a few months ago)
        if closing_date:
            try:
                close_dt = datetime.strptime(closing_date, "%Y-%m-%d").date()
                if close_dt < today:
                    logger.debug("Carlos Museum: skipping past exhibition %r (closed %s)", title, closing_date)
                    continue
            except ValueError:
                pass

        image_url = _extract_card_image(article)

        results.append({
            "title": title,
            "source_url": source_url,
            "opening_date": opening_date,
            "closing_date": closing_date,
            "image_url": image_url,
        })

    return results


def _fetch_exhibition_description(source_url: str) -> Optional[str]:
    """
    Fetch an exhibition detail page and extract the description.
    Returns None on failure so the caller can use a fallback.
    """
    try:
        soup = _fetch_soup(source_url)
        # Try meta description first
        for key, value in [("name", "description"), ("property", "og:description")]:
            tag = soup.find("meta", attrs={key: value})
            if tag and tag.get("content"):
                desc = re.sub(r"\s+", " ", tag["content"]).strip()
                if len(desc) >= 20:
                    return desc
        # Fall back to first substantial paragraph in main content
        for p in soup.select("main p, article p, .field--type-text-with-summary p"):
            text = re.sub(r"\s+", " ", p.get_text(" ", strip=True)).strip()
            if len(text) >= 60:
                return text
    except Exception as exc:
        logger.debug("Carlos Museum: could not fetch detail page %s: %s", source_url, exc)
    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Michael C. Carlos Museum exhibitions using requests + BeautifulSoup.

    The exhibitions index page is server-rendered Drupal — no Playwright needed.
    We parse exhibition cards from the index, then optionally fetch detail pages
    for descriptions.
    """
    source_id = source["id"]
    portal_id = source.get("portal_id")
    events_found = 0
    events_new = 0

    try:
        # Enrich venue metadata from homepage og: tags
        try:
            home_soup = _fetch_soup(BASE_URL)
            _enrich_venue_from_og(home_soup)
        except Exception as exc:
            logger.debug("Carlos Museum: homepage og: fetch failed: %s", exc)

        venue_id = get_or_create_venue(VENUE_DATA)
        persist_typed_entity_envelope(_build_destination_envelope(venue_id))

        logger.info("Carlos Museum: fetching exhibitions index %s", EXHIBITIONS_URL)
        index_soup = _fetch_soup(EXHIBITIONS_URL)
        cards = _parse_exhibition_cards(index_soup)
        logger.info("Carlos Museum: found %d exhibition card(s) in index", len(cards))

        exhibition_envelope = TypedEntityEnvelope()

        for card in cards:
            title = card["title"]

            # Fetch detail page for description
            description = _fetch_exhibition_description(card["source_url"])
            if not description:
                description = f"Exhibition at Michael C. Carlos Museum at Emory University."

            record, artists = build_exhibition_record(
                title=title,
                venue_id=venue_id,
                source_id=source_id,
                opening_date=card["opening_date"],
                closing_date=card["closing_date"],
                venue_name=VENUE_DATA["name"],
                description=description,
                image_url=card["image_url"],
                source_url=card["source_url"],
                portal_id=portal_id,
                admission_type="ticketed",
                tags=["carlos-museum", "emory", "museum", "art", "antiquities", "exhibition"],
            )
            if artists:
                record["artists"] = artists

            exhibition_envelope.add("exhibitions", record)
            events_found += 1
            events_new += 1
            logger.info(
                "Carlos Museum queued exhibition: %r (open=%s close=%s)",
                title,
                card["opening_date"] or "unknown",
                card["closing_date"] or "unknown",
            )

        if exhibition_envelope.has_records():
            persist_typed_entity_envelope(exhibition_envelope)
            ex_count = len(exhibition_envelope.exhibitions)
            logger.info("Carlos Museum: persisted %d exhibition(s) to exhibitions table", ex_count)

    except Exception as exc:
        logger.error("Failed to crawl Michael C. Carlos Museum: %s", exc)
        raise

    logger.info(
        "Carlos Museum crawl complete: %d found, %d new, 0 updated",
        events_found,
        events_new,
    )
    return events_found, events_new, 0
