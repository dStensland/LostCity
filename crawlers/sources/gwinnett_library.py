"""
Crawler for Gwinnett County Public Library System events.

Uses the Communico events platform API directly (same platform as DeKalb Library).
Covers all 15 library branches with storytimes, book clubs, educational programs, and more.

Previously used Playwright to load the list view page with lazy-loaded content via
scroll events. The default page only rendered ~7 days of events. The underlying
Communico API (/eeventcaldata) accepts explicit date + days parameters, returning
up to 90 days of events in a single API call without JavaScript rendering.
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

BASE_URL = "https://gwinnettpl.libnet.info"
EVENTS_API = f"{BASE_URL}/eeventcaldata"
EVENTS_PAGE = f"{BASE_URL}/events?v=list"
CRAWL_DAYS = 90

# Map of Gwinnett County Public Library branches
BRANCH_VENUES = {
    "centerville": {
        "name": "Centerville Library",
        "slug": "centerville-library",
        "address": "3025 Bethany Church Rd",
        "city": "Snellville",
        "state": "GA",
        "zip": "30039",
        "venue_type": "library",
    },
    "collins hill": {
        "name": "Collins Hill Library",
        "slug": "collins-hill-library",
        "address": "455 Camp Perrin Rd",
        "city": "Lawrenceville",
        "state": "GA",
        "zip": "30043",
        "venue_type": "library",
    },
    "dacula": {
        "name": "Dacula Library",
        "slug": "dacula-library",
        "address": "75 W Hightower Trail",
        "city": "Dacula",
        "state": "GA",
        "zip": "30019",
        "venue_type": "library",
    },
    "duluth": {
        "name": "Duluth Library",
        "slug": "duluth-library",
        "address": "3480 Howell Ferry Rd",
        "city": "Duluth",
        "state": "GA",
        "zip": "30096",
        "venue_type": "library",
    },
    "five forks": {
        "name": "Five Forks Library",
        "slug": "five-forks-library",
        "address": "2780 Five Forks Trickum Rd SW",
        "city": "Lawrenceville",
        "state": "GA",
        "zip": "30044",
        "venue_type": "library",
    },
    "grayson": {
        "name": "Grayson Library",
        "slug": "grayson-library",
        "address": "700 Grayson Pkwy",
        "city": "Grayson",
        "state": "GA",
        "zip": "30017",
        "venue_type": "library",
    },
    "hamilton mill": {
        "name": "Hamilton Mill Library",
        "slug": "hamilton-mill-library",
        "address": "3690 Braselton Hwy",
        "city": "Dacula",
        "state": "GA",
        "zip": "30019",
        "venue_type": "library",
    },
    "lawrenceville": {
        "name": "Lawrenceville Library",
        "slug": "lawrenceville-library",
        "address": "1001 Lawrenceville Hwy",
        "city": "Lawrenceville",
        "state": "GA",
        "zip": "30046",
        "venue_type": "library",
    },
    "lilburn": {
        "name": "Lilburn Library",
        "slug": "lilburn-library",
        "address": "4818 Church St",
        "city": "Lilburn",
        "state": "GA",
        "zip": "30047",
        "venue_type": "library",
    },
    "mountain park": {
        "name": "Mountain Park Library",
        "slug": "mountain-park-library",
        "address": "1210 Pounds Rd SW",
        "city": "Stone Mountain",
        "state": "GA",
        "zip": "30087",
        "venue_type": "library",
    },
    "norcross": {
        "name": "Norcross Library",
        "slug": "norcross-library",
        "address": "6025 Buford Hwy",
        "city": "Norcross",
        "state": "GA",
        "zip": "30071",
        "venue_type": "library",
    },
    "peachtree corners": {
        "name": "Peachtree Corners Library",
        "slug": "peachtree-corners-library",
        "address": "5570 Spalding Dr",
        "city": "Peachtree Corners",
        "state": "GA",
        "zip": "30092",
        "venue_type": "library",
    },
    "pinckneyville": {
        "name": "Pinckneyville Library",
        "slug": "pinckneyville-library",
        "address": "4650 Peachtree Industrial Blvd",
        "city": "Norcross",
        "state": "GA",
        "zip": "30071",
        "venue_type": "library",
    },
    "suwanee": {
        "name": "Suwanee Library",
        "slug": "suwanee-library",
        "address": "361 Main St",
        "city": "Suwanee",
        "state": "GA",
        "zip": "30024",
        "venue_type": "library",
    },
    "virtual": {
        "name": "Gwinnett County Public Library (Virtual)",
        "slug": "gwinnett-county-public-library-virtual",
        "city": "Lawrenceville",
        "state": "GA",
        "venue_type": "library",
    },
}

DEFAULT_VENUE = {
    "name": "Gwinnett County Public Library",
    "slug": "gwinnett-county-public-library",
    "city": "Lawrenceville",
    "state": "GA",
    "venue_type": "library",
}

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    events=True,
    destinations=True,
    destination_details=True,
    venue_features=True,
)


def _build_branch_destination_envelope(venue_id: int, place_data: dict) -> TypedEntityEnvelope:
    """Project a Gwinnett library branch into shared Family-friendly destination details."""
    envelope = TypedEntityEnvelope()
    branch_name = str(place_data.get("name") or "Gwinnett library branch").strip()

    envelope.add(
        "destination_details",
        {
            "venue_id": venue_id,
            "destination_type": "library_branch",
            "commitment_tier": "hour",
            "primary_activity": "free indoor family library visit",
            "best_seasons": ["spring", "summer", "fall", "winter"],
            "weather_fit_tags": ["indoor", "rainy-day", "heat-day", "free-option"],
            "practical_notes": (
                f"{branch_name} is a free indoor family destination with books, browsing, and branch programming. "
                "Check the official branch listing for current hours and service details."
            ),
            "best_time_of_day": "any",
            "family_suitability": "yes",
            "reservation_required": False,
            "permit_required": False,
            "fee_note": "Free public library access.",
            "source_url": "https://www.gwinnettpl.org/locations/",
            "metadata": {
                "source_type": "family_destination_enrichment",
                "venue_type": "library",
                "branch_name": branch_name,
            },
        },
    )

    envelope.add(
        "venue_features",
        {
            "venue_id": venue_id,
            "slug": "free-indoor-family-stop",
            "title": "Free indoor family stop",
            "feature_type": "amenity",
            "description": f"{branch_name} is a free indoor place for browsing, reading, and easy family time out of the weather.",
            "url": "https://www.gwinnettpl.org/locations/",
            "price_note": "Free public library access.",
            "is_free": True,
            "sort_order": 5,
        },
    )
    envelope.add(
        "venue_features",
        {
            "venue_id": venue_id,
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
    location_lower = location_text.lower()
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


def determine_category_and_tags(
    title: str,
    description: str = "",
    ages_array: Optional[list] = None,
) -> tuple[str, Optional[str], list]:
    """Determine category, subcategory, and tags from title, description, and ages array."""
    ages_array = ages_array or []
    text = f"{title} {description}".lower()

    base_tags = ["library", "free", "gwinnett"]

    # Communico age label to LostCity tag mapping
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

    age_tags: list[str] = []
    is_family_audience = False

    for label in ages_array:
        label_lower = (label or "").lower().strip()
        for key, tag_list in COMMUNICO_AGE_MAP.items():
            if key in label_lower:
                for t in tag_list:
                    if t not in age_tags:
                        age_tags.append(t)
                if key in FAMILY_AUDIENCES:
                    is_family_audience = True
                break

    # Fall back to title/description keyword matching for age inference
    if not age_tags:
        baby_words = ["baby", "infant", "toddler", "preschool", "birth to five"]
        child_words = ["storytime", "story time", "children", "kids", "elementary"]
        teen_words = ["teen", "tween", "young adult", "ya "]

        if any(w in text for w in baby_words):
            if "baby" in text or "infant" in text:
                age_tags.append("infant")
            if "toddler" in text:
                age_tags.append("toddler")
            if "preschool" in text or "birth to five" in text:
                age_tags.append("preschool")
            age_tags += ["kids", "family-friendly"]
            is_family_audience = True
        elif any(w in text for w in child_words):
            age_tags += ["elementary", "kids", "family-friendly"]
            is_family_audience = True
        elif any(w in text for w in teen_words):
            age_tags.append("teen")
        elif "adult" in text and "young adult" not in text:
            age_tags.append("adults")
        else:
            age_tags.append("family-friendly")

    tags = base_tags + [t for t in age_tags if t not in base_tags]

    # Category and subcategory — ordered from most specific to least.
    # Previously used "play" (not a valid category) and defaulted to "words",
    # causing chess clubs, STEM programs, and support services to be misclassified.
    if "storytime" in text or "story time" in text:
        return "family", "words.storytelling", tags
    elif "book club" in text or "reading group" in text or "book discussion" in text:
        cat = "family" if is_family_audience else "words"
        return cat, "words.bookclub", tags
    elif "author" in text or "book signing" in text:
        cat = "family" if is_family_audience else "words"
        return cat, "words.reading", tags
    elif "poetry" in text or "poem" in text:
        cat = "family" if is_family_audience else "words"
        return cat, "words.poetry", tags
    elif "writing" in text or "writer" in text:
        cat = "family" if is_family_audience else "words"
        return cat, "words.workshop", tags
    elif any(w in text for w in ["book", "reading", "literacy", "zine"]):
        cat = "family" if is_family_audience else "words"
        return cat, None, tags
    elif any(w in text for w in ["chess", "mahjong", "mah jongg", "lego", "pokemon", "pokémon", "tabletop", "dungeons", "bingo", "puzzle"]):
        cat = "family" if is_family_audience else "games"
        return cat, None, tags
    elif any(w in text for w in ["game", "gaming"]):
        cat = "family" if is_family_audience else "games"
        return cat, None, tags
    elif any(w in text for w in ["film", "movie", "cinema", "anime", "screening"]):
        cat = "family" if is_family_audience else "film"
        return cat, None, tags
    elif any(w in text for w in ["concert", "music", "ukulele", "guitar", "jazz", "blues"]):
        cat = "family" if is_family_audience else "music"
        return cat, None, tags
    elif any(w in text for w in ["yoga", "tai chi", "taichi", "qigong", "zumba", "exercise", "fitness"]):
        cat = "family" if is_family_audience else "fitness"
        return cat, None, tags
    elif any(w in text for w in ["bollywood", "k-pop dance", "dance class", "dance lesson"]):
        cat = "family" if is_family_audience else "dance"
        return cat, None, tags
    elif any(w in text for w in ["craft", "crochet", "knit", "sew", "origami", "diy", "take and make", "take & make", "cricut", "embroidery", "culinary", "cooking", "passive program"]):
        tags.append("hands-on")
        cat = "family" if is_family_audience else "workshops"
        return cat, None, tags
    elif any(w in text for w in ["support group", "dementia", "brain health", "caregiver", "medicare", "aarp", "blood drive"]):
        cat = "support"
        return cat, None, tags
    elif any(w in text for w in ["board of trustees", "library board", "trustee meeting"]):
        return "civic", None, tags
    elif any(w in text for w in ["stem", "science", "math", "coding", "robot", "computer", "technology", "digital", "genealogy", "career", "resume", "homework", "esl", "english class", "language learning", "ged", "homeschool", "financial literacy", "college prep", "fafsa", "3d print", "learning lab"]):
        tags.append("educational")
        cat = "family" if is_family_audience else "education"
        return cat, None, tags
    elif any(w in text for w in ["art", "arts", "paint", "draw", "exhibit", "podcast", "screenwriting", "photography"]):
        tags.append("hands-on")
        cat = "family" if is_family_audience else "art"
        return cat, None, tags
    else:
        tags.append("educational")
        cat = "family" if is_family_audience else "education"
        return cat, None, tags


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
            logger.error(f"Gwinnett Library API returned unexpected type: {type(data)}")
            return []
        logger.info(f"Gwinnett Library API returned {len(data)} events")
        return data
    except Exception as e:
        logger.error(f"Gwinnett Library API fetch failed: {e}")
        return []


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Gwinnett County Public Library events via the Communico API."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    today = datetime.now()
    start_date = today.strftime("%Y-%m-%d")

    logger.info(f"Gwinnett Library: fetching {CRAWL_DAYS} days from {start_date}")
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
                persist_result = persist_typed_entity_envelope(
                    _build_branch_destination_envelope(venue_id, place_data)
                )
                if persist_result.skipped:
                    logger.warning(
                        "Gwinnett Library: skipped typed destination writes for %s: %s",
                        place_data["name"],
                        persist_result.skipped,
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

            # Category, subcategory, and tags using ages from API + keyword fallback
            ages_array = ev.get("agesArray") or []
            category, subcategory, tags = determine_category_and_tags(
                title, description, ages_array
            )

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
                "venue_id": venue_id,
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
                "extraction_confidence": 0.88,
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
            logger.error(f"Failed to process Gwinnett event '{ev.get('title', 'unknown')}': {e}")
            continue

    logger.info(
        f"Gwinnett Library crawl complete: {events_found} found, "
        f"{events_new} new, {events_updated} updated"
    )

    return events_found, events_new, events_updated
