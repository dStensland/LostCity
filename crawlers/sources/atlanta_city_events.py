"""
Crawler for City of Atlanta Official Event Calendar (atlantaga.gov).

This is a 3-phase crawler:
1. Scrape list pages (with pagination)
2. Visit detail pages for each event
3. Follow organizer website URLs for enrichment (og:image, ticket links)

The city calendar requires Playwright due to 403 errors with simple HTTP requests.
Filters out events with PENDING permits.
"""

from __future__ import annotations

import html as html_module
import re
import time
import logging
from datetime import datetime
from typing import Optional
from urllib.parse import urljoin, urlparse

from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.atlantaga.gov"
LIST_URL_BASE = BASE_URL + "/i-want-to-/advanced-components/event-list-view/-sortn-EDate/-sortd-desc/-toggle-allupcoming"

# Category mapping keywords
CATEGORY_KEYWORDS = {
    "fitness": ["5k", "run", "walk", "marathon", "race", "fitness", "workout", "yoga"],
    "music": ["concert", "music", "band", "dj", "live music", "performance"],
    "art": ["art", "gallery", "exhibition", "artist", "mural", "sculpture"],
    "film": ["film", "movie", "screening", "cinema"],
    "food": ["food", "culinary", "tasting", "chef", "restaurant"],
    "markets": ["market", "fair", "vendor", "artisan", "craft fair"],
    "nightlife": ["pub crawl", "bar crawl", "nightlife", "party"],
}


def parse_time_12h(time_text: str) -> Optional[str]:
    """
    Parse time from '10:00 AM' or '7:30 PM' format to 24-hour HH:MM.
    """
    match = re.search(r"(\d{1,2}):(\d{2})\s*(AM|PM)", time_text, re.IGNORECASE)
    if match:
        hour, minute, period = match.groups()
        hour = int(hour)
        if period.upper() == "PM" and hour != 12:
            hour += 12
        elif period.upper() == "AM" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute}"
    return None


def parse_date_from_text(date_text: str) -> Optional[str]:
    """
    Parse date from 'MM/DD/YYYY' format to YYYY-MM-DD.
    """
    match = re.search(r"(\d{1,2})/(\d{1,2})/(\d{4})", date_text)
    if match:
        month, day, year = match.groups()
        try:
            dt = datetime(int(year), int(month), int(day))
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            return None
    return None


def parse_datetime_range(datetime_text: str) -> tuple[Optional[str], Optional[str], Optional[str], Optional[str]]:
    """
    Parse datetime range like:
    'Date: 02/15/2026 10:00 AM - 02/15/2026 05:00 PM'
    'Date: 02/15/2026 10:00 AM - 02/16/2026 05:00 PM'

    Returns: (start_date, start_time, end_date, end_time)
    """
    # Pattern: MM/DD/YYYY HH:MM AM/PM - MM/DD/YYYY HH:MM AM/PM
    match = re.search(
        r"(\d{1,2}/\d{1,2}/\d{4})\s+(\d{1,2}:\d{2}\s+[AP]M)\s*-\s*(\d{1,2}/\d{1,2}/\d{4})\s+(\d{1,2}:\d{2}\s+[AP]M)",
        datetime_text,
        re.IGNORECASE
    )

    if match:
        start_date_str = match.group(1)
        start_time_str = match.group(2)
        end_date_str = match.group(3)
        end_time_str = match.group(4)

        start_date = parse_date_from_text(start_date_str)
        start_time = parse_time_12h(start_time_str)
        end_date = parse_date_from_text(end_date_str)
        end_time = parse_time_12h(end_time_str)

        return start_date, start_time, end_date, end_time

    # Single date pattern: Date: MM/DD/YYYY HH:MM AM/PM
    match_single = re.search(
        r"(\d{1,2}/\d{1,2}/\d{4})\s+(\d{1,2}:\d{2}\s+[AP]M)",
        datetime_text,
        re.IGNORECASE
    )

    if match_single:
        start_date_str = match_single.group(1)
        start_time_str = match_single.group(2)

        start_date = parse_date_from_text(start_date_str)
        start_time = parse_time_12h(start_time_str)

        return start_date, start_time, None, None

    # Date-only range: MM/DD/YYYY - MM/DD/YYYY (no times)
    match_range = re.search(
        r"(\d{1,2}/\d{1,2}/\d{4})\s*-\s*(\d{1,2}/\d{1,2}/\d{4})",
        datetime_text,
        re.IGNORECASE
    )
    if match_range:
        start_date = parse_date_from_text(match_range.group(1))
        end_date = parse_date_from_text(match_range.group(2))
        return start_date, None, end_date, None

    # Single date only: MM/DD/YYYY
    match_date_only = re.search(r"(\d{1,2}/\d{1,2}/\d{4})", datetime_text)
    if match_date_only:
        start_date = parse_date_from_text(match_date_only.group(1))
        return start_date, None, None, None

    return None, None, None, None


def infer_category(title: str, description: str = "") -> str:
    """
    Infer event category based on title and description keywords.
    """
    text = (title + " " + description).lower()

    for category, keywords in CATEGORY_KEYWORDS.items():
        for keyword in keywords:
            if keyword in text:
                return category

    # Check for festival/parade patterns
    if any(word in text for word in ["festival", "fest", "parade", "march", "celebration"]):
        return "community"

    return "community"


def parse_location_text(location_text: str) -> tuple[str, str]:
    """
    Parse location text into venue name and address.

    Examples:
    - "Buckhead Avenue between Piedmont and Grandview - 269 Buckhead Avenue, Atlanta, GA 30305"
      -> name: "Buckhead Avenue", address: "269 Buckhead Avenue, Atlanta, GA 30305"
    - "Broad Street Boardwalk"
      -> name: "Broad Street Boardwalk", address: "Broad Street Boardwalk, Atlanta, GA"
    - "Piedmont Park - 1320 Monroe Drive NE, Atlanta, GA 30306"
      -> name: "Piedmont Park", address: "1320 Monroe Drive NE, Atlanta, GA 30306"
    """
    location_text = location_text.strip()

    # Pattern: "Name - Address"
    if " - " in location_text:
        parts = location_text.split(" - ", 1)
        venue_name = parts[0].strip()
        address = parts[1].strip()
        return venue_name, address

    # If it looks like a full address (has street number), use as both
    if re.match(r"\d+\s+", location_text):
        return location_text.split(",")[0].strip(), location_text

    # Otherwise, treat as venue name and construct basic address
    return location_text, f"{location_text}, Atlanta, GA"


def extract_organizer_website(detail_html: str) -> Optional[str]:
    """
    Extract organizer website URL from event detail page HTML.
    The detail pages show the organizer's URL as a plain <a> tag (e.g., www.atlantadowntown.com).
    """
    soup = BeautifulSoup(detail_html, "html.parser")

    # Collect all external links (excluding atlantaga.gov, mailto, calendar, etc.)
    skip_patterns = ["atlantaga.gov", "mailto:", "addtocalendar", "javascript:", "#"]
    candidates = []

    for link in soup.find_all("a", href=True):
        href = link.get("href", "").strip()
        if not href:
            continue
        if any(skip in href.lower() for skip in skip_patterns):
            continue
        # Filter bare protocol-only URLs
        if href in ("http://", "https://", "http:", "https:"):
            continue
        parsed = urlparse(href)
        if href.startswith("http") and parsed.netloc and len(parsed.netloc) > 3:
            candidates.append(href)
        elif href.startswith("www.") and len(href) > 5:
            candidates.append(f"https://{href}")

    # Return the first external link (these pages typically have just one organizer link)
    return candidates[0] if candidates else None


def scrape_organizer_website(url: str, page, max_wait: int = 5000) -> dict:
    """
    Visit organizer website and extract og:image, og:description, and ticket links.

    Returns dict with: image_url, description, ticket_url, status
    """
    result = {
        "image_url": None,
        "description": None,
        "ticket_url": None,
        "status": "success"
    }

    try:
        logger.debug(f"Visiting organizer website: {url}")
        response = page.goto(url, wait_until="domcontentloaded", timeout=max_wait)

        if not response or response.status >= 400:
            logger.warning(f"Organizer website returned {response.status if response else 'no response'}: {url}")
            result["status"] = "error"
            return result

        page.wait_for_timeout(1000)

        html = page.content()
        soup = BeautifulSoup(html, "html.parser")

        # Extract og:image
        og_image = soup.find("meta", property="og:image")
        if og_image and og_image.get("content"):
            result["image_url"] = og_image["content"]

        # Extract og:description (prefer over city permit description)
        og_description = soup.find("meta", property="og:description")
        if og_description and og_description.get("content"):
            result["description"] = og_description["content"].strip()

        # Look for ticket/registration links
        ticketing_domains = ["eventbrite", "ticketmaster", "universe", "showclix", "brownpapertickets", "tix", "ticket"]
        for link in soup.find_all("a", href=True):
            href = link.get("href", "").lower()
            link_text = link.get_text().lower()
            if any(domain in href for domain in ticketing_domains) or any(word in link_text for word in ["tickets", "buy", "register", "rsvp"]):
                result["ticket_url"] = link["href"]
                break

        logger.debug(f"Enriched from {url}: image={bool(result['image_url'])}, desc={bool(result['description'])}, ticket={bool(result['ticket_url'])}")

    except Exception as e:
        logger.warning(f"Failed to scrape organizer website {url}: {e}")
        result["status"] = "error"

    return result


def scrape_event_detail(detail_url: str, page) -> Optional[dict]:
    """
    Scrape a single event detail page for description, location, website, permit status.

    Returns dict with: title, description, location, website, permit_status, datetime_text
    """
    try:
        logger.debug(f"Fetching detail page: {detail_url}")
        page.goto(detail_url, wait_until="domcontentloaded", timeout=15000)
        page.wait_for_timeout(1500)

        html = page.content()
        soup = BeautifulSoup(html, "html.parser")

        # Extract full page text for parsing
        body_text = soup.get_text(separator="\n")

        # Extract title — it's the bold text before "Date:" on detail pages
        # The page <h1> is "Event List View" (section title), not the event title
        title = None
        bold = soup.find("strong") or soup.find("b")
        if bold:
            title = bold.get_text(strip=True)
        if not title:
            # Fallback: look in page title
            page_title = soup.find("title")
            if page_title:
                title = page_title.get_text(strip=True).split("|")[0].strip()
        if not title:
            title = "Unknown Event"
        # Decode HTML entities (e.g., &amp; -> &)
        title = html_module.unescape(title)

        # Extract datetime (look for "Date:" pattern — various formats)
        datetime_text = None
        # Full datetime range with times
        date_match = re.search(
            r"Date:\s*(.+?)(?=Add to my Calendar|$)",
            body_text, re.IGNORECASE | re.DOTALL
        )
        if date_match:
            datetime_text = date_match.group(1).strip()
            # Clean up multiline whitespace
            datetime_text = re.sub(r"\s+", " ", datetime_text)

        # Extract description (after "EVENT DESCRIPTION:" or "Event Description:")
        description = None
        desc_match = re.search(r"EVENT DESCRIPTION:\s*(.+?)(?=EVENT LOCATION[/\w]*:|$)", body_text, re.IGNORECASE | re.DOTALL)
        if desc_match:
            description = desc_match.group(1).strip()
            description = re.sub(r"\s+", " ", description)

        # Extract location (after "EVENT LOCATION:" or "EVENT LOCATION/ROUTE:")
        # Stop at double newline, "EVENT PERMIT", or "Return to full list"
        location = None
        loc_match = re.search(
            r"EVENT LOCATION[/\w]*:\s*(.+?)(?=\n\n|\*?EVENT PERMIT|Return to full list|$)",
            body_text, re.IGNORECASE | re.DOTALL
        )
        if loc_match:
            location = loc_match.group(1).strip()
            location = re.sub(r"\s+", " ", location)
            # Truncate at common junk suffixes
            for junk in ["EVENT PERMIT", "Return to full list", "Atlanta City Hall"]:
                idx = location.find(junk)
                if idx > 0:
                    location = location[:idx].strip().rstrip("-").strip()

        # Extract permit status (handles both *EVENT PERMIT PENDING* and EVENT PERMIT PENDING)
        permit_status = "UNKNOWN"
        if re.search(r"\*?EVENT PERM\w*T? PENDING\*?", body_text):
            permit_status = "PENDING"
        elif re.search(r"\*?EVENT PERM\w*T? ISSUED\*?", body_text):
            permit_status = "ISSUED"

        # Extract organizer website from links
        website = extract_organizer_website(html)

        return {
            "title": title,
            "description": description,
            "location": location,
            "website": website,
            "permit_status": permit_status,
            "datetime_text": datetime_text,
        }

    except Exception as e:
        logger.error(f"Failed to scrape detail page {detail_url}: {e}")
        return None


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl City of Atlanta official event calendar.

    3-phase process:
    1. Scrape list pages with pagination
    2. Visit detail pages for each event
    3. Follow organizer websites for enrichment
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        with sync_playwright() as p:
            # Use Firefox — Akamai WAF blocks Chromium's TLS fingerprint
            browser = p.firefox.launch(headless=True)
            context = browser.new_context(
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            # Phase 1: Scrape list pages
            logger.info("Phase 1: Scraping event list pages")
            event_detail_urls = []

            # Iterate through pages (estimate 7 pages with 20 events each)
            # Page 1 has no -npage- param; pages 2+ use -npage-N
            for page_num in range(1, 10):
                list_url = LIST_URL_BASE if page_num == 1 else f"{LIST_URL_BASE}/-npage-{page_num}"
                logger.info(f"Fetching list page {page_num}: {list_url}")

                try:
                    response = page.goto(list_url, wait_until="domcontentloaded", timeout=20000)

                    if not response or response.status >= 400:
                        logger.warning(f"List page {page_num} returned error {response.status if response else 'no response'}")
                        break

                    page.wait_for_timeout(2000)

                    html = page.content()
                    soup = BeautifulSoup(html, "html.parser")

                    # Find event links (pattern: /Home/Components/Calendar/Event/{id}/...)
                    event_links = soup.find_all("a", href=re.compile(r"/Home/Components/Calendar/Event/\d+"))

                    if not event_links:
                        logger.info(f"No events found on page {page_num}, stopping pagination")
                        break

                    new_on_page = 0
                    for link in event_links:
                        href = link.get("href")
                        if href:
                            full_url = urljoin(BASE_URL, href)
                            if full_url not in event_detail_urls:
                                event_detail_urls.append(full_url)
                                new_on_page += 1

                    logger.info(f"Found {len(event_links)} event links on page {page_num} ({new_on_page} new)")

                    # Stop if this page had no new events (pagination wrapping)
                    if new_on_page == 0:
                        logger.info(f"No new events on page {page_num}, stopping pagination")
                        break

                    # Respectful delay between pages
                    time.sleep(1)

                except Exception as e:
                    logger.error(f"Error fetching list page {page_num}: {e}")
                    break

            logger.info(f"Phase 1 complete: Found {len(event_detail_urls)} unique events")

            # Phase 2 & 3: Visit detail pages and enrich from organizer websites
            logger.info("Phase 2 & 3: Processing event details and enrichment")

            for idx, detail_url in enumerate(event_detail_urls, 1):
                try:
                    logger.info(f"Processing event {idx}/{len(event_detail_urls)}: {detail_url}")

                    # Phase 2: Scrape detail page
                    event_data = scrape_event_detail(detail_url, page)

                    if not event_data:
                        logger.warning(f"Failed to parse event detail: {detail_url}")
                        continue

                    # Skip events with pending permits
                    if event_data["permit_status"] == "PENDING":
                        logger.info(f"Skipping event with pending permit: {event_data['title']}")
                        continue

                    # Skip events with no location
                    if not event_data["location"]:
                        logger.warning(f"Skipping event with no location: {event_data['title']}")
                        continue

                    # Parse datetime
                    if not event_data["datetime_text"]:
                        logger.warning(f"Skipping event with no datetime: {event_data['title']}")
                        continue

                    start_date, start_time, end_date, end_time = parse_datetime_range(event_data["datetime_text"])

                    if not start_date:
                        logger.warning(f"Could not parse date for: {event_data['title']}")
                        continue

                    # Skip past events
                    try:
                        event_dt = datetime.strptime(start_date, "%Y-%m-%d")
                        if event_dt.date() < datetime.now().date():
                            logger.debug(f"Skipping past event: {event_data['title']} on {start_date}")
                            continue
                    except ValueError:
                        pass

                    events_found += 1

                    # Parse location into venue
                    venue_name, address = parse_location_text(event_data["location"])

                    # Determine venue type
                    venue_type = "event_space"
                    location_lower = event_data["location"].lower()
                    if any(word in location_lower for word in ["park", "trail", "green", "plaza", "garden"]):
                        venue_type = "park"
                    elif any(word in location_lower for word in ["stadium", "arena", "dome"]):
                        venue_type = "arena"
                    elif any(word in location_lower for word in ["museum", "gallery"]):
                        venue_type = "museum"

                    # Parse address components
                    address_parts = address.split(",")
                    street_address = address_parts[0].strip() if len(address_parts) > 0 else address
                    city = "Atlanta"
                    state = "GA"
                    zip_code = None

                    # Extract city/state/zip if present
                    if len(address_parts) >= 2:
                        for part in address_parts[1:]:
                            part = part.strip()
                            if re.match(r"[A-Z]{2}", part):
                                state = part
                            elif re.search(r"\d{5}", part):
                                zip_match = re.search(r"\d{5}", part)
                                zip_code = zip_match.group(0)
                            elif not part.upper() in ["GA", "GEORGIA"] and len(part) > 2:
                                city = part

                    venue_data = {
                        "name": venue_name,
                        "slug": re.sub(r"[^a-z0-9]+", "-", venue_name.lower()).strip("-"),
                        "address": street_address,
                        "city": city,
                        "state": state,
                        "zip": zip_code,
                        "venue_type": venue_type,
                        "website": BASE_URL,
                    }

                    venue_id = get_or_create_venue(venue_data)

                    # Infer category
                    category = infer_category(event_data["title"], event_data["description"] or "")

                    # Phase 3: Enrich from organizer website if available
                    enrichment = {"image_url": None, "description": event_data["description"], "ticket_url": None}
                    source_url = detail_url  # Default to city page

                    if event_data["website"]:
                        enrichment = scrape_organizer_website(event_data["website"], page)

                        # Use organizer website as source_url if it loaded successfully
                        if enrichment["status"] == "success":
                            source_url = event_data["website"]

                        # Prefer enriched description if available and longer
                        if enrichment["description"] and (not event_data["description"] or len(enrichment["description"]) > len(event_data["description"])):
                            enrichment["description"] = enrichment["description"]
                        else:
                            enrichment["description"] = event_data["description"]

                        time.sleep(0.5)  # Rate limiting

                    # Generate content hash for deduplication
                    content_hash = generate_content_hash(event_data["title"], venue_name, start_date)

                    # City-permitted events without times are all-day outdoor events
                    is_all_day = False
                    if not start_time:
                        is_all_day = True

                    # Create event record
                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": event_data["title"],
                        "description": enrichment["description"],
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": end_date,
                        "end_time": end_time,
                        "is_all_day": is_all_day,
                        "category": category,
                        "subcategory": None,
                        "tags": ["atlanta", "city-event", category],
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": False,
                        "source_url": source_url,
                        "ticket_url": enrichment["ticket_url"],
                        "image_url": enrichment["image_url"],
                        "is_recurring": False,
                        "content_hash": content_hash,
                    }

                    existing = find_event_by_hash(content_hash)
                    if existing:
                        smart_update_existing_event(existing, event_record)
                        events_updated += 1
                        logger.debug(f"Event updated: {event_data['title']}")
                        continue

                    insert_event(event_record)
                    events_new += 1
                    logger.info(f"Added: {event_data['title']} on {start_date} at {venue_name}")

                    # Rate limiting
                    time.sleep(0.8)

                except Exception as e:
                    logger.error(f"Error processing event {detail_url}: {e}")
                    continue

            browser.close()

        logger.info(
            f"City of Atlanta crawl complete: {events_found} found, "
            f"{events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl City of Atlanta events: {e}")
        raise

    return events_found, events_new, events_updated
