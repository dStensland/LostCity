"""
Crawler for Full Radius Dance (fullradiusdance.org).
Physically integrated modern/contemporary dance company in Atlanta.
Known for MAD (Moving and Discovering) Festival.

Site: WordPress (with Cloudflare protection — requires Playwright with stealth approach).
Events listed at /performances/ and /events/.

Full Radius Dance is a small company with 2-3 main productions per year plus the
annual MAD Festival (typically spring). They use a mix of Atlanta venues.

Typical home venues:
  - 7 Stages Theatre (home base - Little Five Points)
  - Under Construction at The Center for Puppetry Arts
  - Various Atlanta venues

If Cloudflare blocks access, the crawler logs a warning and returns empty results
rather than crashing. Events will need to be monitored and the source rechecked
periodically as Cloudflare protection may change.
"""

from __future__ import annotations

import logging
import re
import time
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

from db import get_or_create_place, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.fullradiusdance.org"
PERFORMANCES_URL = f"{BASE_URL}/performances/"
EVENTS_URL = f"{BASE_URL}/events/"

# Primary home base venue
SEVEN_STAGES_VENUE_DATA = {
    "name": "7 Stages Theatre",
    "slug": "7-stages-theatre",
    "address": "1105 Euclid Ave NE",
    "neighborhood": "Little Five Points",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    "lat": 33.7621,
    "lng": -84.3481,
    "place_type": "theater",
    "spot_type": "theater",
    "website": "https://www.7stages.org",
    "vibes": ["all-ages", "artsy"],
}

# Full Radius Dance's organization record (for performances without a known venue)
FRD_ORG_VENUE_DATA = {
    "name": "Full Radius Dance",
    "slug": "full-radius-dance",
    "address": "1105 Euclid Ave NE",
    "neighborhood": "Little Five Points",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    "lat": 33.7621,
    "lng": -84.3481,
    "place_type": "organization",
    "spot_type": "theater",
    "website": BASE_URL,
    "vibes": ["wheelchair-accessible", "all-ages"],
}

MONTH_MAP = {
    "january": 1, "february": 2, "march": 3, "april": 4,
    "may": 5, "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12,
}


def _is_cloudflare_challenge(page) -> bool:
    """Detect if we're stuck on a Cloudflare challenge page."""
    title = page.title().lower()
    if "just a moment" in title or "cloudflare" in title:
        return True
    content = page.content()
    if "Performing security verification" in content or "challenge-form" in content:
        return True
    return False


def _parse_date_time(text: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse date and time from a text string.
    Returns ("YYYY-MM-DD", "HH:MM") or (None, None).
    """
    # Full date with year
    m = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December)"
        r"\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})",
        text,
        re.IGNORECASE,
    )
    if m:
        month_str, day, year = m.groups()
        month = MONTH_MAP.get(month_str.lower())
        if month:
            try:
                date_str = datetime(int(year), month, int(day)).strftime("%Y-%m-%d")
                time_str = _parse_time(text)
                return date_str, time_str
            except ValueError:
                pass

    # Numeric date: "3/15/2026", "03-15-2026"
    m2 = re.search(r"(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})", text)
    if m2:
        month, day, year = m2.groups()
        try:
            date_str = datetime(int(year), int(month), int(day)).strftime("%Y-%m-%d")
            time_str = _parse_time(text)
            return date_str, time_str
        except ValueError:
            pass

    return None, None


def _parse_time(text: str) -> Optional[str]:
    """Extract time from text, return HH:MM in 24-hour format."""
    m = re.search(r"(\d{1,2})(?::(\d{2}))?\s*(am|pm|AM|PM)", text)
    if m:
        hour = int(m.group(1))
        minute = int(m.group(2) or 0)
        meridiem = m.group(3).upper()
        if meridiem == "PM" and hour != 12:
            hour += 12
        elif meridiem == "AM" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute:02d}"
    return None


def _extract_events_from_page_text(body_text: str, source_url: str) -> list[dict]:
    """
    Extract events from the raw text of a Full Radius Dance page.
    Returns list of raw event dicts ready for processing.
    """
    events = []

    # Split by common event separators — empty lines, horizontal rules, etc.
    # Look for blocks that contain both a title-like heading and a date
    lines = [l.strip() for l in body_text.split("\n") if l.strip()]

    # Find lines that contain dates — these anchor event blocks
    date_line_indices = []
    for i, line in enumerate(lines):
        if re.search(
            r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}",
            line,
            re.IGNORECASE,
        ):
            date_line_indices.append(i)
        elif re.search(r"\d{1,2}[/\-]\d{1,2}[/\-]\d{4}", line):
            date_line_indices.append(i)

    if not date_line_indices:
        return events

    # For each date-containing line, look backward for a title and forward for description
    for date_idx in date_line_indices:
        date_str, time_str = _parse_date_time(lines[date_idx])
        if not date_str:
            continue

        # Skip past events
        try:
            if datetime.strptime(date_str, "%Y-%m-%d").date() < datetime.now().date():
                continue
        except ValueError:
            continue

        # Look backward up to 5 lines for a title (short, meaningful line)
        title = None
        for j in range(max(0, date_idx - 5), date_idx):
            candidate = lines[j].strip()
            if (
                10 < len(candidate) < 150
                and not re.search(r"^\d", candidate)
                and not re.search(r"^(by|at|in|with|presented|featuring|produced)\b", candidate, re.IGNORECASE)
                and not re.search(r"(january|february|march|april|may|june|july|august|september|october|november|december)", candidate, re.IGNORECASE)
            ):
                title = candidate
                # Keep searching backward — the last non-date title candidate wins
        if not title:
            # Use the date line context as a fallback title
            continue

        # Look forward up to 8 lines for description
        description_lines = []
        for j in range(date_idx + 1, min(len(lines), date_idx + 8)):
            line = lines[j].strip()
            if not line:
                break
            if re.search(
                r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}",
                line,
                re.IGNORECASE,
            ):
                break  # Hit the next event
            if len(line) > 20:
                description_lines.append(line)
        description = " ".join(description_lines)[:500] if description_lines else None

        # Look for ticket URL in surrounding context
        ticket_url = source_url
        surrounding = " ".join(lines[max(0, date_idx - 3): min(len(lines), date_idx + 5)])
        ticket_match = re.search(r"https?://(?:tickets\.|www\.)?[^\s<>\"']+ticket[^\s<>\"']*", surrounding, re.IGNORECASE)
        if ticket_match:
            ticket_url = ticket_match.group(0)

        events.append({
            "title": title,
            "description": description,
            "date": date_str,
            "time": time_str,
            "ticket_url": ticket_url,
            "source_url": source_url,
        })

    return events


def _scrape_event_detail(page, event_url: str) -> Optional[dict]:
    """
    Scrape a Full Radius Dance individual event detail page.
    Returns an enriched event dict or None.
    """
    try:
        page.goto(event_url, wait_until="domcontentloaded", timeout=20000)
        page.wait_for_timeout(3000)

        if _is_cloudflare_challenge(page):
            return None

        body_text = page.inner_text("body")

        # Get title
        title = None
        for selector in ["h1.entry-title", "h1", ".event-title"]:
            el = page.query_selector(selector)
            if el:
                t = el.inner_text().strip()
                if 5 < len(t) < 200:
                    title = t
                    break

        # Get image
        image_url = None
        for selector in [".wp-post-image", ".entry-content img", "article img", ".tribe-event-featured-image img"]:
            el = page.query_selector(selector)
            if el:
                src = el.get_attribute("src") or el.get_attribute("data-src")
                if src and "logo" not in src.lower():
                    image_url = src if src.startswith("http") else BASE_URL + src
                    break

        # Get OG image as fallback
        if not image_url:
            og_el = page.query_selector('meta[property="og:image"]')
            if og_el:
                image_url = og_el.get_attribute("content")

        date_str, time_str = _parse_date_time(body_text)

        return {
            "title": title,
            "date": date_str,
            "time": time_str,
            "image_url": image_url,
            "body_text": body_text[:1000],
        }

    except PlaywrightTimeoutError:
        logger.debug(f"Full Radius Dance: timeout on {event_url}")
        return None
    except Exception as e:
        logger.debug(f"Full Radius Dance: error on {event_url}: {e}")
        return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Full Radius Dance performances. Handles Cloudflare protection gracefully."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                args=["--disable-blink-features=AutomationControlled"],
            )
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                viewport={"width": 1280, "height": 900},
                extra_http_headers={"Accept-Language": "en-US,en;q=0.9"},
            )
            page = context.new_page()

            # Create venue records
            seven_stages_venue_id = get_or_create_place(SEVEN_STAGES_VENUE_DATA)
            get_or_create_place(FRD_ORG_VENUE_DATA)

            # Try the performances page first
            logger.info(f"Full Radius Dance: fetching {PERFORMANCES_URL}")
            try:
                page.goto(PERFORMANCES_URL, wait_until="domcontentloaded", timeout=25000)
                page.wait_for_timeout(6000)  # Extra wait for Cloudflare JS challenge
            except PlaywrightTimeoutError:
                logger.warning("Full Radius Dance: timeout loading performances page")
                browser.close()
                return 0, 0, 0

            if _is_cloudflare_challenge(page):
                logger.warning(
                    "Full Radius Dance: blocked by Cloudflare. "
                    "Site is currently inaccessible to automated crawlers. "
                    "Check https://www.fullradiusdance.org/performances/ manually."
                )
                browser.close()
                return 0, 0, 0

            # Scroll to load lazy content
            page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            page.wait_for_timeout(1500)

            body_text = page.inner_text("body")

            # Collect event links
            event_links: list[str] = []

            # Look for WordPress event patterns
            links = page.evaluate("""() => {
                return Array.from(document.querySelectorAll('a')).map(a => ({
                    href: a.href,
                    text: a.innerText.trim()
                })).filter(l => l.href && l.text.length > 0);
            }""")

            for link in links:
                href = link.get("href", "")
                text = link.get("text", "")
                if not href or not text:
                    continue
                # Skip nav/footer/social links
                if any(skip in href for skip in ["#", "facebook", "instagram", "twitter", "mailto", "tel:"]):
                    continue
                # Look for event/performance links
                if any(
                    pattern in href
                    for pattern in ["/event/", "/performance/", "/show/", f"{BASE_URL}/"]
                ) and BASE_URL in href and href != PERFORMANCES_URL:
                    # Filter to links that look like event pages (not nav/about/contact)
                    if not any(
                        skip in href
                        for skip in ["/about", "/contact", "/support", "/donate", "/company", "/school", "/education", "/news", "/blog", "/page/"]
                    ):
                        event_links.append(href)

            # Deduplicate
            event_links = list(dict.fromkeys(event_links))

            # Also parse events directly from the performances page text
            inline_events = _extract_events_from_page_text(body_text, PERFORMANCES_URL)

            logger.info(
                f"Full Radius Dance: found {len(event_links)} event links, "
                f"{len(inline_events)} inline events on performances page"
            )

            # Process inline events from page text
            for raw_event in inline_events:
                title = raw_event.get("title", "")
                if not title or len(title) < 5:
                    continue

                start_date = raw_event.get("date")
                if not start_date:
                    continue

                start_time = raw_event.get("time")
                description = raw_event.get("description")
                ticket_url = raw_event.get("ticket_url", PERFORMANCES_URL)
                event_src_url = raw_event.get("source_url", PERFORMANCES_URL)

                # Default to 7 Stages for FRD home venue
                venue_id = seven_stages_venue_id
                venue_name = "7 Stages Theatre"

                # Check for MAD Festival
                tags = ["full-radius-dance", "dance", "contemporary-dance", "disability-arts", "performing-arts", "inclusive"]
                if "mad" in title.lower() or "moving and discovering" in title.lower():
                    tags.extend(["mad-festival", "festival"])

                events_found += 1
                content_hash = generate_content_hash(title, venue_name, start_date)

                event_record = {
                    "source_id": source_id,
                    "place_id": venue_id,
                    "title": title,
                    "description": description,
                    "start_date": start_date,
                    "start_time": start_time,
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": False,
                    "category": "dance",
                    "subcategory": "contemporary",
                    "tags": tags,
                    "price_min": None,
                    "price_max": None,
                    "price_note": None,
                    "is_free": False,
                    "source_url": event_src_url,
                    "ticket_url": ticket_url,
                    "image_url": None,
                    "raw_text": f"{title} — {start_date}",
                    "extraction_confidence": 0.75,
                    "is_recurring": False,
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
                    logger.info(f"Full Radius Dance: added '{title}' on {start_date}")
                except Exception as e:
                    logger.error(f"Full Radius Dance: failed to insert '{title}': {e}")

            # Process individual event detail pages
            for event_url in event_links[:20]:  # Cap to avoid runaway
                time.sleep(0.5)

                detail = _scrape_event_detail(page, event_url)
                if not detail:
                    continue

                if _is_cloudflare_challenge(page):
                    logger.warning("Full Radius Dance: Cloudflare challenge encountered on detail page")
                    break

                title = detail.get("title")
                start_date = detail.get("date")

                if not title or not start_date:
                    # Try to get info from page body text
                    body = detail.get("body_text", "")
                    if not title:
                        title = "Full Radius Dance Performance"
                    if not start_date:
                        start_date, _ = _parse_date_time(body)
                    if not start_date:
                        continue

                # Skip past events
                try:
                    if datetime.strptime(start_date, "%Y-%m-%d").date() < datetime.now().date():
                        continue
                except ValueError:
                    continue

                start_time = detail.get("time")
                image_url = detail.get("image_url")
                venue_id = seven_stages_venue_id
                venue_name = "7 Stages Theatre"

                tags = ["full-radius-dance", "dance", "contemporary-dance", "disability-arts", "performing-arts", "inclusive"]
                if "mad" in title.lower() or "moving and discovering" in title.lower():
                    tags.extend(["mad-festival", "festival"])

                events_found += 1
                content_hash = generate_content_hash(title, venue_name, start_date)

                event_record = {
                    "source_id": source_id,
                    "place_id": venue_id,
                    "title": title,
                    "description": None,
                    "start_date": start_date,
                    "start_time": start_time,
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": False,
                    "category": "dance",
                    "subcategory": "contemporary",
                    "tags": tags,
                    "price_min": None,
                    "price_max": None,
                    "price_note": None,
                    "is_free": False,
                    "source_url": event_url,
                    "ticket_url": event_url,
                    "image_url": image_url,
                    "raw_text": f"{title} — {start_date}",
                    "extraction_confidence": 0.80,
                    "is_recurring": False,
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
                    logger.info(f"Full Radius Dance: added '{title}' on {start_date}")
                except Exception as e:
                    logger.error(f"Full Radius Dance: failed to insert '{title}': {e}")

            browser.close()

    except Exception as e:
        logger.error(f"Full Radius Dance: crawl failed: {e}")
        raise

    logger.info(
        f"Full Radius Dance crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
    )
    return events_found, events_new, events_updated
