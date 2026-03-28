"""
Crawler for Capitol City Opera Company (ccityopera.org).

Capitol City Opera Company is an Atlanta nonprofit that has provided performance
opportunities to local singers for 36+ years. They run two main programs:

1. Dinner and a Diva — monthly opera dinner series at Petite Violette Restaurant
   (monthly Jan–Nov, each evening is a different opera excerpt)
2. On the Light Side — annual fundraiser concert at Peachtree Road UMC

Data is scraped from individual WordPress pages per production. Dates are embedded
in page text. No structured API.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, date
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import (
    find_event_by_hash,
    get_or_create_place,
    insert_event,
    remove_stale_source_events,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

REQUEST_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; LostCity/1.0)",
}

# Capitol City Opera Company's home venue / mailing address (not a performance venue)
# Actual performances happen at Petite Violette Restaurant and Peachtree Road UMC
CCO_ORG_VENUE = {
    "name": "Capitol City Opera Company",
    "slug": "capitol-city-opera-company",
    "address": "1266 West Paces Ferry Rd NW",
    "neighborhood": "Buckhead",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30327",
    "place_type": "organization",
    "website": "https://ccityopera.org",
}

# Petite Violette — where Dinner and a Diva happens
PETITE_VIOLETTE_VENUE = {
    "name": "Petite Violette Restaurant",
    "slug": "petite-violette-restaurant",
    "address": "2948 Clairmont Rd NE",
    "neighborhood": "Brookhaven",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30329",
    "lat": 33.8375,
    "lng": -84.3271,
    "place_type": "restaurant",
    "website": "https://www.petitevioletterestaurant.com",
}

# Peachtree Road UMC Grace Hall — where On the Light Side happens
PRUMC_VENUE = {
    "name": "Peachtree Road United Methodist Church",
    "slug": "peachtree-road-umc",
    "address": "3180 Peachtree Rd NE",
    "neighborhood": "Buckhead",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30305",
    "lat": 33.8476,
    "lng": -84.3719,
    "place_type": "church",
    "website": "https://www.prumc.org",
}

# Dinner and a Diva: each month's program has its own page
DND_PAGES = [
    {
        "url": "https://ccityopera.org/pirates/",
        "title": "Dinner and a Diva: The Pirates of Penzance",
        "month": 1,
        "day": 20,
    },
    {
        "url": "https://ccityopera.org/opera-d-amore/",
        "title": "Dinner and a Diva: Opera d'Amore",
        "month": 2,
        "day": 17,
    },
    {
        "url": "https://ccityopera.org/west-side-story/",
        "title": "Dinner and a Diva: West Side Story",
        "month": 3,
        "day": 17,
    },
    {
        "url": "https://ccityopera.org/magic-flute/",
        "title": "Dinner and a Diva: The Magic Flute",
        "month": 4,
        "day": 21,
    },
    {
        "url": "https://ccityopera.org/butterfly/",
        "title": "Dinner and a Diva: Madama Butterfly",
        "month": 5,
        "day": 19,
    },
    {
        "url": "https://ccityopera.org/puritani/",
        "title": "Dinner and a Diva: I Puritani",
        "month": 6,
        "day": 16,
    },
    {
        "url": "https://ccityopera.org/werther/",
        "title": "Dinner and a Diva: Werther",
        "month": 7,
        "day": 21,
    },
    {
        "url": "https://ccityopera.org/barber-of-seville/",
        "title": "Dinner and a Diva: The Barber of Seville",
        "month": 8,
        "day": 18,
    },
    {
        "url": "https://ccityopera.org/carmen/",
        "title": "Dinner and a Diva: Carmen",
        "month": 9,
        "day": 15,
    },
    {
        "url": "https://ccityopera.org/la-traviata/",
        "title": "Dinner and a Diva: La Traviata",
        "month": 10,
        "day": 21,
    },
    {
        "url": "https://ccityopera.org/la-boheme/",
        "title": "Dinner and a Diva: La Bohème",
        "month": 11,
        "day": 17,
    },
]

DND_BASE_URL = "https://ccityopera.org/dinner-and-a-diva/"
ON_LIGHT_SIDE_URL = "https://ccityopera.org/on-the-light-side/"


def _get_page(url: str) -> Optional[BeautifulSoup]:
    """Fetch a page and return parsed soup, or None on error."""
    try:
        resp = requests.get(url, headers=REQUEST_HEADERS, timeout=15)
        resp.raise_for_status()
        return BeautifulSoup(resp.text, "html.parser")
    except Exception as exc:
        logger.warning("Failed to fetch %s: %s", url, exc)
        return None


def _extract_og_image(soup: BeautifulSoup) -> Optional[str]:
    """Get og:image from page."""
    tag = soup.find("meta", property="og:image")
    if tag:
        content = tag.get("content", "").strip()
        return content or None
    return None


def _extract_description(soup: BeautifulSoup) -> Optional[str]:
    """Get the main body text of a production page.

    CCO's WordPress theme uses a custom Elementor layout with a div.site-content
    container rather than standard article/entry-content. The full opera synopsis
    lives there, preceded by a "Make a reservation" paragraph that we strip.
    """
    # Primary: div.site-content contains the full event write-up
    site_content = soup.find(class_="site-content")
    if site_content:
        text = site_content.get_text(separator=" ", strip=True)
        if text:
            # Strip "Make a reservation at Petite Violette..." boilerplate
            text = re.sub(
                r"Make a reservation at Petite Violette Restaurant by going to\s+\S+\s*",
                "",
                text,
            ).strip()
            # Strip any leftover URLs
            text = re.sub(r"https?://\S+", "", text).strip()
            # Strip WordPress social share widget tail noise
            # "Share this: Share on X ... Like Loading..." always appears at end
            text = re.split(r"\s*Share this:\s*Share on", text)[0].strip()
            if len(text) > 40:
                return text[:600].strip()

    # Fallback: standard WP article/entry-content
    body = soup.find("article") or soup.find(class_="entry-content")
    if body:
        text = body.get_text(separator=" ", strip=True)
        if len(text) > 40:
            return text[:600].strip()

    # Last resort: meta name="description" — may be truncated but better than nothing
    meta_desc = soup.find("meta", attrs={"name": "description"})
    if meta_desc:
        content = meta_desc.get("content", "").strip()
        # Strip truncation ellipsis and reservation boilerplate
        content = re.sub(r"Make a reservation at Petite Violette.*", "", content).strip()
        content = re.sub(r"https?://\S+", "", content).strip()
        content = content.rstrip("…").strip()
        if len(content) > 40:
            return content[:600]

    return None


def _infer_year(month: int, day: int, season_year: Optional[int] = None) -> int:
    """
    Infer the year for a given month/day.

    If a season_year is provided (extracted from page text), use it directly.
    Otherwise, prefer the current year; if the date is more than 6 months in
    the past, bump to next year.
    """
    if season_year:
        return season_year
    today = date.today()
    candidate = date(today.year, month, day)
    # If this date was more than 6 months ago, it's probably next year's season
    if (today - candidate).days > 180:
        return today.year + 1
    return today.year


def _extract_season_year(soup: BeautifulSoup) -> Optional[int]:
    """
    Extract the season year from the DnD page.
    Looks for text like "2026 Dinner and a Diva Season".
    """
    text = soup.get_text(separator=" ", strip=True)
    match = re.search(r"(\d{4})\s+Dinner and a Diva Season", text, re.I)
    if match:
        return int(match.group(1))
    # Try to find any 4-digit year in the context of "season"
    match2 = re.search(r"\b(202\d)\b", text)
    if match2:
        return int(match2.group(1))
    return None


def _extract_ticket_link(soup: BeautifulSoup) -> Optional[str]:
    """Look for a ticket/purchase/reserve link in the page."""
    for link in soup.find_all("a", href=True):
        href = link.get("href", "")
        text = link.get_text(strip=True).lower()
        if any(kw in text for kw in ["ticket", "buy", "purchase", "reserve", "reservation"]):
            return href
        if any(kw in href.lower() for kw in ["eventbrite", "ticket", "purchase"]):
            return href
    return None


def _crawl_dnd_events(
    source_id: int,
    venue_id: int,
    seen_hashes: set,
) -> tuple[int, int, int]:
    """Crawl monthly Dinner and a Diva events."""
    found = new = updated = 0
    today = date.today()

    # Extract the season year from the main DnD page
    dnd_main_soup = _get_page(DND_BASE_URL)
    season_year = _extract_season_year(dnd_main_soup) if dnd_main_soup else None
    logger.info("CCO Dinner and a Diva season year: %s", season_year)

    for dnd in DND_PAGES:
        month = dnd["month"]
        day = dnd["day"]
        year = _infer_year(month, day, season_year)
        start_date = f"{year}-{month:02d}-{day:02d}"

        # Skip events more than 2 months in the past
        event_date = date(year, month, day)
        if (today - event_date).days > 60:
            continue

        title = dnd["title"]
        url = dnd["url"]

        soup = _get_page(url)
        image_url = _extract_og_image(soup) if soup else None
        description = _extract_description(soup) if soup else None
        ticket_url = _extract_ticket_link(soup) if soup else DND_BASE_URL

        content_hash = generate_content_hash(title, "Petite Violette Restaurant", start_date)
        seen_hashes.add(content_hash)
        found += 1

        event_record = {
            "source_id": source_id,
            "place_id": venue_id,
            "title": title,
            "description": description,
            "start_date": start_date,
            "start_time": "19:00",  # Program starts 7:00 pm; hors d'oeuvres at 6:30
            "end_date": None,
            "end_time": None,
            "is_all_day": False,
            "category": "music",
            "subcategory": "opera",
            "tags": sorted({
                "capitol-city-opera",
                "opera",
                "dinner",
                "performing-arts",
                "classical",
                "dinner-and-a-diva",
                "brookhaven",
            }),
            "price_min": 75.0,
            "price_max": 75.0,
            "price_note": "$75 per person (tax included; gratuity separate). Four-course dinner + wine.",
            "is_free": False,
            "source_url": url,
            "ticket_url": ticket_url or DND_BASE_URL,
            "image_url": image_url,
            "raw_text": None,
            "extraction_confidence": 0.90,
            "is_recurring": True,
            "recurrence_rule": "monthly",
            "content_hash": content_hash,
        }

        existing = find_event_by_hash(content_hash)
        if existing:
            smart_update_existing_event(existing, event_record)
            updated += 1
        else:
            insert_event(event_record)
            new += 1
            logger.debug("Added DnD: %s on %s", title, start_date)

    return found, new, updated


def _crawl_on_light_side(
    source_id: int,
    venue_id: int,
    seen_hashes: set,
) -> tuple[int, int, int]:
    """Crawl the annual On the Light Side fundraiser concert."""
    found = new = updated = 0
    today = date.today()

    soup = _get_page(ON_LIGHT_SIDE_URL)
    if not soup:
        return 0, 0, 0

    # Parse dates from page text
    body = soup.find("article") or soup.find(class_="entry-content") or soup
    text = body.get_text(separator=" ", strip=True)

    # Look for "September 27 & September 28 at 7:30 pm" pattern
    date_match = re.search(
        r"(September|October|November|December|January|February|March|April|May|June|July|August)\s+(\d{1,2})"
        r"(?:\s*[&,]\s*(?:\w+\s+)?(\d{1,2}))?\s+at\s+(\d{1,2}(?::\d{2})?)\s*(am|pm)",
        text,
        re.I,
    )

    if not date_match:
        # Try simpler pattern
        date_match = re.search(
            r"(September|October|November|December|January|February|March|April|May|June|July|August)\s+(\d{1,2})",
            text,
            re.I,
        )

    if not date_match:
        logger.warning("Could not find dates for On the Light Side")
        return 0, 0, 0

    month_str = date_match.group(1)
    day1 = int(date_match.group(2))
    month_map = {
        "january": 1, "february": 2, "march": 3, "april": 4,
        "may": 5, "june": 6, "july": 7, "august": 8,
        "september": 9, "october": 10, "november": 11, "december": 12,
    }
    month_num = month_map.get(month_str.lower(), 9)

    # Try to extract an explicit year from the page text
    year_match = re.search(r"\b(202\d)\b", text)
    explicit_year = int(year_match.group(1)) if year_match else None
    year = _infer_year(month_num, day1, explicit_year)

    # Parse time
    time_match = re.search(r"(\d{1,2}(?::\d{2})?)\s*(am|pm)", text, re.I)
    start_time = None
    if time_match:
        hour_str = time_match.group(1)
        period = time_match.group(2).upper()
        if ":" in hour_str:
            hour, minute = map(int, hour_str.split(":"))
        else:
            hour, minute = int(hour_str), 0
        if period == "PM" and hour != 12:
            hour += 12
        elif period == "AM" and hour == 12:
            hour = 0
        start_time = f"{hour:02d}:{minute:02d}"

    image_url = _extract_og_image(soup)
    description = _extract_description(soup)
    ticket_url = _extract_ticket_link(soup)

    # Individual ticket price
    price_match = re.search(r"\$(\d+)\s*(?:per person|each|individual)", text, re.I)
    price = float(price_match.group(1)) if price_match else 45.0

    title = "On the Light Side — A Night at the Tonys"

    for day in [day1]:
        start_date = f"{year}-{month_num:02d}-{day:02d}"
        event_date = date(year, month_num, day)
        if (today - event_date).days > 60:
            continue

        content_hash = generate_content_hash(
            title, "Peachtree Road United Methodist Church", start_date
        )
        seen_hashes.add(content_hash)
        found += 1

        event_record = {
            "source_id": source_id,
            "place_id": venue_id,
            "title": title,
            "description": description,
            "start_date": start_date,
            "start_time": start_time,
            "end_date": None,
            "end_time": None,
            "is_all_day": False,
            "category": "music",
            "subcategory": "concert",
            "tags": sorted({
                "capitol-city-opera",
                "musical-theater",
                "performing-arts",
                "fundraiser",
                "on-the-light-side",
                "buckhead",
            }),
            "price_min": price,
            "price_max": price,  # $45 individual ticket is the ceiling; table rate is a group discount
            "price_note": f"${price:.0f} individual; $350 table of 8. Indoor picnic fundraiser with silent auction.",
            "is_free": False,
            "source_url": ON_LIGHT_SIDE_URL,
            "ticket_url": ticket_url or ON_LIGHT_SIDE_URL,
            "image_url": image_url,
            "raw_text": None,
            "extraction_confidence": 0.88,
            "is_recurring": False,
            "recurrence_rule": None,
            "content_hash": content_hash,
        }

        existing = find_event_by_hash(content_hash)
        if existing:
            smart_update_existing_event(existing, event_record)
            updated += 1
        else:
            insert_event(event_record)
            new += 1
            logger.debug("Added On the Light Side: %s", start_date)

    return found, new, updated


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Capitol City Opera Company events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    seen_hashes: set[str] = set()

    try:
        # Ensure venue records exist
        petite_violette_id = get_or_create_place(PETITE_VIOLETTE_VENUE)
        prumc_id = get_or_create_place(PRUMC_VENUE)
        # Also register CCO as an organization venue
        get_or_create_place(CCO_ORG_VENUE)

        logger.info("Crawling Capitol City Opera Company")

        # 1. Dinner and a Diva monthly series
        f, n, u = _crawl_dnd_events(source_id, petite_violette_id, seen_hashes)
        events_found += f
        events_new += n
        events_updated += u

        # 2. On the Light Side annual fundraiser
        f2, n2, u2 = _crawl_on_light_side(source_id, prumc_id, seen_hashes)
        events_found += f2
        events_new += n2
        events_updated += u2

        if seen_hashes:
            from db import remove_stale_source_events
            stale = remove_stale_source_events(source_id, seen_hashes)
            if stale:
                logger.info("Removed %s stale CCO events", stale)

        logger.info(
            "Capitol City Opera: %s found, %s new, %s updated",
            events_found, events_new, events_updated,
        )

    except Exception as exc:
        logger.error("Failed to crawl Capitol City Opera: %s", exc)
        raise

    return events_found, events_new, events_updated
