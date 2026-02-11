"""
Crawler for American Red Cross blood drives (redcrossblood.org).

STATUS: NOT WORKING - Strong bot protection (Akamai)

ISSUE:
The Red Cross website has very aggressive bot detection (Akamai) that blocks:
- Headless browsers
- Automated requests
- Known VPN/datacenter IPs
- Their API is explicitly disallowed in robots.txt

ATTEMPTED SOLUTIONS:
1. Playwright with stealth mode - BLOCKED
2. Non-headless browser - Works but not practical for automation
3. Direct API access - 403 Forbidden

RECOMMENDED ALTERNATIVES:
1. Manual data entry workflow for blood drives
2. RSS feed if they add one
3. Partner integration with Red Cross API (requires approval)
4. Use residential proxies with rotation
5. Scrape less frequently (weekly) with browser fingerprint rotation

Blood drives are PUBLIC HEALTH EVENTS and should go live immediately when we can access them.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime, timedelta
from typing import Optional

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.redcrossblood.org"

# Multiple Atlanta metro zip codes to search
ATLANTA_ZIPS = [
    "30301",  # Downtown
    "30306",  # Virginia-Highland
    "30308",  # Midtown
    "30312",  # Old Fourth Ward
    "30318",  # West Midtown
    "30324",  # Buckhead
    "30030",  # Decatur
    "30033",  # Decatur
    "30060",  # Marietta
    "30305",  # Buckhead
]


def infer_venue_type(sponsor_name: str) -> str:
    """Infer venue type from sponsor name."""
    name_lower = sponsor_name.lower()

    if any(word in name_lower for word in ["church", "cathedral", "chapel", "temple", "synagogue", "mosque"]):
        return "church"
    elif any(word in name_lower for word in ["community center", "recreation center", "rec center"]):
        return "community_center"
    elif any(word in name_lower for word in ["college", "university", "high school", "middle school", "elementary"]):
        return "college"
    elif any(word in name_lower for word in ["hospital", "medical center", "health center"]):
        return "venue"
    elif any(word in name_lower for word in ["library"]):
        return "library"
    elif any(word in name_lower for word in ["office", "corporate", "building"]):
        return "venue"
    else:
        return "venue"


def parse_date_time(date_str: str, time_str: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse date and time from Red Cross formats.

    Date format: "Wed, Feb 12, 2026" or "February 12, 2026"
    Time format: "1:00 PM - 6:00 PM" or "9:00 AM - 2:00 PM"

    Returns: (start_date, start_time)
    """
    try:
        # Remove day of week if present
        date_str = re.sub(r"^(Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s*", "", date_str.strip())

        # Parse date
        for fmt in ["%B %d, %Y", "%b %d, %Y", "%m/%d/%Y"]:
            try:
                dt = datetime.strptime(date_str, fmt)
                start_date = dt.strftime("%Y-%m-%d")
                break
            except ValueError:
                continue
        else:
            return None, None

        # Parse start time
        start_time = None
        if time_str:
            match = re.match(r"(\d{1,2}):(\d{2})\s*(AM|PM)", time_str, re.IGNORECASE)
            if match:
                hour, minute, period = match.groups()
                hour = int(hour)
                if period.upper() == "PM" and hour != 12:
                    hour += 12
                elif period.upper() == "AM" and hour == 12:
                    hour = 0
                start_time = f"{hour:02d}:{minute}"

        return start_date, start_time

    except Exception as e:
        logger.warning(f"Failed to parse date/time: {date_str}, {time_str}: {e}")
        return None, None


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Red Cross blood drives for Atlanta metro area.

    Note: This crawler may fail due to aggressive bot detection.
    If it consistently fails, consider:
    1. Running with headless=False
    2. Adding longer delays
    3. Using residential proxies
    4. Manual data entry as a fallback
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        with sync_playwright() as p:
            # Launch browser with anti-detection measures
            # NOTE: This site requires headless=False to bypass Akamai bot detection
            browser = p.chromium.launch(
                headless=False,  # MUST be False - Akamai blocks headless
                args=[
                    '--disable-blink-features=AutomationControlled',
                    '--disable-dev-shm-usage',
                    '--no-sandbox',
                    '--disable-web-security',
                ]
            )

            context = browser.new_context(
                user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                viewport={'width': 1920, 'height': 1080},
                locale='en-US',
                timezone_id='America/New_York',
            )

            # Remove webdriver detection
            context.add_init_script("""
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined
                });

                // Mock chrome object
                window.chrome = {
                    runtime: {}
                };

                // Mock permissions
                const originalQuery = window.navigator.permissions.query;
                window.navigator.permissions.query = (parameters) => (
                    parameters.name === 'notifications' ?
                        Promise.resolve({ state: Notification.permission }) :
                        originalQuery(parameters)
                );
            """)

            page = context.new_page()

            # Try to search multiple zip codes
            for zip_code in ATLANTA_ZIPS:
                try:
                    logger.info(f"Searching Red Cross blood drives for zip: {zip_code}")

                    # Navigate directly to results page with query params
                    # This bypasses the search form which may have more protection
                    results_url = f"{BASE_URL}/give.html/drive-results?zipSponsor={zip_code}&range=25"

                    page.goto(results_url, wait_until='domcontentloaded', timeout=30000)
                    page.wait_for_timeout(5000)  # Wait for JS to load results

                    # Check for access denied
                    page_text = page.inner_text('body')
                    if 'Access Denied' in page_text or 'permission' in page_text.lower():
                        logger.error(f"Bot detection triggered - Access Denied")
                        browser.close()
                        return 0, 0, 0

                    # Look for drive results
                    # The site typically loads results dynamically via API
                    # We'll try to parse them from the rendered HTML

                    # Wait for results to load
                    try:
                        page.wait_for_selector('[class*="drive"], [class*="result"], [data-drive-id]', timeout=10000)
                    except PlaywrightTimeout:
                        logger.warning(f"No drives found for zip {zip_code}")
                        continue

                    # Extract drive elements
                    # The exact selectors may need adjustment based on site structure
                    drive_elements = page.query_selector_all('[class*="drive-result"], [class*="drive-item"], article, .blood-drive')

                    if not drive_elements:
                        logger.info(f"No blood drives found for zip {zip_code}")
                        continue

                    logger.info(f"Found {len(drive_elements)} potential drive elements")

                    for element in drive_elements:
                        try:
                            element_text = element.inner_text()
                            element_html = element.inner_html()

                            # Extract sponsor name (drive location)
                            sponsor_match = re.search(r"(?:Sponsor|Location|at):\s*(.+?)(?:\n|$)", element_text, re.IGNORECASE)
                            if not sponsor_match:
                                # Try alternate patterns
                                lines = [l.strip() for l in element_text.split('\n') if l.strip()]
                                sponsor_name = lines[0] if lines else "Red Cross Blood Drive"
                            else:
                                sponsor_name = sponsor_match.group(1).strip()

                            # Extract address
                            address_match = re.search(
                                r"(\d+[^,\n]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Boulevard|Blvd|Lane|Ln|Way|Court|Ct|Circle|Cir|Parkway|Pkwy)[^,\n]*,\s*[^,\n]+,\s*\w{2}\s+\d{5})",
                                element_text,
                                re.IGNORECASE
                            )
                            if not address_match:
                                logger.debug(f"No address found in element: {element_text[:100]}")
                                continue

                            full_address = address_match.group(1).strip()

                            # Parse address components
                            address_parts = [p.strip() for p in full_address.split(',')]
                            if len(address_parts) < 3:
                                continue

                            street = address_parts[0]
                            city = address_parts[1]
                            state_zip = address_parts[2].strip().split()
                            state = state_zip[0] if state_zip else "GA"
                            zip_val = state_zip[1] if len(state_zip) > 1 else ""

                            # Extract date
                            date_match = re.search(
                                r"(Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})",
                                element_text,
                                re.IGNORECASE
                            )
                            if not date_match:
                                continue

                            date_str = f"{date_match.group(2)} {date_match.group(3)}, {date_match.group(4)}"

                            # Extract time range
                            time_match = re.search(r"(\d{1,2}:\d{2}\s*(?:AM|PM))\s*-\s*(\d{1,2}:\d{2}\s*(?:AM|PM))", element_text, re.IGNORECASE)
                            time_str = time_match.group(1) if time_match else ""

                            start_date, start_time = parse_date_time(date_str, time_str)

                            if not start_date:
                                continue

                            # Skip past events
                            if datetime.strptime(start_date, "%Y-%m-%d").date() < datetime.now().date():
                                continue

                            events_found += 1

                            # Create venue for drive location
                            venue_type = infer_venue_type(sponsor_name)

                            venue_data = {
                                "name": sponsor_name,
                                "slug": re.sub(r'[^a-z0-9]+', '-', sponsor_name.lower()).strip('-'),
                                "address": street,
                                "city": city,
                                "state": state,
                                "zip": zip_val,
                                "venue_type": venue_type,
                                "spot_type": venue_type,
                                "neighborhood": None,  # Will be enriched later
                                "lat": None,
                                "lng": None,
                            }

                            venue_id = get_or_create_venue(venue_data)

                            # Create event title
                            title = f"American Red Cross Blood Drive"

                            # Generate content hash
                            content_hash = generate_content_hash(
                                title,
                                sponsor_name,
                                start_date
                            )

                            # Check for existing event
                            if find_event_by_hash(content_hash):
                                events_updated += 1
                                continue

                            # Build event record
                            event_record = {
                                "source_id": source_id,
                                "venue_id": venue_id,
                                "title": title,
                                "description": f"Blood drive at {sponsor_name}. Walk-ins welcome or schedule an appointment online. Donating blood takes about an hour and can save up to three lives.",
                                "start_date": start_date,
                                "start_time": start_time,
                                "end_date": None,
                                "end_time": None,
                                "is_all_day": False,
                                "category": "community",
                                "subcategory": "health",
                                "tags": ["free", "community", "health", "blood-drive", "red-cross"],
                                "price_min": None,
                                "price_max": None,
                                "price_note": "Free to donate, no cost",
                                "is_free": True,
                                "source_url": results_url,
                                "ticket_url": f"{BASE_URL}/give.html/find-drive",
                                "image_url": "https://www.redcrossblood.org/content/dam/redcrossblood/social-media-images/FB_Donor_Image1.jpg",
                                "raw_text": element_text,
                                "extraction_confidence": 0.85,
                                "is_recurring": False,
                                "recurrence_rule": None,
                                "content_hash": content_hash,
                            }

                            try:
                                insert_event(event_record)
                                events_new += 1
                                logger.info(f"Added blood drive: {sponsor_name} on {start_date}")
                            except Exception as e:
                                logger.error(f"Failed to insert blood drive: {sponsor_name}: {e}")

                        except Exception as e:
                            logger.warning(f"Error parsing drive element: {e}")
                            continue

                    # Add delay between zip code searches to appear more human-like
                    page.wait_for_timeout(2000)

                except PlaywrightTimeout:
                    logger.warning(f"Timeout loading results for zip {zip_code}")
                    continue
                except Exception as e:
                    logger.error(f"Error crawling zip {zip_code}: {e}")
                    continue

            browser.close()

        logger.info(
            f"Red Cross blood drives crawl complete: {events_found} found, "
            f"{events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Red Cross blood drives: {e}")
        raise

    return events_found, events_new, events_updated
