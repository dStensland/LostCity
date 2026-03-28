"""
Crawler for Aurora Theatre (auroratheatre.com).
Professional theater in Lawrenceville with mainstage productions, family shows,
and the Aurora Academy summer camps and education programs.

Site structure:
  Shows: /productions-and-programs/ with /view/[slug]/ pattern (Playwright).
  Education/camps: /classes-camps/ — static HTML, tabbed layout with one table
    per camp. Each table row contains: title (red bold span), ages/dates/price
    (left column), and description (right column). Parsed with BeautifulSoup.

Education page URL: https://www.auroratheatre.com/classes-camps/
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

logger = logging.getLogger(__name__)

BASE_URL = "https://www.auroratheatre.com"
PRODUCTIONS_URL = f"{BASE_URL}/productions-and-programs/"
CLASSES_CAMPS_URL = f"{BASE_URL}/classes-camps/"

EDUCATION_REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml",
}

PLACE_DATA = {
    "name": "Aurora Theatre",
    "slug": "aurora-theatre",
    "address": "128 E Pike St",
    "neighborhood": "Downtown Lawrenceville",
    "city": "Lawrenceville",
    "state": "GA",
    "zip": "30046",
    "lat": 33.9562,
    "lng": -83.9880,
    "venue_type": "theater",
    "spot_type": "theater",
    "website": BASE_URL,
}

SKIP_PATTERNS = [
    r"^(home|about|contact|donate|support|subscribe|tickets?|buy|cart|menu)$",
    r"^(login|sign in|register|account)$",
    r"^(facebook|twitter|instagram|youtube)$",
    r"^(privacy|terms|policy|copyright)$",
    r"^(season \d+|subscription|flex pass|star pass)$",
    r"^\d+$",
    r"^[a-z]{1,3}$",
]
PRICE_RE = re.compile(r"\$(\d+(?:\.\d{2})?)")


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
    - "Jan 22, 2026-Feb 15, 2026" (with comma before dash)
    - "Jan 22 - Feb 15, 2026"
    - "February 7, 2026" (single day)
    - "Mar 26, 2026-Apr 19, 2026"
    """
    if not date_text:
        return None, None

    date_text = date_text.strip()

    # Pattern: "Mon Day, Year-Mon Day, Year" (e.g., "Jan 22, 2026-Feb 15, 2026")
    full_range_match = re.search(
        r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),\s*(\d{4})\s*[-\u2013\u2014]\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),\s*(\d{4})",
        date_text,
        re.IGNORECASE
    )
    if full_range_match:
        start_month, start_day, start_year, end_month, end_day, end_year = full_range_match.groups()
        try:
            start_dt = datetime.strptime(f"{start_month} {start_day} {start_year}", "%b %d %Y")
            end_dt = datetime.strptime(f"{end_month} {end_day} {end_year}", "%b %d %Y")
            return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Pattern: "Mon Day - Mon Day, Year" (different months, same year)
    range_match = re.search(
        r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})\s*[-\u2013\u2014]\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s*(\d{4})",
        date_text,
        re.IGNORECASE
    )
    if range_match:
        start_month, start_day, end_month, end_day, year = range_match.groups()
        try:
            fmt = "%b %d %Y" if len(start_month) <= 3 else "%B %d %Y"
            start_dt = datetime.strptime(f"{start_month} {start_day} {year}", fmt)
            fmt = "%b %d %Y" if len(end_month) <= 3 else "%B %d %Y"
            end_dt = datetime.strptime(f"{end_month} {end_day} {year}", fmt)
            return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Pattern: Same month range "Jan 12 - 15, 2026"
    same_month_match = re.search(
        r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})\s*[-\u2013\u2014]\s*(\d{1,2}),?\s*(\d{4})",
        date_text,
        re.IGNORECASE
    )
    if same_month_match:
        month, start_day, end_day, year = same_month_match.groups()
        try:
            fmt = "%b %d %Y" if len(month) <= 3 else "%B %d %Y"
            start_dt = datetime.strptime(f"{month} {start_day} {year}", fmt)
            end_dt = datetime.strptime(f"{month} {end_day} {year}", fmt)
            return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Single date
    single_match = re.search(
        r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s*(\d{4})",
        date_text,
        re.IGNORECASE
    )
    if single_match:
        month, day, year = single_match.groups()
        try:
            fmt = "%b %d %Y" if len(month) <= 3 else "%B %d %Y"
            dt = datetime.strptime(f"{month} {day} {year}", fmt)
            return dt.strftime("%Y-%m-%d"), dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return None, None


def extract_price_info(body_text: str) -> tuple[Optional[float], Optional[float], Optional[str]]:
    """Extract ticket pricing from the show page body text."""
    if not body_text:
        return None, None, None

    normalized = " ".join(body_text.split())
    snippet = None

    section_match = re.search(
        r"Tickets:\s*(.*?)(?:Date:|Location:|Attire:|Vote for Patron|MEDIA|JOIN OUR MAILING LISTS)",
        normalized,
        re.IGNORECASE,
    )
    if section_match:
        snippet = section_match.group(1).strip()
    else:
        start_match = re.search(
            r"(Tickets start at\s*\$\d+(?:\.\d{2})?.*?)(?:Date:|Location:|ABOUT|MEDIA)",
            normalized,
            re.IGNORECASE,
        )
        if start_match:
            snippet = start_match.group(1).strip()

    if not snippet:
        return None, None, None

    values = [float(value) for value in PRICE_RE.findall(snippet)]
    if not values:
        return None, None, None

    price_min = min(values)
    price_max = max(values)
    price_note = snippet[:240]
    return price_min, price_max, price_note


# ── education / classes-camps parser ──────────────────────────────────────────


def _parse_aurora_education_date(date_text: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse Aurora Academy date strings like:
      "Monday-Friday | Apr. 6, 2026 – Apr. 10, 2026"
      "Monday – Friday | Jun. 1, 2026 – Jun. 5, 2026"

    Returns (start_date, end_date) in YYYY-MM-DD format.
    """
    if not date_text:
        return None, None

    # Remove day-of-week prefix before the pipe
    if "|" in date_text:
        date_text = date_text.split("|", 1)[1].strip()

    # Normalize: remove trailing periods from month abbreviations
    date_text = re.sub(r"\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.", r"\1", date_text, flags=re.IGNORECASE)

    # Normalize em-dashes to hyphens and collapse whitespace
    date_text = re.sub(r"\s*[\u2013\u2014\u2012]\s*", " - ", date_text)
    date_text = re.sub(r"\s+", " ", date_text).strip()

    # Find all date instances: "Apr 6, 2026" or "Apr 6 2026" or "Apr 10 , 2026" (space before comma)
    date_pattern = r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s*,?\s*(\d{4})"
    matches = re.findall(date_pattern, date_text, re.IGNORECASE)

    if len(matches) >= 2:
        try:
            s = datetime.strptime(f"{matches[0][0]} {matches[0][1]} {matches[0][2]}", "%b %d %Y")
            e = datetime.strptime(f"{matches[1][0]} {matches[1][1]} {matches[1][2]}", "%b %d %Y")
            return s.strftime("%Y-%m-%d"), e.strftime("%Y-%m-%d")
        except ValueError:
            pass
    elif len(matches) == 1:
        try:
            s = datetime.strptime(f"{matches[0][0]} {matches[0][1]} {matches[0][2]}", "%b %d %Y")
            return s.strftime("%Y-%m-%d"), s.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return None, None


def _parse_camp_from_title_span(title_span: BeautifulSoup, tab_label: str) -> Optional[dict]:
    """
    Parse one Aurora camp entry given its red title span.

    Page structure (nested inline tables from WordPress editor):
      <table>
        <tbody>
          <tr><td><span style="color: #ff0000; font-size: x-large;">TITLE</span></td></tr>
          <tr><td>
            <table>  ← inner detail table
              <tbody>
                <tr>
                  <td>Ages: N-M\nDay | Date\nTime\nPrice: $N</td>
                  <td>description text</td>
                </tr>
              </tbody>
            </table>
          </td></tr>
        </tbody>
      </table>

    We find the outer table by walking up from the span, then grab the detail inner
    table from the following row.
    """
    # Extract title text
    title = re.sub(r"\s+", " ", title_span.get_text(separator=" ", strip=True)).strip()
    if not title or len(title) < 3:
        return None

    # Walk up: span → td → tr → tbody → table (outer camp table)
    outer_table = title_span.find_parent("table")
    if not outer_table:
        return None

    # All rows in the outer table (recursive=True needed — tbody is implicit layer)
    all_rows = outer_table.find_all("tr")
    if len(all_rows) < 2:
        return None

    # Row 0 contains the title; row 1 contains the detail inner table
    detail_row = all_rows[1]
    detail_cell = detail_row.find("td")
    if not detail_cell:
        return None

    inner_table = detail_cell.find("table")
    if not inner_table:
        return None

    inner_rows = inner_table.find_all("tr")
    if not inner_rows:
        return None

    inner_cells = inner_rows[0].find_all("td")
    if len(inner_cells) >= 2:
        left_text = inner_cells[0].get_text(separator="\n", strip=True)
        desc_text = inner_cells[1].get_text(separator=" ", strip=True)
    elif len(inner_cells) == 1:
        left_text = inner_cells[0].get_text(separator="\n", strip=True)
        desc_text = ""
    else:
        return None

    left_lines = [ln.strip() for ln in left_text.split("\n") if ln.strip()]

    # The date range can be split across 2-3 lines, e.g.:
    #   "Monday-Friday | Apr. 6, 2026"
    #   "– Apr. 10"
    #   ", 2026"
    # Merge all date-region lines into one string before parsing.
    ages_str = time_str = price_str = ""
    date_parts: list[str] = []
    in_date_region = False
    for line in left_lines:
        if re.match(r"ages?:", line, re.IGNORECASE):
            ages_str = line
            in_date_region = False
        elif re.search(r"\d{1,2}:\d{2}\s*[AP]M", line, re.IGNORECASE):
            time_str = line
            in_date_region = False
        elif re.match(r"price:", line, re.IGNORECASE):
            price_str = line
            in_date_region = False
        elif re.search(r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)", line, re.IGNORECASE):
            # Start of a date region
            date_parts.append(line)
            in_date_region = True
        elif in_date_region and re.search(r"[\u2013\u2014-]|,\s*\d{4}", line):
            # Continuation line: em-dash fragment "– Apr. 10" or ", 2026"
            date_parts.append(line)
        else:
            in_date_region = False

    date_str = " ".join(date_parts)

    # Parse ages
    age_min: Optional[int] = None
    age_max: Optional[int] = None
    age_tags: list[str] = []
    m_age = re.search(r"ages?:\s*(\d+)\s*[-\u2013]\s*(\d+)", ages_str, re.IGNORECASE)
    if m_age:
        age_min = int(m_age.group(1))
        age_max = int(m_age.group(2))
        if age_min <= 10:
            age_tags.append("elementary")
        if age_min <= 13 and age_max >= 10:
            age_tags.append("tween")
        if age_max >= 13:
            age_tags.append("teen")

    start_date, end_date = _parse_aurora_education_date(date_str)
    if not start_date:
        return None

    # Parse times "10:00AM – 4:00PM"
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    tm = re.search(
        r"(\d{1,2}:\d{2})\s*([AP]M)\s*[\u2013\u2014-]\s*(\d{1,2}:\d{2})\s*([AP]M)",
        time_str,
        re.IGNORECASE,
    )
    if tm:
        try:
            start_time = datetime.strptime(f"{tm.group(1)}{tm.group(2).upper()}", "%I:%M%p").strftime("%H:%M")
            end_time = datetime.strptime(f"{tm.group(3)}{tm.group(4).upper()}", "%I:%M%p").strftime("%H:%M")
        except ValueError:
            pass

    # Parse price
    price_val: Optional[float] = None
    price_note: Optional[str] = None
    pm = re.search(r"\$(\d+)", price_str)
    if pm:
        price_val = float(pm.group(1))
        price_note = f"${int(price_val)} per session"

    # Enroll link — look anywhere within the outer table
    ticket_url: Optional[str] = None
    enroll_link = outer_table.find("a", href=True)
    if enroll_link:
        href = enroll_link.get("href", "")
        if href.startswith("http"):
            ticket_url = href

    return {
        "title": title,
        "description": desc_text[:800] if desc_text else f"{title} at Aurora Theatre.",
        "start_date": start_date,
        "end_date": end_date,
        "start_time": start_time or "10:00",
        "end_time": end_time or "16:00",
        "age_min": age_min,
        "age_max": age_max,
        "age_tags": age_tags,
        "price_min": price_val,
        "price_max": price_val,
        "price_note": price_note,
        "ticket_url": ticket_url,
        "tab_label": tab_label,
    }


def _crawl_aurora_education(source_id: int, venue_id: int) -> tuple[int, int, int]:
    """
    Crawl Aurora Academy /classes-camps/ page and insert future programs.
    Returns (found, new, updated).
    """
    found = new = updated = 0

    try:
        resp = requests.get(CLASSES_CAMPS_URL, headers=EDUCATION_REQUEST_HEADERS, timeout=20)
        resp.raise_for_status()
    except Exception as exc:
        logger.warning("[aurora-theatre] Failed to fetch education page: %s", exc)
        return 0, 0, 0

    soup = BeautifulSoup(resp.text, "html.parser")

    # Each bootstrap tab-pane contains one or more camp tables
    tab_panes = soup.find_all("div", class_="tab-pane")
    if not tab_panes:
        logger.warning("[aurora-theatre] No tab panes found on education page")
        return 0, 0, 0

    all_camps: list[dict] = []
    # Track which outer tables we've already parsed to avoid double-counting
    # (inner tables also contain red spans in some layouts)
    seen_tables: set[int] = set()

    for pane in tab_panes:
        tab_id = pane.get("id", "")
        tab_label = tab_id.replace("-", " ").title()

        # Discover camps by finding red title spans, then walking up to their table.
        # This avoids the recursive=False / implicit-tbody bug where
        # table.find_all("tr", recursive=False) always returns [].
        for span in pane.find_all("span"):
            style = span.get("style", "") or ""
            if "color: #ff0000" not in style or "font-size: x-large" not in style:
                continue

            # Make sure this span's parent table hasn't been parsed already
            outer_table = span.find_parent("table")
            if outer_table is None:
                continue
            table_id = id(outer_table)
            if table_id in seen_tables:
                continue
            seen_tables.add(table_id)

            camp = _parse_camp_from_title_span(span, tab_label)
            if camp:
                all_camps.append(camp)

    logger.info("[aurora-theatre] Education page: %d camp records parsed", len(all_camps))

    today = date.today()
    for camp in all_camps:
        end_check = camp.get("end_date") or camp.get("start_date")
        if end_check:
            try:
                if datetime.strptime(end_check, "%Y-%m-%d").date() < today:
                    continue
            except ValueError:
                pass

        found += 1
        title = camp["title"]
        start_date = camp["start_date"]
        end_date = camp.get("end_date")
        age_tags = camp.pop("age_tags", [])
        camp.pop("tab_label", None)

        content_hash = generate_content_hash(f"{title}|education", "Aurora Theatre", start_date)

        tags = ["aurora-theatre", "theater", "lawrenceville", "gwinnett", "camp", "education"]
        tags.extend(age_tags)
        if camp.get("age_max") and camp["age_max"] <= 10:
            tags.append("kids")
        if camp.get("age_min") and camp["age_min"] >= 13:
            tags.append("teen")

        series_hint = None
        if end_date and end_date != start_date:
            series_hint = {"series_type": "class_series", "series_title": title}

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": f"{title} — Aurora Academy",
            "description": camp["description"],
            "start_date": start_date,
            "end_date": end_date,
            "start_time": camp.get("start_time", "10:00"),
            "end_time": camp.get("end_time", "16:00"),
            "is_all_day": False,
            "category": "education",
            "subcategory": "education.performing-arts",
            "tags": list(set(tags)),
            "age_min": camp.get("age_min"),
            "age_max": camp.get("age_max"),
            "is_free": False,
            "price_min": camp.get("price_min"),
            "price_max": camp.get("price_max"),
            "price_note": camp.get("price_note"),
            "source_url": CLASSES_CAMPS_URL,
            "ticket_url": camp.get("ticket_url") or CLASSES_CAMPS_URL,
            "image_url": None,
            "raw_text": f"{title}|Aurora Theatre|{start_date}",
            "extraction_confidence": 0.90,
            "is_recurring": False,
            "recurrence_rule": None,
            "content_hash": content_hash,
        }

        existing = find_event_by_hash(content_hash)
        if existing:
            smart_update_existing_event(existing, event_record)
            updated += 1
            logger.debug("[aurora-theatre] Updated education: %s on %s", title, start_date)
            continue

        try:
            insert_event(event_record, series_hint=series_hint)
            new += 1
            logger.info("[aurora-theatre] Added education: %s on %s", title, start_date)
        except Exception as exc:
            logger.error("[aurora-theatre] Failed to insert education %s: %s", title, exc)

    return found, new, updated


# ── main crawl entrypoint ──────────────────────────────────────────────────────


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Aurora Theatre — mainstage productions AND Aurora Academy education programs.

    Pass 1 (static HTTP): Fetch /classes-camps/ and parse summer camps / education
      programs with BeautifulSoup. No Playwright needed — page is server-rendered.

    Pass 2 (Playwright): Navigate /productions-and-programs/ and visit each
      /view/[slug]/ show page to extract title, dates, description, and pricing.
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

            # Pass 1: Education programs (static HTTP — no Playwright needed)
            logger.info("[aurora-theatre] Crawling education programs at %s", CLASSES_CAMPS_URL)
            try:
                edu_found, edu_new, edu_updated = _crawl_aurora_education(source_id, venue_id)
                events_found += edu_found
                events_new += edu_new
                events_updated += edu_updated
                logger.info(
                    "[aurora-theatre] Education: %d found, %d new, %d updated",
                    edu_found, edu_new, edu_updated,
                )
            except Exception as exc:
                logger.error("[aurora-theatre] Education crawl failed: %s", exc)

            # Pass 2: Mainstage productions (Playwright)
            logger.info(f"Fetching Aurora Theatre: {PRODUCTIONS_URL}")
            page.goto(PRODUCTIONS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(4000)

            # Scroll to load content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Aurora uses /productions-and-programs/view/[slug]/ URLs
            show_links = page.query_selector_all('a[href*="/view/"]')

            show_urls = set()
            for link in show_links:
                href = link.get_attribute("href")
                if href and "/view/" in href:
                    # Skip archive pages
                    if "archive" in href.lower():
                        continue
                    full_url = href if href.startswith("http") else BASE_URL + href
                    show_urls.add(full_url)

            logger.info(f"Found {len(show_urls)} show pages")

            # Process each show page
            for show_url in show_urls:
                try:
                    page.goto(show_url, wait_until="domcontentloaded", timeout=20000)
                    page.wait_for_timeout(3000)

                    # Get title from H1
                    title = None
                    h1 = page.query_selector("h1")
                    if h1:
                        title = h1.inner_text().strip()

                    if not title:
                        # Extract from URL
                        match = re.search(r"/view/([^/]+)/?", show_url)
                        if match:
                            title = match.group(1).replace("-", " ").title()

                    if not title or not is_valid_title(title):
                        logger.debug(f"Skipping invalid title: {title}")
                        continue

                    # Get dates from H2 tag (dates are consistently in the first H2)
                    start_date, end_date = None, None
                    h2 = page.query_selector("h2")
                    if h2:
                        date_text = h2.inner_text().strip()
                        start_date, end_date = parse_date_range(date_text)

                    if not start_date:
                        logger.debug(f"No dates found for {title}")
                        continue

                    # Skip past shows
                    check_date = end_date or start_date
                    try:
                        if datetime.strptime(check_date, "%Y-%m-%d").date() < datetime.now().date():
                            logger.debug(f"Skipping past show: {title} ({check_date})")
                            continue
                    except ValueError:
                        pass

                    # Get description - it's typically in the ABOUT section
                    description = None
                    body_text = page.inner_text("body")
                    price_min, price_max, price_note = extract_price_info(body_text)

                    # Look for text after "ABOUT" heading
                    about_match = re.search(
                        r'(?:^|\n)ABOUT\n+(.*?)(?:Buy Tickets|MEDIA|January|February|March|April|May|June|July|August|September|October|November|December|\n\n\n)',
                        body_text,
                        re.DOTALL,
                    )
                    if about_match:
                        desc = about_match.group(1).strip()
                        desc = re.sub(r'(Metro Waterproofing Main Stage|Runtime:.*|Content Advisory:.*)', '', desc, flags=re.DOTALL)
                        desc = re.sub(r'^(FAQ|BUY TICKETS|DONATE|SUBSCRIBE|SEASON|HOME|ABOUT)\s*', '', desc, flags=re.IGNORECASE | re.MULTILINE)
                        desc = desc.strip()
                        if len(desc) > 30:
                            description = desc[:800]

                    # Get image - look for production images, not the program button
                    image_url = None
                    imgs = page.query_selector_all("img")
                    for img in imgs:
                        src = img.get_attribute("src") or img.get_attribute("data-src")
                        if src and "logo" not in src.lower() and "Program_WebButton" not in src:
                            if "scaled" in src or any(word in src for word in ["/PTGW-", "/Flat", "/Heights", "/Initiative"]):
                                image_url = src if src.startswith("http") else BASE_URL + src
                                break

                    # Fallback: get any non-logo image
                    if not image_url:
                        for img in imgs:
                            src = img.get_attribute("src") or img.get_attribute("data-src")
                            if src and "logo" not in src.lower() and "Program_WebButton" not in src and "wp-content/uploads" in src:
                                image_url = src if src.startswith("http") else BASE_URL + src
                                break

                    # Determine category based on title/content
                    category = "theater"
                    subcategory = "play"
                    tags = ["aurora-theatre", "theater", "lawrenceville", "gwinnett"]

                    if any(word in title.lower() for word in ["musical", "heights", "chorus"]):
                        subcategory = "musical"
                        tags.append("musical")
                    elif any(word in body_text.lower() for word in ["children", "kids", "family", "playhouse"]):
                        tags.append("family")
                        tags.append("kids")

                    events_found += 1

                    content_hash = generate_content_hash(title, "Aurora Theatre", start_date)

                    # Build series hint for show runs
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
                        "description": description or f"{title} at Aurora Theatre",
                        "start_date": start_date,
                        "start_time": "19:30",  # Aurora typically starts at 7:30
                        "end_date": end_date,
                        "end_time": None,
                        "is_all_day": False,
                        "category": category,
                        "subcategory": subcategory,
                        "tags": tags,
                        "price_min": price_min,
                        "price_max": price_max,
                        "price_note": price_note,
                        "is_free": price_max == 0.0 if price_max is not None else False,
                        "source_url": show_url,
                        "ticket_url": show_url,
                        "image_url": image_url,
                        "raw_text": f"{title}",
                        "extraction_confidence": 0.88,
                        "is_recurring": True if end_date and end_date != start_date else False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

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
                    logger.warning(f"Failed to process {show_url}: {e}")
                    continue

            browser.close()

        logger.info(
            "[aurora-theatre] Crawl complete: %d found, %d new, %d updated (shows + education)",
            events_found, events_new, events_updated,
        )

    except Exception as e:
        logger.error(f"Failed to crawl Aurora Theatre: {e}")
        raise

    return events_found, events_new, events_updated
