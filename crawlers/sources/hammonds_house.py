"""
Crawler for Hammonds House Museum (hammondshousemuseum.org).
Historic house museum in West End showcasing African American and Haitian art.
Founded 1988 in restored Victorian home of Dr. Otis Thrash Hammonds.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from utils import parse_date_range, enrich_event_record

logger = logging.getLogger(__name__)

BASE_URL = "https://hammondshousemuseum.org"

VENUE_DATA = {
    "name": "Hammonds House Museum",
    "slug": "hammonds-house-museum",
    "address": "503 Peeples St SW",
    "neighborhood": "West End",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30310",
    "lat": 33.7380,
    "lng": -84.4120,
    "venue_type": "museum",
    "spot_type": "museum",
    "website": BASE_URL,
    "description": "Historic house museum showcasing African American and Haitian art in restored Victorian home.",
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
}

_INVALID_TITLES = {
    "events",
    "event",
    "programs",
    "exhibitions",
    "current exhibit",
    "exhibition history",
    "donate",
    "special event request",
    "welcome to the hammonds house museum",
}

DATE_LINE_RE = re.compile(
    r"^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+"
    r"(?:January|February|March|April|May|June|July|August|September|October|November|December|"
    r"Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2}(?:,\s*\d{4})?\s*\|",
    re.IGNORECASE,
)


def parse_date(date_str: str) -> Optional[str]:
    """Parse date from various formats."""
    date_str = date_str.strip()
    date_str = re.sub(
        r"^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+",
        "",
        date_str,
        flags=re.IGNORECASE,
    )
    now = datetime.now()

    formats = [
        "%B %d, %Y",
        "%b %d, %Y",
        "%m/%d/%Y",
        "%m/%d/%y",
    ]

    for fmt in formats:
        try:
            dt = datetime.strptime(date_str, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue

    match = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December|"
        r"Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?",
        date_str,
        re.IGNORECASE
    )
    if match:
        month_str = match.group(1)[:3]
        day = match.group(2)
        year = match.group(3) if match.group(3) else str(now.year)
        try:
            dt = datetime.strptime(f"{month_str} {day} {year}", "%b %d %Y")
            if dt.date() < now.date():
                dt = dt.replace(year=now.year + 1)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return None


def parse_time(time_str: str) -> Optional[str]:
    """Parse time from various formats."""
    match = re.search(r"(\d{1,2}):?(\d{2})?\s*(am|pm|a|p)", time_str, re.IGNORECASE)
    if match:
        hour = int(match.group(1))
        minute = int(match.group(2)) if match.group(2) else 0
        period = match.group(3).lower()
        if period in ("pm", "p") and hour != 12:
            hour += 12
        elif period in ("am", "a") and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute:02d}"
    return None


def parse_time_range(time_str: str) -> tuple[Optional[str], Optional[str]]:
    """Parse '9:30am - 11:30am' style time windows."""
    text = " ".join((time_str or "").split())
    parts = re.split(r"\s*[–-]\s*", text, maxsplit=1)
    start = parse_time(parts[0]) if parts else None
    end = parse_time(parts[1]) if len(parts) > 1 else None
    return start, end


def is_title_candidate(line: str) -> bool:
    """Heuristic filter for event title lines in plain-text page content."""
    text = " ".join((line or "").split()).strip()
    if len(text) < 5 or len(text) > 120:
        return False
    lowered = text.lower()
    if lowered in _INVALID_TITLES:
        return False
    if DATE_LINE_RE.match(text):
        return False
    if "|" in text:
        return False
    if re.search(r"\d{3}[-)\s]\d{3}", text):
        return False
    if text.count(" ") > 10 and text.endswith("."):
        return False
    if lowered.startswith(("welcome to", "experience the creative pulse", "discover dynamic programs")):
        return False
    return True


def determine_category(title: str, description: str = "") -> tuple[str, Optional[str], list[str]]:
    """Determine category based on event title and description."""
    text = (title + " " + description).lower()
    tags = ["hammonds-house", "west-end", "african-american-art", "museum"]

    if any(w in text for w in ["exhibition", "exhibit", "gallery", "opening"]):
        return "museums", "exhibition", tags + ["art", "exhibition"]
    if any(w in text for w in ["lecture", "talk", "speaker", "discussion", "panel"]):
        return "museums", "lecture", tags + ["lecture", "educational"]
    if any(w in text for w in ["workshop", "class", "hands-on"]):
        return "museums", "workshop", tags + ["workshop", "educational"]
    if any(w in text for w in ["concert", "music", "performance", "jazz"]):
        return "music", "live", tags + ["live-music"]
    if any(w in text for w in ["tour", "docent"]):
        return "museums", "tour", tags + ["tour"]
    if any(w in text for w in ["film", "movie", "screening", "documentary"]):
        return "film", "screening", tags + ["film"]
    if any(w in text for w in ["kids", "children", "family", "youth"]):
        return "family", None, tags + ["family-friendly", "kids"]

    return "museums", "special_event", tags


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Hammonds House Museum events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        venue_id = get_or_create_venue(VENUE_DATA)

        # Try multiple potential event page paths
        for path in ["/events", "/programs", "/calendar", "/whats-on", ""]:
            try:
                url = BASE_URL + path
                response = requests.get(url, headers=HEADERS, timeout=30)
                if response.status_code != 200:
                    continue

                soup = BeautifulSoup(response.text, "html.parser")

                # Look for event elements
                event_selectors = [
                    ".event", ".event-item", "[class*='event']",
                    ".program", ".calendar-item", "article",
                    ".exhibition", "[class*='exhibition']"
                ]

                for selector in event_selectors:
                    elements = soup.select(selector)
                    if not elements:
                        continue

                    for element in elements:
                        try:
                            title_elem = element.find(["h1", "h2", "h3", "h4", "a"])
                            if not title_elem:
                                continue
                            title = title_elem.get_text(strip=True)
                            if not title or len(title) < 3:
                                continue
                            if title.strip().lower() in _INVALID_TITLES:
                                continue

                            text = element.get_text()
                            if len(text) > 4500:
                                # Usually a full-page/nav container; too noisy for event extraction.
                                continue
                            if "|" not in text:
                                # Event listings on this site consistently include a date|time separator.
                                continue
                            if not re.search(r"\d{1,2}:?\d{0,2}\s*(am|pm|a|p)", text, re.I):
                                continue

                            # Look for date
                            date_match = re.search(
                                r"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+"
                                r"(January|February|March|April|May|June|July|August|September|October|November|December|"
                                r"Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2}(?:,\s*\d{4})?",
                                text,
                                re.IGNORECASE
                            )
                            if not date_match:
                                date_match = re.search(r"\d{1,2}/\d{1,2}/\d{2,4}", text)

                            if not date_match:
                                continue

                            start_date = parse_date(date_match.group())
                            if not start_date:
                                continue

                            if datetime.strptime(start_date, "%Y-%m-%d").date() < datetime.now().date():
                                continue

                            time_match = re.search(r"\d{1,2}:?\d{0,2}\s*(am|pm|a|p)", text, re.I)
                            start_time = parse_time(time_match.group()) if time_match else None

                            content_hash = generate_content_hash(title, "Hammonds House Museum", start_date)


                            # Get description
                            desc_elem = element.find("p")
                            description = desc_elem.get_text(strip=True) if desc_elem else ""

                            category, subcategory, tags = determine_category(title, description)

                            link = element.find("a", href=True)
                            event_url = link["href"] if link else url
                            if event_url.startswith("/"):
                                event_url = BASE_URL + event_url

                            # Try to extract end_date from description text
                            range_text = f"{title} {description or ''} {text[:500]}"
                            _, range_end = parse_date_range(range_text)

                            event_record = {
                                "source_id": source_id,
                                "venue_id": venue_id,
                                "title": title,
                                "description": description or f"Event at Hammonds House Museum, showcasing African American and Haitian art",
                                "start_date": start_date,
                                "start_time": start_time,
                                "end_date": range_end,
                                "end_time": None,
                                "is_all_day": False,
                                "category": category,
                                "subcategory": subcategory,
                                "tags": tags,
                                "price_min": None,
                                "price_max": None,
                                "price_note": None,
                                "is_free": False,
                                "source_url": event_url,
                                "ticket_url": event_url,
                                "image_url": None,
                                "raw_text": text[:500],
                                "extraction_confidence": 0.75,
                                "is_recurring": False,
                                "recurrence_rule": None,
                                "content_hash": content_hash,
                            }

                            # Exhibit detection
                            exhibit_keywords = ["exhibit", "exhibition", "on view", "collection", "installation"]
                            combined_exhibit = f"{title.lower()} {(description or '').lower()}"
                            if any(kw in combined_exhibit for kw in exhibit_keywords):
                                event_record["content_kind"] = "exhibit"
                                event_record["is_all_day"] = True
                                event_record["start_time"] = None

                            enrich_event_record(event_record, source_name="Hammonds House Museum")

                            existing = find_event_by_hash(content_hash)
                            if existing:
                                smart_update_existing_event(existing, event_record)
                                events_found += 1
                                events_updated += 1
                                continue

                            try:
                                insert_event(event_record)
                                events_found += 1
                                events_new += 1
                                logger.info(f"Added: {title} on {start_date}")
                            except Exception as e:
                                logger.error(f"Failed to insert: {title}: {e}")

                        except Exception as e:
                            logger.debug(f"Error parsing event: {e}")
                            continue

                    if events_new + events_updated > 0:
                        break

                if events_new + events_updated > 0:
                    break

                if path == "/events" and events_new + events_updated == 0:
                    lines = [ln.strip() for ln in soup.get_text("\n").split("\n") if ln.strip()]
                    current_title: Optional[str] = None
                    seen_hashes: set[str] = set()

                    for line in lines:
                        if is_title_candidate(line):
                            current_title = " ".join(line.split())
                            continue

                        if not DATE_LINE_RE.match(line):
                            continue
                        if not current_title:
                            continue

                        date_part, _, time_part = line.partition("|")
                        start_date = parse_date(date_part)
                        if not start_date:
                            continue
                        if datetime.strptime(start_date, "%Y-%m-%d").date() < datetime.now().date():
                            continue

                        start_time, end_time = parse_time_range(time_part)
                        content_hash = generate_content_hash(
                            current_title,
                            "Hammonds House Museum",
                            start_date,
                        )
                        if content_hash in seen_hashes:
                            continue
                        seen_hashes.add(content_hash)

                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": current_title,
                            "description": f"{current_title} at Hammonds House Museum.",
                            "start_date": start_date,
                            "start_time": start_time,
                            "end_date": None,
                            "end_time": end_time,
                            "is_all_day": False,
                            "category": "museums",
                            "subcategory": "special_event",
                            "tags": ["hammonds-house", "west-end", "museum", "community"],
                            "price_min": None,
                            "price_max": None,
                            "price_note": None,
                            "is_free": False,
                            "source_url": url,
                            "ticket_url": url,
                            "image_url": None,
                            "raw_text": line,
                            "extraction_confidence": 0.85,
                            "is_recurring": False,
                            "recurrence_rule": None,
                            "content_hash": content_hash,
                        }

                        existing = find_event_by_hash(content_hash)
                        if existing:
                            smart_update_existing_event(existing, event_record)
                            events_found += 1
                            events_updated += 1
                            continue

                        try:
                            insert_event(event_record)
                            events_found += 1
                            events_new += 1
                            logger.info(f"Added (text fallback): {current_title} on {start_date}")
                        except Exception as e:
                            logger.error(f"Failed to insert (text fallback): {current_title}: {e}")

                if events_new + events_updated > 0:
                    break

            except requests.RequestException:
                continue

        # Add current exhibit from homepage if available.
        try:
            home = requests.get(BASE_URL, headers=HEADERS, timeout=30)
            if home.status_code == 200:
                home_lines = [ln.strip() for ln in BeautifulSoup(home.text, "html.parser").get_text("\n").split("\n") if ln.strip()]
                exhibit_title = None
                on_view_line = None

                for idx, line in enumerate(home_lines):
                    lowered = line.lower()
                    if lowered == "current exhibit" and idx + 1 < len(home_lines):
                        next_line = home_lines[idx + 1].strip()
                        if is_title_candidate(next_line):
                            exhibit_title = next_line
                    if lowered.startswith("on view "):
                        on_view_line = line

                if exhibit_title and on_view_line:
                    start_date, end_date = parse_date_range(on_view_line)
                    if start_date and end_date:
                        content_hash = generate_content_hash(exhibit_title, "Hammonds House Museum", start_date)
                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": exhibit_title,
                            "description": f"Current exhibit at Hammonds House Museum. {on_view_line}",
                            "start_date": start_date,
                            "start_time": None,
                            "end_date": end_date,
                            "end_time": None,
                            "is_all_day": True,
                            "category": "museums",
                            "subcategory": "exhibition",
                            "tags": ["hammonds-house", "west-end", "museum", "exhibition", "on-view"],
                            "price_min": None,
                            "price_max": None,
                            "price_note": None,
                            "is_free": False,
                            "source_url": BASE_URL,
                            "ticket_url": BASE_URL,
                            "image_url": None,
                            "raw_text": on_view_line,
                            "extraction_confidence": 0.85,
                            "is_recurring": False,
                            "recurrence_rule": None,
                            "content_hash": content_hash,
                            "content_kind": "exhibit",
                        }

                        enrich_event_record(event_record, source_name="Hammonds House Museum")

                        existing = find_event_by_hash(content_hash)
                        if existing:
                            smart_update_existing_event(existing, event_record)
                            events_updated += 1
                        else:
                            insert_event(event_record)
                            events_new += 1
                        events_found += 1
                        logger.info(f"Added current exhibit: {exhibit_title} ({start_date} - {end_date})")
        except Exception as e:
            logger.debug(f"Could not extract current exhibit: {e}")

        logger.info(f"Hammonds House Museum crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    except Exception as e:
        logger.error(f"Failed to crawl Hammonds House Museum: {e}")
        raise

    return events_found, events_new, events_updated
