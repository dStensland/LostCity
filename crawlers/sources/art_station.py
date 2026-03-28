"""
Crawler for ART Station (artstation.org).
Contemporary arts center and theater company in Stone Mountain, GA.
39-year-old organization producing professional theater, gallery exhibitions,
and education programs. Uses Squarespace as CMS.

Site structure:
- Theatre season at /theatre with show list (h2/h3 headings + date lines)
- Gallery info at /gallery
- Individual show pages at /<show-slug> with performance schedule
- Ticketing via embedded links/forms on show pages

Current Season 2025-26 shows:
- The Pin-Up Girls Christmas (Dec 11-21, 2025) — past
- Tribute to Lucy & Ricky (Feb 13-14, 2026) — past
- The Hill (Apr 16-26, 2026)
- The Second-to-Last Chance Ladies League (Jun 4-14, 2026)
- Working (Jul 23 - Aug 2, 2026)
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_place, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.artstation.org"
THEATRE_URL = f"{BASE_URL}/theatre"

PLACE_DATA = {
    "name": "ART Station",
    "slug": "art-station",
    "address": "5384 Manor Dr",
    "neighborhood": "Stone Mountain",
    "city": "Stone Mountain",
    "state": "GA",
    "zip": "30083",
    "lat": 33.8087,
    "lng": -84.1688,
    "place_type": "theater",
    "spot_type": "theater",
    "website": BASE_URL,
    "vibes": ["theater", "arts"],
}

# Map show title fragments to individual show page slugs
# Populated from site research; add new shows each season
SHOW_SLUG_MAP = {
    "pin-up": "pinupchristmas",
    "lucy": "lucyandricky",
    "hill": "thehill",
    "second-to-last": "secondtolastchance",
    "ladies league": "secondtolastchance",
    "working": "working",
}

# Boilerplate strings to skip
SKIP_LINES = {
    "season 2025-2026",
    "anniversary season",
    "click here for subscription packages",
    "to purchase single tickets,",
    "please click on the show below",
    "single ticket prices",
    "past productions",
    "contact",
    "hours",
    "join our mailing list",
    "this show has already occurred, therefore, it is no longer available for purchase",
}


def is_show_title(text: str) -> bool:
    """Return True if text looks like a show title (all-caps, meaningful length)."""
    if not text or len(text) < 3 or len(text) > 200:
        return False
    text_lower = text.lower().strip()
    if text_lower in SKIP_LINES:
        return False
    if re.match(r"^(adult|senior|military|student|subscription|premium|standard|\$\d+)", text_lower):
        return False
    # Skip attribution lines ("By Author Name", "Book and Music by...")
    if re.match(r"^(by |book |music |directed |adapted |conceived |written )", text_lower):
        return False
    # Skip date-only lines ("April 16 - 26", "July 23 - Aug 2")
    if re.search(
        r"^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)",
        text, re.IGNORECASE
    ):
        return False
    # Skip lines that are just a single number or abbreviation
    if re.match(r"^\d+$|^[a-z]{1,3}$", text_lower):
        return False
    # ART Station show titles are typically ALL CAPS — this is the primary signal
    if text.isupper() and len(text) > 3:
        return True
    return False


def parse_art_station_dates(date_text: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse ART Station date formats:
    - "DEC 11-21, 2025"
    - "FEB 13 - 14, 2026"
    - "APRIL 16 - 26"  (no explicit year — assume current/next year)
    - "JUNE 4 - 14"
    - "JULY 23 - AUG 2"
    """
    if not date_text:
        return None, None

    date_text = date_text.strip()

    # Cross-month range: "JULY 23 - AUG 2" or "JULY 23 - AUG 2, 2026"
    cross_month = re.search(
        r"(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|"
        r"Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)"
        r"[\.\s]+(\d{1,2})\s*[-–—]\s*"
        r"(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|"
        r"Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)"
        r"[\.\s]+(\d{1,2}),?\s*(\d{4})?",
        date_text,
        re.IGNORECASE,
    )
    if cross_month:
        sm, sd, em, ed, year = cross_month.groups()
        year = year or _infer_year(sm, sd)
        try:
            start_dt = datetime.strptime(f"{sm} {sd} {year}", "%b %d %Y")
        except ValueError:
            try:
                start_dt = datetime.strptime(f"{sm} {sd} {year}", "%B %d %Y")
            except ValueError:
                start_dt = None
        try:
            end_dt = datetime.strptime(f"{em} {ed} {year}", "%b %d %Y")
        except ValueError:
            try:
                end_dt = datetime.strptime(f"{em} {ed} {year}", "%B %d %Y")
            except ValueError:
                end_dt = None
        if start_dt and end_dt:
            return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")

    # Same-month range: "APRIL 16 - 26" or "DEC 11-21, 2025"
    same_month = re.search(
        r"(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|"
        r"Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)"
        r"[\.\s]+(\d{1,2})\s*[-–—]\s*(\d{1,2}),?\s*(\d{4})?",
        date_text,
        re.IGNORECASE,
    )
    if same_month:
        month, start_day, end_day, year = same_month.groups()
        year = year or _infer_year(month, start_day)
        try:
            start_dt = datetime.strptime(f"{month} {start_day} {year}", "%b %d %Y")
            end_dt = datetime.strptime(f"{month} {end_day} {year}", "%b %d %Y")
        except ValueError:
            try:
                start_dt = datetime.strptime(f"{month} {start_day} {year}", "%B %d %Y")
                end_dt = datetime.strptime(f"{month} {end_day} {year}", "%B %d %Y")
            except ValueError:
                return None, None
        return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")

    # Single date
    single = re.search(
        r"(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|"
        r"Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)"
        r"[\.\s]+(\d{1,2}),?\s*(\d{4})?",
        date_text,
        re.IGNORECASE,
    )
    if single:
        month, day, year = single.groups()
        year = year or _infer_year(month, day)
        try:
            dt = datetime.strptime(f"{month} {day} {year}", "%b %d %Y")
        except ValueError:
            try:
                dt = datetime.strptime(f"{month} {day} {year}", "%B %d %Y")
            except ValueError:
                return None, None
        date_str = dt.strftime("%Y-%m-%d")
        return date_str, date_str

    return None, None


def _infer_year(month_str: str, day_str: str) -> str:
    """Infer year when not specified. If the date already passed this year, use next year."""
    now = datetime.now()
    current_year = now.year
    try:
        try:
            dt = datetime.strptime(f"{month_str} {day_str} {current_year}", "%b %d %Y")
        except ValueError:
            dt = datetime.strptime(f"{month_str} {day_str} {current_year}", "%B %d %Y")
        if dt.date() < now.date():
            return str(current_year + 1)
        return str(current_year)
    except ValueError:
        return str(current_year)


def find_show_slug(title: str) -> Optional[str]:
    """Return the URL slug for a show given its title."""
    title_lower = title.lower()
    for key, slug in SHOW_SLUG_MAP.items():
        if key in title_lower:
            return slug
    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl ART Station theatre season."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            venue_id = get_or_create_place(PLACE_DATA)

            logger.info(f"Fetching ART Station theatre season: {THEATRE_URL}")
            page.goto(THEATRE_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # ART Station uses Squarespace. The theatre page lists shows as p/h2/h3 elements.
            # Pattern: SHOW TITLE (h2/h3/p bold), then "BY AUTHOR", then "DATES", then "Learn more" link
            # We'll extract by iterating paragraphs and headings in order

            all_elements = page.query_selector_all("h2, h3, h4, p, strong")

            processed_titles: set[str] = set()
            i = 0
            while i < len(all_elements):
                try:
                    el = all_elements[i]
                    text = el.inner_text().strip()

                    if not text or not is_show_title(text):
                        i += 1
                        continue

                    # Normalize title
                    title = text.title() if text.isupper() else text

                    title_key = title.lower().strip()
                    if title_key in processed_titles:
                        i += 1
                        continue

                    # Look ahead up to 5 elements for date info
                    window_text = text
                    for j in range(1, 6):
                        if i + j < len(all_elements):
                            next_text = all_elements[i + j].inner_text().strip()
                            window_text += " " + next_text
                            if re.search(r"\d{4}|\d{1,2}\s*[-–—]\s*\d{1,2}", next_text):
                                break

                    start_date, end_date = parse_art_station_dates(window_text)

                    if not start_date:
                        i += 1
                        continue

                    # Skip past shows
                    check_date = end_date or start_date
                    try:
                        if datetime.strptime(check_date, "%Y-%m-%d").date() < datetime.now().date():
                            logger.debug(f"Skipping past show: {title}")
                            processed_titles.add(title_key)
                            i += 1
                            continue
                    except ValueError:
                        pass

                    processed_titles.add(title_key)
                    events_found += 1

                    # Find the individual show page
                    show_slug = find_show_slug(title)
                    show_url = f"{BASE_URL}/{show_slug}" if show_slug else THEATRE_URL

                    # Fetch show detail page for description, image, tickets
                    description = None
                    image_url = None
                    ticket_url = None

                    try:
                        show_page = context.new_page()
                        show_page.goto(show_url, wait_until="domcontentloaded", timeout=20000)
                        show_page.wait_for_timeout(2000)

                        # Get description from page body
                        body_text = show_page.inner_text("body")
                        # Extract meaningful paragraphs (skip nav/footer boilerplate)
                        lines = [ln.strip() for ln in body_text.split("\n") if ln.strip()]
                        desc_lines = []
                        in_desc = False
                        for line in lines:
                            if line.lower() in {"cart 0", "about", "contact", "hours", "© art station, inc."}:
                                break
                            if len(line) > 50 and not re.match(
                                r"^(skip to|auditions|end of year|about|rentals|donate|0|©|info@|770|hours|tues|sat)",
                                line, re.IGNORECASE
                            ):
                                desc_lines.append(line)
                                in_desc = True
                            if in_desc and len(desc_lines) >= 3:
                                break

                        if desc_lines:
                            description = " ".join(desc_lines)[:500]

                        # Get og:image (ART Station uses site logo as og:image, not show-specific)
                        og_img = show_page.query_selector('meta[property="og:image"]')
                        if og_img:
                            og_val = og_img.get_attribute("content") or ""
                            # Skip generic site logo
                            if "artstationtransparent" not in og_val and og_val:
                                image_url = og_val

                        # Find ticket purchase link
                        tix_links = show_page.query_selector_all('a[href*="purchase"], a[href*="ticket"], a[href*="squarespace"]')
                        for tix in tix_links:
                            href = tix.get_attribute("href") or ""
                            tix_text = tix.inner_text().strip().lower()
                            if "purchase" in tix_text or "ticket" in tix_text or "buy" in tix_text:
                                ticket_url = href if href.startswith("http") else BASE_URL + href
                                break

                        show_page.close()
                    except Exception as e:
                        logger.debug(f"Could not fetch show detail for {title}: {e}")

                    # Classify show
                    title_lower = title.lower()
                    subcategory = "play"
                    tags = ["art-station", "theater", "stone-mountain", "professional-theater"]
                    if any(w in title_lower for w in ["musical", "working", "lucy", "comedy show"]):
                        subcategory = "musical"
                        tags.append("musical")
                    elif "comedy" in title_lower or "ladies league" in title_lower:
                        subcategory = "comedy"
                        tags.append("comedy")
                    elif "christmas" in title_lower or "pin-up" in title_lower:
                        subcategory = "holiday"
                        tags.append("holiday")

                    content_hash = generate_content_hash(title, "ART Station", start_date)

                    series_hint = None
                    if end_date and end_date != start_date:
                        series_hint = {
                            "series_type": "recurring_show",
                            "series_title": title,
                        }
                        if description:
                            series_hint["description"] = description

                    event_record = {
                        "source_id": source_id,
                        "place_id": venue_id,
                        "title": title,
                        "description": description or f"{title} at ART Station",
                        "start_date": start_date,
                        "start_time": "20:00",  # Thursdays & Fridays 8pm per site
                        "end_date": end_date,
                        "end_time": None,
                        "is_all_day": False,
                        "category": "theater",
                        "subcategory": subcategory,
                        "tags": tags,
                        "price_min": 22,  # Military/student minimum
                        "price_max": 32,  # Adult maximum
                        "price_note": "Adult $32, Senior $27, Military/Student $22",
                        "is_free": False,
                        "source_url": show_url,
                        "ticket_url": ticket_url or show_url,
                        "image_url": image_url,
                        "raw_text": window_text[:300],
                        "extraction_confidence": 0.88,
                        "is_recurring": True if end_date and end_date != start_date else False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    existing = find_event_by_hash(content_hash)
                    if existing:
                        smart_update_existing_event(existing, event_record)
                        events_updated += 1
                        i += 1
                        continue

                    try:
                        insert_event(event_record, series_hint=series_hint)
                        events_new += 1
                        logger.info(f"Added: {title} ({start_date} to {end_date})")
                    except Exception as e:
                        logger.error(f"Failed to insert {title}: {e}")

                    i += 1

                except Exception as e:
                    logger.warning(f"Error processing element {i}: {e}")
                    i += 1

            browser.close()

        logger.info(
            f"ART Station crawl complete: {events_found} found, "
            f"{events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl ART Station: {e}")
        raise

    return events_found, events_new, events_updated
