"""
Crawler for Atlanta Contemporary (atlantacontemporary.org).
Free contemporary art center in West Midtown with rotating exhibitions,
artist talks, workshops, openings, and programs.

Site uses JavaScript rendering - must use Playwright.
Events are listed on /programs/schedule page.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from db import get_or_create_place, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from entity_lanes import SourceEntityCapabilities, TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope

logger = logging.getLogger(__name__)

BASE_URL = "https://atlantacontemporary.org"
EVENTS_URL = f"{BASE_URL}/programs/schedule"
EXHIBITIONS_URL = f"{BASE_URL}/exhibitions"

PLACE_DATA = {
    "name": "Atlanta Contemporary",
    "slug": "atlanta-contemporary",
    "address": "535 Means St NW",
    "neighborhood": "West Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30318",
    "lat": 33.7780,
    "lng": -84.4127,
    "venue_type": "museum",
    "spot_type": "museum",
    "website": BASE_URL,
    # Description populated dynamically from og:description on first Playwright visit.
    # Fallback for offline/test runs:
    "description": (
        "Atlanta Contemporary is a free contemporary art center in West Midtown dedicated to "
        "presenting innovative work by local, national, and international artists through "
        "rotating exhibitions, artist talks, studio visits, and community programs."
    ),
    # Hours verified 2026-03-11 from atlantacontemporary.org/visit
    "hours": {
        "monday": "closed",
        "tuesday": "11:00-17:00",
        "wednesday": "11:00-17:00",
        "thursday": "11:00-20:00",
        "friday": "11:00-17:00",
        "saturday": "11:00-17:00",
        "sunday": "12:00-17:00",
    },
    "vibes": ["free", "contemporary-art", "cultural", "west-midtown"],
}

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    events=True,
    destinations=True,
    destination_details=True,
    exhibitions=True,
    venue_features=True,
    venue_specials=True,
)


def _build_destination_envelope(venue_id: int) -> TypedEntityEnvelope:
    envelope = TypedEntityEnvelope()
    envelope.add(
        "destination_details",
        {
            "venue_id": venue_id,
            "destination_type": "art_museum",
            "commitment_tier": "hour",
            "primary_activity": "free contemporary art visit",
            "best_seasons": ["spring", "summer", "fall", "winter"],
            "weather_fit_tags": ["indoor", "rainy-day", "heat-day", "family-daytrip"],
            "parking_type": "street",
            "best_time_of_day": "afternoon",
            "practical_notes": (
                "Atlanta Contemporary works best as a free West Midtown culture stop for school-age families, especially when paired with another nearby outing rather than treated as an all-day museum plan."
            ),
            "accessibility_notes": (
                "Indoor galleries keep walking friction fairly low once families arrive, but the visit is a better fit for older kids and adults than for toddler-first museum expectations."
            ),
            "family_suitability": "caution",
            "reservation_required": False,
            "permit_required": False,
            "fee_note": "General gallery access is free; check the center for any ticketed openings, talks, or workshops.",
            "source_url": BASE_URL,
            "metadata": {
                "source_type": "family_destination_enrichment",
                "venue_type": "museum",
                "city": "atlanta",
            },
        },
    )
    envelope.add(
        "venue_features",
        {
            "venue_id": venue_id,
            "slug": "free-contemporary-art-center",
            "title": "Free contemporary art center",
            "feature_type": "amenity",
            "description": "Atlanta Contemporary is one of the strongest free contemporary art stops in the city, useful for school-age families with arts interest.",
            "url": BASE_URL,
            "is_free": True,
            "sort_order": 10,
        },
    )
    envelope.add(
        "venue_features",
        {
            "venue_id": venue_id,
            "slug": "west-midtown-cultural-pairing-stop",
            "title": "West Midtown cultural pairing stop",
            "feature_type": "experience",
            "description": "The center works best as a compact West Midtown culture stop paired with another nearby destination rather than as a full standalone family day.",
            "url": EVENTS_URL,
            "is_free": True,
            "sort_order": 20,
        },
    )
    envelope.add(
        "venue_specials",
        {
            "venue_id": venue_id,
            "slug": "always-free-gallery-admission",
            "title": "Always-free gallery admission",
            "description": "General gallery admission is free, which makes Atlanta Contemporary one of the easiest recurring no-ticket culture stops for older kids and family add-on outings.",
            "price_note": "General admission is free.",
            "is_free": True,
            "source_url": BASE_URL,
            "category": "admission",
        },
    )
    return envelope


def parse_date_time(date_time_str: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse date and time from format like 'February 1 / 12:00pm' or 'February 5 / 6:00pm'.
    Returns (date, time) as (YYYY-MM-DD, HH:MM).
    """
    try:
        date_time_str = date_time_str.strip()

        # Pattern: "Month Day / Hour:MMam/pm"
        match = re.match(
            r'([A-Za-z]+)\s+(\d{1,2})\s*/\s*(\d{1,2}):(\d{2})\s*(am|pm)',
            date_time_str,
            re.IGNORECASE
        )

        if match:
            month, day, hour, minute, period = match.groups()

            # Parse date
            current_year = datetime.now().year
            try:
                dt = datetime.strptime(f"{month} {day} {current_year}", "%B %d %Y")
            except ValueError:
                dt = datetime.strptime(f"{month} {day} {current_year}", "%b %d %Y")

            # If date is in the past, assume next year
            if dt.date() < datetime.now().date():
                dt = dt.replace(year=current_year + 1)

            date_str = dt.strftime("%Y-%m-%d")

            # Parse time
            hour = int(hour)
            period = period.lower()

            if period == "pm" and hour != 12:
                hour += 12
            elif period == "am" and hour == 12:
                hour = 0

            time_str = f"{hour:02d}:{minute}"

            return date_str, time_str

        # Try just date without time: "February 1"
        match = re.match(r'([A-Za-z]+)\s+(\d{1,2})', date_time_str, re.IGNORECASE)
        if match:
            month, day = match.groups()
            current_year = datetime.now().year
            try:
                dt = datetime.strptime(f"{month} {day} {current_year}", "%B %d %Y")
            except ValueError:
                dt = datetime.strptime(f"{month} {day} {current_year}", "%b %d %Y")

            if dt.date() < datetime.now().date():
                dt = dt.replace(year=current_year + 1)

            return dt.strftime("%Y-%m-%d"), None

    except (ValueError, AttributeError) as e:
        logger.debug(f"Could not parse date/time '{date_time_str}': {e}")

    return None, None


def determine_category(event_type: str, title: str, description: str = "") -> tuple[str, Optional[str], list[str]]:
    """Determine category based on event type, title, and description."""
    event_type_lower = event_type.lower()
    title_lower = title.lower()
    description_lower = description.lower() if description else ""
    combined = f"{event_type_lower} {title_lower} {description_lower}"

    tags = ["atlanta-contemporary", "museum", "contemporary-art", "west-midtown", "free"]

    # Contemporary Talks
    if "contemporary talks" in event_type_lower or "artist talk" in title_lower:
        return "museums", "talk", tags + ["talk", "artist-talk"]

    # Contemporary Kids
    if "contemporary kids" in event_type_lower or "kids" in event_type_lower:
        return "family", "kids", tags + ["family-friendly", "kids"]

    # Special Events - openings, receptions
    if "special event" in event_type_lower or "opening" in combined:
        if "opening" in combined or "reception" in combined:
            return "museums", "opening", tags + ["opening", "reception"]
        return "museums", "event", tags + ["special-event"]

    # Open Studios
    if "open studios" in event_type_lower or "open studio" in title_lower:
        return "museums", "studio", tags + ["open-studios", "studio-visit"]

    # Workshops
    if "workshop" in combined or "class" in combined:
        return "museums", "workshop", tags + ["workshop", "class"]

    # Member Programs
    if "member" in event_type_lower:
        return "museums", "member", tags + ["member-exclusive"]

    # Film screenings
    if any(w in combined for w in ["film", "screening", "movie"]):
        return "film", None, tags + ["film"]

    # Music performances
    if any(w in combined for w in ["music", "performance", "concert"]):
        return "music", "performance", tags + ["music", "performance"]

    # Exhibitions
    if any(w in combined for w in ["exhibition", "exhibit", "gallery", "show"]):
        return "museums", "exhibition", tags + ["exhibition"]

    # Default to museums
    return "museums", None, tags


def parse_exhibition_date_range(date_text: str) -> tuple[Optional[str], Optional[str]]:
    """Parse exhibition range strings like 'February 1, 2026 - May 17, 2026'."""
    if not date_text:
        return None, None

    cleaned = re.sub(r"\s+", " ", date_text.strip()).replace("–", "-").replace("—", "-")
    match = re.search(
        r"([A-Za-z]+ \d{1,2}, \d{4})\s*-\s*([A-Za-z]+ \d{1,2}, \d{4})",
        cleaned,
    )
    if not match:
        return None, None

    start_raw, end_raw = match.groups()
    for fmt in ("%B %d, %Y", "%b %d, %Y"):
        try:
            start_dt = datetime.strptime(start_raw, fmt)
            end_dt = datetime.strptime(end_raw, fmt)
            return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")
        except ValueError:
            continue

    return None, None


def normalize_ongoing_exhibit_dates(start_date: str, end_date: Optional[str]) -> tuple[str, Optional[str]]:
    """
    Keep ongoing exhibits active by normalizing the visible start date to today
    once the show is already running.
    """
    if not start_date or not end_date:
        return start_date, end_date

    today = datetime.now().date()
    start_dt = datetime.strptime(start_date, "%Y-%m-%d").date()
    end_dt = datetime.strptime(end_date, "%Y-%m-%d").date()

    if start_dt < today <= end_dt:
        return today.strftime("%Y-%m-%d"), end_date

    return start_date, end_date


def build_exhibition_title(primary: str, secondary: str) -> str:
    """Build a readable exhibit title from artist/org + show name."""
    primary_clean = re.sub(r"\s+", " ", (primary or "").strip())
    secondary_clean = re.sub(r"\s+", " ", (secondary or "").strip())

    if primary_clean and secondary_clean and primary_clean.lower() != secondary_clean.lower():
        return f"{primary_clean}: {secondary_clean}"
    return secondary_clean or primary_clean


def build_exhibition_lane_record(
    exhibition: dict,
    *,
    source_id: int,
    venue_id: int,
    portal_id: Optional[str],
) -> tuple[dict, Optional[list[dict]]]:
    """Build the typed exhibition lane record plus optional artist associations."""
    parts = exhibition["title"].split(": ", 1)
    artist_name = parts[0] if len(parts) == 2 else None

    exhibition_record = {
        "title": exhibition["title"],
        "venue_id": venue_id,
        "source_id": source_id,
        "_venue_name": PLACE_DATA["name"],
        "opening_date": exhibition["canonical_start_date"],
        "closing_date": exhibition["end_date"],
        "description": exhibition["description"],
        "image_url": exhibition["image_url"],
        "source_url": exhibition["source_url"],
        "admission_type": "free",
        "tags": ["contemporary-art", "museum", "west-midtown", "exhibition"],
        "is_active": True,
        "metadata": {
            "display_start_date": exhibition["start_date"],
        },
    }
    if portal_id:
        exhibition_record["portal_id"] = portal_id

    artists = [{"artist_name": artist_name}] if artist_name else None
    return exhibition_record, artists


def extract_exhibition_detail(detail_url: str) -> tuple[Optional[str], Optional[str]]:
    """Fetch the exhibit detail page for description and hero image."""
    try:
        response = requests.get(
            detail_url,
            timeout=30,
            headers={"User-Agent": "Mozilla/5.0"},
        )
        response.raise_for_status()
    except Exception as exc:
        logger.warning("Failed to fetch Atlanta Contemporary exhibit detail %s: %s", detail_url, exc)
        return None, None

    soup = BeautifulSoup(response.text, "html.parser")

    description = None
    for paragraph in soup.select("main p, article p, .content p"):
        text = re.sub(r"\s+", " ", paragraph.get_text(" ", strip=True))
        if len(text) >= 80:
            description = text[:1000]
            break

    image_url = None
    for image in soup.select('img[src*="/transforms/exhibits/"], img[src*="/images/exhibits/"], img'):
        src = image.get("src")
        if not src:
            continue
        image_url = urljoin(BASE_URL, src)
        break

    return description, image_url


def extract_exhibitions() -> list[dict]:
    """Extract current exhibitions from Atlanta Contemporary's exhibitions page."""
    try:
        response = requests.get(
            EXHIBITIONS_URL,
            timeout=30,
            headers={"User-Agent": "Mozilla/5.0"},
        )
        response.raise_for_status()
    except Exception as exc:
        logger.error("Failed to fetch Atlanta Contemporary exhibitions page: %s", exc)
        return []

    soup = BeautifulSoup(response.text, "html.parser")
    exhibitions: list[dict] = []

    for article in soup.select(".exhibitions__featured article"):
        link = article.select_one('a[href*="/exhibits/"]')
        primary = article.select_one("h2")
        secondary = article.select_one("h3")
        text = re.sub(r"\s+", " ", article.get_text(" ", strip=True))

        if not link or not primary or not secondary:
            continue

        canonical_start_date, end_date = parse_exhibition_date_range(text)
        if not canonical_start_date:
            logger.debug("Could not parse Atlanta Contemporary exhibit dates from: %s", text)
            continue

        normalized_start_date, normalized_end_date = normalize_ongoing_exhibit_dates(
            canonical_start_date,
            end_date,
        )
        detail_url = urljoin(BASE_URL, link.get("href"))
        description, image_url = extract_exhibition_detail(detail_url)

        exhibitions.append(
            {
                "title": build_exhibition_title(
                    primary.get_text(" ", strip=True),
                    secondary.get_text(" ", strip=True),
                ),
                "description": description,
                "canonical_start_date": canonical_start_date,
                "start_date": normalized_start_date,
                "end_date": normalized_end_date,
                "source_url": detail_url,
                "ticket_url": detail_url,
                "image_url": image_url,
            }
        )

    return exhibitions


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Atlanta Contemporary events using Playwright.

    The site has a schedule page at /programs/schedule with well-structured
    event articles containing date, type, title, and description.
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    exhibition_envelope = TypedEntityEnvelope()

    try:
        from db.sources import get_source_info

        source_info = get_source_info(source_id) or {}
    except Exception:
        source_info = {}
    portal_id = source_info.get("owner_portal_id")

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            # ----------------------------------------------------------------
            # 0. Homepage — extract og:image / og:description for venue record
            # ----------------------------------------------------------------
            try:
                page.goto(BASE_URL, wait_until="domcontentloaded", timeout=30000)
                og_image = page.evaluate(
                    "() => { const m = document.querySelector('meta[property=\"og:image\"]'); return m ? m.content : null; }"
                )
                og_desc = page.evaluate(
                    "() => { const m = document.querySelector('meta[property=\"og:description\"]') "
                    "|| document.querySelector('meta[name=\"description\"]'); return m ? m.content : null; }"
                )
                if og_image:
                    PLACE_DATA["image_url"] = og_image
                    logger.debug("Atlanta Contemporary: og:image = %s", og_image)
                if og_desc:
                    PLACE_DATA["description"] = og_desc
                    logger.debug("Atlanta Contemporary: og:description captured")
            except Exception as _meta_exc:
                logger.debug("Atlanta Contemporary: could not extract og meta from homepage: %s", _meta_exc)

            # Get venue ID
            venue_id = get_or_create_place(PLACE_DATA)
            persist_typed_entity_envelope(_build_destination_envelope(venue_id))

            logger.info(f"Fetching Atlanta Contemporary events: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=60000)
            page.wait_for_timeout(3000)

            # Scroll to load all content
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Find all event articles
            event_articles = page.query_selector_all("article")
            logger.info(f"Found {len(event_articles)} event articles")

            for article in event_articles:
                try:
                    # Extract date and time
                    date_elem = article.query_selector(".event__date")
                    if not date_elem:
                        continue

                    date_time_str = date_elem.inner_text().strip()
                    start_date, start_time = parse_date_time(date_time_str)

                    if not start_date:
                        logger.debug(f"Could not parse date from: {date_time_str}")
                        continue

                    # Extract event type (Contemporary Talks, Special Event, etc.)
                    event_type = ""
                    type_elem = article.query_selector(".event__type")
                    if type_elem:
                        event_type = type_elem.inner_text().strip()

                    # Extract title
                    title_elem = article.query_selector("h3")
                    if not title_elem:
                        continue

                    title = title_elem.inner_text().strip()
                    if not title or len(title) < 3:
                        continue

                    # Extract description
                    description = ""
                    desc_elem = article.query_selector(".event__info p")
                    if desc_elem:
                        description = desc_elem.inner_text().strip()

                    # Check if free
                    is_free = False
                    label_elem = article.query_selector(".event__label")
                    if label_elem and "free" in label_elem.inner_text().lower():
                        is_free = True

                    # Extract image
                    image_url = None
                    img_elem = article.query_selector("img")
                    if img_elem:
                        src = img_elem.get_attribute("src")
                        if src:
                            # Make absolute URL
                            if src.startswith("http"):
                                image_url = src
                            elif src.startswith("//"):
                                image_url = "https:" + src
                            elif src.startswith("/"):
                                image_url = BASE_URL + src

                    # Extract event URL
                    event_url = EVENTS_URL
                    link_elem = article.query_selector("a[href]")
                    if link_elem:
                        href = link_elem.get_attribute("href")
                        if href:
                            if href.startswith("http"):
                                event_url = href
                            elif href.startswith("/"):
                                event_url = BASE_URL + href

                    events_found += 1

                    # Generate content hash
                    content_hash = generate_content_hash(
                        title, "Atlanta Contemporary", start_date
                    )

                    # Check for existing event

                    # Determine category and tags
                    category, subcategory, tags = determine_category(
                        event_type, title, description
                    )

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": description if description else None,
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": category,
                        "subcategory": subcategory,
                        "tags": tags,
                        "price_min": None,
                        "price_max": None,
                        "price_note": "Free admission",
                        "is_free": is_free,
                        "source_url": event_url,
                        "ticket_url": event_url,
                        "image_url": image_url,
                        "raw_text": f"{event_type}: {title} - {description[:200] if description else ''}",
                        "extraction_confidence": 0.90,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    existing = find_event_by_hash(content_hash)
                    if existing:
                        smart_update_existing_event(existing, event_record)
                        events_updated += 1
                        continue

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {title} on {start_date} at {start_time or 'TBD'}")
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

                except Exception as e:
                    logger.warning(f"Error parsing event article: {e}")
                    continue

            exhibitions = extract_exhibitions()
            logger.info("Found %d current exhibitions", len(exhibitions))

            for exhibition in exhibitions:
                try:
                    events_found += 1

                    exhibition_record, artists = build_exhibition_lane_record(
                        exhibition,
                        source_id=source_id,
                        venue_id=venue_id,
                        portal_id=portal_id,
                    )
                    if artists:
                        exhibition_record["artists"] = artists
                    exhibition_envelope.add("exhibitions", exhibition_record)
                    events_new += 1
                    logger.info(
                        "Added exhibition: %s (%s - %s)",
                        exhibition["title"],
                        exhibition["canonical_start_date"],
                        exhibition.get("end_date") or "ongoing",
                    )

                except Exception as e:
                    logger.warning("Error parsing Atlanta Contemporary exhibition: %s", e)
                    continue

            browser.close()

        if exhibition_envelope.exhibitions:
            persist_result = persist_typed_entity_envelope(exhibition_envelope)
            skipped_exhibitions = persist_result.skipped.get("exhibitions", 0)
            if skipped_exhibitions:
                logger.warning(
                    "Atlanta Contemporary: skipped %d exhibition rows",
                    skipped_exhibitions,
                )

        logger.info(
            f"Atlanta Contemporary crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching Atlanta Contemporary: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl Atlanta Contemporary: {e}")
        raise

    return events_found, events_new, events_updated
