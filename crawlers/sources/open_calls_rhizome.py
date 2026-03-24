"""
Crawler for Rhizome Community Opportunities (rhizome.org/community/?type=opportunity).

Rhizome is the 30-year-old international hub for new media art (born-digital,
net art, AI art, technology art), affiliated with the New Museum. Their
community bulletin board is a moderated, globally respected aggregator of
grants, residencies, commissions, open calls, and exhibition opportunities
in the tech/new media art world.

Source: https://rhizome.org/community/?type=opportunity

HTML structure (verified 2026-03-24, server-rendered — no Playwright needed):
  div#community-posts-list
    div.community-list-item  (16 per page)
      div.listing-header
        div.listing-summary
          h2 > a[href="/community/NNNNN/"]  — title + detail URL
          ul.information
            li > span.heading "Deadline:" + text  — deadline (may be absent)
            li.location > span.heading "Location:" + text  — location
      div.text-content       — description snippet (truncated)
      a.read-more-link[href] — same as title href
      div.metadata
        div > time[datetime] — ISO datetime string (posted date)
        div > a.active       — type label ("opportunity")

Pagination:
  ?page=N  (page 1 = default, 16 items/page)
  div#load-more-indicator data-pagecount="598" tells us total pages.
  Sort order: by deadline descending (far-future deadlines appear on page 1).
  Stop condition: all items on a page have past deadlines (or no deadline),
  or posted date is older than 6 months — whichever comes first.

Detail pages (rhizome.org/community/NNNNN/):
  These are behind Cloudflare JS challenge. We skip individual detail fetches
  and use the listing-page snippet as description. The listing page gives us:
    - title (full)
    - deadline (exact date)
    - location
    - description snippet (100–200 chars, truncated with "…")
    - source URL (the detail page URL)

  The application URL = the source_url since Rhizome listings ARE the canonical
  apply page (visitors click through to the full post to find the apply link).
  We cannot bypass Cloudflare without Playwright, and the listing-page data is
  sufficient for our purposes.

Call type mapping (inferred from title keywords, no structured type on listing):
  title contains "residency" / "artist-in-residence" / "fellowship" → residency
  title contains "fellowship" / "award" / "prize" / "grant"        → fellowship or grant
  title contains "commission" / "public art" / "rfp" / "rfq"       → commission
  title contains "exhibition" / "proposal"                          → exhibition_proposal
  default                                                            → submission

Confidence tier: "aggregated" — Rhizome is a curated aggregator.
Eligibility: "International" — Rhizome's community is global.

Rate limiting: 0.5s between page fetches.
Stop after 6 months of past deadlines appear consistently across a page.
"""

import logging
import re
import time
from datetime import date, datetime, timedelta
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db.open_calls import insert_open_call

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

BASE_URL = "https://rhizome.org"
LISTING_URL = "https://rhizome.org/community/?type=opportunity"

_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

PAGE_DELAY_S = 0.5  # between page fetches
MAX_PAGES = 20  # hard cap — 320 items max per run (avoid runaway pagination)

# How far back we look: stop when a full page has no items posted within this window
_LOOKBACK_DAYS = 180  # ~6 months

# ---------------------------------------------------------------------------
# Call type mapping
# ---------------------------------------------------------------------------

# Ordered from most-specific to least — first match wins
_CALL_TYPE_KEYWORDS: list[tuple[list[str], str]] = [
    (
        ["residency", "artist-in-residence", "artist in residence", "studio residency"],
        "residency",
    ),
    (["fellowship", "fellow "], "fellowship"),
    (["grant", "award", "prize", "bursary", "stipend"], "grant"),
    (["commission", "public art", "rfp", "rfq", "mural"], "commission"),
    (["exhibition", "proposal", "curatorial"], "exhibition_proposal"),
    # "open call" and everything else falls through to submission
]


def _infer_call_type(title: str) -> str:
    """Map title keywords to a call_type enum value."""
    title_lower = title.lower()
    for keywords, call_type in _CALL_TYPE_KEYWORDS:
        if any(kw in title_lower for kw in keywords):
            return call_type
    return "submission"


# ---------------------------------------------------------------------------
# Date parsing
# ---------------------------------------------------------------------------

# "2026-03-31, 12:00p.m." or "2030-12-31, 12:00p.m."
_DEADLINE_DATE_RE = re.compile(r"(\d{4}-\d{2}-\d{2})")


def _parse_deadline(text: str) -> Optional[str]:
    """
    Extract YYYY-MM-DD from Rhizome deadline text like "2026-03-31, 12:00p.m.".
    Returns ISO date string or None.
    """
    m = _DEADLINE_DATE_RE.search(text)
    if not m:
        return None
    raw = m.group(1)
    try:
        datetime.fromisoformat(raw)
    except ValueError:
        return None
    return raw


def _parse_posted_date(datetime_attr: str) -> Optional[date]:
    """
    Parse the <time datetime="..."> ISO datetime to a date object.
    Returns None on parse failure.
    """
    if not datetime_attr:
        return None
    try:
        return datetime.fromisoformat(datetime_attr).date()
    except ValueError:
        # Try truncated form "2026-02-18"
        try:
            return date.fromisoformat(datetime_attr[:10])
        except ValueError:
            return None


def _is_past_deadline(deadline_str: Optional[str]) -> bool:
    """Return True if deadline has already passed today."""
    if not deadline_str:
        return False
    try:
        return date.fromisoformat(deadline_str) < date.today()
    except ValueError:
        return False


# ---------------------------------------------------------------------------
# HTTP helper
# ---------------------------------------------------------------------------


def _fetch(url: str, session: requests.Session) -> Optional[bytes]:
    """Fetch a URL and return content bytes, or None on failure."""
    try:
        resp = session.get(url, timeout=30)
        resp.raise_for_status()
        return resp.content
    except requests.RequestException as exc:
        logger.warning("Rhizome: failed to fetch %s — %s", url, exc)
        return None


# ---------------------------------------------------------------------------
# Page parser
# ---------------------------------------------------------------------------


def _parse_listing_item(item_div) -> Optional[dict]:
    """
    Parse one div.community-list-item into a raw data dict.

    Returns None if the item is missing required fields (title, source_url).
    """
    # Title + source URL
    title_link = item_div.select_one("div.listing-summary h2 a")
    if not title_link:
        return None

    title = title_link.get_text(strip=True)
    if not title:
        return None

    href = title_link.get("href", "").strip()
    if not href:
        return None
    source_url = BASE_URL + href if href.startswith("/") else href

    # Deadline (may be absent for some listings)
    deadline: Optional[str] = None
    deadline_heading = item_div.find(
        "span", class_="heading", string=lambda t: t and "Deadline" in t
    )
    if deadline_heading and deadline_heading.parent:
        deadline_text = deadline_heading.parent.get_text(strip=True)
        deadline = _parse_deadline(deadline_text)

    # Location (optional metadata)
    location: Optional[str] = None
    loc_li = item_div.find("li", class_="location")
    if loc_li:
        loc_text = loc_li.get_text(strip=True)
        # Strip the "Location:" prefix
        location = re.sub(r"^Location\s*:\s*", "", loc_text, flags=re.I).strip() or None

    # Posted datetime
    posted_time = item_div.find("time")
    posted_date: Optional[date] = None
    posted_datetime_str: Optional[str] = None
    if posted_time:
        posted_datetime_str = posted_time.get("datetime", "")
        posted_date = _parse_posted_date(posted_datetime_str)

    # Description snippet from div.text-content
    description: Optional[str] = None
    text_div = item_div.select_one("div.text-content")
    if text_div:
        desc_text = text_div.get_text(separator=" ", strip=True)
        desc_text = re.sub(r"\s{2,}", " ", desc_text).strip()
        if len(desc_text) > 20:
            description = desc_text[:2000]

    return {
        "title": title,
        "source_url": source_url,
        "deadline": deadline,
        "location": location,
        "posted_date": posted_date,
        "posted_datetime_str": posted_datetime_str,
        "description": description,
    }


def _parse_page(html_bytes: bytes) -> list[dict]:
    """
    Parse one listing page and return a list of raw item dicts.
    Returns empty list if the page structure has changed.
    """
    soup = BeautifulSoup(html_bytes, "html.parser")
    posts_div = soup.find("div", id="community-posts-list")
    if not posts_div:
        logger.warning(
            "Rhizome: could not find #community-posts-list — site may have changed"
        )
        return []

    items = []
    for item_div in posts_div.select("div.community-list-item"):
        parsed = _parse_listing_item(item_div)
        if parsed:
            items.append(parsed)

    return items


def _get_total_pages(html_bytes: bytes) -> Optional[int]:
    """
    Extract total page count from the #load-more-indicator data-pagecount attribute.
    Returns None if not found.
    """
    soup = BeautifulSoup(html_bytes, "html.parser")
    indicator = soup.find("div", id="load-more-indicator")
    if not indicator:
        return None
    try:
        return int(indicator.get("data-pagecount", "0"))
    except (ValueError, TypeError):
        return None


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Rhizome community opportunities.

    Pagination strategy:
      1. Fetch page 1 to learn total_pages (data-pagecount attribute).
      2. Iterate pages in order (sorted by deadline desc, so most-future first).
      3. On each page, skip items with past deadlines.
      4. Stop when a full page yields zero non-expired items AND all posted
         dates are older than 6 months — the board has nothing current left.
      5. Hard cap at MAX_PAGES to prevent runaway pagination.

    Returns (found, new, updated).
    """
    source_id = source["id"]
    found = new = updated = 0

    cutoff_date = date.today() - timedelta(days=_LOOKBACK_DAYS)

    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": _USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": "https://rhizome.org/",
        }
    )

    # -----------------------------------------------------------------------
    # Fetch page 1 (also tells us total page count)
    # -----------------------------------------------------------------------
    logger.info("Rhizome: fetching page 1 — %s", LISTING_URL)
    page1_bytes = _fetch(LISTING_URL, session)
    if not page1_bytes:
        logger.error("Rhizome: failed to fetch listing page")
        return 0, 0, 0

    total_pages = _get_total_pages(page1_bytes)
    if total_pages:
        logger.info("Rhizome: total pages = %d", total_pages)
        max_pages = min(total_pages, MAX_PAGES)
    else:
        logger.warning(
            "Rhizome: could not determine total pages, defaulting to %d", MAX_PAGES
        )
        max_pages = MAX_PAGES

    pages_to_fetch = [(1, page1_bytes)] + [(p, None) for p in range(2, max_pages + 1)]

    skipped_expired = 0
    skipped_old = 0
    consecutive_empty_pages = 0

    for page_num, prefetched_bytes in pages_to_fetch:
        # Fetch if not already fetched
        if prefetched_bytes is not None:
            html_bytes = prefetched_bytes
        else:
            time.sleep(PAGE_DELAY_S)
            page_url = f"{LISTING_URL}&page={page_num}"
            logger.debug("Rhizome: fetching page %d — %s", page_num, page_url)
            html_bytes = _fetch(page_url, session)
            if not html_bytes:
                logger.warning("Rhizome: failed to fetch page %d, stopping", page_num)
                break

        items = _parse_page(html_bytes)
        if not items:
            logger.warning("Rhizome: no items on page %d — stopping", page_num)
            break

        page_found = 0
        page_expired = 0
        page_old = 0
        all_old_or_expired = True

        for item in items:
            title = item["title"]
            deadline = item["deadline"]
            posted_date = item.get("posted_date")
            source_url = item["source_url"]

            # Skip past-deadline items
            if _is_past_deadline(deadline):
                page_expired += 1
                skipped_expired += 1
                logger.debug(
                    "Rhizome: skipping %r — deadline %s is past", title[:60], deadline
                )
                continue

            # Skip if posted date is older than our lookback window AND deadline is unknown
            # (listings with no deadline but very old posts are likely stale)
            if deadline is None and posted_date and posted_date < cutoff_date:
                page_old += 1
                skipped_old += 1
                logger.debug(
                    "Rhizome: skipping %r — no deadline and posted %s > 6 months ago",
                    title[:60],
                    posted_date,
                )
                continue

            # This item counts as active — page is not fully stale
            all_old_or_expired = False

            call_type = _infer_call_type(title)
            description = item.get("description")
            location = item.get("location")

            # Build metadata
            meta: dict = {"source": "rhizome"}
            if location:
                meta["location"] = location
            if item.get("posted_datetime_str"):
                meta["posted_at"] = item["posted_datetime_str"]

            call_data = {
                "title": title,
                "description": description,
                "deadline": deadline,
                # Application URL = source URL (detail page is the apply destination)
                "application_url": source_url,
                "source_url": source_url,
                "call_type": call_type,
                "eligibility": "International",
                "source_id": source_id,
                "confidence_tier": "aggregated",
                "_org_name": "rhizome",
                "metadata": meta,
            }

            page_found += 1
            result = insert_open_call(call_data)
            if result:
                new += 1
                logger.debug(
                    "Rhizome: inserted/updated %r (deadline=%s, type=%s)",
                    title[:60],
                    deadline,
                    call_type,
                )

        found += page_found

        logger.info(
            "Rhizome: page %d — %d active, %d expired, %d old-no-deadline",
            page_num,
            page_found,
            page_expired,
            page_old,
        )

        # Stop if this entire page was either expired or older than lookback window
        if all_old_or_expired:
            consecutive_empty_pages += 1
            if consecutive_empty_pages >= 2:
                logger.info(
                    "Rhizome: stopping after page %d — %d consecutive pages with no active items",
                    page_num,
                    consecutive_empty_pages,
                )
                break
        else:
            consecutive_empty_pages = 0

    logger.info(
        "Rhizome: crawl complete — %d found, %d inserted/updated, "
        "%d expired skipped, %d old-no-deadline skipped",
        found,
        new,
        skipped_expired,
        skipped_old,
    )
    return found, new, updated
