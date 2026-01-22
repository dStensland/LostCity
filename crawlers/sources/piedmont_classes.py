"""
Crawler for Piedmont Healthcare Classes (classes.inquicker.com).

Classes include maternity education, CPR, baby basics, breastfeeding, etc.
The Inquicker platform is JavaScript-heavy - requires Playwright.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright, Page

from db import get_or_create_venue, insert_event, find_event_by_hash, get_portal_id_by_slug
from dedupe import generate_content_hash
from utils import extract_images_from_page

# Portal ID for Piedmont-exclusive events
PORTAL_SLUG = "piedmont"

logger = logging.getLogger(__name__)

BASE_URL = "https://classes.inquicker.com"
CLASSES_URL = f"{BASE_URL}/?ClientID=12422"

# Categories to crawl
CATEGORIES = [
    "Maternity Services",
    "Weight Loss & Nutrition",
    "Bone and Joint Health",
    "Community Education & Wellness",
    "Women's Health",
    "Support Groups",
    "Diabetes Health",
    "CPR and First Aid",
    "Virtual Classes",
]

# Category mappings
CATEGORY_MAP = {
    "Maternity Services": ("family", "maternity", ["maternity", "prenatal", "baby"]),
    "Weight Loss & Nutrition": ("wellness", "nutrition", ["nutrition", "weight-loss", "health"]),
    "Bone and Joint Health": ("wellness", "fitness", ["health", "orthopedic", "fitness"]),
    "Community Education & Wellness": ("learning", "health", ["health-education", "wellness"]),
    "Women's Health": ("wellness", "womens-health", ["womens-health", "health"]),
    "Support Groups": ("community", "support-group", ["support-group", "health"]),
    "Diabetes Health": ("wellness", "health", ["diabetes", "health-education"]),
    "CPR and First Aid": ("learning", "safety", ["cpr", "first-aid", "certification"]),
    "Virtual Classes": ("learning", "online", ["virtual", "online", "health"]),
}


def parse_date(date_text: str) -> Optional[str]:
    """Parse date from various formats."""
    # Match patterns like "Monday, February 16, 2026"
    match = re.search(
        r"(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+"
        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+"
        r"(\d{1,2}),?\s+(\d{4})",
        date_text,
        re.IGNORECASE
    )
    if match:
        month = match.group(2)
        day = match.group(3)
        year = match.group(4)
        try:
            dt = datetime.strptime(f"{month} {day} {year}", "%B %d %Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Match patterns like "02/16/2026"
    match = re.search(r"(\d{1,2})/(\d{1,2})/(\d{4})", date_text)
    if match:
        try:
            dt = datetime.strptime(match.group(0), "%m/%d/%Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time to HH:MM format."""
    match = re.search(r"@?\s*(\d{1,2}):(\d{2})\s*(AM|PM)", time_text, re.IGNORECASE)
    if match:
        hour = int(match.group(1))
        minute = match.group(2)
        period = match.group(3).upper()

        if period == "PM" and hour != 12:
            hour += 12
        elif period == "AM" and hour == 12:
            hour = 0

        return f"{hour:02d}:{minute}"
    return None


def parse_price(text: str) -> tuple[bool, Optional[float], Optional[float]]:
    """Parse price from text. Returns (is_free, price_min, price_max)."""
    if "FREE" in text.upper():
        return True, None, None

    match = re.search(r"\$(\d+(?:\.\d{2})?)", text)
    if match:
        price = float(match.group(1))
        return False, price, price

    return False, None, None


def get_or_create_class_venue(venue_text: str) -> Optional[int]:
    """Parse venue from class listing and get/create in database."""
    lines = venue_text.strip().split("\n")
    if len(lines) < 2:
        return None

    name = lines[0].strip()
    address_line = lines[1].strip() if len(lines) > 1 else ""

    # Parse address
    address_match = re.match(r"(.+),\s*(\w+),\s*(\w{2})\s*(\d{5})?", address_line)
    if address_match:
        address = address_match.group(1)
        city = address_match.group(2)
        state = address_match.group(3)
        zip_code = address_match.group(4) or ""
    else:
        address = address_line
        city = "Atlanta"
        state = "GA"
        zip_code = ""

    # Create slug from name
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")

    venue_data = {
        "name": name,
        "slug": slug,
        "address": address,
        "city": city,
        "state": state,
        "zip": zip_code,
        "venue_type": "hospital",
        "website": "https://www.piedmont.org",
    }

    return get_or_create_venue(venue_data)


def crawl_category(page: Page, category: str, source_id: int, portal_id: str) -> tuple[int, int, int]:
    """Crawl a single category and return (found, new, updated)."""
    events_found = 0
    events_new = 0
    events_updated = 0

    cat_info = CATEGORY_MAP.get(category, ("learning", "health", ["health-education"]))
    event_category, subcategory, base_tags = cat_info

    try:
        # Click category
        logger.info(f"Crawling category: {category}")
        page.click(f"text={category}", timeout=10000)
        page.wait_for_timeout(3000)

        # Extract images from page
        image_map = extract_images_from_page(page)

        # Wait for results to load
        page.wait_for_selector("text=Classes", timeout=10000)

        # Scroll to load all content
        for _ in range(3):
            page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            page.wait_for_timeout(1000)

        # Get page content
        content = page.inner_text("body")

        # Parse classes - look for pattern: Title, Description, Venue, Date, Price
        # Classes are separated by "Add to Cart" or "Add to Waitlist"
        sections = re.split(r"Add to (?:Cart|Waitlist)", content)

        for section in sections:
            lines = [l.strip() for l in section.split("\n") if l.strip()]
            if len(lines) < 5:
                continue

            # Find the class title - usually first substantial line after nav items
            title = None
            description = None
            venue_text = None
            date_text = None
            time_text = None
            price_text = None

            # UI elements and navigation items to skip
            skip_words = [
                "Classes", "Events", "Category", "Reset", "Filter", "Sort", "Home", "Search",
                "Click for More Dates", "Class Name", "Date Range", "Location", "Price",
                "View Details", "Register", "Sign Up", "Log In", "My Account", "Cart",
                "Showing", "results", "No classes", "Loading", "Please wait",
                "(Class Name", "(Date", "(Location", "(Price", "A-Z", "Z-A",
                "Ascending", "Descending", "Clear All", "Apply", "Cancel",
                category
            ]

            for i, line in enumerate(lines):
                # Skip navigation items and UI elements
                if any(sw.lower() in line.lower() for sw in skip_words) or len(line) < 10:
                    continue

                # Skip lines that look like UI controls (parentheses with sorting, buttons, etc.)
                if line.startswith("(") or line.endswith(")"):
                    continue

                # Skip lines that are just numbers or very short
                if re.match(r"^\d+$", line) or re.match(r"^[A-Z]{1,3}$", line):
                    continue

                # First substantial line is likely the title - must look like a class name
                # Good titles usually have multiple words and don't contain certain patterns
                if not title and len(line) > 15 and len(line) < 100:
                    # Skip if it looks like a button or UI element
                    if re.match(r"^(Click|View|Show|Hide|Select|Choose|More|See|Get)\s", line, re.IGNORECASE):
                        continue
                    title = line
                    continue

                # Description follows title
                if title and not description and len(line) > 50:
                    description = line[:500]
                    continue

                # Look for venue (contains "Piedmont" or address pattern)
                if "Piedmont" in line and not venue_text:
                    # Get venue name and address (next line)
                    venue_lines = [line]
                    if i + 1 < len(lines) and re.search(r"\d+.*,.*[A-Z]{2}", lines[i + 1]):
                        venue_lines.append(lines[i + 1])
                    venue_text = "\n".join(venue_lines)
                    continue

                # Look for date
                if re.search(r"(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)", line):
                    date_text = line
                    continue

                # Look for time (@ HH:MM AM/PM)
                if re.search(r"@\s*\d{1,2}:\d{2}\s*(AM|PM)", line, re.IGNORECASE):
                    time_text = line
                    continue

                # Look for price
                if re.search(r"(\$\d+|\bFREE\b)", line, re.IGNORECASE):
                    price_text = line
                    continue

            if not title or not date_text:
                continue

            # Parse extracted data
            start_date = parse_date(date_text)
            if not start_date:
                continue

            # Skip past dates
            try:
                event_date = datetime.strptime(start_date, "%Y-%m-%d")
                if event_date.date() < datetime.now().date():
                    continue
            except ValueError:
                continue

            start_time = parse_time(time_text or date_text)
            is_free, price_min, price_max = parse_price(price_text or "")

            # Get or create venue
            venue_id = None
            venue_name = "Piedmont Healthcare"
            if venue_text:
                venue_id = get_or_create_class_venue(venue_text)
                venue_name = venue_text.split("\n")[0]

            events_found += 1

            # Generate content hash
            content_hash = generate_content_hash(title, venue_name, start_date)

            # Check if exists
            existing = find_event_by_hash(content_hash)
            if existing:
                events_updated += 1
                continue

            # Build tags
            tags = ["piedmont", "healthcare", "class"] + base_tags

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "portal_id": portal_id,
                "title": title,
                "description": description,
                "start_date": start_date,
                "start_time": start_time,
                "end_date": None,
                "end_time": None,
                "is_all_day": start_time is None,
                "category": event_category,
                "category_id": event_category,
                "subcategory": subcategory,
                "tags": tags,
                "price_min": price_min,
                "price_max": price_max,
                "price_note": "Registration required via Inquicker.",
                "is_free": is_free,
                "source_url": CLASSES_URL,
                "ticket_url": CLASSES_URL,
                "image_url": image_map.get(title),
                "raw_text": f"{title} - {start_date}",
                "extraction_confidence": 0.85,
                "is_recurring": False,
                "recurrence_rule": None,
                "content_hash": content_hash,
            }

            try:
                insert_event(event_record)
                events_new += 1
                logger.info(f"Added: {title} on {start_date}")
            except Exception as e:
                logger.error(f"Failed to insert: {title}: {e}")

        # Go back to main page for next category
        page.goto(CLASSES_URL, wait_until="networkidle", timeout=60000)
        page.wait_for_timeout(2000)

    except Exception as e:
        logger.error(f"Error crawling category {category}: {e}")
        # Try to recover by going back to main page
        try:
            page.goto(CLASSES_URL, wait_until="networkidle", timeout=60000)
            page.wait_for_timeout(2000)
        except:
            pass

    return events_found, events_new, events_updated


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Piedmont classes from Inquicker platform using Playwright."""
    source_id = source["id"]
    total_found = 0
    total_new = 0
    total_updated = 0

    # Get portal ID for Piedmont-exclusive events
    portal_id = get_portal_id_by_slug(PORTAL_SLUG)

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            logger.info(f"Fetching Piedmont Classes: {CLASSES_URL}")
            page.goto(CLASSES_URL, wait_until="networkidle", timeout=60000)
            page.wait_for_timeout(3000)

            # Crawl each category
            for category in CATEGORIES:
                try:
                    found, new, updated = crawl_category(page, category, source_id, portal_id)
                    total_found += found
                    total_new += new
                    total_updated += updated
                    logger.info(f"{category}: {found} found, {new} new, {updated} updated")
                except Exception as e:
                    logger.error(f"Failed to crawl {category}: {e}")
                    continue

            browser.close()

        logger.info(
            f"Piedmont Classes crawl complete: {total_found} found, {total_new} new, {total_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Piedmont Classes: {e}")
        raise

    return total_found, total_new, total_updated
