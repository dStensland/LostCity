"""
Crawler for Meetup.com events in Atlanta.
Scrapes public meetup events using Playwright.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, get_or_create_virtual_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from utils import extract_images_from_page

logger = logging.getLogger(__name__)

BASE_URL = "https://www.meetup.com"
EVENTS_URL = f"{BASE_URL}/find/?location=us--ga--Atlanta&source=EVENTS"

# Additional keyword-specific URLs to surface underrepresented activities
BROWSE_URLS = [
    EVENTS_URL,
    f"{EVENTS_URL}&keywords=hiking",
    f"{EVENTS_URL}&keywords=kayaking",
    f"{EVENTS_URL}&keywords=pottery+class",
    f"{EVENTS_URL}&keywords=running+club",
    f"{EVENTS_URL}&keywords=book+club",
    f"{EVENTS_URL}&keywords=photography",
]

# Map Meetup topics to our subcategories
TOPIC_MAP = {
    # Tech & Science
    "tech": "meetup.tech",
    "technology": "meetup.tech",
    "software": "meetup.tech",
    "software-development": "meetup.tech",
    "programming": "meetup.tech",
    "data-science": "meetup.tech",
    "web-development": "meetup.tech",
    "machine-learning": "meetup.tech",
    "artificial-intelligence": "meetup.tech",
    "cloud-computing": "meetup.tech",
    "cybersecurity": "meetup.tech",
    "blockchain": "meetup.tech",
    "python": "meetup.tech",
    "javascript": "meetup.tech",
    "java": "meetup.tech",
    "devops": "meetup.tech",
    # Professional & Career
    "career-business": "meetup.professional",
    "entrepreneurship": "meetup.professional",
    "business": "meetup.professional",
    "startups": "meetup.professional",
    "networking": "meetup.professional",
    "professional-development": "meetup.professional",
    "marketing": "meetup.professional",
    "finance": "meetup.professional",
    # Social & Networking
    "socializing": "meetup.social",
    "singles": "meetup.social",
    "new-in-town": "meetup.social",
    "social": "meetup.social",
    "friends": "meetup.social",
    "20s-30s": "meetup.social",
    "30s-40s": "meetup.social",
    # Hobbies & Interests
    "games": "meetup.hobbies",
    "board-games": "meetup.hobbies",
    "video-games": "meetup.hobbies",
    "photography": "meetup.hobbies",
    "book-clubs": "meetup.hobbies",
    "anime": "meetup.hobbies",
    "sci-fi-fantasy": "meetup.hobbies",
    "crafts": "meetup.hobbies",
    # Outdoors & Adventure
    "outdoors-adventure": "meetup.outdoors",
    "hiking": "meetup.outdoors",
    "camping": "meetup.outdoors",
    "biking": "meetup.outdoors",
    "running": "meetup.outdoors",
    "nature": "meetup.outdoors",
    "travel": "meetup.outdoors",
    # Learning & Development
    "education-learning": "meetup.learning",
    "language": "meetup.learning",
    "language-exchange": "meetup.learning",
    "writing": "meetup.learning",
    "self-improvement": "meetup.learning",
    # Health & Wellness
    "health-wellbeing": "meetup.health",
    "meditation": "meetup.health",
    "yoga": "meetup.health",
    "mental-health": "meetup.health",
    "wellness": "meetup.health",
    # Arts & Creative
    "arts-culture": "meetup.creative",
    "art": "meetup.creative",
    "music": "meetup.creative",
    "dance": "meetup.creative",
    "film": "meetup.creative",
    "theater": "meetup.creative",
    # Sports & Fitness
    "fitness": "meetup.sports",
    "sports-recreation": "meetup.sports",
    "basketball": "meetup.sports",
    "soccer": "meetup.sports",
    "tennis": "meetup.sports",
    "golf": "meetup.sports",
    # Food & Drink
    "food-drink": "meetup.food",
    "wine": "meetup.food",
    "beer": "meetup.food",
    "cooking": "meetup.food",
    "dining-out": "meetup.food",
    # Parents & Family
    "parents-family": "meetup.parents",
    "moms": "meetup.parents",
    "dads": "meetup.parents",
    "kids": "meetup.parents",
    # LGBTQ+
    "lgbtq": "meetup.lgbtq",
    "gay": "meetup.lgbtq",
    "lesbian": "meetup.lgbtq",
    "queer": "meetup.lgbtq",
}


def map_topic_to_subcategory(topics: list[str]) -> Optional[str]:
    """Map Meetup topics to our subcategory."""
    for topic in topics:
        topic_lower = topic.lower().replace(" ", "-")
        if topic_lower in TOPIC_MAP:
            return TOPIC_MAP[topic_lower]
    return None


def parse_meetup_datetime(datetime_str: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse Meetup datetime format.
    Returns (date, time) tuple as strings.
    """
    try:
        # ISO format: 2026-01-15T19:00:00-05:00
        if "T" in datetime_str:
            dt = datetime.fromisoformat(datetime_str.replace("Z", "+00:00"))
            return dt.strftime("%Y-%m-%d"), dt.strftime("%H:%M")
        return None, None
    except Exception as e:
        logger.debug(f"Failed to parse datetime {datetime_str}: {e}")
        return None, None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Meetup.com for Atlanta events using Playwright."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            seen_urls = set()
            event_data = []
            image_map = {}

            # Browse multiple keyword URLs to capture underrepresented activities
            for browse_url in BROWSE_URLS:
                logger.info(f"Fetching Meetup: {browse_url}")
                try:
                    page.goto(browse_url, wait_until="domcontentloaded", timeout=60000)
                    page.wait_for_timeout(3000)
                except Exception as e:
                    logger.warning(f"Failed to load {browse_url}: {e}")
                    continue

                # Extract images from page
                page_images = extract_images_from_page(page)
                image_map.update(page_images)

                # Scroll to load more events (infinite scroll)
                for i in range(5):
                    page.keyboard.press("End")
                    page.wait_for_timeout(2000)

                event_links = page.query_selector_all('a[href*="/events/"]')

                for link in event_links:
                    try:
                        href = link.get_attribute("href")
                        if not href or "/events/" not in href:
                            continue

                        if href in seen_urls:
                            continue
                        seen_urls.add(href)

                        card = link
                        event_url = href if href.startswith("http") else f"{BASE_URL}{href}"
                        title = card.inner_text().strip()

                        if not title or len(title) < 5 or len(title) > 300:
                            continue

                        skip_words = ["Sign up", "Log in", "Create", "Search", "See all"]
                        if any(sw.lower() in title.lower() for sw in skip_words):
                            continue

                        event_data.append(
                            {
                                "title": title.split("\n")[0].strip(),
                                "url": event_url,
                            }
                        )

                    except Exception as e:
                        logger.debug(f"Error extracting event link: {e}")
                        continue

                logger.info(f"After {browse_url}: {len(event_data)} total unique events")

            logger.info(
                f"Found {len(event_data)} potential events across {len(BROWSE_URLS)} keyword pages, fetching details..."
            )

            # Now visit each event page to get full details
            for idx, event in enumerate(event_data[:50]):  # Limit to 50 events per run
                try:
                    page.goto(
                        event["url"], wait_until="domcontentloaded", timeout=30000
                    )
                    page.wait_for_timeout(1000)

                    # Extract structured data from the page
                    title = event["title"]

                    # Try to get better title from page
                    title_el = page.query_selector("h1")
                    if title_el:
                        page_title = title_el.inner_text().strip()
                        if page_title and len(page_title) > 3:
                            title = page_title

                    # Get datetime from time element
                    time_el = page.query_selector("time[datetime]")
                    start_date = None
                    start_time = None

                    if time_el:
                        datetime_attr = time_el.get_attribute("datetime")
                        if datetime_attr:
                            start_date, start_time = parse_meetup_datetime(
                                datetime_attr
                            )

                    if not start_date:
                        logger.debug(f"Skipping event without date: {title}")
                        continue

                    # Get group name (organizer)
                    group_name = None
                    group_el = page.query_selector(
                        'a[href*="/groups/"], a[href*="/meetup/"]'
                    )
                    if group_el:
                        group_name = group_el.inner_text().strip()

                    # Get location
                    location_text = None
                    is_online = False

                    # Check for online event
                    if (
                        page.query_selector('[data-testid="online-event-badge"]')
                        or "online" in page.inner_text("body").lower()[:1000]
                    ):
                        is_online = True
                        location_text = "Online Event"

                    # Try to get physical location
                    location_el = page.query_selector(
                        '[data-testid="venue-name"], .venueDisplay'
                    )
                    if location_el and not is_online:
                        location_text = location_el.inner_text().strip()

                    # Get description
                    description = None
                    desc_el = page.query_selector(
                        '[data-testid="event-description"], .event-description'
                    )
                    if desc_el:
                        description = desc_el.inner_text().strip()[:2000]

                    # Get topics/tags for subcategory mapping
                    topics = []
                    topic_els = page.query_selector_all(
                        '[data-testid="event-topics"] a, .event-topics a'
                    )
                    for tel in topic_els:
                        topic_text = tel.inner_text().strip()
                        if topic_text:
                            topics.append(topic_text)

                    # Also try to extract from URL
                    url_match = re.search(r"/([a-z-]+)/events/", event["url"])
                    if url_match:
                        topics.append(url_match.group(1))

                    subcategory = map_topic_to_subcategory(topics)

                    events_found += 1

                    # Create venue if we have location info (and not online)
                    venue_id = None
                    if location_text and not is_online:
                        venue_data = {
                            "name": location_text,
                            "slug": re.sub(
                                r"[^a-z0-9]+", "-", location_text.lower()
                            ).strip("-"),
                            "city": "Atlanta",
                            "state": "GA",
                        }
                        try:
                            venue_id = get_or_create_venue(venue_data)
                        except Exception as e:
                            logger.debug(f"Could not create venue: {e}")

                    # Assign virtual venue for online events with no venue
                    if venue_id is None and is_online:
                        venue_id = get_or_create_virtual_venue()

                    # Generate content hash
                    venue_for_hash = location_text or group_name or "Meetup"
                    content_hash = generate_content_hash(
                        title, venue_for_hash, start_date
                    )

                    # Check for existing event

                    # Build event record
                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": description,
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": "meetup",
                        "subcategory": subcategory,
                        "tags": topics[:10] if topics else ["meetup"],
                        "price_min": None,
                        "price_max": None,
                        "price_note": "See Meetup for details",
                        "is_free": True,  # Most meetups are free
                        "source_url": event["url"],
                        "ticket_url": event["url"],
                        "image_url": image_map.get(title),
                        "raw_text": None,
                        "extraction_confidence": 0.8,
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
                        logger.info(f"Added: {title} on {start_date}")
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

                except Exception as e:
                    logger.debug(f"Error processing event {event.get('url')}: {e}")
                    continue

            browser.close()

        logger.info(
            f"Meetup crawl complete: {events_found} found, {events_new} new, {events_updated} existing"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Meetup: {e}")
        raise

    return events_found, events_new, events_updated
