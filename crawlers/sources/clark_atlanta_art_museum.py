"""
Crawler for Clark Atlanta University Art Museum (cau.edu/art-museum).
Extracts current and upcoming art exhibitions from the HBCU university museum.
"""

import logging
import re
from datetime import datetime
import requests
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.cau.edu"
CURRENT_EXHIBITIONS_URL = f"{BASE_URL}/about/cultural-contributions/clark-atlanta-university-art-museum/current-exhibitions"

VENUE_DATA = {
    "name": "Clark Atlanta University Art Museum",
    "slug": "clark-atlanta-art-museum",
    "address": "223 James P Brawley Dr SW",
    "neighborhood": "West End",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30314",
    "lat": 33.7517,
    "lng": -84.4123,
    "venue_type": "museum",
    "website": "https://www.cau.edu/art-museum/",
}


def parse_exhibition_date(date_text: str) -> tuple[str, str]:
    """
    Parse exhibition date range like "February 12 - May 1, 2026" or "February 12, 2026 - May 1, 2026".
    Returns (start_date, end_date) tuple in YYYY-MM-DD format.
    """
    if not date_text:
        return None, None

    try:
        # Clean up the text (replace em dash with regular hyphen)
        date_text = date_text.strip().replace('–', '-').replace('—', '-')

        # Pattern: "Month day - Month day, year" (e.g., "February 12 - May 1, 2026")
        match = re.search(r'(\w+)\s+(\d+)\s*-\s*(\w+)\s+(\d+),\s+(\d{4})', date_text)
        if match:
            start_month, start_day, end_month, end_day, year = match.groups()
            try:
                # Try full month name
                start_date = datetime.strptime(f"{start_month} {start_day} {year}", "%B %d %Y").strftime("%Y-%m-%d")
                end_date = datetime.strptime(f"{end_month} {end_day} {year}", "%B %d %Y").strftime("%Y-%m-%d")
                return start_date, end_date
            except ValueError:
                # Try abbreviated month name
                start_date = datetime.strptime(f"{start_month} {start_day} {year}", "%b %d %Y").strftime("%Y-%m-%d")
                end_date = datetime.strptime(f"{end_month} {end_day} {year}", "%b %d %Y").strftime("%Y-%m-%d")
                return start_date, end_date

        # Pattern: "Month day, year - Month day, year" (e.g., "February 12, 2026 - May 1, 2026")
        match = re.search(r'(\w+)\s+(\d+),\s+(\d{4})\s*-\s*(\w+)\s+(\d+),\s+(\d{4})', date_text)
        if match:
            start_month, start_day, start_year, end_month, end_day, end_year = match.groups()
            try:
                # Try full month name
                start_date = datetime.strptime(f"{start_month} {start_day} {start_year}", "%B %d %Y").strftime("%Y-%m-%d")
                end_date = datetime.strptime(f"{end_month} {end_day} {end_year}", "%B %d %Y").strftime("%Y-%m-%d")
                return start_date, end_date
            except ValueError:
                # Try abbreviated month name
                start_date = datetime.strptime(f"{start_month} {start_day} {start_year}", "%b %d %Y").strftime("%Y-%m-%d")
                end_date = datetime.strptime(f"{end_month} {end_day} {end_year}", "%b %d %Y").strftime("%Y-%m-%d")
                return start_date, end_date

        # Pattern: "Month day, year" (single date, e.g., "February 12, 2026")
        match = re.search(r'(\w+)\s+(\d+),\s+(\d{4})', date_text)
        if match:
            month, day, year = match.groups()
            try:
                # Try full month name
                date = datetime.strptime(f"{month} {day} {year}", "%B %d %Y").strftime("%Y-%m-%d")
                return date, None
            except ValueError:
                # Try abbreviated month name
                date = datetime.strptime(f"{month} {day} {year}", "%b %d %Y").strftime("%Y-%m-%d")
                return date, None

    except Exception as e:
        logger.warning(f"Failed to parse exhibition date '{date_text}': {e}")

    return None, None


def extract_exhibitions(html_content: str) -> list[dict]:
    """
    Extract exhibition data from the current exhibitions page.
    Returns list of exhibition dicts with title, date_text, description, image_url.
    """
    exhibitions = []

    try:
        soup = BeautifulSoup(html_content, 'html.parser')

        # Find all text-html paragraph widgets (exhibitions are in these sections)
        text_widgets = soup.find_all('div', class_='paragraph-widget--text-html')

        for widget in text_widgets:
            text_content = widget.find('div', class_='text-content')
            if not text_content:
                continue

            # Look for h2 (exhibition title)
            h2 = text_content.find('h2')
            if not h2:
                continue

            title = h2.get_text(strip=True)

            # Skip if it doesn't look like an exhibition title (e.g., "Our Mission")
            if title.lower() in ['our mission', 'building amenities', 'meet our partners']:
                continue

            # Get the next sibling (should be a <p> with date and description)
            description_parts = []
            date_text = None

            # Look for date in the first <p> after h2
            first_p = h2.find_next_sibling('p')
            if first_p:
                # Get all text and find date patterns
                p_text = first_p.get_text(separator=' ', strip=True)

                # Extract date pattern (e.g., "February 12 - May 1, 2026")
                date_match = re.search(r'(\w+\s+\d+\s*-\s*\w+\s+\d+,\s+\d{4})', p_text)
                if date_match:
                    date_text = date_match.group(1)
                    logger.debug(f"Found date: {date_text}")

                # Add full text as description part if it's long enough
                if len(p_text) > 50 and not p_text.startswith('ADMISSION'):
                    description_parts.append(p_text)

            # Get additional description from following <p> tags
            for sibling in h2.find_next_siblings('p')[1:]:  # Skip first <p> since we already processed it
                text = sibling.get_text(strip=True)
                if text and len(text) > 50 and not text.startswith('ADMISSION'):
                    description_parts.append(text)

            if not date_text:
                logger.debug(f"No date found for exhibition: {title}")
                continue

            # Get image if available
            image_url = None
            img = widget.find('img')
            if img and img.get('src'):
                image_url = img['src']
                if image_url and not image_url.startswith('http'):
                    image_url = BASE_URL + "/" + image_url.lstrip("/")

            description = ' '.join(description_parts).strip()

            exhibitions.append({
                'title': title,
                'date_text': date_text,
                'description': description or None,
                'image_url': image_url,
            })

            logger.debug(f"Extracted exhibition: {title} ({date_text})")

    except Exception as e:
        logger.error(f"Failed to extract exhibitions: {e}", exc_info=True)

    return exhibitions


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Clark Atlanta University Art Museum exhibitions."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        }

        # Fetch current exhibitions page
        logger.info(f"Fetching exhibitions from {CURRENT_EXHIBITIONS_URL}")
        response = requests.get(CURRENT_EXHIBITIONS_URL, headers=headers, timeout=30)
        response.raise_for_status()

        # Get or create venue
        venue_id = get_or_create_venue(VENUE_DATA)

        # Extract exhibitions from HTML
        exhibitions = extract_exhibitions(response.text)

        logger.info(f"Extracted {len(exhibitions)} exhibitions from Clark Atlanta Art Museum")

        for exhibition_data in exhibitions:
            try:
                events_found += 1

                title = exhibition_data['title']
                date_text = exhibition_data['date_text']

                # Clean up title - remove trailing colons
                if title.endswith(':'):
                    title = title[:-1].strip()

                # Parse dates
                start_date, end_date = parse_exhibition_date(date_text)
                if not start_date:
                    logger.debug(f"Could not parse date for exhibition: {title} - {date_text}")
                    continue

                # Build description
                description = exhibition_data.get('description')
                if not description or len(description) < 50:
                    description = f"Art exhibition at the Clark Atlanta University Art Museum, documenting the role of African Americans in American history and culture."

                # Truncate description if too long
                if len(description) > 500:
                    description = description[:497] + "..."

                # Build tags
                tags = ["art", "museum", "exhibition", "african-american", "hbcu", "clark-atlanta", "west-end"]

                # Add artist name tag if in title
                title_lower = title.lower()
                if ' of ' in title_lower or ':' in title:
                    # Extract artist name from patterns like "Title: Artist Name" or "Title of Artist Name"
                    artist_match = re.search(r'(?:of|:)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)', title)
                    if artist_match:
                        artist_name = artist_match.group(1).lower().replace(' ', '-')
                        tags.append(artist_name)

                # Check for duplicates
                content_hash = generate_content_hash(title, VENUE_DATA["name"], start_date)

                # Create event record
                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title,
                    "description": description,
                    "start_date": start_date,
                    "start_time": None,
                    "end_date": end_date,
                    "end_time": None,
                    "is_all_day": True,
                    "category": "art",
                    "tags": tags,
                    "price_min": None,
                    "price_max": None,
                    "price_note": "Suggested donation $3",
                    "is_free": True,
                    "source_url": CURRENT_EXHIBITIONS_URL,
                    "ticket_url": CURRENT_EXHIBITIONS_URL,
                    "image_url": exhibition_data.get('image_url'),
                    "raw_text": f"{title}\n{date_text}\n{description}",
                    "extraction_confidence": 0.90,
                    "is_recurring": False,
                    "recurrence_rule": None,
                    "content_hash": content_hash,
                }

                existing = find_event_by_hash(content_hash)
                if existing:
                    smart_update_existing_event(existing, event_record)
                    events_updated += 1
                    continue

                insert_event(event_record)
                events_new += 1
                logger.debug(f"Inserted exhibition: {title} ({start_date} - {end_date})")

            except Exception as e:
                logger.error(f"Failed to process exhibition '{exhibition_data.get('title', 'Unknown')}': {e}", exc_info=True)
                continue

        logger.info(f"Clark Atlanta Art Museum: Found {events_found} exhibitions, {events_new} new, {events_updated} existing")

    except Exception as e:
        logger.error(f"Failed to crawl Clark Atlanta Art Museum: {e}", exc_info=True)
        raise

    return events_found, events_new, events_updated
