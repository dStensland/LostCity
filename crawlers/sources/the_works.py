"""
Crawler for The Works / Chattahoochee Food Works district event pages.

Uses The Events Calendar (TEC) WordPress plugin via Playwright and supports:
- the-works-atl
- chattahoochee-food-works
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup

from db import (
    get_or_create_place,
    insert_event,
    find_event_by_hash,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

THE_WORKS_VENUE = {
    "name": "The Works ATL",
    "slug": "the-works-atl",
    "address": "1235 Chattahoochee Ave NW",
    "neighborhood": "Upper Westside",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30318",
    "lat": 33.8098,
    "lng": -84.4305,
    "place_type": "event_space",
    "spot_type": "event_space",
    "website": "https://theworksatl.com",
    "vibes": ["mixed-use", "upper-westside", "chattahoochee", "food-hall", "brewery"],
}

CHATTAHOOCHEE_FOOD_WORKS_VENUE = {
    "name": "Chattahoochee Food Works",
    "slug": "chattahoochee-food-works",
    "address": "1235 Chattahoochee Ave NW Suite 130",
    "neighborhood": "Upper Westside",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30318",
    "lat": 33.8098,
    "lng": -84.4305,
    "place_type": "food_hall",
    "spot_type": "food_hall",
    "website": "https://chattahoocheefoodworks.com",
    "vibes": ["food-hall", "upper-westside", "chattahoochee", "diverse-cuisine"],
}

SOURCE_CONFIGS = {
    "the-works-atl": {
        "base_url": "https://theworksatl.com",
        "events_url": "https://theworksatl.com/events/",
        "primary_venue": THE_WORKS_VENUE,
        "sub_venues": {"chattahoochee food works": CHATTAHOOCHEE_FOOD_WORKS_VENUE},
    },
    "chattahoochee-food-works": {
        "base_url": "https://chattahoocheefoodworks.com",
        "events_url": "https://chattahoocheefoodworks.com/events/",
        "primary_venue": CHATTAHOOCHEE_FOOD_WORKS_VENUE,
        "sub_venues": {},
    },
}


def _get_source_config(source_slug: str) -> dict:
    return SOURCE_CONFIGS.get(source_slug, SOURCE_CONFIGS["the-works-atl"])


def _parse_tec_datetime(
    text: str,
) -> tuple[Optional[str], Optional[str], Optional[str], Optional[str]]:
    """Parse TEC datetime text like 'March 15 @ 6:00 pm-8:00 pm'."""
    current_year = datetime.now().year
    text = text.strip()

    # Multi-day: "March 15 @ 6:00 pm-March 16 @ 12:00 am"
    m = re.match(
        r"(\w+)\s+(\d+)\s+@\s+(\d+):(\d+)\s+(am|pm)\s*-\s*(\w+)\s+(\d+)\s+@\s+(\d+):(\d+)\s+(am|pm)",
        text,
        re.IGNORECASE,
    )
    if m:
        try:
            start_dt = datetime.strptime(
                f"{m.group(1)} {m.group(2)} {current_year}", "%B %d %Y"
            )
            if (datetime.now() - start_dt).days > 60:
                start_dt = datetime.strptime(
                    f"{m.group(1)} {m.group(2)} {current_year + 1}", "%B %d %Y"
                )

            sh = int(m.group(3))
            sp = m.group(5).lower()
            if sp == "pm" and sh != 12:
                sh += 12
            elif sp == "am" and sh == 12:
                sh = 0

            eh = int(m.group(8))
            ep = m.group(10).lower()
            if ep == "pm" and eh != 12:
                eh += 12
            elif ep == "am" and eh == 12:
                eh = 0

            end_month_num = datetime.strptime(m.group(6), "%B").month
            end_year = start_dt.year + (1 if end_month_num < start_dt.month else 0)
            end_dt = datetime.strptime(
                f"{m.group(6)} {m.group(7)} {end_year}", "%B %d %Y"
            )

            return (
                start_dt.strftime("%Y-%m-%d"),
                f"{sh:02d}:{m.group(4)}",
                end_dt.strftime("%Y-%m-%d"),
                f"{eh:02d}:{m.group(9)}",
            )
        except ValueError:
            pass

    # Same-day: "March 15 @ 6:00 pm-8:00 pm" or "March 15 @ 6:00 pm"
    m = re.match(
        r"(\w+)\s+(\d+)\s+@\s+(\d+):(\d+)\s+(am|pm)(?:\s*-\s*(\d+):(\d+)\s+(am|pm))?",
        text,
        re.IGNORECASE,
    )
    if m:
        try:
            dt = datetime.strptime(
                f"{m.group(1)} {m.group(2)} {current_year}", "%B %d %Y"
            )
            if (datetime.now() - dt).days > 60:
                dt = datetime.strptime(
                    f"{m.group(1)} {m.group(2)} {current_year + 1}", "%B %d %Y"
                )

            sh = int(m.group(3))
            sp = m.group(5).lower()
            if sp == "pm" and sh != 12:
                sh += 12
            elif sp == "am" and sh == 12:
                sh = 0
            start_date = dt.strftime("%Y-%m-%d")
            start_time = f"{sh:02d}:{m.group(4)}"

            end_date, end_time = None, None
            if m.group(6):
                eh = int(m.group(6))
                ep = m.group(8).lower()
                if ep == "pm" and eh != 12:
                    eh += 12
                elif ep == "am" and eh == 12:
                    eh = 0
                end_time = f"{eh:02d}:{m.group(7)}"
                end_date = start_date

            return start_date, start_time, end_date, end_time
        except ValueError:
            pass

    return None, None, None, None


def _parse_photo_view_datetime(
    article,
    dt_el,
    date_tag,
) -> tuple[Optional[str], Optional[str], Optional[str], Optional[str]]:
    raw_dt = date_tag.get("datetime", "") if date_tag else ""
    start_date = raw_dt[:10] if len(raw_dt) >= 10 else None
    if not start_date or not dt_el:
        return None, None, None, None

    dt_text = dt_el.get_text(strip=True)
    if "@" in dt_text:
        parsed_start_date, parsed_start_time, parsed_end_date, parsed_end_time = (
            _parse_tec_datetime(dt_text)
        )
        if parsed_start_date:
            return (
                parsed_start_date,
                parsed_start_time,
                parsed_end_date,
                parsed_end_time,
            )

    time_tags = dt_el.find_all("time")
    if not time_tags:
        return start_date, None, start_date, None

    def _normalize_time(value: Optional[str]) -> Optional[str]:
        if not value:
            return None
        match = re.match(r"^(\d{1,2}):(\d{2})$", value.strip())
        if not match:
            return None
        hour = int(match.group(1))
        minute = match.group(2)
        return f"{hour:02d}:{minute}"

    start_time = _normalize_time(time_tags[0].get("datetime"))
    end_time = (
        _normalize_time(time_tags[1].get("datetime")) if len(time_tags) > 1 else None
    )
    end_date = start_date if end_time else start_date
    return start_date, start_time, end_date, end_time


def _classify_event(title: str) -> tuple[str, Optional[str], list[str]]:
    """Classify event by title keywords."""
    title_lower = title.lower()
    tags = ["the-works", "upper-westside", "chattahoochee"]

    if any(w in title_lower for w in ["trivia", "quiz"]):
        return "nightlife", "nightlife.trivia", tags + ["trivia"]
    if any(w in title_lower for w in ["run club", "running"]):
        return "fitness", "fitness.running", tags + ["run-club"]
    if any(w in title_lower for w in ["yoga"]):
        return "fitness", "fitness.yoga", tags + ["yoga"]
    if any(w in title_lower for w in ["comedy", "comedian"]):
        return "comedy", "comedy.standup", tags + ["comedy"]
    if any(
        w in title_lower for w in ["music", "concert", "live", "dj", "band", "f.a.m"]
    ):
        return "music", "concert", tags + ["live-music"]
    if any(w in title_lower for w in ["market", "farmers", "pop-up"]):
        return "community", None, tags + ["market"]
    if any(
        w in title_lower
        for w in ["tasting", "wine", "chef", "dinner", "brunch", "industry night"]
    ):
        return "food_drink", None, tags + ["food"]
    if any(w in title_lower for w in ["kids", "family", "easter"]):
        return "family", None, tags + ["family"]
    if any(w in title_lower for w in ["art", "gallery", "craft", "workshop"]):
        return "arts", None, tags + ["arts"]

    return "community", None, tags


def _resolve_venue(
    venue_name: str, primary_venue: dict, sub_venues: dict[str, dict]
) -> dict:
    """Map TEC venue name to our sub-venue data."""
    venue_lower = venue_name.lower()
    for keyword, place_data in sub_venues.items():
        if keyword in venue_lower:
            return place_data
    return primary_venue


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl The Works Atlanta events via Playwright + TEC HTML parsing."""
    source_id = source["id"]
    source_slug = source.get("slug") or "the-works-atl"
    config = _get_source_config(source_slug)
    primary_venue = config["primary_venue"]
    sub_venues = config["sub_venues"]
    events_url = config["events_url"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_ids: dict[str, int] = {}
    for vdata in [primary_venue] + list(sub_venues.values()):
        venue_ids[vdata["slug"]] = get_or_create_place(vdata)

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            logger.info("Fetching %s events from %s", source_slug, events_url)
            page.goto(events_url, wait_until="domcontentloaded", timeout=45000)
            page.wait_for_timeout(5000)

            # Click "Load More" to get all events
            for _ in range(8):
                load_more = page.query_selector(
                    ".tribe-events-c-load-more button, "
                    ".tribe-events-c-load-more a, "
                    "button:has-text('Load More'), "
                    "a:has-text('Load More')"
                )
                if not load_more:
                    break

                before_count = page.locator(
                    "article.tribe-events-calendar-list__event"
                ).count()
                try:
                    load_more.click(timeout=5000)
                    page.wait_for_timeout(2000)
                    page.wait_for_load_state("domcontentloaded", timeout=10000)
                except Exception:
                    break

                after_count = page.locator(
                    "article.tribe-events-calendar-list__event"
                ).count()
                if after_count <= before_count:
                    break

            content = page.content()
            browser.close()

    except Exception as exc:
        logger.error("Failed to fetch %s events: %s", source_slug, exc)
        return events_found, events_new, events_updated

    soup = BeautifulSoup(content, "html.parser")

    # TEC uses different view layouts — try list view first, then photo view
    articles = soup.select("article.tribe-events-calendar-list__event")
    view_type = "list"
    if not articles:
        articles = soup.select("article.tribe-events-pro-photo__event")
        view_type = "photo"
    if not articles:
        articles = soup.select("article[class*=tribe-events]")
        view_type = "generic"
    if not articles:
        articles = soup.select("article")
        view_type = "article"
    logger.info(
        "%s: found %s TEC event articles (%s view)",
        source_slug,
        len(articles),
        view_type,
    )

    for article in articles:
        try:
            # Title — different class per view type
            title_el = (
                article.find("h3", class_="tribe-events-calendar-list__event-title")
                or article.find("h3", class_="tribe-events-pro-photo__event-title")
                or article.find("h3")
            )
            if not title_el:
                continue
            link = title_el.find("a")
            if not link:
                continue

            title = link.get_text(strip=True)
            event_url = link.get("href", events_url)

            # DateTime — try list view, then photo view, then generic
            dt_el = article.find(
                "time", class_="tribe-events-calendar-list__event-datetime"
            ) or article.find("div", class_="tribe-events-pro-photo__event-datetime")
            if not dt_el:
                continue

            # Photo view uses date tag for month/day + separate time div
            date_tag = article.find(
                "time", class_="tribe-events-pro-photo__event-date-tag-datetime"
            )
            if date_tag and date_tag.get("datetime"):
                start_date, start_time, end_date, end_time = _parse_photo_view_datetime(
                    article, dt_el, date_tag
                )
            else:
                dt_text = dt_el.get_text(strip=True)
                start_date, start_time, end_date, end_time = _parse_tec_datetime(
                    dt_text
                )
            if not start_date:
                continue

            events_found += 1

            # Venue within The Works
            venue_name = ""
            venue_el = article.find(
                "span", class_="tribe-events-calendar-list__event-venue-title"
            ) or article.find(
                "span", class_="tribe-events-pro-photo__event-venue-title"
            )
            if venue_el:
                venue_name = venue_el.get_text(strip=True)

            matched_venue = _resolve_venue(
                venue_name or title, primary_venue, sub_venues
            )
            venue_id = venue_ids[matched_venue["slug"]]

            # Description
            desc_el = article.find(
                "div", class_="tribe-events-calendar-list__event-description"
            ) or article.find("div", class_="tribe-events-pro-photo__event-description")
            description = (
                desc_el.get_text(strip=True)
                if desc_el
                else f"Event at {matched_venue['name']}"
            )

            category, subcategory, tags = _classify_event(title)

            combined_text = f"{title} {description}".lower()
            is_free = "free" in combined_text
            is_recurring = "tribe-recurring-event" in (article.get("class") or [])

            content_hash = generate_content_hash(
                title, matched_venue["name"], start_date
            )

            event_record = {
                "source_id": source_id,
                "place_id": venue_id,
                "title": title,
                "description": description,
                "start_date": start_date,
                "start_time": start_time or "18:00",
                "end_date": end_date,
                "end_time": end_time,
                "is_all_day": False,
                "category": category,
                "subcategory": subcategory,
                "tags": tags,
                "price_min": None,
                "price_max": None,
                "price_note": None,
                "is_free": is_free,
                "source_url": event_url,
                "ticket_url": event_url,
                "image_url": None,
                "raw_text": title,
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
                insert_event(event_record)
                events_new += 1
                logger.debug(f"The Works: added '{title}' on {start_date}")
            except Exception as exc:
                logger.error(f"The Works: failed to insert '{title}': {exc}")

        except Exception as exc:
            logger.debug(f"The Works: error parsing article: {exc}")
            continue

    logger.info(
        "%s crawl complete: %s found, %s new, %s updated",
        source_slug,
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
