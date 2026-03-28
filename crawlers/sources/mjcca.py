"""
Crawler for Marcus Jewish Community Center of Atlanta (MJCCA).

The MJCCA is a major cultural hub hosting hundreds of events monthly including:
- Theater performances and concerts
- Lectures and speaker series (Montag Speaker Series)
- Book festivals and literary events
- Fitness classes and sports events
- Cultural celebrations and community programs
- Educational workshops and classes
- Family programs and camps

Site uses JavaScript rendering with The Events Calendar plugin.
Uses Month view to capture ~3 weeks of events at a time.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from db import (
    get_or_create_place,
    insert_event,
    find_event_by_hash,
    smart_update_existing_event,
    remove_stale_source_events,
)
from dedupe import generate_content_hash
from description_fetcher import fetch_description_from_url
from entity_lanes import SourceEntityCapabilities, TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope
from utils import extract_images_from_page, enrich_event_record

logger = logging.getLogger(__name__)

BASE_URL = "https://www.atlantajcc.org"
CALENDAR_URL = f"{BASE_URL}/calendar/"

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    events=True,
    destinations=True,
    destination_details=True,
    venue_features=True,
)

PLACE_DATA = {
    "name": "Marcus Jewish Community Center of Atlanta",
    "slug": "mjcca",
    "address": "5342 Tilly Mill Road",
    "neighborhood": "Dunwoody",
    "city": "Dunwoody",
    "state": "GA",
    "zip": "30338",
    "lat": 33.9301,
    "lng": -84.2966,
    "place_type": "community_center",
    "spot_type": "community_center",
    "website": BASE_URL,
    "vibes": ["family-friendly", "all-ages", "faith-jewish"],
}


def _build_destination_envelope(venue_id: int) -> TypedEntityEnvelope:
    envelope = TypedEntityEnvelope()
    envelope.add(
        "destination_details",
        {
            "place_id": venue_id,
            "destination_type": "community_center",
            "commitment_tier": "halfday",
            "primary_activity": "family community-center campus visit",
            "best_seasons": ["spring", "summer", "fall", "winter"],
            "weather_fit_tags": ["indoor", "outdoor-indoor-mix", "family-daytrip"],
            "parking_type": "free_lot",
            "best_time_of_day": "morning",
            "practical_notes": (
                "MJCCA works best as a family campus stop when the plan centers on a specific class, event, or community activity, rather than as a generic drop-in attraction."
            ),
            "accessibility_notes": (
                "Its campus format offers lower-friction indoor access than a large outdoor destination, but families usually get the most value when they arrive with a program or event in mind."
            ),
            "family_suitability": "yes",
            "reservation_required": False,
            "permit_required": False,
            "fee_note": "Some public cultural events are ticketed, while many classes, camps, fitness, and membership-based programs have separate registration or access rules.",
            "source_url": BASE_URL,
            "metadata": {
                "source_type": "family_destination_enrichment",
                "place_type": "community_center",
                "city": "dunwoody",
            },
        },
    )
    envelope.add(
        "venue_features",
        {
            "place_id": venue_id,
            "slug": "family-campus-program-hub",
            "title": "Family campus program hub",
            "feature_type": "amenity",
            "description": "MJCCA is one of the stronger family program campuses in the metro, with recurring classes, camps, performances, and community events in one place.",
            "url": BASE_URL,
            "is_free": False,
            "sort_order": 10,
        },
    )
    envelope.add(
        "venue_features",
        {
            "place_id": venue_id,
            "slug": "indoor-community-and-cultural-flex",
            "title": "Indoor community and cultural flex",
            "feature_type": "amenity",
            "description": "The center's indoor community-space mix makes it useful for family plans that need more weather-flex than a purely outdoor program destination.",
            "url": BASE_URL,
            "is_free": False,
            "sort_order": 20,
        },
    )
    envelope.add(
        "venue_features",
        {
            "place_id": venue_id,
            "slug": "planned-program-day-rather-than-drop-in-stop",
            "title": "Planned program day rather than drop-in stop",
            "feature_type": "amenity",
            "description": "MJCCA is strongest when the family day is anchored by a known class, performance, or program instead of treating the campus like a casual wander destination.",
            "url": BASE_URL,
            "is_free": False,
            "sort_order": 30,
        },
    )
    return envelope


def parse_date(date_str: str) -> Optional[str]:
    """
    Parse date from format like 'Tuesday, 02.10.26' or 'Friday, 02.14.26'.
    Returns YYYY-MM-DD format.
    """
    try:
        # Remove day name if present
        date_str = re.sub(r'^[A-Za-z]+,?\s+', '', date_str.strip())

        # Parse MM.DD.YY format
        match = re.match(r'(\d{2})\.(\d{2})\.(\d{2})', date_str)
        if match:
            month, day, year = match.groups()
            # Convert 2-digit year to 4-digit (assume 2000s)
            full_year = f"20{year}"
            return f"{full_year}-{month}-{day}"
    except (ValueError, AttributeError) as e:
        logger.debug(f"Could not parse date '{date_str}': {e}")

    return None


def parse_time_range(time_str: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse time range from format like '10:00 am - 11:00 am'.
    Returns (start_time, end_time) in HH:MM format.
    """
    try:
        # Split on dash
        parts = time_str.split('-')
        if len(parts) != 2:
            return None, None

        start_str = parts[0].strip()
        end_str = parts[1].strip()

        def parse_single_time(s: str) -> Optional[str]:
            """Parse single time like '10:00 am' to '10:00'."""
            match = re.match(r'(\d{1,2}):(\d{2})\s*(am|pm)', s, re.IGNORECASE)
            if match:
                hour, minute, period = match.groups()
                hour = int(hour)
                if period.lower() == 'pm' and hour != 12:
                    hour += 12
                elif period.lower() == 'am' and hour == 12:
                    hour = 0
                return f"{hour:02d}:{minute}"
            return None

        start_time = parse_single_time(start_str)
        end_time = parse_single_time(end_str)

        return start_time, end_time

    except (ValueError, AttributeError) as e:
        logger.debug(f"Could not parse time range '{time_str}': {e}")
        return None, None


def categorize_event(title: str) -> str:
    """
    Categorize event based on title keywords.
    """
    title_lower = title.lower()

    # Music events
    if any(word in title_lower for word in ['concert', 'music', 'orchestra', 'choir', 'band', 'symphony']):
        return 'music'

    # Theater/performance (avoid false positives like "Open Play", "Playgroup")
    if any(word in title_lower for word in ['theater', 'theatre', 'performance', 'drama', 'musical theater', 'musical theatre', 'stage']):
        return 'theater'

    # Film
    if any(word in title_lower for word in ['film', 'movie', 'screening', 'cinema']):
        return 'film'

    # Learning/education
    if any(word in title_lower for word in [
        'class', 'workshop', 'lecture', 'seminar', 'course', 'study', 'learn',
        'melton', 'book of', 'torah', 'bible', 'talmud', 'hebrew', 'judaism',
        'history', 'philosophy', 'speaker', 'discussion', 'forum'
    ]):
        return 'learning'

    # Kids/family — check BEFORE arts so "Art Camp for Kids" → family, not art
    if any(word in title_lower for word in [
        'preschool', 'toddler', 'kids', 'children', 'family', 'little',
        'twisting', 'tumbling', 'playgroup', 'kindergarten', 'pre-k',
        'youth camp', 'day camp', 'summer camp',
    ]):
        return 'family'

    # Arts & crafts (fine art, galleries, adult creative)
    if any(word in title_lower for word in ['art', 'craft', 'paint', 'draw', 'pottery', 'creative']):
        return 'art'

    # Fitness/sports
    if any(word in title_lower for word in [
        'fitness', 'yoga', 'pilates', 'dance', 'zumba', 'tennis', 'basketball',
        'swim', 'gym', 'workout', 'exercise', 'sport', 'hip-hop', 'movement'
    ]):
        return 'fitness'

    # Food/culinary
    if any(word in title_lower for word in ['cook', 'cooking', 'culinary', 'chef', 'baking', 'food']):
        return 'food'

    # Community/social
    if any(word in title_lower for word in [
        'club', 'social', 'networking', 'meetup', 'gathering', 'coffee',
        'mens', 'womens', 'singles'
    ]):
        return 'community'

    # Default to community for MJCCA
    return 'community'


def extract_tags(title: str, category: str) -> list[str]:
    """Extract relevant tags from event title."""
    title_lower = title.lower()
    tags = []

    # Age-specific tags
    if any(word in title_lower for word in ['preschool', 'toddler', 'little', 'tiny']):
        tags.append('toddlers')
    if any(word in title_lower for word in ['kids', 'children', 'youth']):
        tags.append('kids')
    if any(word in title_lower for word in ['teen', 'tween']):
        tags.append('teens')
    if any(word in title_lower for word in ['senior', 'older adult']):
        tags.append('seniors')

    # Activity tags
    if 'dance' in title_lower or 'hip-hop' in title_lower or 'ballet' in title_lower:
        tags.append('dance')
    if 'tennis' in title_lower:
        tags.append('tennis')
    if 'yoga' in title_lower:
        tags.append('yoga')
    if 'pilates' in title_lower:
        tags.append('pilates')
    if 'swim' in title_lower:
        tags.append('swimming')
    if 'cook' in title_lower or 'culinary' in title_lower:
        tags.append('cooking')

    # Learning tags
    if any(word in title_lower for word in ['torah', 'talmud', 'bible', 'hebrew']):
        tags.append('jewish-learning')
    if 'book' in title_lower and 'club' not in title_lower:
        tags.append('literature')
    if 'speaker' in title_lower or 'lecture' in title_lower:
        tags.append('lecture')
    if 'montag' in title_lower:
        tags.append('speaker-series')

    # Social tags
    if any(word in title_lower for word in ['mens', 'men\'s']):
        tags.append('mens')
    if any(word in title_lower for word in ['womens', 'women\'s', 'ladies']):
        tags.append('womens')
    if 'singles' in title_lower:
        tags.append('singles')

    # Content tags
    if 'israel' in title_lower:
        tags.append('israel')
    if 'holocaust' in title_lower:
        tags.append('holocaust')
    if 'music' in title_lower or 'concert' in title_lower:
        tags.append('music')
    if 'art' in title_lower and category == 'art':
        tags.append('visual-arts')

    return tags


def should_skip_event(title: str) -> bool:
    """
    Check if event should be skipped.

    The MJCCA runs hundreds of registered programs (swim teams, tennis leagues,
    kids classes, tutoring, ongoing sessions) that require membership/enrollment.
    These aren't discoverable events for the general public.

    We KEEP: one-time public events (concerts, speaker series, film screenings,
    festivals, celebrations, open community events).
    We SKIP: registered programs, classes, camps, leagues, ongoing sessions.
    """
    # Normalize smart quotes to straight quotes for matching
    title_lower = title.lower().replace('\u2019', "'").replace('\u2018', "'")

    # ── Facility access / memberships ──
    if any(p in title_lower for p in [
        'membership', 'facility rental', 'open gym', 'open swim',
        'lap swim', 'pool hours', 'facility hours',
    ]):
        return True

    # ── ALTA tennis (all entries) ──
    if re.match(r'^alta\b', title_lower):
        return True

    # ── Named registered programs ──
    if any(p in title_lower for p in [
        'hoops academy', 'shooting stars', 'mathnasium',
        'swim team', 'sharks', 'soar basketball', 'gym stars',
        'xcel ', 'pre-team', 'intramural',
        'private music lessons', 'private lesson',
        'blonder bowling registration',
        'beginner social ladder',
        'aarp safe driving', 'future fashionistas',
        'young atlanta leadership', 'abridged hours',
        'mah jongg', 'bone density series',
    ]):
        return True

    # ── Join-first sports programs and league play ──
    if any(p in title_lower for p in [
        'young professionals basketball league',
        "adult women's basketball league",
        "adult womens basketball league",
        "men's soccer league",
        "mens soccer league",
        "women's soccer league",
        "womens soccer league",
        'alta pickleball',
        'soar pickleball',
        'slow pitch softball league',
        'modified softball league',
    ]):
        return True

    # ── Session/year patterns (ongoing multi-week programs) ──
    if re.search(r'session [1-9]|sessions [1-9]|20\d{2}\s*[-–]\s*20\d{2}', title_lower):
        return True

    # ── Level/skill patterns (class progressions) ──
    if re.search(r'level [2-9]\b|beginner level|intermediate level|advanced level', title_lower):
        return True

    # ── Kids classes / camps ──
    if any(p in title_lower for p in [
        'day camp', 'summer camp', "school's out camp", 'vacation camp',
        'spring into camp', 'camp registration',
        'mini hoopers', 'little tennis', 'multi-sports',
        'abc\'s of cooking', 'abcs of cooking', 'kitchen combo',
        'dramatic discoveries', 'coach and play',
        'musical theatre jr', 't-ball',
    ]):
        return True

    # ── Age/grade ranges in parens ──
    # "(Ages 3-4)", "(Kindergarten)", "(Pre-K)", "(2nd-3rd Grade)", "(6th-8th Grade)"
    if re.search(r'\(ages?\s+\d|kindergarten|pre-k|\bgrades?\s+\d', title_lower):
        return True
    if re.search(r'\(\d+(?:st|nd|rd|th)\s*[-–]\s*\d+(?:st|nd|rd|th)\s+grade\)', title_lower):
        return True

    # ── Gymnastics/dance class names ──
    if any(p in title_lower for p in [
        'aerials', 'tumbling', 'handsprings', 'cartwheels',
        'round-offs', 'flipping', 'twisting',
        'creative movement', 'elite boxing', 'catchball',
        'acro dance',
    ]):
        return True

    # ── Standalone class-format titles (dance/fitness/martial arts) ──
    # Only skip when it's clearly a registered class, not a one-time event
    if re.match(r'^(hip-hop|ballet|jazz|tap|aikido|chess|cardio tennis)\b', title_lower):
        # Allow if title suggests a special event: "Hip-Hop Night", "Jazz Concert"
        if not re.search(r'night|show|concert|performance|event|festival|celebration', title_lower):
            return True

    # ── Ballet/dance class combos: "Ballet & Jazz (K-2nd Grade)" ──
    if re.search(r'ballet\s*[&+]\s*(jazz|tap)|jazz\s*[&+]\s*tap', title_lower):
        return True

    # ── Day-of-week schedule items: "Hip-Hop (Tuesdays)" ──
    if re.search(r'\((mondays?|tuesdays?|wednesdays?|thursdays?|fridays?|saturdays?|sundays?)\)', title_lower):
        return True

    # ── Multi-day class patterns: "(Monday, Tuesday & Wednesday)" ──
    if re.search(r'\((?:monday|tuesday|wednesday|thursday|friday|saturday|sunday).*?(?:&|and).*?\)', title_lower):
        return True

    # ── Hebrew/religious ongoing courses (multi-week enrollment) ──
    if any(p in title_lower for p in [
        'ulpan ', 'melton:', 'melton -',
    ]):
        return True

    # ── Sports leagues (not one-time tournaments) ──
    # Catches: basketball league, soccer league, flag football league, softball league, volleyball league, etc.
    if re.search(r'\bleague\b', title_lower):
        # Allow "league" in tournament/event context
        if not re.search(r'tournament|championship|playoff|all.star', title_lower):
            return True

    # ── Youth-prefixed activities (kids programs) ──
    if title_lower.startswith('youth '):
        return True

    # ── Preschool-prefixed anything ──
    if title_lower.startswith('preschool '):
        return True

    # ── "Elite" skills training (grade-based sports clinics) ──
    if re.search(r'elite\s+\w+\s+skills?\s+training', title_lower):
        return True

    # ── Ongoing class names (standalone, no event context) ──
    if re.match(r'^(adult gymnastics|musical theater|introduction to judaism|'
                r'stroke of the week|chopping block|safe sitter)\b', title_lower):
        return True

    # ── "Coach 'n Play" / "Coach and Play" with month suffix ──
    if re.search(r"coach\s*[''n]+\s*play|coach and play", title_lower):
        return True

    # ── Blonder ongoing programs (senior center) ──
    if re.match(r'^blonder\s+(art|healthy cooking|cooking|exercise)', title_lower):
        return True

    return False


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl MJCCA calendar using Playwright.

    The calendar uses The Events Calendar plugin with a dropdown to switch views.
    We use Month view to get ~3 weeks of events (~550 events).
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    current_hashes: set[str] = set()

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            venue_id = get_or_create_place(PLACE_DATA)
            persist_typed_entity_envelope(_build_destination_envelope(venue_id))

            logger.info(f"Fetching MJCCA calendar: {CALENDAR_URL}")
            page.goto(CALENDAR_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Switch to Month view to get more events
            try:
                select = page.query_selector('select')
                if select:
                    logger.info("Switching to Month view")
                    select.select_option('Month')
                    page.wait_for_timeout(3000)
            except Exception as e:
                logger.warning(f"Could not switch to Month view: {e}")

            # Scroll to load all events
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1500)

            # Extract title-to-image map from page (uses alt text matching)
            image_map = extract_images_from_page(page)
            logger.info(f"Extracted {len(image_map)} images from page")

            # Get all event rows
            event_rows = page.query_selector_all('.events__row')
            logger.info(f"Found {len(event_rows)} events on calendar")

            for event_row in event_rows:
                try:
                    # Get table cells
                    cells = event_row.query_selector_all('td.events__col')
                    if len(cells) < 3:
                        continue

                    # Cell 0: Title and link
                    title_elem = cells[0].query_selector('.events__span--big')
                    if not title_elem:
                        continue

                    title = title_elem.inner_text().strip()

                    # Skip non-events
                    if should_skip_event(title):
                        logger.debug(f"Skipping non-event: {title}")
                        continue

                    # Get event URL
                    link_elem = cells[0].query_selector('a[href]')
                    event_url = link_elem.get_attribute('href') if link_elem else CALENDAR_URL

                    # Cell 1: Date
                    date_spans = cells[1].query_selector_all('span.events__span')
                    date_text = None
                    if len(date_spans) >= 2:
                        date_text = date_spans[1].inner_text().strip()

                    if not date_text:
                        logger.debug(f"No date for event: {title}")
                        continue

                    start_date = parse_date(date_text)
                    if not start_date:
                        logger.debug(f"Could not parse date '{date_text}' for: {title}")
                        continue

                    # Cell 2: Time
                    time_spans = cells[2].query_selector_all('span.events__span')
                    time_text = None
                    if len(time_spans) >= 2:
                        time_text = time_spans[1].inner_text().strip()

                    start_time = None
                    end_time = None
                    if time_text:
                        start_time, end_time = parse_time_range(time_text)

                    events_found += 1

                    # Categorization
                    category = categorize_event(title)
                    tags = extract_tags(title, category)

                    # Dedup check
                    content_hash = generate_content_hash(
                        title, "Marcus Jewish Community Center of Atlanta", start_date
                    )
                    current_hashes.add(content_hash)


                    # Fetch description from detail page
                    description = None
                    if event_url and event_url != CALENDAR_URL:
                        description = fetch_description_from_url(event_url)
                        if description:
                            logger.debug(f"Fetched description for: {title}")

                    # Try to match image from page's image map
                    event_image = None
                    title_lower = title.lower()
                    for img_alt, img_url in image_map.items():
                        if img_alt.lower() == title_lower or title_lower in img_alt.lower():
                            event_image = img_url
                            break

                    event_record = {
                        "source_id": source_id,
                        "place_id": venue_id,
                        "title": title,
                        "description": description,
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": start_date,  # Same day event
                        "end_time": end_time,
                        "is_all_day": False,
                        "category": category,
                        "subcategory": None,
                        "tags": tags,
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": False,  # Many require membership or fees
                        "source_url": event_url,
                        "ticket_url": event_url,
                        "image_url": event_image,
                        "raw_text": f"{title} - {date_text} - {time_text or 'No time'}",
                        "extraction_confidence": 0.90,  # Calendar is well-structured
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    existing = find_event_by_hash(content_hash)
                    if existing:
                        smart_update_existing_event(existing, event_record)
                        events_updated += 1
                        continue

                    # Enrich from detail page if still missing image
                    if not event_image and event_url and event_url != CALENDAR_URL:
                        event_record = enrich_event_record(event_record, source_name="MJCCA")

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {title} on {start_date}")
                    except Exception as e:
                        logger.error(f"Failed to insert event '{title}': {e}")

                except Exception as e:
                    logger.warning(f"Error parsing event row: {e}")
                    continue

            browser.close()

        if current_hashes:
            stale_removed = remove_stale_source_events(source_id, current_hashes)
            if stale_removed:
                logger.info(f"Removed {stale_removed} stale MJCCA events")

        logger.info(
            f"MJCCA crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching MJCCA calendar: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl MJCCA: {e}")
        raise

    return events_found, events_new, events_updated
