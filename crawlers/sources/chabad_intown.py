"""
Crawler for Chabad Intown Atlanta.
https://www.chabadintown.com/events

Jewish community center in Grant Park offering 10-20 public events monthly:
holiday celebrations, Shabbat dinners, Tot Shabbat, educational lectures,
cooking classes, Café Chabad music nights, women's wellness programs.

Categorizes by event type, not religion.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.chabadintown.com"
EVENTS_URL = f"{BASE_URL}/events"

VENUE_DATA = {
    "name": "Chabad Intown",
    "slug": "chabad-intown",
    "address": "730 Boulevard SE",
    "neighborhood": "Grant Park",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30312",
    "lat": 33.7393,
    "lng": -84.3711,
    "venue_type": "community_center",
    "spot_type": "community_center",
    "website": BASE_URL,
    "vibes": ["faith-jewish", "family-friendly", "all-ages"],
}


def parse_date_string(date_str: str) -> Optional[str]:
    """
    Parse date from various formats.
    Returns YYYY-MM-DD format string or None.
    """
    if not date_str:
        return None

    current_year = datetime.now().year

    # Try full month name formats (e.g., "February 7, 2026", "Friday, February 7")
    date_match = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:,?\s+(\d{4}))?",
        date_str,
        re.IGNORECASE
    )
    if date_match:
        month = date_match.group(1)
        day = int(date_match.group(2))
        year = int(date_match.group(3)) if date_match.group(3) else current_year
        try:
            dt = datetime.strptime(f"{month} {day} {year}", "%B %d %Y")
            if dt.date() < datetime.now().date() and not date_match.group(3):
                dt = datetime.strptime(f"{month} {day} {year + 1}", "%B %d %Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Try short month name formats
    date_match = re.search(
        r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?",
        date_str,
        re.IGNORECASE
    )
    if date_match:
        month = date_match.group(1)
        day = int(date_match.group(2))
        year = int(date_match.group(3)) if date_match.group(3) else current_year
        try:
            dt = datetime.strptime(f"{month} {day} {year}", "%b %d %Y")
            if dt.date() < datetime.now().date() and not date_match.group(3):
                dt = datetime.strptime(f"{month} {day} {year + 1}", "%b %d %Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Try MM/DD/YYYY format
    date_match = re.search(r"(\d{1,2})/(\d{1,2})/(\d{4})", date_str)
    if date_match:
        month = int(date_match.group(1))
        day = int(date_match.group(2))
        year = int(date_match.group(3))
        try:
            dt = datetime(year, month, day)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from various formats like '7pm', '10:30 AM', 'noon'."""
    if not time_text:
        return None

    if "noon" in time_text.lower():
        return "12:00"

    match = re.search(r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)", time_text, re.IGNORECASE)
    if match:
        hour = int(match.group(1))
        minute = match.group(2) or "00"
        period = match.group(3).lower()

        if period == "pm" and hour != 12:
            hour += 12
        elif period == "am" and hour == 12:
            hour = 0

        return f"{hour:02d}:{minute}"
    return None


def determine_category_and_tags(title: str, description: str) -> tuple[str, Optional[str], list[str]]:
    """Determine category based on event type, not religion."""
    text = f"{title} {description}".lower()
    tags = ["chabad-intown", "grant-park", "jewish", "faith"]

    # Check if open to all
    if "open to all" in text or "all are welcome" in text:
        tags.append("open-to-all")

    # Holiday celebrations
    if any(kw in text for kw in ["purim", "chanukah", "hanukkah", "passover", "pesach", "rosh hashanah", "yom kippur", "sukkot", "shavuot"]):
        tags.extend(["celebration", "holiday"])
        return "community", "celebration", tags

    # Shabbat dinners
    if "shabbat" in text and any(kw in text for kw in ["dinner", "meal", "potluck"]):
        tags.extend(["dinner", "community-dinner", "family-friendly"])
        return "food_drink", "dinner", tags

    # Tot Shabbat (kids programming)
    if "tot shabbat" in text or ("shabbat" in text and "tot" in text):
        tags.extend(["kids", "family-friendly", "all-ages"])
        return "family", "kids", tags

    # Music nights (Café Chabad)
    if any(kw in text for kw in ["café chabad", "music night", "concert", "live music"]):
        tags.extend(["live-music", "music", "cafe"])
        return "music", "live", tags

    # Cooking classes
    if any(kw in text for kw in ["cooking class", "culinary", "recipe", "kitchen"]):
        tags.extend(["cooking", "class", "hands-on"])
        return "food_drink", "cooking_class", tags

    # Educational lectures/talks
    if any(kw in text for kw in ["lecture", "talk", "discussion", "class", "study", "torah"]):
        tags.extend(["lecture", "education", "learning"])
        return "learning", "lecture", tags

    # Women's wellness (yoga, sound baths, meditation)
    if any(kw in text for kw in ["yoga", "wellness", "meditation", "sound bath", "women's"]):
        tags.extend(["wellness", "women"])
        if "yoga" in text:
            tags.append("yoga")
        if "sound bath" in text or "meditation" in text:
            tags.append("meditation")
        return "wellness", "meditation" if "meditation" in text or "sound bath" in text else "yoga", tags

    # Social events
    if any(kw in text for kw in ["social", "mixer", "happy hour", "gathering"]):
        tags.extend(["social", "community"])
        return "community", "social", tags

    # Kids/family events
    if any(kw in text for kw in ["kids", "children", "family", "youth"]):
        tags.extend(["family-friendly", "kids"])
        return "family", "kids", tags

    # Default to community
    return "community", "gathering", tags


def get_series_hint(title: str, description: str) -> Optional[dict]:
    """Generate series hint for recurring events."""
    text = f"{title} {description}".lower()

    # Shabbat dinners (weekly on Friday)
    if "shabbat" in text and "dinner" in text:
        return {
            "series_type": "recurring_show",
            "series_title": "Shabbat Dinner",
            "frequency": "weekly",
            "day_of_week": "Friday",
            "description": "Weekly Shabbat dinner - open to all",
        }

    # Tot Shabbat (weekly)
    if "tot shabbat" in text:
        return {
            "series_type": "recurring_show",
            "series_title": "Tot Shabbat",
            "frequency": "weekly",
            "day_of_week": "Saturday",
            "description": "Weekly Tot Shabbat for young families",
        }

    # Weekly Torah study/classes
    if any(kw in text for kw in ["weekly", "every week"]) and any(kw in text for kw in ["torah", "study", "class"]):
        day_match = re.search(r"(monday|tuesday|wednesday|thursday|friday|saturday|sunday)", text, re.IGNORECASE)
        if day_match:
            day = day_match.group(1).capitalize()
            return {
                "series_type": "recurring_show",
                "series_title": title,
                "frequency": "weekly",
                "day_of_week": day,
                "description": description,
            }

    # Monthly events
    if "monthly" in text or "every month" in text:
        return {
            "series_type": "recurring_show",
            "series_title": title,
            "frequency": "monthly",
            "description": description,
        }

    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Chabad Intown events using Playwright."""
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

            venue_id = get_or_create_venue(VENUE_DATA)

            logger.info(f"Fetching Chabad Intown events: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Scroll to load all content
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Chabad sites often use structured event listings
            # Try multiple possible selectors
            event_containers = []
            possible_selectors = [
                ".event-item",
                ".calendar-item",
                ".eventItem",
                ".event",
                "article",
                ".tribe-events-list-event-row",  # Common WordPress events plugin
                ".upcoming-event",
                ".content-block",
            ]

            for selector in possible_selectors:
                found = page.query_selector_all(selector)
                if found and len(found) > 0:
                    logger.info(f"Found {len(found)} events using selector: {selector}")
                    event_containers = found
                    break

            if not event_containers:
                logger.warning("No structured event elements found")
                # Could add fallback text extraction here like BAPS crawler
                browser.close()
                return 0, 0, 0

            # Process structured event containers
            logger.info(f"Processing {len(event_containers)} event elements")

            seen_events = set()

            for container in event_containers:
                try:
                    text = container.inner_text().strip()

                    if len(text) < 20:
                        continue

                    # Extract title (usually first heading or strong text)
                    title_elem = container.query_selector("h2, h3, h4, .event-title, .title, strong")
                    title = title_elem.inner_text().strip() if title_elem else text.split("\n")[0]

                    if not title or len(title) < 5:
                        continue

                    # Look for date in container
                    start_date = parse_date_string(text)
                    if not start_date:
                        logger.debug(f"No date found for: {title}")
                        continue

                    # Dedupe
                    event_key = f"{title}|{start_date}"
                    if event_key in seen_events:
                        continue
                    seen_events.add(event_key)

                    # Look for time
                    start_time = parse_time(text)

                    # Extract description
                    desc_elem = container.query_selector("p, .description, .event-description, .tribe-events-list-event-description")
                    description = desc_elem.inner_text().strip() if desc_elem else ""

                    # If description is empty, grab more from the container text
                    if not description:
                        lines = [l.strip() for l in text.split("\n") if l.strip() and l.strip() != title]
                        description = " ".join(lines[:3])

                    # Extract image
                    image_url = None
                    img_elem = container.query_selector("img")
                    if img_elem:
                        src = img_elem.get_attribute("src")
                        if src:
                            if src.startswith("http"):
                                image_url = src
                            elif src.startswith("//"):
                                image_url = "https:" + src
                            elif src.startswith("/"):
                                image_url = BASE_URL + src

                    # Extract event URL
                    event_url = EVENTS_URL
                    link_elem = container.query_selector("a[href]")
                    if link_elem:
                        href = link_elem.get_attribute("href")
                        if href:
                            if href.startswith("http"):
                                event_url = href
                            elif href.startswith("/"):
                                event_url = BASE_URL + href

                    events_found += 1

                    content_hash = generate_content_hash(
                        title, "Chabad Intown", start_date
                    )


                    category, subcategory, tags = determine_category_and_tags(title, description)

                    # Check if it's a recurring event
                    series_hint = get_series_hint(title, description)
                    is_recurring = series_hint is not None

                    # Determine if free based on text
                    is_free = False
                    price_note = None
                    text_lower = text.lower()

                    if any(kw in text_lower for kw in ["free", "no cost", "no charge", "complimentary"]):
                        is_free = True
                        price_note = "Free"

                    if any(kw in text_lower for kw in ["$", "cost:", "price:", "ticket"]):
                        # If price is mentioned, try to extract it
                        price_match = re.search(r"\$(\d+)", text)
                        if price_match:
                            price = int(price_match.group(1))
                            if price > 0:
                                is_free = False
                                price_note = f"${price}"

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title[:200],
                        "description": description[:1000] if description else None,
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
                        "price_note": price_note,
                        "is_free": is_free,
                        "source_url": event_url,
                        "ticket_url": event_url if event_url != EVENTS_URL else None,
                        "image_url": image_url,
                        "raw_text": f"{title} {description}"[:500],
                        "extraction_confidence": 0.85,
                        "is_recurring": is_recurring,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    existing = find_event_by_hash(content_hash)
                    if existing:
                        smart_update_existing_event(existing, event_record)
                        events_updated += 1
                        continue

                    try:
                        insert_event(event_record, series_hint=series_hint)
                        events_new += 1
                        logger.info(f"Added: {title[:50]}... on {start_date} at {start_time or 'TBD'}")
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

                except Exception as e:
                    logger.warning(f"Error processing event container: {e}")
                    continue

            browser.close()

        logger.info(
            f"Chabad Intown crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching Chabad Intown: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl Chabad Intown: {e}")
        raise

    return events_found, events_new, events_updated
