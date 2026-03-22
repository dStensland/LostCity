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
from entity_lanes import SourceEntityCapabilities, TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope
from exhibition_utils import build_exhibition_record
from utils import parse_date_range, enrich_event_record

logger = logging.getLogger(__name__)

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    events=True,
    exhibitions=True,
)

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
    "description": (
        "Hammonds House Museum is a historic house museum dedicated to African American and Haitian art, "
        "housed in the restored Victorian home of collector Dr. Otis Thrash Hammonds in Atlanta's West End. "
        "Founded in 1988, it presents rotating exhibitions and community programs celebrating the African diaspora."
    ),
    # Hours verified 2026-03-11 from hammondshousemuseum.org
    "hours": {
        "monday": "closed",
        "tuesday": "12:00-16:00",
        "wednesday": "12:00-16:00",
        "thursday": "12:00-16:00",
        "friday": "12:00-16:00",
        "saturday": "10:00-16:00",
        "sunday": "closed",
    },
    # Admission: $5 adults, $3 students/seniors; verify at box office
    "vibes": ["historic", "cultural", "art", "west-end"],
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


def normalize_ongoing_exhibit_dates(start_date: str, end_date: Optional[str]) -> tuple[str, Optional[str]]:
    """
    Keep ongoing exhibits active by normalizing the visible start date to today
    once the run has already started.
    """
    if not start_date or not end_date:
        return start_date, end_date

    today = datetime.now().date()
    start_dt = datetime.strptime(start_date, "%Y-%m-%d").date()
    end_dt = datetime.strptime(end_date, "%Y-%m-%d").date()

    if start_dt < today <= end_dt:
        return today.strftime("%Y-%m-%d"), end_date

    return start_date, end_date


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
    portal_id = source.get("portal_id")
    events_found = 0
    events_new = 0
    events_updated = 0
    exhibition_envelope = TypedEntityEnvelope()

    try:
        # ----------------------------------------------------------------
        # 0. Homepage — extract og:image for venue record
        # ----------------------------------------------------------------
        try:
            home_resp = requests.get(BASE_URL, headers=HEADERS, timeout=20)
            if home_resp.status_code == 200:
                home_soup = BeautifulSoup(home_resp.text, "html.parser")
                og_img = home_soup.find("meta", property="og:image")
                og_desc = home_soup.find("meta", property="og:description") or home_soup.find("meta", attrs={"name": "description"})
                if og_img and og_img.get("content"):
                    VENUE_DATA["image_url"] = og_img["content"]
                    logger.debug("Hammonds House: og:image = %s", og_img["content"])
                if og_desc and og_desc.get("content") and len(og_desc["content"]) > 30:
                    VENUE_DATA["description"] = og_desc["content"]
                    logger.debug("Hammonds House: og:description captured")
        except Exception as _meta_exc:
            logger.debug("Hammonds House: could not extract og meta from homepage: %s", _meta_exc)

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

                            enrich_event_record(event_record, source_name="Hammonds House Museum")

                            # Exhibit detection: route to exhibitions lane instead of events
                            exhibit_keywords = ["exhibit", "exhibition", "on view", "collection", "installation"]
                            combined_exhibit = f"{title.lower()} {(description or '').lower()}"
                            if any(kw in combined_exhibit for kw in exhibit_keywords):
                                ex_record, ex_artists = build_exhibition_record(
                                    title=title,
                                    venue_id=venue_id,
                                    source_id=source_id,
                                    opening_date=start_date,
                                    closing_date=event_record.get("end_date"),
                                    venue_name=VENUE_DATA["name"],
                                    description=description,
                                    image_url=None,
                                    source_url=event_record.get("source_url"),
                                    portal_id=portal_id,
                                    admission_type="ticketed",
                                    tags=["museum", "hammonds-house", "west-end", "african-american-art", "exhibition"],
                                )
                                if ex_artists:
                                    ex_record["artists"] = ex_artists
                                exhibition_envelope.add("exhibitions", ex_record)
                                events_found += 1
                                events_new += 1
                                logger.info(f"Queued exhibition: {title} on {start_date}")
                                continue

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
                        start_date, end_date = normalize_ongoing_exhibit_dates(start_date, end_date)
                        ex_record, ex_artists = build_exhibition_record(
                            title=exhibit_title,
                            venue_id=venue_id,
                            source_id=source_id,
                            opening_date=start_date,
                            closing_date=end_date,
                            venue_name=VENUE_DATA["name"],
                            description=f"Current exhibit at Hammonds House Museum. {on_view_line}",
                            image_url=None,
                            source_url=BASE_URL,
                            portal_id=portal_id,
                            admission_type="ticketed",
                            tags=["museum", "hammonds-house", "west-end", "african-american-art", "exhibition", "on-view"],
                        )
                        if ex_artists:
                            ex_record["artists"] = ex_artists
                        exhibition_envelope.add("exhibitions", ex_record)
                        events_found += 1
                        events_new += 1
                        logger.info(f"Queued current exhibit: {exhibit_title} ({start_date} - {end_date})")
        except Exception as e:
            logger.debug(f"Could not extract current exhibit: {e}")

        if exhibition_envelope.exhibitions:
            persist_result = persist_typed_entity_envelope(exhibition_envelope)
            skipped = persist_result.skipped.get("exhibitions", 0)
            if skipped:
                logger.warning("Hammonds House Museum: skipped %d exhibition rows", skipped)

        logger.info(f"Hammonds House Museum crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    except Exception as e:
        logger.error(f"Failed to crawl Hammonds House Museum: {e}")
        raise

    return events_found, events_new, events_updated
