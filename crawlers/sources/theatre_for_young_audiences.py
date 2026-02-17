"""
Crawler for Alliance Theatre's Theatre for Young Audiences.

Dedicated crawler for Alliance Theatre's family programming, including:
- Theatre for Young Audiences (Goizueta Stage)
- Bernhardt Theatre for the Very Young
- The Underground Rep (teen programming)

Website: alliancetheatre.org/family-programming
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from utils import extract_images_from_page, normalize_time_format

logger = logging.getLogger(__name__)

BASE_URL = "https://www.alliancetheatre.org"
FAMILY_PROGRAMMING_URL = f"{BASE_URL}/family-programming/"
THEATRE_YOUNG_AUDIENCES_URL = f"{BASE_URL}/family-programming/theatre-young-audiences/"
BERNHARDT_URL = f"{BASE_URL}/family-programming/bernhardt-theatre-the-very-young/"
UNDERGROUND_REP_URL = f"{BASE_URL}/family-programming/underground-rep/"
SHOWS_URL = f"{BASE_URL}/shows/"

# Alliance Theatre venue data
ALLIANCE_THEATRE_VENUE = {
    "name": "Alliance Theatre",
    "slug": "alliance-theatre",
    "address": "1280 Peachtree St NE",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30309",
    "venue_type": "theater",
    "website": BASE_URL,
}

# Date patterns
DATE_PATTERN = re.compile(r"(\d{2}/\d{2}/\d{4})\s*[–-]\s*(\d{2}/\d{2}/\d{4})")
SINGLE_DATE_PATTERN = re.compile(r"(\d{2}/\d{2}/\d{4})")
MONTH_DAY_PATTERN = re.compile(
    r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:,?\s+(\d{4}))?",
    re.IGNORECASE
)


def parse_date(date_str: str) -> Optional[str]:
    """Parse MM/DD/YYYY to YYYY-MM-DD."""
    try:
        dt = datetime.strptime(date_str.strip(), "%m/%d/%Y")
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        return None


def parse_date_range(line: str) -> tuple[Optional[str], Optional[str]]:
    """Parse date range from line like '01/17/2026 – 02/22/2026'."""
    # Try range first
    match = DATE_PATTERN.search(line)
    if match:
        start = parse_date(match.group(1))
        end = parse_date(match.group(2))
        return start, end

    # Try single date
    match = SINGLE_DATE_PATTERN.search(line)
    if match:
        start = parse_date(match.group(1))
        return start, None

    # Try month day format
    match = MONTH_DAY_PATTERN.search(line)
    if match:
        month_name, day, year = match.groups()
        year = year or str(datetime.now().year)
        try:
            dt = datetime.strptime(f"{month_name} {day}, {year}", "%B %d, %Y")
            return dt.strftime("%Y-%m-%d"), None
        except ValueError:
            pass

    return None, None


def parse_time_text(time_text: str) -> Optional[str]:
    """
    Parse time text from theater shows.
    Examples: "8:00 PM", "7:30pm", "2:00 PM"

    Returns:
        Time in HH:MM format (24-hour), or None if unparseable
    """
    if not time_text:
        return None

    return normalize_time_format(time_text)


def extract_price_info(text: str) -> tuple[Optional[float], Optional[float], Optional[str], bool]:
    """
    Extract price information from text.

    Returns:
        Tuple of (price_min, price_max, price_note, is_free)
    """
    text_lower = text.lower()

    # Check for free
    if "free" in text_lower or "no admission" in text_lower:
        return 0, 0, "Free", True

    # Find dollar amounts
    amounts = re.findall(r'\$(\d+(?:\.\d{2})?)', text)

    if not amounts:
        return None, None, None, False

    amounts = [float(a) for a in amounts]

    return min(amounts), max(amounts), None, False


def determine_show_type(title: str, description: str = "") -> tuple[str, list[str]]:
    """
    Determine show subcategory and base tags from title and description.

    Returns:
        Tuple of (subcategory, tags)
    """
    title_lower = title.lower()
    desc_lower = description.lower()
    combined = f"{title_lower} {desc_lower}"

    tags = ["theater", "family-friendly", "alliance-theatre", "kids"]

    # Determine subcategory
    subcategory = "play"

    if any(w in combined for w in ["musical", "music", "songs"]):
        subcategory = "musical"
        tags.append("musical")
    elif any(w in combined for w in ["puppet", "puppets", "puppetry"]):
        subcategory = "puppet-show"
        tags.append("puppets")
    elif "very young" in combined or "ages 0-" in combined or "ages 1-" in combined:
        tags.append("toddler")
        tags.append("preschool")
    elif "teen" in combined or "underground rep" in combined:
        tags.append("teen")
        tags.remove("kids")  # teens, not young kids

    # Add age-specific tags
    if any(w in combined for w in ["ages 3-", "ages 4-", "ages 5-"]):
        tags.append("preschool")
    if any(w in combined for w in ["ages 6-", "ages 7-", "ages 8-", "ages 9-", "ages 10-"]):
        tags.append("elementary")

    return subcategory, tags


def extract_shows_from_page(page, source_id: int, venue_id: int, page_url: str, page_type: str) -> tuple[int, int, int]:
    """
    Extract shows from a family programming page.

    Args:
        page: Playwright page object
        source_id: Source ID in database
        venue_id: Venue ID in database
        page_url: URL of the page being crawled
        page_type: Type of programming (e.g., "young-audiences", "very-young", "underground-rep")

    Returns:
        Tuple of (found, new, updated)
    """
    events_found = 0
    events_new = 0
    events_updated = 0

    # Extract images from page
    image_map = extract_images_from_page(page)

    # Get all text from page
    body_text = page.inner_text("body")
    lines = [l.strip() for l in body_text.split("\n") if l.strip()]

    # Skip keywords for navigation and footer
    skip_keywords = [
        "MENU",
        "HOME",
        "SHOWS",
        "ABOUT",
        "CONTACT",
        "DONATE",
        "TICKETS",
        "BUY TICKETS",
        "GET TICKETS",
        "Box Office",
        "404.733",
        "Plan Your Visit",
        "Privacy Policy",
        "Footer",
        "Follow Us",
        "Subscribe",
        "Newsletter",
        "Facebook",
        "Instagram",
        "Twitter",
        "©",
        "Copyright",
        "1280 Peachtree",
        "Atlanta, GA",
    ]

    # Try to find show elements on the page
    show_elements = page.query_selector_all('article, .show, .event, [class*="production"], [class*="show-card"]')

    if show_elements:
        # Parse structured show elements
        for element in show_elements:
            try:
                # Extract title
                title_elem = element.query_selector('h1, h2, h3, h4, .title, [class*="title"]')
                if not title_elem:
                    continue

                title = title_elem.inner_text().strip()

                if not title or len(title) < 3:
                    continue

                # Skip navigation items
                if any(kw.lower() in title.lower() for kw in skip_keywords):
                    continue

                # Extract description
                desc_elem = element.query_selector('p, .description, [class*="description"], [class*="excerpt"]')
                description = desc_elem.inner_text().strip() if desc_elem else ""

                # Get all text from the element for date/time parsing
                element_text = element.inner_text()

                # Parse dates
                start_date, end_date = parse_date_range(element_text)
                if not start_date:
                    logger.debug(f"Could not parse date for: {title}")
                    continue

                # Try to parse time
                start_time = parse_time_text(element_text)

                # Extract price info
                price_min, price_max, price_note, is_free = extract_price_info(element_text)

                # Get event URL if available
                link_elem = element.query_selector('a')
                event_url = link_elem.get_attribute('href') if link_elem else page_url
                if event_url and not event_url.startswith('http'):
                    event_url = BASE_URL + event_url

                # Get image
                img_elem = element.query_selector('img')
                image_url = None
                if img_elem:
                    image_url = img_elem.get_attribute('src') or img_elem.get_attribute('data-src')
                    if image_url and not image_url.startswith('http'):
                        image_url = BASE_URL + image_url

                # Fallback to image map
                if not image_url and title in image_map:
                    image_url = image_map[title]

                events_found += 1

                # Generate content hash
                content_hash = generate_content_hash(
                    title, "Alliance Theatre - Theatre for Young Audiences", start_date
                )


                # Determine subcategory and tags
                subcategory, tags = determine_show_type(title, description)

                # Add page-specific tags
                if page_type == "very-young":
                    tags.append("very-young-audiences")
                    tags.append("toddler")
                elif page_type == "underground-rep":
                    tags.append("underground-rep")
                    tags.append("teen")
                elif page_type == "young-audiences":
                    tags.append("theatre-for-young-audiences")

                tags.append("woodruff-arts-center")

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title,
                    "description": description if description else None,
                    "start_date": start_date,
                    "start_time": start_time,
                    "end_date": end_date,
                    "end_time": None,
                    "is_all_day": False,
                    "category": "theater",
                    "subcategory": subcategory,
                    "tags": tags,
                    "price_min": price_min,
                    "price_max": price_max,
                    "price_note": price_note,
                    "is_free": is_free,
                    "source_url": event_url,
                    "ticket_url": event_url,
                    "image_url": image_url,
                    "raw_text": f"{title} | {element_text[:200]}"[:500],
                    "extraction_confidence": 0.85,
                    "is_recurring": end_date is not None,
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
                logger.debug(f"Error processing show element: {e}")
                continue

    else:
        # Fallback: Parse from text lines
        logger.info("No structured elements found, parsing from text lines")

        i = 0
        while i < len(lines):
            line = lines[i]

            # Skip navigation and footer
            if any(kw in line for kw in skip_keywords):
                i += 1
                continue

            # Look for potential show title (reasonable length, not a date)
            if len(line) > 10 and len(line) < 100 and not SINGLE_DATE_PATTERN.search(line):
                potential_title = line

                # Check next few lines for a date
                for j in range(i + 1, min(i + 5, len(lines))):
                    start_date, end_date = parse_date_range(lines[j])
                    if start_date:
                        # Found a show
                        events_found += 1

                        content_hash = generate_content_hash(
                            potential_title, "Alliance Theatre - Theatre for Young Audiences", start_date
                        )

                        if find_event_by_hash(content_hash):
                            events_updated += 1
                            i = j + 1
                            break

                        # Determine subcategory and tags
                        subcategory, tags = determine_show_type(potential_title)

                        if page_type == "very-young":
                            tags.append("very-young-audiences")
                            tags.append("toddler")
                        elif page_type == "underground-rep":
                            tags.append("underground-rep")
                            tags.append("teen")
                        elif page_type == "young-audiences":
                            tags.append("theatre-for-young-audiences")

                        tags.append("woodruff-arts-center")

                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": potential_title,
                            "description": None,
                            "start_date": start_date,
                            "start_time": None,
                            "end_date": end_date,
                            "end_time": None,
                            "is_all_day": True,
                            "category": "theater",
                            "subcategory": subcategory,
                            "tags": tags,
                            "price_min": None,
                            "price_max": None,
                            "price_note": None,
                            "is_free": False,
                            "source_url": page_url,
                            "ticket_url": page_url,
                            "image_url": image_map.get(potential_title),
                            "raw_text": f"{potential_title} | {lines[j]}",
                            "extraction_confidence": 0.75,
                            "is_recurring": end_date is not None,
                            "recurrence_rule": None,
                            "content_hash": content_hash,
                        }

                        try:
                            insert_event(event_record)
                            events_new += 1
                            logger.info(f"Added: {potential_title} on {start_date}")
                        except Exception as e:
                            logger.error(f"Failed to insert: {potential_title}: {e}")

                        i = j + 1
                        break

            i += 1

    return events_found, events_new, events_updated


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Alliance Theatre's Theatre for Young Audiences and family programming.

    Returns:
        Tuple of (events_found, events_new, events_updated)
    """
    source_id = source["id"]
    total_found = 0
    total_new = 0
    total_updated = 0

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            # Get or create Alliance Theatre venue
            venue_id = get_or_create_venue(ALLIANCE_THEATRE_VENUE)

            # Pages to crawl
            pages_to_crawl = [
                (THEATRE_YOUNG_AUDIENCES_URL, "young-audiences"),
                (BERNHARDT_URL, "very-young"),
                (UNDERGROUND_REP_URL, "underground-rep"),
                (FAMILY_PROGRAMMING_URL, "family-general"),
            ]

            for page_url, page_type in pages_to_crawl:
                try:
                    logger.info(f"Fetching Theatre for Young Audiences: {page_url}")
                    page.goto(page_url, wait_until="domcontentloaded", timeout=30000)
                    page.wait_for_timeout(3000)

                    # Scroll to load dynamic content
                    for _ in range(5):
                        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                        page.wait_for_timeout(1000)

                    # Accept cookies if popup appears
                    try:
                        ok_btn = page.query_selector("button:has-text('OK')")
                        if ok_btn:
                            ok_btn.click()
                            page.wait_for_timeout(500)
                    except Exception:
                        pass

                    # Extract shows from this page
                    found, new, updated = extract_shows_from_page(
                        page, source_id, venue_id, page_url, page_type
                    )
                    total_found += found
                    total_new += new
                    total_updated += updated

                    logger.info(f"Page {page_type}: {found} found, {new} new, {updated} updated")

                except PlaywrightTimeout as e:
                    logger.error(f"Timeout fetching {page_url}: {e}")
                except Exception as e:
                    logger.error(f"Error crawling {page_url}: {e}")

            browser.close()

        logger.info(
            f"Theatre for Young Audiences crawl complete: {total_found} found, {total_new} new, {total_updated} updated"
        )

    except PlaywrightTimeout as e:
        logger.error(f"Timeout during Theatre for Young Audiences crawl: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl Theatre for Young Audiences: {e}")
        raise

    return total_found, total_new, total_updated
