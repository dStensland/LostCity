"""
Crawler for DeKalb County Public Library System events.

Uses the Communico events platform API directly.

Previously used Playwright to load the list view page, which only rendered the
default 7-day window. The underlying Communico API (/eeventcaldata) accepts
explicit date + days parameters, returning up to 90 days of events in one call.
"""

from __future__ import annotations

import json
import logging
import re
import requests
from datetime import datetime, timedelta
from typing import Optional
from urllib.parse import quote

from db import get_or_create_place, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from entity_lanes import SourceEntityCapabilities, TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope

logger = logging.getLogger(__name__)

BASE_URL = "https://events.dekalblibrary.org"
EVENTS_API = f"{BASE_URL}/eeventcaldata"
EVENTS_PAGE = f"{BASE_URL}/events?v=list"
CRAWL_DAYS = 90

# Map branch names to venue data
BRANCH_VENUES = {
    "brookhaven": {
        "name": "Brookhaven Library",
        "slug": "brookhaven-library",
        "address": "1242 N. Druid Hills Road",
        "city": "Brookhaven",
        "state": "GA",
        "zip": "30319",
        "place_type": "library",
    },
    "chamblee": {
        "name": "Chamblee Library",
        "slug": "chamblee-library",
        "address": "4115 Clairmont Road",
        "city": "Chamblee",
        "state": "GA",
        "zip": "30341",
        "place_type": "library",
    },
    "clarkston": {
        "name": "Clarkston Library",
        "slug": "clarkston-library",
        "address": "951 N. Indian Creek Drive",
        "city": "Clarkston",
        "state": "GA",
        "zip": "30021",
        "place_type": "library",
    },
    "county line": {
        "name": "County Line-Ellenwood Library",
        "slug": "county-line-ellenwood-library",
        "address": "4331 River Road",
        "city": "Ellenwood",
        "state": "GA",
        "zip": "30294",
        "place_type": "library",
    },
    "ellenwood": {
        "name": "County Line-Ellenwood Library",
        "slug": "county-line-ellenwood-library",
        "address": "4331 River Road",
        "city": "Ellenwood",
        "state": "GA",
        "zip": "30294",
        "place_type": "library",
    },
    "covington": {
        "name": "Covington Library",
        "slug": "covington-library",
        "address": "3500 Covington Highway",
        "city": "Decatur",
        "state": "GA",
        "zip": "30032",
        "place_type": "library",
    },
    "decatur": {
        "name": "Decatur Library",
        "slug": "decatur-library",
        "address": "215 Sycamore St",
        "neighborhood": "Downtown Decatur",
        "city": "Decatur",
        "state": "GA",
        "zip": "30030",
        "place_type": "library",
    },
    "doraville": {
        "name": "Doraville Library",
        "slug": "doraville-library",
        "address": "2421 Van Fleet Circle Suite 180",
        "city": "Doraville",
        "state": "GA",
        "zip": "30360",
        "place_type": "library",
    },
    "dunwoody": {
        "name": "Dunwoody Library",
        "slug": "dunwoody-library",
        "address": "5339 Chamblee-Dunwoody Road",
        "city": "Dunwoody",
        "state": "GA",
        "zip": "30338",
        "place_type": "library",
    },
    "embry hills": {
        "name": "Embry Hills Library",
        "slug": "embry-hills-library",
        "address": "3733 Chamblee-Tucker Road",
        "city": "Chamblee",
        "state": "GA",
        "zip": "30341",
        "place_type": "library",
    },
    "flat shoals": {
        "name": "Flat Shoals Library",
        "slug": "flat-shoals-library",
        "address": "4022 Flat Shoals Parkway",
        "city": "Decatur",
        "state": "GA",
        "zip": "30034",
        "place_type": "library",
    },
    "gresham": {
        "name": "Gresham Library",
        "slug": "gresham-library",
        "address": "2418 Gresham Road SE",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30316",
        "place_type": "library",
    },
    "hairston": {
        "name": "Hairston Crossing Library",
        "slug": "hairston-crossing-library",
        "address": "4911 Redan Road",
        "city": "Stone Mountain",
        "state": "GA",
        "zip": "30088",
        "place_type": "library",
    },
    "lithonia": {
        "name": "Lithonia-Davidson Library",
        "slug": "lithonia-davidson-library",
        "address": "6821 Church Street",
        "city": "Lithonia",
        "state": "GA",
        "zip": "30058",
        "place_type": "library",
    },
    "northlake": {
        "name": "Northlake-Barbara Loar Library",
        "slug": "northlake-barbara-loar-library",
        "address": "3772 LaVista Road",
        "city": "Tucker",
        "state": "GA",
        "zip": "30084",
        "place_type": "library",
    },
    "redan": {
        "name": "Redan-Trotti Library",
        "slug": "redan-trotti-library",
        "address": "1569 Wellborn Road",
        "city": "Lithonia",
        "state": "GA",
        "zip": "30058",
        "place_type": "library",
    },
    "salem": {
        "name": "Salem-Panola Library",
        "slug": "salem-panola-library",
        "address": "5137 Salem Road",
        "city": "Stonecrest",
        "state": "GA",
        "zip": "30038",
        "place_type": "library",
    },
    "scott candler": {
        "name": "Scott Candler Library",
        "slug": "scott-candler-library",
        "address": "1917 Candler Road",
        "city": "Decatur",
        "state": "GA",
        "zip": "30032",
        "place_type": "library",
    },
    "scottdale": {
        "name": "Scottdale-Tobie Grant Homework Center",
        "slug": "scottdale-tobie-grant-homework-center",
        "address": "593 Parkdale Drive",
        "city": "Scottdale",
        "state": "GA",
        "zip": "30079",
        "place_type": "library",
    },
    "stone mountain": {
        "name": "Stone Mountain-Sue Kellogg Library",
        "slug": "stone-mountain-sue-kellogg-library",
        "address": "952 Leon Street",
        "city": "Stone Mountain",
        "state": "GA",
        "zip": "30083",
        "place_type": "library",
    },
    "stonecrest": {
        "name": "Stonecrest Library",
        "slug": "stonecrest-library",
        "address": "3123 Klondike Road",
        "city": "Stonecrest",
        "state": "GA",
        "zip": "30038",
        "place_type": "library",
    },
    "toco hill": {
        "name": "Toco Hill-Avis G. Williams Library",
        "slug": "toco-hill-avis-g-williams-library",
        "address": "1282 McConnell Drive",
        "city": "Decatur",
        "state": "GA",
        "zip": "30033",
        "place_type": "library",
    },
    "tucker": {
        "name": "Tucker-Reid H. Cofer Library",
        "slug": "tucker-reid-h-cofer-library",
        "address": "5234 LaVista Road",
        "city": "Tucker",
        "state": "GA",
        "zip": "30084",
        "place_type": "library",
    },
    "wesley chapel": {
        "name": "Wesley Chapel-William C. Brown Library",
        "slug": "wesley-chapel-william-c-brown-library",
        "address": "2861 Wesley Chapel Road",
        "city": "Decatur",
        "state": "GA",
        "zip": "30034",
        "place_type": "library",
    },
    "virtual": {
        "name": "DeKalb County Library (Virtual)",
        "slug": "dekalb-county-library-virtual",
        "city": "Decatur",
        "state": "GA",
        "place_type": "library",
    },
}

DEFAULT_VENUE = {
    "name": "DeKalb County Library",
    "slug": "dekalb-county-library",
    "city": "Decatur",
    "state": "GA",
    "place_type": "library",
}

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    events=True,
    destinations=True,
    destination_details=True,
    venue_features=True,
)


def _build_branch_destination_envelope(venue_id: int, place_data: dict) -> TypedEntityEnvelope:
    """Project a DeKalb library branch into shared Family-friendly destination details."""
    envelope = TypedEntityEnvelope()
    branch_name = str(place_data.get("name") or "DeKalb library branch").strip()

    envelope.add(
        "destination_details",
        {
            "place_id": venue_id,
            "destination_type": "library_branch",
            "commitment_tier": "hour",
            "primary_activity": "free indoor family library visit",
            "best_seasons": ["spring", "summer", "fall", "winter"],
            "weather_fit_tags": ["indoor", "rainy-day", "heat-day", "free-option"],
            "practical_notes": (
                f"{branch_name} is a free indoor family destination with books, browsing, and branch programming. "
                "Check the official branch listing for current hours and service details."
            ),
            "accessibility_notes": (
                "Library branches are generally easier low-friction indoor stops for families who need predictable bathrooms, seating, and a calmer weather-proof outing."
            ),
            "best_time_of_day": "any",
            "family_suitability": "yes",
            "reservation_required": False,
            "permit_required": False,
            "fee_note": "Free public library access.",
            "source_url": "https://dekalblibrary.org/locations/",
            "metadata": {
                "source_type": "family_destination_enrichment",
                "place_type": "library",
                "branch_name": branch_name,
            },
        },
    )

    envelope.add(
        "venue_features",
        {
            "place_id": venue_id,
            "slug": "free-indoor-family-stop",
            "title": "Free indoor family stop",
            "feature_type": "amenity",
            "description": f"{branch_name} is a free indoor place for browsing, reading, and easy family time out of the weather.",
            "url": "https://dekalblibrary.org/locations/",
            "price_note": "Free public library access.",
            "is_free": True,
            "sort_order": 5,
        },
    )
    envelope.add(
        "venue_features",
        {
            "place_id": venue_id,
            "slug": "storytime-and-family-programs",
            "title": "Storytime and family programs",
            "feature_type": "experience",
            "description": f"{branch_name} regularly hosts free storytimes, reading events, and family-friendly branch programming.",
            "url": EVENTS_PAGE,
            "price_note": "Most branch programs are free; confirm event details on the official calendar.",
            "is_free": True,
            "sort_order": 15,
        },
    )

    return envelope


def find_branch_venue(location_text: str) -> dict:
    """Find matching branch venue from location text."""
    if not location_text:
        return DEFAULT_VENUE
    location_lower = re.sub(r"[^a-z0-9 ]+", " ", location_text.lower()).strip()
    for key, venue in BRANCH_VENUES.items():
        if key in location_lower:
            return venue
    return DEFAULT_VENUE


def parse_communico_datetime(raw: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse a Communico datetime string.
    Format: "2026-03-22 14:30:00" or "2026-03-22 00:00:00"
    Returns (date, time) or (None, None) on failure.
    Midnight is treated as no time (all-day or unknown).
    """
    if not raw:
        return None, None
    try:
        dt = datetime.strptime(raw[:19], "%Y-%m-%d %H:%M:%S")
        date = dt.strftime("%Y-%m-%d")
        time = None if (dt.hour == 0 and dt.minute == 0) else dt.strftime("%H:%M")
        return date, time
    except Exception as e:
        logger.warning(f"Failed to parse Communico datetime '{raw}': {e}")
        return None, None


def derive_age_tags_and_category(ages_array: list) -> tuple[list[str], bool]:
    """
    Derive age-band tags and family category flag from Communico agesArray.
    e.g. ["Teens"], ["Children"], ["Toddlers", "Babies"]
    """
    COMMUNICO_AGE_MAP = {
        "babies": ["infant", "kids", "family-friendly"],
        "toddlers": ["toddler", "kids", "family-friendly"],
        "preschool": ["preschool", "kids", "family-friendly"],
        "children": ["elementary", "kids", "family-friendly"],
        "elementary": ["elementary", "kids", "family-friendly"],
        "tweens": ["teen", "kids", "family-friendly"],
        "teens": ["teen"],
        "young adults": ["teen"],
        "adults": ["adults"],
        "seniors": ["adults", "seniors"],
        "all ages": ["family-friendly"],
        "families": ["family-friendly", "kids"],
        "family": ["family-friendly", "kids"],
    }
    FAMILY_AUDIENCES = {
        "babies",
        "toddlers",
        "preschool",
        "children",
        "elementary",
        "tweens",
        "families",
        "family",
        "all ages",
    }

    tags: list[str] = []
    is_family = False

    for label in ages_array:
        label_lower = (label or "").lower().strip()
        for key, tag_list in COMMUNICO_AGE_MAP.items():
            if key in label_lower:
                for t in tag_list:
                    if t not in tags:
                        tags.append(t)
                if key in FAMILY_AUDIENCES:
                    is_family = True
                break

    return tags, is_family


def determine_category(title: str, description: str = "") -> str:
    """
    Determine event category from title and description.

    Previously defaulted to "words", causing chess clubs, STEM programs,
    fitness classes, and support services to be misclassified. Default is
    now "education" which is a safer fallback for unmatched library events.
    """
    CATEGORY_MAP = {
        # Literary / words
        "book": "words",
        "storytime": "words",
        "story time": "words",
        "author": "words",
        "writing": "words",
        "reading": "words",
        "poetry": "words",
        "book club": "words",
        "literacy": "words",
        "zine": "words",
        # Education — STEM, tech, life skills, language
        "stem": "education",
        "science": "education",
        "math": "education",
        "coding": "education",
        "robot": "education",
        "computer": "education",
        "technology": "education",
        "tech help": "education",
        "genealogy": "education",
        "career": "education",
        "resume": "education",
        "homework": "education",
        "esl": "education",
        "english class": "education",
        "language learning": "education",
        "citizenship": "education",
        "ged": "education",
        "homeschool": "education",
        "financial literacy": "education",
        "college prep": "education",
        "fafsa": "education",
        "entrepreneurship": "education",
        "3d print": "education",
        "learning lab": "education",
        "class": "education",
        # Film
        "film": "film",
        "movie": "film",
        "cinema": "film",
        "anime": "film",
        "screening": "film",
        # Music
        "concert": "music",
        "ukulele": "music",
        "guitar": "music",
        "music": "music",
        "jazz": "music",
        "blues": "music",
        # Games
        "chess": "games",
        "puzzle": "games",
        "mahjong": "games",
        "mah jongg": "games",
        "bingo": "games",
        "dungeons": "games",
        "lego": "games",
        "pokemon": "games",
        "pokémon": "games",
        "tabletop": "games",
        "gaming": "games",
        "game": "games",
        # Fitness
        "yoga": "fitness",
        "tai chi": "fitness",
        "taichi": "fitness",
        "qigong": "fitness",
        "zumba": "fitness",
        "exercise": "fitness",
        "fitness": "fitness",
        "wellness": "fitness",
        # Dance
        "bollywood": "dance",
        "k-pop dance": "dance",
        "dance class": "dance",
        "dance lesson": "dance",
        # Workshops — crafts, making, take-home kits
        "craft": "workshops",
        "crochet": "workshops",
        "knit": "workshops",
        "sew": "workshops",
        "jewelry": "workshops",
        "origami": "workshops",
        "maker": "workshops",
        "diy": "workshops",
        "take home": "workshops",
        "take and make": "workshops",
        "take & make": "workshops",
        "cricut": "workshops",
        "embroidery": "workshops",
        "culinary": "workshops",
        "cooking": "workshops",
        "passive program": "workshops",
        # Art — visual arts, exhibitions, creative production
        "art": "art",
        "arts": "art",
        "paint": "art",
        "draw": "art",
        "exhibit": "art",
        "exhibition": "art",
        "podcast": "art",
        "screenwriting": "art",
        "photography": "art",
        # Support services
        "support group": "support",
        "special needs": "support",
        "dementia": "support",
        "brain health": "support",
        "caregiver": "support",
        "medicare": "support",
        "aarp": "support",
        "blood drive": "support",
        "notary": "support",
        # Civic
        "board of trustees": "civic",
        "library board": "civic",
        "trustee meeting": "civic",
    }
    text = f"{title} {description}".lower()
    for keyword, category in CATEGORY_MAP.items():
        if re.search(r'\b' + re.escape(keyword) + r'\b', text):
            return category
    return "education"


def fetch_events(start_date: str, days: int) -> list[dict]:
    """
    Call the Communico eeventcaldata API and return the raw event list.

    The API accepts a JSON-encoded 'req' parameter with:
      - date: start date in YYYY-MM-DD format
      - days: number of days to fetch (e.g. 90)
      - private: False to exclude private events
      - search: optional keyword filter
    """
    options = {
        "date": start_date,
        "days": days,
        "private": False,
        "search": "",
    }
    url = f"{EVENTS_API}?event_type=&req={quote(json.dumps(options))}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "Accept": "application/json",
        "Referer": EVENTS_PAGE,
    }

    try:
        resp = requests.get(url, headers=headers, timeout=45)
        resp.raise_for_status()
        data = resp.json()
        if not isinstance(data, list):
            logger.error(f"DeKalb Library API returned unexpected type: {type(data)}")
            return []
        logger.info(f"DeKalb Library API returned {len(data)} events")
        return data
    except Exception as e:
        logger.error(f"DeKalb Library API fetch failed: {e}")
        return []


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl DeKalb County Library events via the Communico API."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    today = datetime.now()
    start_date = today.strftime("%Y-%m-%d")

    logger.info(f"DeKalb Library: fetching {CRAWL_DAYS} days from {start_date}")
    raw_events = fetch_events(start_date, CRAWL_DAYS)
    events_found = len(raw_events)

    enriched_venue_ids: set[int] = set()

    for ev in raw_events:
        try:
            title = (ev.get("title") or "").strip()
            if not title:
                continue

            # Skip cancelled events (changed=2 means cancelled in Communico)
            if ev.get("changed") and int(ev.get("changed") or 0) == 2:
                logger.debug(f"Skipping cancelled event: {title}")
                continue

            # Parse start date/time
            start_date_str, start_time = parse_communico_datetime(ev.get("event_start", ""))
            if not start_date_str:
                logger.warning(f"Event '{title}' has no parseable start date, skipping")
                continue

            # Skip past events
            try:
                if datetime.strptime(start_date_str, "%Y-%m-%d").date() < today.date():
                    continue
            except ValueError:
                continue

            # Parse end time
            _, end_time = parse_communico_datetime(ev.get("event_end", ""))

            # Resolve venue from library/location field
            library_name = ev.get("library") or ev.get("location") or ""
            place_data = find_branch_venue(library_name)
            venue_id = get_or_create_place(place_data)

            if venue_id and venue_id not in enriched_venue_ids:
                persist_typed_entity_envelope(
                    _build_branch_destination_envelope(venue_id, place_data)
                )
                enriched_venue_ids.add(venue_id)

            # Event URL
            event_url = ev.get("url") or EVENTS_PAGE

            # Description - prefer long_description stripped of HTML
            description = (ev.get("description") or "").strip()
            long_desc = (ev.get("long_description") or "").strip()
            if long_desc and len(long_desc) > len(description):
                from bs4 import BeautifulSoup

                description = BeautifulSoup(long_desc, "html.parser").get_text(
                    separator=" ", strip=True
                )
                description = re.sub(r"\s+", " ", description).strip()[:5000]

            # Age tags and category
            ages_array = ev.get("agesArray") or []
            age_tags, is_family_audience = derive_age_tags_and_category(ages_array)
            category = determine_category(title, description)
            if is_family_audience:
                category = "family"

            # Subcategory from title keywords
            title_lower = title.lower()
            if "book club" in title_lower or "reading group" in title_lower:
                subcategory = "words.bookclub"
            elif "story" in title_lower or "storytime" in title_lower:
                subcategory = "words.storytelling"
            elif "author" in title_lower or "signing" in title_lower:
                subcategory = "words.reading"
            elif "poetry" in title_lower:
                subcategory = "words.poetry"
            elif "writing" in title_lower or "workshop" in title_lower:
                subcategory = "words.workshop"
            else:
                subcategory = None

            base_tags = ["library", "free", "dekalb"]
            tags = base_tags + [t for t in age_tags if t not in base_tags]

            # Registration check
            has_registration = bool(ev.get("allow_reg") and str(ev.get("allow_reg")) != "0")
            ticket_url = ev.get("reg_url") if (has_registration and ev.get("reg_url")) else None

            # Image
            image_url = None
            if ev.get("event_image"):
                image_url = f"{BASE_URL}/images/events/{ev['event_image']}"

            content_hash = generate_content_hash(title, place_data["name"], start_date_str)

            event_record = {
                "source_id": source_id,
                "place_id": venue_id,
                "title": title,
                "description": description if description else None,
                "start_date": start_date_str,
                "start_time": start_time,
                "end_date": None,
                "end_time": end_time,
                "is_all_day": False,
                "category": category,
                "subcategory": subcategory,
                "tags": tags,
                "price_min": None,
                "price_max": None,
                "price_note": None,
                "is_free": True,
                "source_url": event_url,
                "ticket_url": ticket_url,
                "image_url": image_url,
                "raw_text": None,
                "extraction_confidence": 0.90,
                "is_recurring": bool(ev.get("recurring_id")),
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
                logger.debug(f"Added: {title} on {start_date_str} at {place_data['name']}")
            except Exception as e:
                logger.error(f"Failed to insert '{title}': {e}")

        except Exception as e:
            logger.error(f"Failed to process DeKalb event '{ev.get('title', 'unknown')}': {e}")
            continue

    logger.info(
        f"DeKalb Library crawl complete: {events_found} found, "
        f"{events_new} new, {events_updated} updated"
    )

    return events_found, events_new, events_updated
