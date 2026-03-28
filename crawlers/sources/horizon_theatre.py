"""
Crawler for Horizon Theatre Company (horizontheatre.com).
Intimate theater in Little Five Points known for contemporary plays and world premieres.

Site structure:
  Shows: /plays/ with individual show pages at /plays/[slug]/ (Playwright).
  Education: /education-and-community/young-playwrights/ — the New South Young
    Playwrights Festival is the only education program with parseable dates on
    the Horizon site. Youth classes (Camp StarDust, acting classes) are fully
    outsourced to Atlanta Children's Theatre Company and appear only on
    atlantachildrenstheatre.com, not on horizontheatre.com.

Education pass (static HTTP):
  - New South Young Playwrights Festival (annual, typically June, 1 week)
  - Apprentice Company: currently paused — no active dates to crawl.
"""

from __future__ import annotations

import re
import logging
from datetime import date, datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

from db import get_or_create_place, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from utils import enrich_event_record

logger = logging.getLogger(__name__)

BASE_URL = "https://www.horizontheatre.com"
PLAYS_URL = f"{BASE_URL}/plays/"
YOUNG_PLAYWRIGHTS_URL = f"{BASE_URL}/education-and-community/young-playwrights/"

EDUCATION_REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml",
}

PLACE_DATA = {
    "name": "Horizon Theatre",
    "slug": "horizon-theatre",
    "address": "1083 Austin Ave NE",
    "neighborhood": "Little Five Points",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    "lat": 33.7645,
    "lng": -84.3485,
    "venue_type": "theater",
    "spot_type": "theater",
    "website": BASE_URL,
}

# Words that indicate this is not a real show title
SKIP_PATTERNS = [
    r"^(home|about|contact|donate|support|subscribe|tickets?|buy|cart|menu)$",
    r"^(login|sign in|sign up|register|account|my account)$",
    r"^(facebook|twitter|instagram|youtube|social)$",
    r"^(privacy|terms|policy|copyright|\d{4})$",
    r"^(season \d|our season|this season)$",
    r"^\d+$",  # Just numbers
    r"^[a-z]{1,3}$",  # Very short strings
]


def is_valid_title(title: str) -> bool:
    """Check if a string looks like a valid show title."""
    if not title or len(title) < 3 or len(title) > 200:
        return False

    title_lower = title.lower().strip()

    for pattern in SKIP_PATTERNS:
        if re.match(pattern, title_lower, re.IGNORECASE):
            return False

    return True


def parse_date_range(date_text: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse date range from formats like:
    - "January 15 - February 28, 2026"
    - "March 5-29, 2026"
    - "December 2025"

    Returns (start_date, end_date) in YYYY-MM-DD format.
    """
    if not date_text:
        return None, None

    # Clean up the text
    date_text = date_text.strip()

    # Pattern: "Month Day - Month Day, Year" or "Month Day-Day, Year"
    range_match = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})\s*[-\u2013\u2014]\s*(?:(January|February|March|April|May|June|July|August|September|October|November|December)\s+)?(\d{1,2}),?\s*(\d{4})",
        date_text,
        re.IGNORECASE,
    )

    if range_match:
        start_month = range_match.group(1)
        start_day = range_match.group(2)
        end_month = range_match.group(3) or start_month
        end_day = range_match.group(4)
        year = range_match.group(5)

        try:
            start_dt = datetime.strptime(f"{start_month} {start_day} {year}", "%B %d %Y")
            end_dt = datetime.strptime(f"{end_month} {end_day} {year}", "%B %d %Y")
            return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Pattern: Single date "Month Day, Year"
    single_match = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s*(\d{4})",
        date_text,
        re.IGNORECASE,
    )

    if single_match:
        month, day, year = single_match.groups()
        try:
            dt = datetime.strptime(f"{month} {day} {year}", "%B %d %Y")
            return dt.strftime("%Y-%m-%d"), dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return None, None


# ── education crawler ──────────────────────────────────────────────────────────


def _crawl_horizon_education(source_id: int, venue_id: int) -> tuple[int, int, int]:
    """
    Crawl the New South Young Playwrights Festival from the Horizon education page.

    The page lists past and current festival years with dates. We parse the most
    recent upcoming festival and emit it as an education event. The festival
    typically runs for one week in June.

    Note: Youth classes (Camp StarDust, acting classes) are outsourced to
    atlantachildrenstheatre.com and are NOT crawled from Horizon's site.
    """
    found = new = updated = 0

    try:
        resp = requests.get(YOUNG_PLAYWRIGHTS_URL, headers=EDUCATION_REQUEST_HEADERS, timeout=20)
        resp.raise_for_status()
    except Exception as exc:
        logger.warning("[horizon-theatre] Failed to fetch young playwrights page: %s", exc)
        return 0, 0, 0

    soup = BeautifulSoup(resp.text, "html.parser")
    text = soup.get_text(separator="\n")
    lines = [ln.strip() for ln in text.split("\n") if ln.strip()]

    current_year = date.today().year
    festival_year: Optional[int] = None
    festival_dates_str: Optional[str] = None

    for i, line in enumerate(lines):
        year_m = re.match(r"(\d{4})\s+FESTIVAL", line, re.IGNORECASE)
        if year_m:
            yr = int(year_m.group(1))
            if yr >= current_year:
                festival_year = yr
                # Look for dates in the next few lines
                for j in range(i, min(i + 5, len(lines))):
                    # "JUNE 1-7" or ": JUNE 1-7" patterns
                    date_m = re.search(
                        r":?\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2})\s*[-\u2013]\s*(\d{1,2})",
                        lines[j],
                        re.IGNORECASE,
                    )
                    if date_m:
                        festival_dates_str = lines[j]
                        break
                break

    if not festival_year:
        logger.info("[horizon-theatre] No upcoming Young Playwrights Festival found")
        return 0, 0, 0

    # Parse festival dates
    start_date: Optional[str] = None
    end_date: Optional[str] = None

    if festival_dates_str:
        m = re.search(
            r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2})\s*[-\u2013]\s*(\d{1,2})",
            festival_dates_str,
            re.IGNORECASE,
        )
        if m:
            month_abbr = m.group(1)
            s_day = int(m.group(2))
            e_day = int(m.group(3))
            try:
                s_dt = datetime.strptime(f"{month_abbr} {s_day} {festival_year}", "%b %d %Y")
                e_dt = datetime.strptime(f"{month_abbr} {e_day} {festival_year}", "%b %d %Y")
                start_date = s_dt.strftime("%Y-%m-%d")
                end_date = e_dt.strftime("%Y-%m-%d")
            except ValueError:
                pass

    # Fallback placeholder if date parse fails
    if not start_date:
        start_date = f"{festival_year}-06-01"
        end_date = f"{festival_year}-06-07"
        logger.debug(
            "[horizon-theatre] Using placeholder dates for %d Young Playwrights Festival",
            festival_year,
        )

    # Skip if in the past
    try:
        if datetime.strptime(end_date, "%Y-%m-%d").date() < date.today():
            logger.info(
                "[horizon-theatre] %d Young Playwrights Festival is past, skipping",
                festival_year,
            )
            return 0, 0, 0
    except ValueError:
        pass

    found = 1
    title = f"New South Young Playwrights Festival {festival_year}"
    content_hash = generate_content_hash(title, "Horizon Theatre", start_date)

    description = (
        f"Every year, Horizon Theatre hosts the New South Young Playwrights Festival — "
        f"a week-long event for high school and college-aged aspiring playwrights in Atlanta. "
        f"20-25 playwrights are selected to participate in readings and workshops at Horizon's "
        f"Little Five Points home. Free to attend as an audience member. "
        f"Submissions and festival info at {YOUNG_PLAYWRIGHTS_URL}."
    )

    series_hint = {
        "series_type": "recurring_show",
        "series_title": "New South Young Playwrights Festival",
        "frequency": "yearly",
        "description": description,
    }

    event_record = {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": description,
        "start_date": start_date,
        "end_date": end_date,
        "start_time": None,
        "end_time": None,
        "is_all_day": True,
        "category": "theater",
        "subcategory": "performance",
        "tags": [
            "horizon-theatre", "theater", "little-five-points", "l5p",
            "education", "playwriting", "teen", "youth", "festival", "free",
        ],
        "age_min": 14,
        "age_max": None,
        "is_free": True,
        "price_min": 0,
        "price_max": 0,
        "price_note": "Free to attend as audience. Participation by application.",
        "source_url": YOUNG_PLAYWRIGHTS_URL,
        "ticket_url": YOUNG_PLAYWRIGHTS_URL,
        "image_url": None,
        "raw_text": f"{title}|Horizon Theatre|{start_date}",
        "extraction_confidence": 0.85,
        "is_recurring": True,
        "recurrence_rule": "FREQ=YEARLY",
        "content_hash": content_hash,
    }

    existing = find_event_by_hash(content_hash)
    if existing:
        smart_update_existing_event(existing, event_record)
        updated = 1
        logger.debug("[horizon-theatre] Updated: %s on %s", title, start_date)
    else:
        try:
            insert_event(event_record, series_hint=series_hint)
            new = 1
            logger.info("[horizon-theatre] Added: %s on %s", title, start_date)
        except Exception as exc:
            logger.error("[horizon-theatre] Failed to insert %s: %s", title, exc)

    return found, new, updated


# ── main crawl entrypoint ──────────────────────────────────────────────────────


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Horizon Theatre — mainstage shows AND education programs.

    Pass 1 (static HTTP): Fetch the Young Playwrights Festival page and emit
      the current/upcoming festival as an event. Youth classes are outsourced
      to Atlanta Children's Theatre Company (not crawlable from Horizon's site).

    Pass 2 (Playwright): Navigate /plays/ and visit each show page to extract
      title, dates, description, and image.
    """
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

            # Pass 1: Education programs (static HTTP)
            logger.info("[horizon-theatre] Crawling education programs")
            try:
                edu_found, edu_new, edu_updated = _crawl_horizon_education(source_id, venue_id)
                events_found += edu_found
                events_new += edu_new
                events_updated += edu_updated
                logger.info(
                    "[horizon-theatre] Education: %d found, %d new, %d updated",
                    edu_found, edu_new, edu_updated,
                )
            except Exception as exc:
                logger.error("[horizon-theatre] Education crawl failed: %s", exc)

            # Pass 2: Mainstage shows (Playwright)
            logger.info(f"Fetching Horizon Theatre: {PLAYS_URL}")
            page.goto(PLAYS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)  # Wait for JS instead of networkidle

            # Find all show links in the navigation/plays section
            # Horizon uses menu structure with links to /plays/[show-slug]/
            show_links = page.query_selector_all('a[href*="/plays/"]')

            show_urls = set()
            for link in show_links:
                href = link.get_attribute("href")
                if href and "/plays/" in href:
                    # Skip category pages and navigation
                    if any(skip in href for skip in ["/plays/#", "/plays/?", "season", "family-series", "past-seasons"]):
                        continue
                    # Must be a show page (has another segment after /plays/)
                    parts = href.rstrip("/").split("/plays/")
                    if len(parts) > 1 and parts[1] and "/" not in parts[1]:
                        full_url = href if href.startswith("http") else BASE_URL + href
                        show_urls.add(full_url)

            logger.info(f"Found {len(show_urls)} potential show pages")

            # Visit each show page to get details
            for show_url in show_urls:
                try:
                    page.goto(show_url, wait_until="domcontentloaded", timeout=20000)
                    page.wait_for_timeout(2000)

                    # Get show title - usually in h1 or prominent heading
                    title = None
                    for selector in ["h1", ".show-title", ".entry-title", ".page-title"]:
                        el = page.query_selector(selector)
                        if el:
                            title = el.inner_text().strip()
                            if is_valid_title(title):
                                break
                            title = None

                    if not title:
                        logger.debug(f"No valid title found at {show_url}")
                        continue

                    # Get dates - look for date information
                    date_text = ""
                    for selector in [".show-dates", ".dates", ".performance-dates", "time", ".entry-meta"]:
                        el = page.query_selector(selector)
                        if el:
                            date_text = el.inner_text().strip()
                            if date_text:
                                break

                    # Also check page content for date patterns
                    if not date_text:
                        body_text = page.inner_text("body")
                        date_match = re.search(
                            r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}.*?\d{4}",
                            body_text,
                            re.IGNORECASE,
                        )
                        if date_match:
                            date_text = date_match.group(0)

                    start_date, end_date = parse_date_range(date_text)

                    # Skip if no dates found or dates are in the past
                    if not start_date:
                        logger.debug(f"No dates found for {title}")
                        continue

                    # Skip past shows
                    if end_date and datetime.strptime(end_date, "%Y-%m-%d").date() < datetime.now().date():
                        logger.debug(f"Skipping past show: {title}")
                        continue

                    # Get description
                    description = None
                    for selector in [".show-description", ".entry-content p", ".synopsis", "article p"]:
                        el = page.query_selector(selector)
                        if el:
                            desc = el.inner_text().strip()
                            if desc and len(desc) > 20:
                                description = desc[:500]
                                break

                    # Get image
                    image_url = None
                    for selector in [".show-image img", ".featured-image img", "article img", ".entry-content img"]:
                        el = page.query_selector(selector)
                        if el:
                            src = el.get_attribute("src") or el.get_attribute("data-src")
                            if src:
                                image_url = src if src.startswith("http") else BASE_URL + src
                                break

                    events_found += 1

                    event_start_time = "20:00"
                    hash_key = f"{start_date}|{event_start_time}"
                    content_hash = generate_content_hash(title, "Horizon Theatre", hash_key)

                    # Create series hint for the show run
                    series_hint = None
                    if end_date and end_date != start_date:
                        series_hint = {
                            "series_type": "recurring_show",
                            "series_title": title,
                        }
                        if description:
                            series_hint["description"] = description
                        if image_url:
                            series_hint["image_url"] = image_url

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": description or f"{title} at Horizon Theatre",
                        "start_date": start_date,
                        "start_time": event_start_time,  # Default evening showtime
                        "end_date": end_date,
                        "end_time": None,
                        "is_all_day": False,
                        "category": "theater",
                        "subcategory": "play",
                        "tags": ["horizon-theatre", "theater", "little-five-points", "l5p", "contemporary"],
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": None,
                        "source_url": show_url,
                        "ticket_url": show_url,
                        "image_url": image_url,
                        "raw_text": f"{title} - {date_text}",
                        "extraction_confidence": 0.90,
                        "is_recurring": True if end_date and end_date != start_date else False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    # Enrich from detail page
                    enrich_event_record(event_record, source_name="Horizon Theatre")

                    # Determine is_free if still unknown after enrichment
                    if event_record.get("is_free") is None:
                        desc_lower = (event_record.get("description") or "").lower()
                        title_lower = event_record.get("title", "").lower()
                        combined = f"{title_lower} {desc_lower}"
                        if any(kw in combined for kw in ["free", "no cost", "no charge", "complimentary"]):
                            event_record["is_free"] = True
                            event_record["price_min"] = event_record.get("price_min") or 0
                            event_record["price_max"] = event_record.get("price_max") or 0
                        else:
                            event_record["is_free"] = False

                    existing = find_event_by_hash(content_hash)
                    if existing:
                        smart_update_existing_event(existing, event_record)
                        events_updated += 1
                        continue

                    try:
                        insert_event(event_record, series_hint=series_hint)
                        events_new += 1
                        logger.info(f"Added: {title} ({start_date} to {end_date})")
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

                except Exception as e:
                    logger.warning(f"Failed to process show page {show_url}: {e}")
                    continue

            browser.close()

        logger.info(
            "[horizon-theatre] Crawl complete: %d found, %d new, %d updated (shows + education)",
            events_found, events_new, events_updated,
        )

    except Exception as e:
        logger.error(f"Failed to crawl Horizon Theatre: {e}")
        raise

    return events_found, events_new, events_updated
