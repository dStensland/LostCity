"""
Crawler for the Creative Capital artist opportunities directory.

Source: https://creative-capital.org/artist-resources/artist-opportunities/

Creative Capital maintains a curated list of ~110 artist opportunities from
organizations across the US, paginated across approximately 5 pages (24 items
per page, plus 2 featured items shown on every page).

The page uses JavaScript pagination (WordPress admin-ajax), but the server
also responds to standard WordPress /page/N/ URL paths with correctly paginated
server-rendered HTML — no Playwright required.

Crawl strategy:

  1. Fetch page 1 to determine total page count from the .pagination element.
  2. Fetch pages 1..N sequentially with a polite delay.
  3. On each page, parse both the featured items (div.block-featured-items)
     and the main items-holder. De-duplicate by URL across pages (the 2
     featured items appear on every page).
  4. For each item:
       - Title from <h3> (first one wins)
       - Org name + deadline from <span class="label-text">
         Format: "Org Name — Deadline: Month DD, YYYY"
         or just "Deadline: Rolling"
         or category labels like "Free Courses"
       - Description from <p class="p-small"> (often empty)
       - Application URL from the <a class="item"> href

Deadline handling:
  - "Rolling" deadlines are included with deadline=None since the opportunity
    is actively ongoing.
  - Specific date deadlines: skip if already past.
  - No deadline text: include with deadline=None.

Call type inference:
  - From title/description keywords (residency, grant, fellowship, etc.)
  - Default: "grant"

Confidence tier: "aggregated" — Creative Capital is curating other orgs' calls.
Scope: national.

HTML structure (verified 2026-03-24):
  Page URL pattern: /artist-resources/artist-opportunities/  (page 1)
                    /artist-resources/artist-opportunities/page/N/  (pages 2+)

  Featured block (appears on every page — always de-duplicate by URL):
    div.block-featured-items
      a.item[href]
        div.item-title
          span.label-text.small  — "Org — Deadline: DATE" or "Free Courses"
          h3.medium-title        — opportunity title
        div.item-desc
          p.p-small              — description (often empty in this block)

  Main items holder:
    div.row.block-items.items-holder
      a.item[href]
        div.item-title
          span.label-text.small  — deadline/org info
          h3                     — title
        div.item-desc
          p.p-small              — description

  Pagination:
    div.pagination
      a[data-page="N"]           — page numbers (1-indexed)
      a.pagination-btn.next[data-page="N"]  — next page number or missing if last
"""

import logging
import re
import time
from datetime import date, datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db.open_calls import insert_open_call

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

BASE_URL = "https://creative-capital.org"
DIRECTORY_URL = "https://creative-capital.org/artist-resources/artist-opportunities/"
SOURCE_URL = DIRECTORY_URL

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
)

# Polite delay between page fetches (seconds)
PAGE_FETCH_DELAY_S = 1.5

# Safety cap — directory currently has ~5 pages
MAX_PAGES = 10

_MONTH_MAP: dict[str, int] = {
    "january": 1, "february": 2, "march": 3, "april": 4,
    "may": 5, "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12,
}

# Labels in .label-text that indicate the item is NOT an open call
_NON_CALL_LABELS: frozenset[str] = frozenset({
    "free courses",
    "courses",
    "events",
    "resources",
    "news",
})


# ---------------------------------------------------------------------------
# HTTP helper
# ---------------------------------------------------------------------------


def _fetch(url: str, session: requests.Session) -> Optional[str]:
    """Fetch a URL and return its HTML text, or None on failure."""
    try:
        resp = session.get(url, timeout=30)
        resp.raise_for_status()
        return resp.text
    except requests.RequestException as exc:
        logger.warning("CC-Dir: failed to fetch %s: %s", url, exc)
        return None


# ---------------------------------------------------------------------------
# Deadline parsing
# ---------------------------------------------------------------------------


def _parse_deadline(text: str) -> Optional[str]:
    """
    Parse a deadline date from the .label-text span content.

    Handles:
      "Harpo Foundation — Deadline: April 27, 2026"  → "2026-04-27"
      "Deadline: Rolling"                             → None
      "Deadline: March 8, 2026"                       → "2026-03-08"
      "Free Courses"                                  → None
    """
    if not text:
        return None

    lower = text.lower()

    # Skip rolling deadlines — included but with deadline=None
    if "rolling" in lower:
        return None

    # "Month D(D), YYYY"
    m = re.search(
        r"(January|February|March|April|May|June|July|August|September"
        r"|October|November|December)\s+(\d{1,2}),?\s+(\d{4})",
        text,
        re.I,
    )
    if m:
        month_name, day, year = m.groups()
        month_num = _MONTH_MAP.get(month_name.lower())
        if month_num:
            return f"{int(year)}-{month_num:02d}-{int(day):02d}"

    # MM/DD/YYYY
    m = re.search(r"\b(\d{1,2})/(\d{1,2})/(\d{4})\b", text)
    if m:
        month, day, year = m.groups()
        return f"{int(year)}-{int(month):02d}-{int(day):02d}"

    return None


def _is_past_deadline(deadline_str: Optional[str]) -> bool:
    """Return True if the deadline date has already passed."""
    if not deadline_str:
        return False
    try:
        dl = datetime.strptime(deadline_str, "%Y-%m-%d").date()
        return dl < date.today()
    except ValueError:
        return False


def _is_rolling(info_text: str) -> bool:
    """Return True if the label text indicates a rolling deadline."""
    return "rolling" in info_text.lower()


# ---------------------------------------------------------------------------
# Call type inference
# ---------------------------------------------------------------------------

_RESIDENCY_RE = re.compile(
    r"\bresiden(?:cy|ce|t)\b|\bretreat\b|\bcolony\b|\bin[\s-]residence\b",
    re.I,
)
_GRANT_RE = re.compile(
    r"\bgrant\b|\bfellowship\b|\baward\b|\bprize\b|\bfund\b",
    re.I,
)
_SUBMISSION_RE = re.compile(
    r"\bopen\s+call\b|\bcall\s+for\b|\bsubmission\b|\bentry\b|\bcompetition\b",
    re.I,
)
_COMMISSION_RE = re.compile(r"\bcommission\b", re.I)


def _infer_call_type(title: str, description: str) -> str:
    """
    Determine call_type from title and description keywords.

    Priority: commission > residency > submission > grant > default
    """
    combined = f"{title} {description}"
    if _COMMISSION_RE.search(combined):
        return "commission"
    if _RESIDENCY_RE.search(combined):
        return "residency"
    if _SUBMISSION_RE.search(combined):
        return "submission"
    if _GRANT_RE.search(combined):
        return "grant"
    return "grant"


# ---------------------------------------------------------------------------
# Item parser
# ---------------------------------------------------------------------------


def _parse_item(item_tag) -> Optional[dict]:
    """
    Parse a single <a class="item"> element into a raw listing dict.

    Returns None if the item is not an open call (e.g., courses, events)
    or is missing required fields (title, URL).
    """
    href = item_tag.get("href", "").strip()
    if not href:
        return None

    # Normalize URL — some are relative, most are absolute
    if href.startswith("/"):
        href = BASE_URL + href

    # Title: first <h3> inside the item
    h3 = item_tag.find("h3")
    title = h3.get_text(strip=True) if h3 else ""
    if not title:
        return None

    # Label text: contains org name + deadline or category label
    label_span = item_tag.find("span", class_="label-text")
    info_text = label_span.get_text(strip=True) if label_span else ""

    # Skip non-call items (courses, events, etc.)
    info_lower = info_text.lower()
    for skip_label in _NON_CALL_LABELS:
        if info_lower == skip_label or info_lower.startswith(skip_label + " "):
            return None

    # Also skip items where info has no deadline language at all and no org name
    # (these are typically resource links, not opportunities)
    if not info_text or ("deadline" not in info_lower and "—" not in info_text and "rolling" not in info_lower):
        # Allow through if it looks like an opportunity by title
        combined = title.lower()
        if not any(
            kw in combined
            for kw in (
                "grant", "fellowship", "award", "residency", "prize",
                "commission", "fund", "call", "opportunity",
            )
        ):
            return None

    # Extract org name from info text
    # Format: "Org Name — Deadline: DATE" or "Org Name — Deadline: Rolling"
    org_name = ""
    deadline_text = info_text
    if "—" in info_text:
        parts = info_text.split("—", 1)
        org_name = parts[0].strip()
        deadline_text = parts[1].strip() if len(parts) > 1 else info_text

    # Parse deadline
    deadline = _parse_deadline(info_text)  # parse from full info text for best match
    is_rolling = _is_rolling(info_text)

    # Description from p.p-small
    desc_p = item_tag.find("p", class_="p-small")
    description = desc_p.get_text(strip=True) if desc_p else ""

    return {
        "title": title,
        "org_name": org_name,
        "description": description[:2000] if description else None,
        "deadline": deadline,
        "is_rolling": is_rolling,
        "info_text": info_text,
        "application_url": href,
    }


# ---------------------------------------------------------------------------
# Page parser
# ---------------------------------------------------------------------------


def _parse_page(html: str) -> tuple[list[dict], int]:
    """
    Parse a single opportunities directory page.

    Returns (listings, last_page_num).
    last_page_num is the highest page number in the pagination, or 1 if no
    pager is found.
    """
    soup = BeautifulSoup(html, "html.parser")
    seen_urls: set[str] = set()
    listings: list[dict] = []

    def _collect_items(container) -> None:
        """Parse items from a container, de-duplicating by URL."""
        if not container:
            return
        for item_tag in container.find_all("a", class_="item"):
            parsed = _parse_item(item_tag)
            if not parsed:
                continue
            url = parsed["application_url"]
            if url in seen_urls:
                continue
            seen_urls.add(url)
            listings.append(parsed)

    # Featured block (shown on every page — contains 2 highlighted items)
    featured = soup.find("div", class_="block-featured-items")
    _collect_items(featured)

    # Main items holder
    holder = soup.find("div", class_="items-holder")
    _collect_items(holder)

    # Determine last page from pagination
    last_page = 1
    pager = soup.find("div", class_="pagination")
    if pager:
        page_links = pager.find_all("a", attrs={"data-page": True})
        for link in page_links:
            try:
                page_num = int(link["data-page"])
                if page_num > last_page:
                    last_page = page_num
            except (ValueError, KeyError):
                pass

    return listings, last_page


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl the Creative Capital artist opportunities directory.

    Strategy:
      1. Fetch page 1 — parse items and determine total page count.
      2. Fetch pages 2..N sequentially with PAGE_FETCH_DELAY_S between fetches.
      3. De-duplicate items by URL across pages (featured items appear on all pages).
      4. Skip past-deadline items (rolling deadlines are kept with deadline=None).
      5. Insert/update each call via insert_open_call().

    Returns (found, new, updated).
    """
    source_id = source["id"]
    found = new = updated = 0

    session = requests.Session()
    session.headers.update({
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    })

    # Collect all items across all pages
    all_listings: list[dict] = []
    seen_urls: set[str] = set()

    # Page 1 (base URL)
    html = _fetch(DIRECTORY_URL, session)
    if not html:
        logger.error("CC-Dir: failed to fetch page 1 — aborting")
        return 0, 0, 0

    page_listings, last_page = _parse_page(html)
    for listing in page_listings:
        url = listing["application_url"]
        if url not in seen_urls:
            seen_urls.add(url)
            all_listings.append(listing)

    logger.debug("CC-Dir: page 1 — %d items (last_page=%d)", len(page_listings), last_page)

    # Remaining pages
    for page_num in range(2, min(last_page + 1, MAX_PAGES + 1)):
        time.sleep(PAGE_FETCH_DELAY_S)

        page_url = f"{DIRECTORY_URL}page/{page_num}/"
        page_html = _fetch(page_url, session)
        if not page_html:
            logger.warning("CC-Dir: failed to fetch page %d — stopping pagination", page_num)
            break

        page_listings, _ = _parse_page(page_html)
        new_this_page = 0
        for listing in page_listings:
            url = listing["application_url"]
            if url not in seen_urls:
                seen_urls.add(url)
                all_listings.append(listing)
                new_this_page += 1

        logger.debug("CC-Dir: page %d — %d new items", page_num, new_this_page)

    logger.info("CC-Dir: %d total unique items collected across %d pages", len(all_listings), last_page)

    if not all_listings:
        logger.warning("CC-Dir: no items parsed — check if page structure changed")
        return 0, 0, 0

    # Process each listing
    skipped_deadline = 0
    skipped_no_url = 0

    for listing in all_listings:
        title = listing["title"]
        application_url = listing.get("application_url", "")

        if not application_url:
            skipped_no_url += 1
            logger.debug("CC-Dir: skipping %r — no URL", title[:60])
            continue

        deadline = listing.get("deadline")
        is_rolling = listing.get("is_rolling", False)

        # Skip past-deadline calls (but not rolling ones)
        if deadline and not is_rolling and _is_past_deadline(deadline):
            skipped_deadline += 1
            logger.debug(
                "CC-Dir: skipping %r — deadline %s already passed",
                title[:60],
                deadline,
            )
            continue

        found += 1

        org_name = listing.get("org_name", "").strip()
        description = listing.get("description") or ""
        call_type = _infer_call_type(title, description)

        # Prefix org name into description when present and not already there
        full_description = description
        if org_name and description and org_name.lower() not in description.lower()[:80]:
            full_description = f"{org_name}: {description}"

        call_data: dict = {
            "title": title,
            "description": full_description[:2000] if full_description else None,
            "deadline": deadline,
            "application_url": application_url,
            "source_url": SOURCE_URL,
            "call_type": call_type,
            "eligibility": "National",
            "fee": None,
            "source_id": source_id,
            "confidence_tier": "aggregated",
            "_org_name": org_name or "creative-capital",
            "metadata": {
                "organization": org_name,
                "info_text": listing.get("info_text"),
                "is_rolling": is_rolling,
                "scope": "national",
                "directory_source": "creative-capital-artist-opportunities",
            },
        }

        result = insert_open_call(call_data)
        if result:
            new += 1
            logger.debug(
                "CC-Dir: inserted/updated %r (deadline=%s, type=%s)",
                title[:60],
                deadline or ("rolling" if is_rolling else "none"),
                call_type,
            )

    if skipped_deadline:
        logger.info("CC-Dir: skipped %d past-deadline listings", skipped_deadline)
    if skipped_no_url:
        logger.info("CC-Dir: skipped %d listings with no URL", skipped_no_url)

    logger.info(
        "CC-Dir: %d found (non-expired), %d new, %d updated", found, new, updated
    )
    return found, new, updated
