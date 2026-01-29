"""
Crawler for 404 Found ATL Artist Collective (404foundatl.com/upcoming-events).
Atlanta artist collective with exhibitions, workshops, and community events.
Uses Squarespace with a featured single-event layout.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Optional
from urllib.parse import urljoin

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.404foundatl.com"
EVENTS_URL = f"{BASE_URL}/upcoming-events"

MAX_EVENTS = 50

VENUE_DATA = {
    "name": "404 Found ATL",
    "slug": "404-found-atl",
    "city": "Atlanta",
    "state": "GA",
    "venue_type": "gallery",
    "website": BASE_URL,
}


def parse_date(date_text: str, year: int = None) -> Optional[str]:
    """Parse date string to 'YYYY-MM-DD'."""
    if not date_text:
        return None

    if year is None:
        year = datetime.now().year

    try:
        date_text = re.sub(r'^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s*', '', date_text, flags=re.IGNORECASE)
        date_text = date_text.strip()

        # Handle formats like "JAN 10TH" or "JANUARY 31ST"
        date_text = re.sub(r'(\d+)(ST|ND|RD|TH)', r'\1', date_text, flags=re.IGNORECASE)

        for fmt in ['%B %d, %Y', '%b %d, %Y', '%m/%d/%Y', '%Y-%m-%d', '%B %d', '%b %d']:
            try:
                dt = datetime.strptime(date_text.strip(), fmt)
                if dt.year == 1900:
                    dt = dt.replace(year=year)
                return dt.strftime('%Y-%m-%d')
            except ValueError:
                continue
        return None
    except Exception:
        return None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time string to 'HH:MM:SS' format."""
    if not time_text:
        return None

    try:
        time_text = time_text.strip().upper()
        # Remove timezone
        time_text = re.sub(r'\s*(EST|EDT|CST|CDT|PST|PDT)\s*', '', time_text)
        for fmt in ['%I:%M %p', '%I:%M%p', '%I %p', '%I%p']:
            try:
                dt = datetime.strptime(time_text, fmt)
                return dt.strftime('%H:%M:%S')
            except ValueError:
                continue
        return None
    except Exception:
        return None


def categorize_event(title: str, description: str = '') -> tuple[str, str]:
    """Determine category and subcategory."""
    combined = f"{title} {description}".lower()

    if any(w in combined for w in ['workshop', 'class']):
        return 'art', 'workshop'
    if any(w in combined for w in ['exhibition', 'exhibit', 'opening', 'gallery', 'on view', 'showcase']):
        return 'art', 'exhibition'
    if any(w in combined for w in ['market', 'fair', 'pop-up']):
        return 'markets', 'artisan'
    if any(w in combined for w in ['reception', 'opening night']):
        return 'art', 'reception'

    return 'art', 'other'


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl 404 Found ATL events page."""
    source_id = source['id']
    source_url = source.get('url', EVENTS_URL)
    producer_id = source.get('producer_id')

    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                viewport={'width': 1920, 'height': 1080},
            )
            page = context.new_page()

            logger.info(f"Fetching 404 Found ATL events: {source_url}")
            page.goto(source_url, wait_until='domcontentloaded', timeout=30000)
            page.wait_for_timeout(4000)

            for _ in range(3):
                page.evaluate('window.scrollBy(0, 1000)')
                page.wait_for_timeout(1000)

            venue_id = get_or_create_venue(VENUE_DATA)

            # Get the full page text for parsing
            body = page.query_selector('body')
            if not body:
                logger.warning("Could not find page body")
                browser.close()
                return 0, 0, 0

            full_text = body.inner_text()

            # 404 Found ATL uses a featured event layout
            # Look for date ranges like "ON VIEW: JAN 10TH - JAN 31ST"
            date_range_match = re.search(
                r'ON VIEW[:\s]+([A-Z]+)\s+(\d+)(?:ST|ND|RD|TH)?\s*[-–]\s*([A-Z]+)\s+(\d+)(?:ST|ND|RD|TH)?(?:,?\s*(\d{4}))?',
                full_text, re.IGNORECASE
            )

            # Also look for specific event dates like "CLOSING RECEPTION: SATURDAY, JAN 31ST, 2026"
            reception_match = re.search(
                r'(CLOSING\s+RECEPTION|OPENING\s+RECEPTION|RECEPTION)[:\s]+(?:[A-Z]+day,?\s+)?([A-Z]+)\s+(\d+)(?:ST|ND|RD|TH)?(?:,?\s*(\d{4}))?',
                full_text, re.IGNORECASE
            )

            # Look for time
            time_match = re.search(
                r'TIME[:\s]+(\d+:\d+)\s*(AM|PM)\s*[-–]\s*(\d+:\d+)\s*(AM|PM)',
                full_text, re.IGNORECASE
            )

            # Check if free
            is_free = 'FREE' in full_text.upper()

            # Get description - combine relevant paragraph content
            desc_blocks = page.query_selector_all('.sqs-block-content p')
            description_parts = []
            for block in desc_blocks:
                text = block.inner_text().strip()
                if len(text) > 30 and not any(skip in text.lower() for skip in ['sign up', 'email', 'copyright', '©']):
                    # Skip address-only blocks
                    if not re.match(r'^[\d\s,]+[A-Za-z]+,?\s*[A-Z]{2}\s*\d{5}', text):
                        description_parts.append(text)
                        if len(' '.join(description_parts)) > 400:
                            break
            description = ' '.join(description_parts)[:500] if description_parts else None

            # Get image
            img = page.query_selector('article img, .sqs-block-image img')
            image_url = None
            if img:
                image_url = img.get_attribute('src') or img.get_attribute('data-src')
                if image_url and not image_url.startswith('http'):
                    image_url = urljoin(BASE_URL, image_url)

            # Extract year from page if available
            year_match = re.search(r'\b(202[4-9])\b', full_text)
            event_year = int(year_match.group(1)) if year_match else datetime.now().year

            # Process exhibition (date range)
            if date_range_match:
                start_month = date_range_match.group(1)
                start_day = date_range_match.group(2)
                end_month = date_range_match.group(3)
                end_day = date_range_match.group(4)
                explicit_year = date_range_match.group(5)

                year = int(explicit_year) if explicit_year else event_year

                start_date = parse_date(f"{start_month} {start_day}", year)
                end_date = parse_date(f"{end_month} {end_day}", year)

                if start_date:
                    events_found += 1

                    # Try to extract title from description first (most reliable)
                    title = None
                    if description:
                        # Look for exhibition name patterns like "for Dreamscapes: Cosmosis, a..."
                        exhibit_match = re.search(r'for\s+([A-Z][^,]+?)(?:,\s+a\s+)', description)
                        if exhibit_match:
                            potential_title = exhibit_match.group(1).strip()
                            # Clean up - only use if it looks like a title
                            if len(potential_title) > 5 and len(potential_title) < 100:
                                title = potential_title

                    # If no title found, look for h1/h2/h3 elements
                    if not title:
                        skip_patterns = ['stay in the loop', 'sign up', 'contact', 'upcoming events',
                                         'reception', 'on view', 'closing', 'opening']
                        for heading_sel in ['h1', 'h2', 'h3']:
                            headings = page.query_selector_all(heading_sel)
                            for h in headings:
                                h_text = h.inner_text().strip()
                                if h_text and len(h_text) > 3:
                                    h_lower = h_text.lower()
                                    if not any(skip in h_lower for skip in skip_patterns):
                                        title = h_text
                                        break
                            if title:
                                break

                    if not title:
                        title = "404 Found ATL Exhibition"

                    start_time = None
                    end_time = None
                    if time_match:
                        start_time = parse_time(f"{time_match.group(1)} {time_match.group(2)}")
                        end_time = parse_time(f"{time_match.group(3)} {time_match.group(4)}")

                    category, subcategory = categorize_event(title, description or '')

                    content_hash = generate_content_hash(title, VENUE_DATA['name'], start_date)

                    existing = find_event_by_hash(content_hash)
                    if existing:
                        events_updated += 1
                    else:
                        tags = ['404-found', 'artist-collective', 'atlanta', 'exhibition', 'art']

                        event_record = {
                            'source_id': source_id,
                            'venue_id': venue_id,
                            'producer_id': producer_id,
                            'title': title[:500],
                            'description': description,
                            'start_date': start_date,
                            'start_time': start_time,
                            'end_date': end_date,
                            'end_time': end_time,
                            'is_all_day': start_time is None,
                            'category': category,
                            'subcategory': subcategory,
                            'tags': tags,
                            'price_min': None,
                            'price_max': None,
                            'price_note': 'Free' if is_free else None,
                            'is_free': is_free,
                            'source_url': source_url,
                            'ticket_url': source_url,
                            'image_url': image_url,
                            'raw_text': None,
                            'extraction_confidence': 0.80,
                            'is_recurring': False,
                            'recurrence_rule': None,
                            'content_hash': content_hash,
                        }

                        try:
                            insert_event(event_record)
                            events_new += 1
                            logger.info(f"Added exhibition: {title[:50]}... ({start_date} to {end_date})")
                        except Exception as e:
                            logger.error(f"Failed to insert event: {title[:50]}: {e}")

            # Process reception event if found
            if reception_match:
                reception_type = reception_match.group(1)
                month = reception_match.group(2)
                day = reception_match.group(3)
                explicit_year = reception_match.group(4)

                year = int(explicit_year) if explicit_year else event_year
                reception_date = parse_date(f"{month} {day}", year)

                if reception_date:
                    events_found += 1
                    reception_title = f"{reception_type.title()} at 404 Found ATL"

                    start_time = None
                    end_time = None
                    if time_match:
                        start_time = parse_time(f"{time_match.group(1)} {time_match.group(2)}")
                        end_time = parse_time(f"{time_match.group(3)} {time_match.group(4)}")

                    content_hash = generate_content_hash(reception_title, VENUE_DATA['name'], reception_date)

                    existing = find_event_by_hash(content_hash)
                    if existing:
                        events_updated += 1
                    else:
                        tags = ['404-found', 'artist-collective', 'atlanta', 'reception', 'art']

                        event_record = {
                            'source_id': source_id,
                            'venue_id': venue_id,
                            'producer_id': producer_id,
                            'title': reception_title[:500],
                            'description': description,
                            'start_date': reception_date,
                            'start_time': start_time,
                            'end_date': reception_date,
                            'end_time': end_time,
                            'is_all_day': start_time is None,
                            'category': 'art',
                            'subcategory': 'reception',
                            'tags': tags,
                            'price_min': None,
                            'price_max': None,
                            'price_note': 'Free' if is_free else None,
                            'is_free': is_free,
                            'source_url': source_url,
                            'ticket_url': source_url,
                            'image_url': image_url,
                            'raw_text': None,
                            'extraction_confidence': 0.80,
                            'is_recurring': False,
                            'recurrence_rule': None,
                            'content_hash': content_hash,
                        }

                        try:
                            insert_event(event_record)
                            events_new += 1
                            logger.info(f"Added reception: {reception_title[:50]}... on {reception_date}")
                        except Exception as e:
                            logger.error(f"Failed to insert event: {reception_title[:50]}: {e}")

            browser.close()

        logger.info(f"404 Found ATL crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    except Exception as e:
        logger.error(f"Failed to crawl 404 Found ATL: {e}")
        raise

    return events_found, events_new, events_updated
