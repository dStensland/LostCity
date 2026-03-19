"""
Crawler for Atlanta Contemporary Dance Company (atlantacontemporarydance.com).
Professional contemporary dance company based in Atlanta, GA.
Artistic Director: Lauren Overstreet.

Site structure:
  - Wix site with a /performances page listing upcoming and past performances
  - Upcoming events often have a linked detail page at /event-details-registration/<slug>
  - Detail pages carry: full title, time (HH:MM AM/PM), venue address, price, description, og:image

Strategy:
  - Render /performances via Playwright to capture DOM links alongside event text
  - For each event with a detail page link, fetch that page for complete data
  - Fall back to listing-level parsing for events with no detail link (TBA announcements)
  - Date formats: "Thursday, 3.19" (month.day), "April 18th, 2026", "Month Day, Year at H:MM PM"
  - Wix ticket price of $0.00 = is_free=True

Typical yield: 2-4 events/season (productions, festival appearances, workshops)
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, date
from typing import Optional

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.atlantacontemporarydance.com"
PERFORMANCES_URL = f"{BASE_URL}/performances"

# ACDC does not have a fixed home stage — they perform at various Atlanta venues.
# Use org venue as fallback when no venue can be determined.
ACDC_ORG_VENUE_DATA = {
    "name": "Atlanta Contemporary Dance Company",
    "slug": "atlanta-contemporary-dance-company",
    "address": "Atlanta, GA",
    "neighborhood": "Atlanta",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30308",
    "lat": 33.7490,
    "lng": -84.3880,
    "venue_type": "organization",
    "spot_type": "theater",
    "website": BASE_URL,
    "vibes": ["artsy", "all-ages"],
}

# KSU Dance Theatre — appears frequently as a performance venue
KSU_VENUE_DATA = {
    "name": "KSU Dance Theatre",
    "slug": "ksu-dance-theatre",
    "address": "860 Rossbacher Way",
    "neighborhood": "Marietta",
    "city": "Marietta",
    "state": "GA",
    "zip": "30060",
    "lat": 33.9360,
    "lng": -84.5218,
    "venue_type": "theater",
    "spot_type": "theater",
    "website": "https://dance.kennesaw.edu",
    "vibes": ["artsy"],
}


def _parse_acdc_date(text: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse date/time from ACDC event text. Handles multiple formats:
    - "Thursday, 3.19" → infer year as current/next
    - "April 18th, 2026"
    - "April 18th, 2026 at 7:30 PM"
    - "July 27, 2024 at 7:30pm"
    - "June 3-9, 2024" → use start date

    Returns (start_date, start_time) as ("YYYY-MM-DD", "HH:MM") or (None, None).
    """
    text = text.strip()

    # Format: "Month Day, Year at H:MM PM" or "Month Day, Year"
    match = re.search(
        r"(January|February|March|April|May|June|July|August|"
        r"September|October|November|December)\s+"
        r"(\d{1,2})(?:st|nd|rd|th)?(?:\s*[-–]\s*\d{1,2})?,?\s+"
        r"(\d{4})"
        r"(?:\s+at\s+(\d{1,2}):(\d{2})\s*(am|pm|AM|PM))?",
        text,
        re.IGNORECASE,
    )
    if match:
        month, day, year = match.group(1), match.group(2), match.group(3)
        hour_s, min_s, meridiem = match.group(4), match.group(5), match.group(6)
        try:
            dt = datetime.strptime(f"{month} {day} {year}", "%B %d %Y")
            start_date = dt.strftime("%Y-%m-%d")
            start_time = None
            if hour_s and min_s and meridiem:
                hour_int = int(hour_s)
                if meridiem.upper() == "PM" and hour_int != 12:
                    hour_int += 12
                elif meridiem.upper() == "AM" and hour_int == 12:
                    hour_int = 0
                start_time = f"{hour_int:02d}:{min_s}"
            return start_date, start_time
        except ValueError:
            pass

    # Format: "Thursday, 3.19" (month.day, no year) — infer year
    match2 = re.search(
        r"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+(\d{1,2})\.(\d{1,2})",
        text,
        re.IGNORECASE,
    )
    if match2:
        month_num, day_num = int(match2.group(1)), int(match2.group(2))
        today = date.today()
        # Infer year: use current year, bump to next if already past
        for year_offset in range(2):
            candidate_year = today.year + year_offset
            try:
                candidate_date = date(candidate_year, month_num, day_num)
                if candidate_date >= today:
                    return candidate_date.strftime("%Y-%m-%d"), None
            except ValueError:
                continue

    return None, None


def _extract_upcoming_events(body_text: str, event_links: dict) -> list[dict]:
    """
    Parse the ACDC performances page body text to extract upcoming events.

    Args:
        body_text: Rendered inner text of the performances page.
        event_links: Dict mapping link text -> href for event detail page links
                     found in the DOM (e.g. {"Complimentary Ticket": "https://..."}).

    Returns list of dicts with keys:
        title, date_text, description, is_tba, detail_url (optional).
    """
    # Split on "Past Performances" to get only upcoming section
    past_boundary = re.split(
        r"Past\s+(?:Guest\s+)?Performances?", body_text, flags=re.IGNORECASE, maxsplit=1
    )
    upcoming_text = past_boundary[0] if len(past_boundary) > 1 else body_text

    # Strip navigation noise
    upcoming_text = re.sub(
        r"Skip to Main Content.*?Upcoming Performances", "", upcoming_text,
        flags=re.DOTALL | re.IGNORECASE,
    )
    upcoming_text = upcoming_text.strip()

    events: list[dict] = []

    # Pattern 1: "New Production Coming [Date]!" — teaser with no detail page yet
    coming_matches = re.findall(
        r"(?:New\s+)?(?:Production|Show|Performance)\s+Coming\s+"
        r"([A-Z][a-z]+\s+\d+(?:st|nd|rd|th)?,?\s*\d{4})",
        upcoming_text,
        re.IGNORECASE,
    )
    for date_text in coming_matches:
        events.append({
            "title": "ACDC New Production",
            "date_text": date_text,
            "description": (
                "Upcoming production by Atlanta Contemporary Dance Company. "
                "Check website for details."
            ),
            "is_tba": True,
            "detail_url": None,
        })

    # Pattern 2: "DayOfWeek, M.D Title [Ticket CTA]"
    # e.g. "Thursday, 3.19 Community Performance Complimentary Ticket"
    for day_match in re.finditer(
        r"((?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+\d{1,2}\.\d{1,2})"
        r"\s+(.+?)(?=(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+\d{1,2}\.\d{1,2}|"
        r"New\s+Production|Past|$)",
        upcoming_text,
        re.IGNORECASE | re.DOTALL,
    ):
        date_text = day_match.group(1).strip()
        title_block = re.sub(r"\s+", " ", day_match.group(2)).strip()

        # Capture the CTA text before stripping it — we use it to look up the detail URL
        cta_match = re.search(
            r"(Complimentary\s+Ticket|Buy\s+Ticket|RSVP|Register|Learn\s+More|More\s+Info)",
            title_block,
            re.IGNORECASE,
        )
        cta_text = cta_match.group(1).strip() if cta_match else None

        # Strip ticket/CTA noise from title
        title_block = re.split(
            r"\s+(?:Complimentary\s+Ticket|Buy\s+Ticket|RSVP|Register|Learn\s+More|More\s+Info)",
            title_block,
            flags=re.IGNORECASE,
            maxsplit=1,
        )[0].strip()
        # Also split on "New Production Coming" if it bleeds in
        title_block = re.split(r"\s+New\s+Production", title_block, flags=re.IGNORECASE)[0].strip()

        if not title_block or not (3 < len(title_block) < 120):
            continue

        # Resolve detail URL: check event_links for this CTA text
        detail_url = None
        if cta_text:
            for link_text, href in event_links.items():
                if cta_text.lower() in link_text.lower() or link_text.lower() in cta_text.lower():
                    if "/event-details" in href or "/events/" in href:
                        detail_url = href
                        break

        events.append({
            "title": title_block,
            "date_text": date_text,
            "description": None,
            "is_tba": False,
            "detail_url": detail_url,
        })

    # Deduplicate by (title_lower, date_text)
    seen: set[tuple] = set()
    unique_events: list[dict] = []
    for ev in events:
        key = (ev["title"].lower()[:40], ev["date_text"])
        if key not in seen:
            seen.add(key)
            unique_events.append(ev)

    return unique_events


def _parse_detail_page(page: "Page") -> dict:  # type: ignore[name-defined]
    """
    Extract enriched data from a Wix event detail page.

    Returns a dict with any of:
        title, description, image_url, start_time, end_time,
        price_min, price_max, is_free, venue_name, venue_address
    """
    result: dict = {}

    # og:image — high-res event photo
    og_image = page.query_selector('meta[property="og:image"]')
    if og_image:
        src = og_image.get_attribute("content") or ""
        if src:
            result["image_url"] = src

    # og:description / meta description
    for selector in ['meta[property="og:description"]', 'meta[name="description"]']:
        meta = page.query_selector(selector)
        if meta:
            content = (meta.get_attribute("content") or "").strip()
            if content:
                result["description"] = content[:600]
                break

    body_text = re.sub(r"\s+", " ", page.inner_text("body"))

    # Title: Wix event pages render "<Production Name> | <Subtitle>" as h1 or prominent text
    # Extract from body text — strip nav prefix
    title_area = re.sub(
        r"^.*?(?:Log\s+In\s+)?(?:Home\s+The\s+Company.+?Support\s+)?", "", body_text
    )
    title_match = re.match(
        r"([\w\s|'':,&!.()-]{5,120}?)\s+(?:Thu|Fri|Sat|Sun|Mon|Tue|Wed),\s+\w+\s+\d+",
        title_area.strip(),
        re.IGNORECASE,
    )
    if title_match:
        candidate = title_match.group(1).strip()
        # Reject navigation-sounding titles
        if not re.search(r"(?:log\s+in|home|support|donate)", candidate, re.I):
            result["title"] = candidate

    # Time: "Mar 19, 2026, 6:30 PM – 8:00 PM"
    time_match = re.search(
        r"\w+\s+\d{1,2},\s+\d{4},\s+(\d{1,2}:\d{2}\s*[AP]M)\s*[–-]\s*(\d{1,2}:\d{2}\s*[AP]M)",
        body_text,
        re.IGNORECASE,
    )
    if time_match:
        def _to_24h(t: str) -> str:
            t = t.strip()
            try:
                dt = datetime.strptime(t, "%I:%M %p")
            except ValueError:
                dt = datetime.strptime(t, "%I:%M%p")
            return dt.strftime("%H:%M")

        result["start_time"] = _to_24h(time_match.group(1))
        result["end_time"] = _to_24h(time_match.group(2))

    # Venue: "Round Trip Brewing Co, 1279 Seaboard Industrial Blvd NW, Atlanta, GA 30318, USA"
    venue_match = re.search(
        r"(?:Time\s*&\s*Location\s+\w+\s+\d{1,2},\s+\d{4},.*?[AP]M\s+)"
        r"([A-Z][^,\n]{2,60}),\s+(\d+[^,\n]{5,60}),\s+(Atlanta|Marietta|Decatur|Tucker|Sandy Springs)",
        body_text,
        re.IGNORECASE,
    )
    if venue_match:
        result["venue_name"] = venue_match.group(1).strip()
        result["venue_address"] = f"{venue_match.group(2).strip()}, {venue_match.group(3).strip()}"

    # Price: Wix renders "Price $0.00" or "Price $15.00"
    price_match = re.search(r"Price\s+\$(\d+(?:\.\d{2})?)", body_text, re.IGNORECASE)
    if price_match:
        price_val = float(price_match.group(1))
        result["price_min"] = price_val
        result["price_max"] = price_val
        result["is_free"] = price_val == 0.0

    return result


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Atlanta Contemporary Dance Company performances via Playwright."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    org_venue_id = get_or_create_venue(ACDC_ORG_VENUE_DATA)

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                ),
                viewport={"width": 1280, "height": 900},
            )
            page = context.new_page()

            logger.info("ACDC: fetching performances page %s", PERFORMANCES_URL)
            try:
                page.goto(PERFORMANCES_URL, wait_until="domcontentloaded", timeout=30000)
                page.wait_for_timeout(3000)
            except PlaywrightTimeoutError:
                logger.warning("ACDC: performances page timed out, proceeding with partial load")

            body_text = re.sub(r"\s+", " ", page.inner_text("body"))

            # Collect all event detail page links visible on the listing page.
            # Wix renders these as anchor elements with href=/event-details-registration/<slug>.
            event_links: dict[str, str] = {}
            all_links = page.evaluate(
                "() => Array.from(document.querySelectorAll('a[href]')).map("
                "a => ({text: a.innerText.trim(), href: a.href}))"
            )
            for link_data in all_links:
                href = link_data.get("href") or ""
                text = link_data.get("text") or ""
                if "/event-details" in href or "/events/" in href:
                    event_links[text] = href

            logger.info("ACDC: found %d event detail links on listing page", len(event_links))

            upcoming_events = _extract_upcoming_events(body_text, event_links)
            logger.info("ACDC: found %d upcoming event candidates", len(upcoming_events))

            for ev_data in upcoming_events:
                title = ev_data["title"]
                date_text = ev_data["date_text"]
                description = ev_data.get("description")
                detail_url = ev_data.get("detail_url")

                start_date, start_time = _parse_acdc_date(date_text)
                if not start_date:
                    logger.debug("ACDC: could not parse date '%s' for '%s'", date_text, title)
                    continue

                # Skip past events
                try:
                    if datetime.strptime(start_date, "%Y-%m-%d").date() < datetime.now().date():
                        logger.debug("ACDC: skipping past event '%s' on %s", title, start_date)
                        continue
                except ValueError:
                    continue

                # Defaults from listing page
                image_url: Optional[str] = None
                end_time: Optional[str] = None
                price_min: Optional[float] = None
                price_max: Optional[float] = None
                is_free: Optional[bool] = None
                ticket_url = detail_url or PERFORMANCES_URL
                venue_id = org_venue_id
                source_url = detail_url or PERFORMANCES_URL

                # Fetch detail page when available — it has time, venue, price, image, description
                if detail_url:
                    logger.info("ACDC: fetching detail page %s", detail_url)
                    try:
                        detail_page = context.new_page()
                        detail_page.goto(detail_url, wait_until="domcontentloaded", timeout=30000)
                        detail_page.wait_for_timeout(2500)

                        detail = _parse_detail_page(detail_page)
                        detail_page.close()

                        if detail.get("title"):
                            title = detail["title"]
                        if detail.get("description"):
                            description = detail["description"]
                        if detail.get("image_url"):
                            image_url = detail["image_url"]
                        if detail.get("start_time"):
                            start_time = detail["start_time"]
                        if detail.get("end_time"):
                            end_time = detail["end_time"]
                        if "price_min" in detail:
                            price_min = detail["price_min"]
                            price_max = detail["price_max"]
                            is_free = detail["is_free"]

                        # If the detail page reports a specific venue, create/lookup that venue
                        if detail.get("venue_name") and detail.get("venue_address"):
                            vname = detail["venue_name"]
                            vaddr = detail["venue_address"]
                            # Simple slug from venue name
                            vslug = re.sub(r"[^a-z0-9]+", "-", vname.lower()).strip("-")
                            # Parse city/state/zip from address if available
                            city_match = re.search(
                                r"(Atlanta|Marietta|Decatur|Tucker|Sandy Springs),?\s*(GA)?\s*(\d{5})?",
                                vaddr,
                                re.I,
                            )
                            vcity = city_match.group(1) if city_match else "Atlanta"
                            vzip = city_match.group(3) if (city_match and city_match.group(3)) else "30308"
                            # Street address only
                            street = re.split(r",\s*(?:Atlanta|Marietta|Decatur|Tucker)", vaddr, flags=re.I)[0].strip()
                            new_venue_data = {
                                "name": vname,
                                "slug": vslug,
                                "address": street,
                                "neighborhood": vcity,
                                "city": vcity,
                                "state": "GA",
                                "zip": vzip,
                                "venue_type": "venue",
                                "website": BASE_URL,
                            }
                            try:
                                venue_id = get_or_create_venue(new_venue_data)
                                logger.info("ACDC: using venue '%s' for '%s'", vname, title)
                            except Exception as ve:
                                logger.warning("ACDC: could not create venue '%s': %s", vname, ve)

                    except PlaywrightTimeoutError:
                        logger.warning("ACDC: detail page timed out for %s", detail_url)
                    except Exception as de:
                        logger.warning("ACDC: error fetching detail page %s: %s", detail_url, de)

                # Use venue name for content hash (may differ from org if detail page had a specific venue)
                events_found += 1
                content_hash = generate_content_hash(
                    title, "Atlanta Contemporary Dance Company", start_date
                )

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title,
                    "description": description,
                    "start_date": start_date,
                    "start_time": start_time,
                    "end_date": None,
                    "end_time": end_time,
                    "is_all_day": False,
                    "category": "dance",
                    "subcategory": "contemporary",
                    "tags": [
                        "atlanta-contemporary-dance",
                        "dance",
                        "contemporary-dance",
                        "performing-arts",
                    ],
                    "price_min": price_min,
                    "price_max": price_max,
                    "price_note": "Free admission" if is_free else None,
                    "is_free": is_free,
                    "source_url": source_url,
                    "ticket_url": ticket_url,
                    "image_url": image_url,
                    "raw_text": f"{title} — {date_text}",
                    "extraction_confidence": 0.88 if detail_url else 0.72,
                    "is_recurring": False,
                    "recurrence_rule": None,
                    "content_hash": content_hash,
                }

                existing = find_event_by_hash(content_hash)
                if existing:
                    smart_update_existing_event(existing, event_record)
                    events_updated += 1
                else:
                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info("ACDC: added '%s' on %s", title, start_date)
                    except Exception as e:
                        logger.error("ACDC: failed to insert '%s': %s", title, e)

            browser.close()

    except Exception as e:
        logger.error("ACDC: crawl failed: %s", e)
        raise

    logger.info(
        "ACDC crawl complete: %d found, %d new, %d updated",
        events_found, events_new, events_updated,
    )
    return events_found, events_new, events_updated
