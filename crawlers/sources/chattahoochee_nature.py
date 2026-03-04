"""
Crawler for Chattahoochee Nature Center (chattnaturecenter.org).

Site uses JavaScript rendering - must use Playwright.
Events are displayed with Modern Events Calendar plugin.
"""

from __future__ import annotations

import json
import html as html_lib
import re
import logging
from datetime import datetime
from typing import Optional
from urllib.parse import urlparse, parse_qs

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event, upsert_venue_feature, venues_support_features_table
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.chattnaturecenter.org"
EVENTS_URL = f"{BASE_URL}/events"

# Daily operations / permanent programs — captured as exhibits, not events
EXHIBIT_CNC_TITLES = {
    "river roots science stations",
    "weekend activities",
    "birdseed fundraiser pick up",
}

# Titles containing these words, when spanning >30 days, are seasonal exhibits
_EXHIBIT_TITLE_WORDS = {"gallery", "exhibit", "display", "installation"}

VENUE_DATA = {
    "name": "Chattahoochee Nature Center",
    "slug": "chattahoochee-nature-center",
    "address": "9135 Willeo Rd",
    "neighborhood": "Roswell",
    "city": "Roswell",
    "state": "GA",
    "zip": "30075",
    "lat": 34.0013,
    "lng": -84.3891,
    "venue_type": "park",
    "spot_type": "park",
    "website": BASE_URL,
}


def parse_date_from_occurrence(url: str) -> Optional[str]:
    """Extract date from occurrence URL parameter."""
    try:
        parsed = urlparse(url)
        query_params = parse_qs(parsed.query)
        occurrence = query_params.get('occurrence', [None])[0]
        if occurrence:
            # Format: 2026-01-25
            return occurrence
    except Exception:
        pass
    return None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '7:00 PM' or '7:00 pm' format."""
    match = re.search(r"(\d{1,2}):(\d{2})\s*(am|pm)", time_text, re.IGNORECASE)
    if match:
        hour, minute, period = match.groups()
        hour = int(hour)
        if period.lower() == "pm" and hour != 12:
            hour += 12
        elif period.lower() == "am" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute}"
    return None


def parse_jsonld_events(page) -> list[dict]:
    """Extract Event objects from JSON-LD scripts."""
    events: list[dict] = []
    scripts = page.query_selector_all('script[type="application/ld+json"]')
    for script in scripts:
        try:
            content = script.inner_html()
            data = json.loads(content)
        except Exception:
            continue
        items = data if isinstance(data, list) else [data]
        for item in items:
            if not isinstance(item, dict):
                continue
            event_type = item.get("@type")
            if event_type == "Event" or (isinstance(event_type, list) and "Event" in event_type):
                events.append(item)
    return events


def parse_iso_datetime(value: str | None) -> tuple[Optional[str], Optional[str]]:
    """Parse ISO datetime into (YYYY-MM-DD, HH:MM)."""
    if not value:
        return None, None
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return dt.strftime("%Y-%m-%d"), dt.strftime("%H:%M")
    except ValueError:
        if re.match(r"^\d{4}-\d{2}-\d{2}$", str(value)):
            return str(value), None
        return None, None


def clean_description(value: str | None) -> str:
    if not value:
        return ""
    text = html_lib.unescape(str(value))
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Chattahoochee Nature Center events using Playwright."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            venue_id = get_or_create_venue(VENUE_DATA)

            logger.info(f"Fetching Chattahoochee Nature Center: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # First-pass: JSON-LD is present and more reliable than DOM scraping.
            jsonld_events = parse_jsonld_events(page)
            if jsonld_events:
                logger.info(f"Found {len(jsonld_events)} JSON-LD events")
                seen_keys = set()
                today = datetime.now().date()

                for event_data in jsonld_events:
                    try:
                        title = (event_data.get("name") or "").strip()
                        if not title:
                            continue

                        start_date, start_time = parse_iso_datetime(event_data.get("startDate"))
                        end_date, end_time = parse_iso_datetime(event_data.get("endDate"))
                        if not start_date:
                            continue

                        # Keep ongoing windows active; skip fully past rows.
                        try:
                            start_dt = datetime.strptime(start_date, "%Y-%m-%d").date()
                            end_dt = datetime.strptime(end_date, "%Y-%m-%d").date() if end_date else start_dt
                        except ValueError:
                            continue

                        if end_dt < today:
                            continue

                        # Classify as exhibit: permanent programs or seasonal exhibits (>30 day span)
                        is_exhibit = title.lower().strip() in EXHIBIT_CNC_TITLES
                        span_days = (end_dt - start_dt).days
                        is_seasonal_exhibit = False
                        if span_days > 30:
                            title_lower_check = title.lower()
                            if any(w in title_lower_check for w in _EXHIBIT_TITLE_WORDS):
                                is_exhibit = True
                                is_seasonal_exhibit = True

                        # Upsert exhibits as venue features
                        if is_exhibit and venues_support_features_table():
                            feat_desc = clean_description(event_data.get("description"))
                            feat_img = event_data.get("image")
                            if isinstance(feat_img, list):
                                feat_img = feat_img[0] if feat_img else None
                            feature_type = "exhibition" if is_seasonal_exhibit else "amenity"
                            upsert_venue_feature(venue_id, {
                                "title": title,
                                "feature_type": feature_type,
                                "description": feat_desc if feat_desc else None,
                                "image_url": feat_img,
                                "is_seasonal": is_seasonal_exhibit,
                                "start_date": start_date if is_seasonal_exhibit else None,
                                "end_date": end_date if is_seasonal_exhibit else None,
                            })
                            continue  # exhibits live in venue_features, not events

                        is_recurring = False
                        if start_dt < today <= end_dt:
                            is_recurring = True
                            start_date = today.strftime("%Y-%m-%d")

                        event_key = f"{title}|{start_date}"
                        if event_key in seen_keys:
                            continue
                        seen_keys.add(event_key)

                        description = clean_description(event_data.get("description"))
                        event_url = event_data.get("url") or EVENTS_URL

                        image_url = event_data.get("image")
                        if isinstance(image_url, list):
                            image_url = image_url[0] if image_url else None

                        is_free = False
                        price_note = None
                        offers = event_data.get("offers")
                        if isinstance(offers, dict):
                            price_note = offers.get("price") or offers.get("availability")
                            try:
                                is_free = float(offers.get("price", 0)) == 0
                            except Exception:
                                is_free = "free" in str(price_note or "").lower()
                        elif isinstance(offers, list) and offers:
                            prices = []
                            for offer in offers:
                                if not isinstance(offer, dict):
                                    continue
                                if offer.get("price") is not None:
                                    try:
                                        prices.append(float(offer["price"]))
                                    except Exception:
                                        pass
                            if prices:
                                is_free = min(prices) == 0

                        title_lower = title.lower()
                        desc_lower = description.lower()
                        category = "community"
                        tags = ["chattahoochee", "nature", "roswell", "outdoor", "education"]
                        if any(word in title_lower or word in desc_lower for word in ["hike", "trail", "walk"]):
                            tags.append("hiking")
                        if any(word in title_lower or word in desc_lower for word in ["bird", "wildlife", "animal"]):
                            tags.append("wildlife")
                        if any(word in title_lower or word in desc_lower for word in ["kid", "child", "family"]):
                            tags.append("family-friendly")
                        if any(word in title_lower or word in desc_lower for word in ["kayak", "canoe", "paddle"]):
                            tags.append("kayaking")
                        if any(word in title_lower or word in desc_lower for word in ["art", "gallery", "exhibit"]):
                            category = "art"
                            tags.append("gallery")

                        events_found += 1
                        content_hash = generate_content_hash(title, "Chattahoochee Nature Center", start_date)
                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": title,
                            "description": description or "Event at Chattahoochee Nature Center",
                            "start_date": start_date,
                            "start_time": start_time,
                            "end_date": end_date,
                            "end_time": end_time,
                            "is_all_day": False,
                            "category": category,
                            "subcategory": None,
                            "tags": tags,
                            "price_min": None,
                            "price_max": None,
                            "price_note": price_note,
                            "is_free": is_free,
                            "source_url": event_url,
                            "ticket_url": event_url,
                            "image_url": image_url,
                            "raw_text": f"{title} - {description[:200] if description else ''}",
                            "extraction_confidence": 0.9,
                            "is_recurring": is_recurring,
                            "recurrence_rule": "Recurring date range" if is_recurring else None,
                            "content_hash": content_hash,
                            "content_kind": "exhibit" if is_exhibit else None,
                        }

                        existing = find_event_by_hash(content_hash)
                        if existing:
                            smart_update_existing_event(existing, event_record)
                            events_updated += 1
                            continue

                        try:
                            insert_event(event_record)
                            events_new += 1
                        except Exception as e:
                            logger.error(f"Failed to insert JSON-LD event '{title}': {e}")
                    except Exception as e:
                        logger.debug(f"Error processing JSON-LD event: {e}")
                        continue

                browser.close()
                logger.info(
                    f"Chattahoochee Nature Center crawl complete (JSON-LD): {events_found} found, "
                    f"{events_new} new, {events_updated} updated"
                )
                return events_found, events_new, events_updated

            # Scroll to load all content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Track seen event IDs to avoid duplicates (events repeat for each occurrence)
            seen_event_ids = set()

            # Find all event articles
            event_articles = page.query_selector_all("article.mec-event-article")
            logger.info(f"Found {len(event_articles)} event article elements")

            for article in event_articles:
                try:
                    # Get event title and link
                    title_link = article.query_selector("h3.mec-event-title a")
                    if not title_link:
                        logger.debug("No title link found, skipping")
                        continue

                    title = title_link.inner_text().strip()
                    event_url = title_link.get_attribute("href")
                    event_id_attr = title_link.get_attribute("data-event-id")

                    if not title or not event_url:
                        logger.debug("Missing title or URL, skipping")
                        continue

                    # Skip duplicate events (same event on different days)
                    if event_id_attr in seen_event_ids:
                        continue
                    seen_event_ids.add(event_id_attr)

                    # Get description
                    description_elem = article.query_selector(".mec-event-description")
                    description = description_elem.inner_text().strip() if description_elem else ""

                    # Extract start date from occurrence parameter in URL
                    start_date = parse_date_from_occurrence(event_url)
                    if not start_date:
                        logger.debug(f"Could not extract date from URL: {event_url}")
                        continue

                    # Parse the date to ensure it's valid
                    try:
                        dt = datetime.strptime(start_date, "%Y-%m-%d")
                        # Skip past events
                        if dt.date() < datetime.now().date():
                            continue
                    except ValueError:
                        logger.debug(f"Invalid date format: {start_date}")
                        continue

                    # Get time from meta section
                    start_time = None
                    time_elem = article.query_selector(".mec-start-time")
                    if time_elem:
                        time_text = time_elem.inner_text().strip()
                        if time_text.lower() != "all day":
                            start_time = parse_time(time_text)

                    # Get image
                    image_url = None
                    img_elem = article.query_selector("img.mec-event-image")
                    if img_elem:
                        image_url = img_elem.get_attribute("src") or img_elem.get_attribute("data-src")

                    # Get price/registration info
                    price_note = None
                    is_free = False
                    cost_elem = article.query_selector(".mec-event-cost, .mec-booking-button")
                    if cost_elem:
                        cost_text = cost_elem.inner_text().strip().lower()
                        if "free" in cost_text:
                            is_free = True
                        elif cost_text:
                            price_note = cost_text

                    events_found += 1

                    content_hash = generate_content_hash(title, "Chattahoochee Nature Center", start_date)


                    # Determine category from title/description
                    category = "community"
                    tags = ["chattahoochee", "nature", "roswell", "outdoor", "education"]

                    title_lower = title.lower()
                    desc_lower = description.lower()

                    if any(word in title_lower or word in desc_lower for word in ["hike", "trail", "walk"]):
                        tags.append("hiking")
                    if any(word in title_lower or word in desc_lower for word in ["bird", "wildlife", "animal"]):
                        tags.append("wildlife")
                    if any(word in title_lower or word in desc_lower for word in ["kid", "child", "family"]):
                        tags.append("family-friendly")
                    if any(word in title_lower or word in desc_lower for word in ["kayak", "canoe", "paddle"]):
                        tags.append("kayaking")
                    if any(word in title_lower or word in desc_lower for word in ["art", "gallery", "exhibit"]):
                        category = "art"
                        tags.append("gallery")

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": description if description else "Event at Chattahoochee Nature Center",
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": category,
                        "subcategory": None,
                        "tags": tags,
                        "price_min": None,
                        "price_max": None,
                        "price_note": price_note,
                        "is_free": is_free,
                        "source_url": event_url,
                        "ticket_url": event_url,
                        "image_url": image_url,
                        "raw_text": f"{title} - {description[:200] if description else ''}",
                        "extraction_confidence": 0.85,
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
                    logger.error(f"Error processing event article: {e}")
                    continue

            browser.close()

        logger.info(
            f"Chattahoochee Nature Center crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Chattahoochee Nature Center: {e}")
        raise

    return events_found, events_new, events_updated
