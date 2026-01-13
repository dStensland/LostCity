"""
Crawler for FanCons (fancons.com/events/schedule.php?loc=usGA).
Comprehensive fan convention database for Georgia.
Uses structured JSON-LD data embedded in pages.
"""

from __future__ import annotations

import re
import json
import logging
from datetime import datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from utils import slugify
from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://fancons.com"
SCHEDULE_URL = f"{BASE_URL}/events/schedule.php?loc=usGA"

# Convention type to category mapping
TYPE_MAP = {
    "anime": "community",
    "comic": "community",
    "gaming": "community",
    "board gaming": "community",
    "tabletop gaming": "community",
    "sci-fi": "community",
    "horror": "community",
    "furry": "community",
    "pop culture": "community",
    "cosplay": "community",
    "lego": "family",
    "pokemon": "family",
    "trading cards": "community",
}


def parse_date(date_str: str) -> Optional[str]:
    """Parse date from format like '2026-01-23'."""
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        return None


def fetch_conventions() -> list[dict]:
    """Fetch convention data from FanCons."""
    conventions = []

    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        }
        response = requests.get(SCHEDULE_URL, headers=headers, timeout=30)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "lxml")

        # Look for JSON-LD structured data
        scripts = soup.find_all("script", type="application/ld+json")
        for script in scripts:
            try:
                data = json.loads(script.string)
                if isinstance(data, list):
                    for item in data:
                        if item.get("@type") == "Event":
                            conventions.append(item)
                elif isinstance(data, dict) and data.get("@type") == "Event":
                    conventions.append(data)
            except json.JSONDecodeError:
                continue

        # Also parse the HTML table as fallback
        if not conventions:
            table = soup.find("table", {"id": "conlist"}) or soup.find("table")
            if table:
                rows = table.find_all("tr")[1:]  # Skip header
                for row in rows:
                    cells = row.find_all("td")
                    if len(cells) >= 3:
                        # Name, Dates, Venue
                        name_cell = cells[0]
                        date_cell = cells[1] if len(cells) > 1 else None
                        venue_cell = cells[2] if len(cells) > 2 else None

                        name_link = name_cell.find("a")
                        name = name_link.get_text(strip=True) if name_link else name_cell.get_text(strip=True)
                        url = name_link.get("href") if name_link else None

                        dates = date_cell.get_text(strip=True) if date_cell else ""
                        venue = venue_cell.get_text(strip=True) if venue_cell else ""

                        if name and dates:
                            conventions.append({
                                "name": name,
                                "dates": dates,
                                "location": {"name": venue} if venue else None,
                                "url": url,
                            })

        logger.info(f"Found {len(conventions)} conventions from FanCons")

    except Exception as e:
        logger.error(f"Failed to fetch FanCons: {e}")

    return conventions


def parse_convention(conv: dict) -> Optional[dict]:
    """Parse a convention into event format."""
    try:
        # Handle JSON-LD format
        name = conv.get("name") or conv.get("title", "").strip()
        if not name:
            return None

        # Dates
        start_date = None
        end_date = None

        if conv.get("startDate"):
            start_date = parse_date(conv["startDate"][:10])
        if conv.get("endDate"):
            end_date = parse_date(conv["endDate"][:10])

        # Fallback: parse from dates string like "Jan 23-25"
        if not start_date and conv.get("dates"):
            dates_text = conv["dates"]
            # "Jan 23-25" or "Feb 5-8"
            match = re.match(r"(\w+)\s+(\d+)(?:-(\d+))?", dates_text)
            if match:
                month, day1, day2 = match.groups()
                year = datetime.now().year
                for fmt in ["%b %d %Y", "%B %d %Y"]:
                    try:
                        dt = datetime.strptime(f"{month} {day1} {year}", fmt)
                        if dt < datetime.now():
                            dt = datetime.strptime(f"{month} {day1} {year + 1}", fmt)
                            year = year + 1
                        start_date = dt.strftime("%Y-%m-%d")
                        if day2:
                            end_dt = datetime.strptime(f"{month} {day2} {year}", fmt)
                            end_date = end_dt.strftime("%Y-%m-%d")
                        break
                    except ValueError:
                        continue

        if not start_date:
            return None

        # Location
        location = conv.get("location", {})
        if isinstance(location, dict):
            venue_name = location.get("name", "")
            address = location.get("address", {})
            if isinstance(address, dict):
                city = address.get("addressLocality", "Atlanta")
            else:
                city = "Atlanta"
        else:
            venue_name = str(location) if location else ""
            city = "Atlanta"

        # Extract city from venue name if it contains it
        venue_parts = venue_name.split(",")
        if len(venue_parts) > 1:
            venue_name = venue_parts[0].strip()
            city = venue_parts[-1].strip()

        if not venue_name:
            venue_name = "Atlanta Convention Venue"

        # URL
        url = conv.get("url") or ""
        if url and not url.startswith("http"):
            url = f"{BASE_URL}{url}"
        if not url:
            url = SCHEDULE_URL

        # Determine category from name
        category = "community"
        name_lower = name.lower()
        for keyword, cat in TYPE_MAP.items():
            if keyword in name_lower:
                category = cat
                break

        # Description
        description = conv.get("description")

        return {
            "title": name,
            "description": description,
            "start_date": start_date,
            "end_date": end_date,
            "venue_name": venue_name,
            "city": city,
            "category": category,
            "source_url": url,
        }

    except Exception as e:
        logger.warning(f"Failed to parse convention: {e}")
        return None


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl FanCons conventions for Georgia.
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        conventions = fetch_conventions()

        for conv in conventions:
            parsed = parse_convention(conv)
            if not parsed:
                continue

            events_found += 1

            # Create venue
            venue_data = {
                "name": parsed["venue_name"],
                "slug": slugify(parsed["venue_name"]),
                "city": parsed["city"],
                "state": "GA",
                "venue_type": "convention_center",
            }
            venue_id = get_or_create_venue(venue_data)

            # Content hash
            content_hash = generate_content_hash(
                parsed["title"],
                parsed["venue_name"],
                parsed["start_date"]
            )

            # Check for existing
            existing = find_event_by_hash(content_hash)
            if existing:
                events_updated += 1
                continue

            # Build tags from convention name
            tags = ["convention", "fancons", "geek"]
            name_lower = parsed["title"].lower()
            if "anime" in name_lower:
                tags.append("anime")
            if "comic" in name_lower:
                tags.append("comics")
            if "gaming" in name_lower or "game" in name_lower:
                tags.append("gaming")
            if "cosplay" in name_lower:
                tags.append("cosplay")

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": parsed["title"],
                "description": parsed.get("description"),
                "start_date": parsed["start_date"],
                "start_time": None,
                "end_date": parsed.get("end_date"),
                "end_time": None,
                "is_all_day": True,
                "category": parsed["category"],
                "subcategory": "convention",
                "tags": tags,
                "price_min": None,
                "price_max": None,
                "price_note": None,
                "is_free": False,
                "source_url": parsed["source_url"],
                "ticket_url": None,
                "image_url": None,
                "raw_text": None,
                "extraction_confidence": 0.90,
                "is_recurring": False,
                "recurrence_rule": None,
                "content_hash": content_hash,
            }

            try:
                insert_event(event_record)
                events_new += 1
                logger.info(f"Added: {parsed['title']} on {parsed['start_date']}")
            except Exception as e:
                logger.error(f"Failed to insert: {parsed['title']}: {e}")

        logger.info(f"FanCons crawl complete: {events_found} found, {events_new} new")

    except Exception as e:
        logger.error(f"Failed to crawl FanCons: {e}")
        raise

    return events_found, events_new, events_updated
