#!/usr/bin/env python3
"""
Scrape operating hours from venue websites.

Looks for:
1. Schema.org JSON-LD structured data (most reliable)
2. Schema.org microdata (openingHours)
3. Common hour patterns in text

Usage:
    python scrape_venue_hours.py --limit 50
    python scrape_venue_hours.py --venue-type bar --limit 20
    python scrape_venue_hours.py --dry-run
"""

import os
import sys
import re
import json
import time
import logging
import argparse
import requests
from pathlib import Path
from typing import Optional
from bs4 import BeautifulSoup
from dotenv import load_dotenv

# Load .env file from project root
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

# Add parent to path for db module
sys.path.insert(0, str(Path(__file__).parent))
from db import get_client

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

# Request settings
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}

# Day name mappings
DAY_NAMES = {
    "monday": "mon", "mon": "mon", "mo": "mon",
    "tuesday": "tue", "tue": "tue", "tu": "tue",
    "wednesday": "wed", "wed": "wed", "we": "wed",
    "thursday": "thu", "thu": "thu", "th": "thu",
    "friday": "fri", "fri": "fri", "fr": "fri",
    "saturday": "sat", "sat": "sat", "sa": "sat",
    "sunday": "sun", "sun": "sun", "su": "sun",
}

# Schema.org day mappings
SCHEMA_DAYS = {
    "Monday": "mon",
    "Tuesday": "tue",
    "Wednesday": "wed",
    "Thursday": "thu",
    "Friday": "fri",
    "Saturday": "sat",
    "Sunday": "sun",
    "Mo": "mon", "Tu": "tue", "We": "wed", "Th": "thu",
    "Fr": "fri", "Sa": "sat", "Su": "sun",
}


def normalize_time(time_str: str) -> Optional[str]:
    """Convert time string to HH:MM format."""
    if not time_str:
        return None

    time_str = time_str.strip().lower()

    # Handle 24h format (14:00, 1400)
    match = re.match(r'^(\d{1,2}):?(\d{2})$', time_str)
    if match:
        hour = int(match.group(1))
        minute = match.group(2)
        if 0 <= hour <= 23:
            return f"{hour:02d}:{minute}"

    # Handle 12h format (2pm, 2:30pm, 2:30 pm)
    match = re.match(r'^(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)$', time_str)
    if match:
        hour = int(match.group(1))
        minute = match.group(2) or "00"
        period = match.group(3).replace(".", "")[:1]  # 'a' or 'p'

        if period == 'p' and hour != 12:
            hour += 12
        elif period == 'a' and hour == 12:
            hour = 0

        if 0 <= hour <= 23:
            return f"{hour:02d}:{minute}"

    # Handle noon/midnight
    if time_str in ['noon', '12 noon']:
        return "12:00"
    if time_str in ['midnight', '12 midnight']:
        return "00:00"

    return None


def parse_schema_hours(hours_spec: list) -> Optional[dict]:
    """Parse Schema.org openingHoursSpecification format."""
    if not hours_spec or not isinstance(hours_spec, list):
        return None

    hours = {}

    for spec in hours_spec:
        if not isinstance(spec, dict):
            continue

        # Get days
        days_of_week = spec.get("dayOfWeek", [])
        if isinstance(days_of_week, str):
            days_of_week = [days_of_week]

        opens = spec.get("opens", "")
        closes = spec.get("closes", "")

        open_time = normalize_time(opens)
        close_time = normalize_time(closes)

        if not open_time or not close_time:
            continue

        for day in days_of_week:
            # Handle full URL or short form
            day_name = day.replace("https://schema.org/", "").replace("http://schema.org/", "")
            if day_name in SCHEMA_DAYS:
                hours[SCHEMA_DAYS[day_name]] = {"open": open_time, "close": close_time}

    return hours if hours else None


def parse_opening_hours_string(hours_str: str) -> Optional[dict]:
    """
    Parse Schema.org openingHours string format.
    Examples: "Mo-Fr 09:00-17:00", "Mo,Tu,We,Th,Fr 09:00-17:00", "Sa 10:00-14:00"
    """
    if not hours_str:
        return None

    hours = {}

    # Split multiple entries (comma or space separated)
    parts = re.split(r'\s*,\s*|\s+(?=[A-Z])', hours_str)

    for part in parts:
        part = part.strip()
        if not part:
            continue

        # Match pattern: "Mo-Fr 09:00-17:00" or "Sa 10:00-14:00"
        match = re.match(r'^([A-Za-z]{2}(?:-[A-Za-z]{2})?)\s+(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$', part)
        if not match:
            continue

        days_part = match.group(1)
        open_time = normalize_time(match.group(2))
        close_time = normalize_time(match.group(3))

        if not open_time or not close_time:
            continue

        # Handle day range (Mo-Fr) or single day (Sa)
        if '-' in days_part:
            start_day, end_day = days_part.split('-')
            day_order = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]

            start_idx = day_order.index(start_day) if start_day in day_order else -1
            end_idx = day_order.index(end_day) if end_day in day_order else -1

            if start_idx >= 0 and end_idx >= 0:
                for i in range(start_idx, end_idx + 1):
                    day = SCHEMA_DAYS.get(day_order[i])
                    if day:
                        hours[day] = {"open": open_time, "close": close_time}
        else:
            day = SCHEMA_DAYS.get(days_part)
            if day:
                hours[day] = {"open": open_time, "close": close_time}

    return hours if hours else None


def get_hours_from_jsonld(soup: BeautifulSoup) -> Optional[dict]:
    """Extract hours from JSON-LD structured data."""
    scripts = soup.find_all("script", type="application/ld+json")

    for script in scripts:
        try:
            data = json.loads(script.string)

            # Handle @graph format
            if isinstance(data, dict) and "@graph" in data:
                data = data["@graph"]

            # Handle list format
            if isinstance(data, list):
                for item in data:
                    hours = extract_hours_from_schema(item)
                    if hours:
                        return hours
            else:
                hours = extract_hours_from_schema(data)
                if hours:
                    return hours
        except (json.JSONDecodeError, TypeError):
            continue

    return None


def extract_hours_from_schema(data: dict) -> Optional[dict]:
    """Extract hours from a schema.org object."""
    if not isinstance(data, dict):
        return None

    # Check if this is a LocalBusiness, Restaurant, etc.
    schema_type = data.get("@type", "")
    if isinstance(schema_type, list):
        schema_type = schema_type[0] if schema_type else ""

    # Try openingHoursSpecification (detailed format)
    hours_spec = data.get("openingHoursSpecification")
    if hours_spec:
        hours = parse_schema_hours(hours_spec)
        if hours:
            return hours

    # Try openingHours (simple format)
    opening_hours = data.get("openingHours")
    if opening_hours:
        if isinstance(opening_hours, list):
            all_hours = {}
            for oh in opening_hours:
                parsed = parse_opening_hours_string(oh)
                if parsed:
                    all_hours.update(parsed)
            if all_hours:
                return all_hours
        else:
            return parse_opening_hours_string(opening_hours)

    return None


def get_hours_from_microdata(soup: BeautifulSoup) -> Optional[dict]:
    """Extract hours from Schema.org microdata (itemprop attributes)."""
    hours = {}

    # Look for time elements with itemprop
    time_elements = soup.find_all(attrs={"itemprop": "openingHours"})

    for elem in time_elements:
        content = elem.get("content") or elem.get("datetime") or elem.get_text()
        if content:
            parsed = parse_opening_hours_string(content)
            if parsed:
                hours.update(parsed)

    return hours if hours else None


def parse_text_hours(text: str) -> Optional[dict]:
    """
    Parse hours from common text patterns.
    Examples:
    - "Monday - Friday: 9am - 5pm"
    - "Mon-Fri 9:00am-5:00pm"
    - "Sat: 10am-2pm"
    """
    hours = {}

    # Pattern: "Day(s): time - time" or "Day(s) time-time"
    # Match: Monday - Friday: 9am - 5pm, Mon-Fri 9am-5pm, Saturday 10am-2pm
    pattern = r'(?i)((?:mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\s*(?:-|to|through)\s*(?:mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)|(?:mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?))\s*:?\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)?)\s*[-–to]+\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)?)'

    matches = re.findall(pattern, text, re.IGNORECASE)

    for match in matches:
        days_str = match[0].lower().strip()
        open_str = match[1]
        close_str = match[2]

        open_time = normalize_time(open_str)
        close_time = normalize_time(close_str)

        if not open_time or not close_time:
            continue

        # Parse day range or single day
        days = parse_day_range(days_str)
        for day in days:
            hours[day] = {"open": open_time, "close": close_time}

    return hours if hours else None


def parse_day_range(days_str: str) -> list[str]:
    """Parse a day string like 'monday - friday' into list of day codes."""
    days_str = days_str.lower().strip()

    # Check for range
    range_match = re.match(r'(\w+)\s*(?:-|to|through)\s*(\w+)', days_str)
    if range_match:
        start = range_match.group(1)
        end = range_match.group(2)

        # Normalize to short codes
        start_code = DAY_NAMES.get(start[:3], start[:3])
        end_code = DAY_NAMES.get(end[:3], end[:3])

        day_order = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]

        if start_code in day_order and end_code in day_order:
            start_idx = day_order.index(start_code)
            end_idx = day_order.index(end_code)
            return day_order[start_idx:end_idx + 1]

    # Single day
    for name, code in DAY_NAMES.items():
        if days_str.startswith(name):
            return [code]

    return []


def get_hours_from_text(soup: BeautifulSoup) -> Optional[dict]:
    """Try to find hours in page text using common patterns."""
    # Look in common hour containers
    hour_selectors = [
        ".hours", ".business-hours", ".opening-hours", ".store-hours",
        "#hours", "#business-hours", "#opening-hours",
        "[class*='hour']", "[class*='schedule']",
        "footer", ".contact", "#contact",
    ]

    for selector in hour_selectors:
        try:
            elements = soup.select(selector)
            for elem in elements:
                text = elem.get_text(separator=" ", strip=True)
                hours = parse_text_hours(text)
                if hours and len(hours) >= 3:  # At least 3 days to be valid
                    return hours
        except:
            continue

    return None


def scrape_hours_from_website(url: str) -> Optional[dict]:
    """Scrape operating hours from a website."""
    try:
        response = requests.get(
            url,
            headers=HEADERS,
            timeout=10,
            allow_redirects=True
        )
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")

        # Try methods in order of reliability
        # 1. JSON-LD structured data (most reliable)
        hours = get_hours_from_jsonld(soup)
        if hours and len(hours) >= 3:
            logger.debug("  Found hours in JSON-LD")
            return hours

        # 2. Microdata
        hours = get_hours_from_microdata(soup)
        if hours and len(hours) >= 3:
            logger.debug("  Found hours in microdata")
            return hours

        # 3. Text patterns
        hours = get_hours_from_text(soup)
        if hours and len(hours) >= 3:
            logger.debug("  Found hours in text")
            return hours

        return None

    except requests.exceptions.Timeout:
        logger.debug(f"    Timeout: {url}")
        return None
    except requests.exceptions.RequestException as e:
        logger.debug(f"    Request error: {e}")
        return None
    except Exception as e:
        logger.debug(f"    Error: {e}")
        return None


def format_hours_display(hours: dict) -> str:
    """Generate a human-readable hours display string."""
    if not hours:
        return ""

    day_order = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
    day_labels = {"mon": "Mon", "tue": "Tue", "wed": "Wed", "thu": "Thu",
                  "fri": "Fri", "sat": "Sat", "sun": "Sun"}

    lines = []

    # Group consecutive days with same hours
    i = 0
    while i < len(day_order):
        day = day_order[i]
        if day not in hours:
            i += 1
            continue

        times = hours[day]
        start_day = day
        end_day = day

        # Find consecutive days with same hours
        j = i + 1
        while j < len(day_order):
            next_day = day_order[j]
            if next_day in hours and hours[next_day] == times:
                end_day = next_day
                j += 1
            else:
                break

        # Format time range
        open_time = times["open"]
        close_time = times["close"]

        # Convert to 12h format for display
        def to_12h(t):
            h, m = int(t[:2]), t[3:]
            period = "am" if h < 12 else "pm"
            h = h % 12 or 12
            return f"{h}:{m}{period}" if m != "00" else f"{h}{period}"

        time_str = f"{to_12h(open_time)}-{to_12h(close_time)}"

        if start_day == end_day:
            lines.append(f"{day_labels[start_day]}: {time_str}")
        else:
            lines.append(f"{day_labels[start_day]}-{day_labels[end_day]}: {time_str}")

        i = j

    return ", ".join(lines)


def get_venues_needing_hours(
    venue_type: Optional[str] = None,
    limit: int = 50,
) -> list[dict]:
    """Get venues that have websites but no hours."""
    client = get_client()

    query = client.table("venues").select(
        "id, name, slug, website, hours, venue_type"
    ).eq("active", True)

    # Must have website
    query = query.not_.is_("website", "null")

    # Must not have hours
    query = query.is_("hours", "null")

    if venue_type:
        query = query.eq("venue_type", venue_type)

    query = query.limit(limit)

    result = query.execute()
    return result.data or []


def update_venue_hours(venue_id: int, hours: dict, hours_display: str, dry_run: bool = False) -> bool:
    """Update venue with scraped hours."""
    if dry_run:
        return True

    client = get_client()
    try:
        updates = {"hours": hours}
        if hours_display:
            updates["hours_display"] = hours_display

        client.table("venues").update(updates).eq("id", venue_id).execute()
        return True
    except Exception as e:
        logger.error(f"    Update error: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Scrape hours from venue websites")
    parser.add_argument("--venue-type", help="Filter by venue type (bar, restaurant, etc.)")
    parser.add_argument("--limit", type=int, default=50, help="Max venues to process")
    parser.add_argument("--dry-run", action="store_true", help="Preview without updating")
    args = parser.parse_args()

    logger.info("=" * 60)
    logger.info("Scraping Venue Hours from Websites")
    logger.info("=" * 60)

    venues = get_venues_needing_hours(args.venue_type, args.limit)
    logger.info(f"Found {len(venues)} venues with websites but no hours")
    logger.info("")

    scraped = 0
    failed = 0

    for venue in venues:
        name = venue["name"]
        website = venue["website"]

        if not website:
            continue

        # Ensure URL has protocol
        if not website.startswith("http"):
            website = "https://" + website

        hours = scrape_hours_from_website(website)

        if hours:
            hours_display = format_hours_display(hours)

            if args.dry_run:
                logger.info(f"  FOUND: {name}")
                logger.info(f"         {hours_display}")
            else:
                success = update_venue_hours(venue["id"], hours, hours_display)
                if success:
                    logger.info(f"  SCRAPED: {name}")
                    logger.info(f"           {hours_display}")
                    scraped += 1
                else:
                    logger.info(f"  ERROR: {name}")
                    failed += 1
        else:
            logger.info(f"  NO HOURS: {name} ({website[:40]}...)")
            failed += 1

        # Be nice to servers
        time.sleep(1)

    logger.info("")
    logger.info("=" * 60)
    logger.info(f"Done! Scraped: {scraped}, Failed/Skipped: {failed}")
    if args.dry_run:
        logger.info("(Dry run - no changes made)")


if __name__ == "__main__":
    main()
