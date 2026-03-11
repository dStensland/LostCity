"""
Crawler for Atlanta Outdoor Club (atlantaoutdoorclub.com).

The site is server-rendered HTML. Upcoming events are listed in a table on
`/event/`, and each detail page contains usable time and location markup.
"""

from __future__ import annotations

import logging
import re
from datetime import date, datetime
from typing import Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.atlantaoutdoorclub.com"
EVENTS_URL = f"{BASE_URL}/event/"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    )
}

ORG_VENUE = {
    "name": "Atlanta Outdoor Club",
    "slug": "atlanta-outdoor-club",
    "city": "Atlanta",
    "state": "GA",
    "venue_type": "organization",
    "spot_type": "organization",
    "website": BASE_URL,
}


def parse_listing_date(date_text: str) -> Optional[str]:
    cleaned = " ".join(date_text.split())
    for fmt in ("%a, %b %d %Y", "%A, %b %d %Y", "%a, %B %d %Y", "%A, %B %d %Y"):
        try:
            return datetime.strptime(cleaned, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def parse_time_range(time_text: str) -> tuple[Optional[str], Optional[str], Optional[str], Optional[str], bool]:
    cleaned = " ".join(time_text.replace("\xa0", " ").split())
    matches = re.findall(
        r"(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+[A-Za-z]{3,9}\s+\d{1,2}\s+\d{4}\s+(\d{1,2}:\d{2})\s*(am|pm)",
        cleaned,
        re.IGNORECASE,
    )
    if len(matches) >= 2:
        start_time = _to_24h(matches[0][0], matches[0][1])
        end_time = _to_24h(matches[1][0], matches[1][1])
        return None, start_time, None, end_time, False
    if len(matches) == 1:
        start_time = _to_24h(matches[0][0], matches[0][1])
        return None, start_time, None, None, False
    return None, None, None, None, False


def _to_24h(clock: str, period: str) -> str:
    hour, minute = [int(part) for part in clock.split(":", 1)]
    period = period.lower()
    if period == "pm" and hour != 12:
        hour += 12
    if period == "am" and hour == 12:
        hour = 0
    return f"{hour:02d}:{minute:02d}"


def parse_coords(detail_soup: BeautifulSoup) -> tuple[Optional[float], Optional[float]]:
    map_link = detail_soup.select_one('a[href*="/apps/map/?lat="]')
    if not map_link:
        return None, None
    href = map_link.get("href", "")
    lat_match = re.search(r"lat=([0-9.\-]+)", href)
    lng_match = re.search(r"long=([0-9.\-]+)", href)
    if not lat_match or not lng_match:
        return None, None
    try:
        return float(lat_match.group(1)), float(lng_match.group(1))
    except ValueError:
        return None, None


def extract_detail(detail_url: str, session: requests.Session) -> dict:
    response = session.get(detail_url, headers=HEADERS, timeout=20)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")

    title = ""
    title_tag = soup.find("title")
    if title_tag:
        title = title_tag.get_text(" ", strip=True).split(" - ")[0].strip()

    location_name = ""
    location_tag = soup.select_one('[itemprop="location"] [itemprop="name"]')
    if location_tag:
        location_name = " ".join(location_tag.get_text(" ", strip=True).split())

    time_label = soup.find(string=re.compile(r"^Time:", re.IGNORECASE))
    time_text = ""
    if time_label:
        row = time_label.find_parent("tr")
        if row:
            cells = row.find_all("td")
            if len(cells) >= 3:
                time_text = " ".join(cells[2].get_text(" ", strip=True).split())

    start_date = None
    start_time = None
    end_date = None
    end_time = None
    is_all_day = False
    if time_text:
        start_date, start_time, end_date, end_time, is_all_day = parse_time_range(time_text)

    description_parts: list[str] = []
    for heading in ["Description", "Event Description", "Notes", "Meeting Place"]:
        label = soup.find(string=re.compile(rf"^{re.escape(heading)}:?", re.IGNORECASE))
        if not label:
            continue
        row = label.find_parent("tr")
        if not row:
            continue
        cells = row.find_all("td")
        if len(cells) >= 3:
            text = " ".join(cells[2].get_text(" ", strip=True).split())
            if text and text not in description_parts:
                description_parts.append(text)

    coords = parse_coords(soup)

    return {
        "title": title,
        "location_name": location_name,
        "start_date": start_date,
        "start_time": start_time,
        "end_date": end_date,
        "end_time": end_time,
        "is_all_day": is_all_day,
        "description": " ".join(description_parts)[:2000],
        "lat": coords[0],
        "lng": coords[1],
    }


def categorize_event(title: str, event_type: str) -> tuple[str, Optional[str], list[str]]:
    combined = f"{title} {event_type}".lower()
    tags = ["atlanta-outdoor-club", "outdoor", "adventure"]

    if "paddle" in combined or "canoe" in combined or "kayak" in combined or "raft" in combined:
        tags.extend(["water", "paddle"])
        return "community", "outdoor", tags
    if "bike" in combined or "cycling" in combined or "ride" in combined:
        tags.extend(["cycling"])
        return "fitness", "group-ride", tags
    if "climb" in combined or "boulder" in combined:
        tags.extend(["climbing"])
        return "fitness", "climbing", tags
    if "backpack" in combined or "camp" in combined:
        tags.extend(["backpacking", "camping"])
        return "community", "outdoor", tags
    tags.extend(["hiking"])
    return "community", "outdoor", tags


def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    session = requests.Session()
    fallback_venue_id = get_or_create_venue(ORG_VENUE)

    try:
        logger.info("Fetching Atlanta Outdoor Club listing: %s", EVENTS_URL)
        response = session.get(EVENTS_URL, headers=HEADERS, timeout=20)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")

        today = date.today()
        for row in soup.select("tr"):
            cells = row.find_all("td")
            if len(cells) < 4:
                continue

            event_date = parse_listing_date(cells[0].get_text(" ", strip=True))
            link = cells[3].find("a", href=re.compile(r"details\.asp\?eventid=", re.IGNORECASE))
            if not event_date or not link:
                continue

            if date.fromisoformat(event_date) < today:
                continue

            detail_url = urljoin(EVENTS_URL, link.get("href", ""))
            title = " ".join(link.get_text(" ", strip=True).split())
            event_type = " ".join(cells[1].get_text(" ", strip=True).split())
            difficulty = " ".join(cells[2].get_text(" ", strip=True).split())

            detail = extract_detail(detail_url, session)
            if detail.get("title"):
                title = detail["title"]

            venue_id = fallback_venue_id
            location_name = detail.get("location_name") or title
            lat = detail.get("lat")
            lng = detail.get("lng")
            if location_name and lat is not None and lng is not None:
                venue_record = {
                    "name": location_name,
                    "slug": re.sub(r"[^a-z0-9]+", "-", location_name.lower()).strip("-")[:80],
                    "city": "Atlanta",
                    "state": "GA",
                    "lat": lat,
                    "lng": lng,
                    "venue_type": "park",
                    "spot_type": "trail",
                    "website": detail_url,
                }
                try:
                    venue_id = get_or_create_venue(venue_record)
                except Exception as exc:
                    logger.debug("Falling back to org venue for %s: %s", title, exc)

            description = detail.get("description") or f"{title}. Atlanta Outdoor Club {event_type.lower()} event."
            category, subcategory, tags = categorize_event(title, event_type)
            if difficulty:
                tags.append(difficulty.lower().replace(" ", "-"))

            start_date = detail.get("start_date") or event_date
            start_time = detail.get("start_time")
            end_date = detail.get("end_date") or start_date
            end_time = detail.get("end_time")
            is_all_day = bool(detail.get("is_all_day")) and not start_time

            content_hash = generate_content_hash(title, location_name or "Atlanta Outdoor Club", start_date)
            events_found += 1

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": title[:500],
                "description": description[:2000],
                "start_date": start_date,
                "start_time": start_time,
                "end_date": end_date,
                "end_time": end_time,
                "is_all_day": is_all_day,
                "category": category,
                "subcategory": subcategory,
                "tags": tags[:10],
                "price_min": None,
                "price_max": None,
                "price_note": "Registration details on Atlanta Outdoor Club",
                "is_free": False,
                "source_url": detail_url,
                "ticket_url": detail_url,
                "image_url": None,
                "raw_text": f"{event_type} | {difficulty} | {location_name}",
                "extraction_confidence": 0.9,
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
            except Exception as exc:
                logger.error("Failed to insert Atlanta Outdoor Club event '%s': %s", title, exc)

        logger.info(
            "Atlanta Outdoor Club crawl complete: %s found, %s new, %s updated",
            events_found,
            events_new,
            events_updated,
        )
    except Exception as exc:
        logger.error("Failed to crawl Atlanta Outdoor Club: %s", exc)
        raise
    finally:
        session.close()

    return events_found, events_new, events_updated
