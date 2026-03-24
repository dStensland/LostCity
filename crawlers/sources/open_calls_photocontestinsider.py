"""
Crawler for Photo Contest Insider (photocontestinsider.com) open calls.

Photo Contest Insider is a WordPress-based aggregator that curates and
lists photography contests and open calls from around the world. Contests
are posted by the PCI editorial team on behalf of the organizing bodies;
the site links out to the original host for entry submission.

Confidence tier: "aggregated" — PCI is an aggregator, not the issuing org.

All contests are typed as "submission" — PCI exclusively covers photo
contests, competitions, and related open calls for photographic work.

Crawl strategy — two phases, static HTML (no Playwright required):

  Phase 1 — Paginated index:
    Base URL: https://www.photocontestinsider.com/contest/all-themes/
    Page N URL: https://www.photocontestinsider.com/contest/all-themes/page/{N}/
    10 listings per page. Last page discovered from the "Last" link in
    the pagination div (which always contains the final page number).
    Approximately 143 contests / 15 pages at time of build.

    Each listing (div.block-item-big) has:
      a.readmore href          — PCI detail page URL
      a.enter-now href         — direct external entry URL
      h2.contest-title-cat     — title (may be a marketing tagline)
      div.contest-info-right-cat-single  — repeated: Deadline, Winner is, Entry
        "Entry" field values: "Free Entry" | "Paid Entry" | "Varied Entry"

  Phase 2 — Detail pages (one per listing):
    div.contest-info-cat-single (repeated) — Deadline, Winner is, Entry, Entry Fee
      "Entry Fee" field: e.g. "$15-$35", "Free", absent when free
    div.customright a href                 — Enter Contest (= application_url)
    h2 (inside .single-title)             — authoritative title
    div.single-photo-contests-content     — full body: description, rules, eligibility
      "ORGANIZER" heading followed by <p> — organization name

Fee mapping:
  Index "Free Entry"  → fee=0.0, detail "Entry Fee" field absent (no fee row)
  Index "Paid Entry"  → fee=None, detail "Entry Fee" field present (e.g. "$35")
    If detail "Entry Fee" contains a parseable dollar amount, store as fee_min
    in metadata. fee column stays None (multi-tier pricing is common).
  Index "Varied Entry" → fee=None, metadata.fee_type="varied"

Date format on both pages: "Mon DD, YYYY" — e.g. "Jun 29, 2026"

Rate limiting:
  1.5s between detail page fetches. Index pages fetched without extra delay.
  With ~143 listings and past-deadline skipping, a full run takes ~3–5 minutes.
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

BASE_URL = "https://www.photocontestinsider.com"
INDEX_URL = "https://www.photocontestinsider.com/contest/all-themes/"
_PAGE_URL = "https://www.photocontestinsider.com/contest/all-themes/page/{page}/"

_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
)

# Seconds between detail page fetches — polite to a small editorial site
_DETAIL_DELAY = 1.5

# Safety cap — raise if PCI grows significantly past 300 listings
_MAX_LISTINGS = 400

_REQUEST_TIMEOUT = 30

# Months for parsing "Jun 29, 2026" style dates
_MONTH_MAP = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}

# Pattern: "Jun 29, 2026" or "June 29, 2026"
_DATE_RE = re.compile(
    r"(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*"
    r"\s+(\d{1,2}),?\s*(\d{4})",
    re.I,
)

# Dollar amount extraction from "Entry Fee" field (e.g. "$15", "$15-$35", "35 USD")
_DOLLAR_RE = re.compile(r"\$\s*(\d+(?:\.\d{2})?)")


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------


def _make_session() -> requests.Session:
    """Build a requests.Session that looks like a browser to avoid 403s.

    Note: Accept-Encoding is intentionally omitted — requests handles
    gzip/deflate automatically, and explicitly listing "br" (Brotli) without
    the brotli package installed causes garbled response bodies.
    """
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": _USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
        }
    )
    return session


def _fetch(url: str, session: requests.Session) -> Optional[str]:
    """Fetch a URL and return HTML text, or None on failure."""
    try:
        resp = session.get(url, timeout=_REQUEST_TIMEOUT)
        resp.raise_for_status()
        return resp.text
    except requests.RequestException as exc:
        logger.warning("PhotoContestInsider: failed to fetch %s: %s", url, exc)
        return None


# ---------------------------------------------------------------------------
# Date parsing
# ---------------------------------------------------------------------------


def _parse_date(text: str) -> Optional[str]:
    """
    Parse a "Mon DD, YYYY" date string into ISO format.

    Handles both abbreviated ("Jun") and full ("June") month names.
    Returns "YYYY-MM-DD" or None if no match.
    """
    m = _DATE_RE.search(text)
    if not m:
        return None
    try:
        month_abbr = m.group(1).lower()
        month = _MONTH_MAP.get(month_abbr, 0)
        day = int(m.group(2))
        year = int(m.group(3))
        if not month:
            return None
        datetime(year, month, day)  # validate — raises ValueError for bad dates
        return f"{year}-{month:02d}-{day:02d}"
    except (ValueError, TypeError):
        return None


def _is_past_deadline(deadline_str: Optional[str]) -> bool:
    """Return True if the deadline has already passed."""
    if not deadline_str:
        return False
    try:
        dl = datetime.strptime(deadline_str, "%Y-%m-%d").date()
        return dl < date.today()
    except ValueError:
        return False


# ---------------------------------------------------------------------------
# Fee helpers
# ---------------------------------------------------------------------------


def _parse_fee_amount(fee_text: str) -> Optional[float]:
    """
    Extract the minimum dollar amount from an Entry Fee string.

    Examples: "$15-$35" → 15.0, "$35" → 35.0, "35 USD" → None (no $ sign).
    Returns None when no parseable dollar value is found.
    """
    m = _DOLLAR_RE.search(fee_text)
    if m:
        return float(m.group(1))
    return None


# ---------------------------------------------------------------------------
# Phase 1: index page parser
# ---------------------------------------------------------------------------


def _parse_last_page(soup: BeautifulSoup) -> int:
    """
    Extract the total page count from the pagination div.

    The "Last" link always points to the final page. Falls back to 1 when
    no pagination is present (single page of results).
    """
    pager = soup.find("div", class_="pagination")
    if not pager:
        return 1

    # The "Last" link is always the final <a> in the pagination div
    links = pager.find_all("a", href=True)
    for link in reversed(links):
        text = link.get_text(strip=True)
        if text.lower() == "last":
            m = re.search(r"/page/(\d+)/", link["href"])
            if m:
                return int(m.group(1))

    # Fallback: largest page number seen in any pagination link
    max_page = 1
    for link in links:
        m = re.search(r"/page/(\d+)/", link.get("href", ""))
        if m:
            max_page = max(max_page, int(m.group(1)))
    return max_page


def _is_last_page(soup: BeautifulSoup, current_page: int) -> bool:
    """Return True when there is no Next link in the pagination div."""
    pager = soup.find("div", class_="pagination")
    if not pager:
        return True

    for link in pager.find_all("a", href=True):
        if link.get_text(strip=True).lower() == "next":
            return False

    # No "Next" link found — we're on the last page
    return True


def _parse_index_page(html: str) -> list[dict]:
    """
    Parse one page of the Photo Contest Insider contest listing.

    Returns a list of dicts with keys:
      detail_url, enter_url, title, index_deadline, entry_type
    """
    soup = BeautifulSoup(html, "html.parser")
    items = soup.find_all("div", class_="block-item-big")
    listings: list[dict] = []

    for item in items:
        # --- Detail URL ("Read More" link) ---
        read_more = item.find("a", class_="readmore")
        if not read_more:
            continue
        detail_url = read_more.get("href", "").strip()
        if not detail_url:
            continue

        # --- Enter Now link (direct external URL, may differ from detail URL) ---
        enter_link = item.find("a", class_="enter-now")
        enter_url = enter_link.get("href", "").strip() if enter_link else ""

        # --- Title (from the h2 on the index, often a marketing tagline) ---
        h2 = item.find("h2", class_="contest-title-cat")
        index_title = h2.get_text(strip=True) if h2 else ""

        # --- Meta fields from the right-column info boxes ---
        meta: dict[str, str] = {}
        for meta_div in item.find_all("div", class_="contest-info-right-cat-single"):
            b = meta_div.find("b")
            if b:
                key = b.get_text(strip=True).rstrip(":").strip()
                val = meta_div.get_text(strip=True)
                # Remove the label text from the value
                val = val.replace(b.get_text(strip=True), "").strip()
                meta[key] = val

        index_deadline = _parse_date(meta.get("Deadline", ""))
        entry_type_raw = meta.get("Entry", "").lower()

        if "free" in entry_type_raw:
            entry_type = "free"
        elif "paid" in entry_type_raw:
            entry_type = "paid"
        elif "varied" in entry_type_raw:
            entry_type = "varied"
        else:
            entry_type = "unknown"

        listings.append(
            {
                "detail_url": detail_url,
                "enter_url": enter_url,
                "index_title": index_title,
                "index_deadline": index_deadline,
                "entry_type": entry_type,
            }
        )

    return listings


# ---------------------------------------------------------------------------
# Phase 2: detail page parser
# ---------------------------------------------------------------------------


def _parse_detail_page(html: str, source_url: str, enter_url: str) -> dict:
    """
    Parse a Photo Contest Insider contest detail page.

    Returns a dict with keys:
      title, deadline, description, application_url, org_name,
      fee, fee_raw, entry_type
    """
    soup = BeautifulSoup(html, "html.parser")

    # --- Title (authoritative — the h2 in .single-title, not the tagline) ---
    single_title = soup.find("div", class_="single-title")
    if single_title:
        h2 = single_title.find("h2")
        title = h2.get_text(strip=True) if h2 else ""
    else:
        h2 = soup.find("h2")
        title = h2.get_text(strip=True) if h2 else ""

    # --- Meta fields from contest-info-cat-single divs ---
    # These appear in the post-heading metablock above the content body.
    meta: dict[str, str] = {}
    for meta_div in soup.find_all("div", class_="contest-info-cat-single"):
        b = meta_div.find("b")
        if b:
            key = b.get_text(strip=True).rstrip(":").strip()
            val = meta_div.get_text(strip=True)
            val = val.replace(b.get_text(strip=True), "").strip()
            meta[key] = val

    deadline = _parse_date(meta.get("Deadline", ""))

    # --- Entry type and fee from detail meta ---
    entry_type_raw = meta.get("Entry", "").lower()
    if "free" in entry_type_raw:
        detail_entry_type = "free"
        fee: Optional[float] = 0.0
        fee_raw: Optional[str] = None
    elif "paid" in entry_type_raw or "varied" in entry_type_raw:
        detail_entry_type = "paid" if "paid" in entry_type_raw else "varied"
        fee_field = meta.get("Entry Fee", "").strip()
        fee_raw = fee_field if fee_field else None
        # Don't store a numeric fee — multi-tier pricing is the norm (e.g. "$15-$35")
        fee = None
    else:
        detail_entry_type = "unknown"
        fee_field = meta.get("Entry Fee", "").strip()
        fee_raw = fee_field if fee_field else None
        fee = None

    # --- Application URL ---
    # Prefer the "Enter Contest" button in .customright (direct external link).
    # Fall back to the index-level enter_url, then the PCI detail page itself.
    application_url: str = source_url
    customright = soup.find("div", class_="customright")
    if customright:
        enter_link = customright.find("a", href=True)
        if enter_link:
            href = enter_link["href"].strip()
            if href and href.startswith("http"):
                application_url = href
    if application_url == source_url and enter_url:
        application_url = enter_url

    # --- Description from the contest body ---
    content_div = soup.find("div", class_="single-photo-contests-content")
    description: Optional[str] = None
    org_name: str = ""

    if content_div:
        # Extract organizer: look for "ORGANIZER" heading followed by a <p>
        org_heading = content_div.find(
            string=lambda s: s and "organizer" in s.strip().lower()
        )
        if org_heading:
            # The organizer name is in the next sibling <p> or the parent's next sibling
            parent = org_heading.parent
            sibling = parent.find_next_sibling("p")
            if sibling:
                org_name = sibling.get_text(strip=True)[:200]

        # Full description text — strip social-share cruft, limit to 3000 chars
        raw_text = content_div.get_text(separator="\n", strip=True)
        # Remove the title from the very start (it's repeated)
        if title and raw_text.startswith(title):
            raw_text = raw_text[len(title):].strip()
        description = raw_text[:3000] if raw_text else None

    return {
        "title": title,
        "deadline": deadline,
        "description": description,
        "application_url": application_url,
        "org_name": org_name,
        "fee": fee,
        "fee_raw": fee_raw,
        "entry_type": detail_entry_type,
    }


# ---------------------------------------------------------------------------
# Eligibility inference
# ---------------------------------------------------------------------------

_INTL_RE = re.compile(r"\binternational\b|\bworldwide\b|\bglobal\b|\bopen\s+to\s+all\b", re.I)
_US_RE = re.compile(r"\bunited\s+states\b|\bu\.s\.?\b|\bamerican\s+photographer", re.I)


def _infer_eligibility(title: str, description: str) -> str:
    """
    Infer geographic eligibility from title and description text.

    PCI contests are predominantly international. Defaults to "International"
    unless the text strongly indicates US-only.
    """
    combined = f"{title} {description[:500]}"
    if _US_RE.search(combined) and not _INTL_RE.search(combined):
        return "National (US)"
    return "International"


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl the Photo Contest Insider contest listing.

    Strategy:
      1. Page through the contest index (10 listings/page). Collect all
         active listings with their detail URLs and entry metadata.
      2. Skip any listing whose index-level deadline has already passed
         (avoids fetching expired detail pages — fast path).
      3. Fetch each detail page for authoritative title, full description,
         entry fee, application URL, and organizer name.
      4. Insert or update via insert_open_call().

    Returns (found, new, updated).
    """
    source_id = source["id"]
    found = new = updated = 0

    session = _make_session()

    # -----------------------------------------------------------------------
    # Phase 1: collect all listings from the paginated index
    # -----------------------------------------------------------------------
    all_listings: list[dict] = []
    page = 1
    last_page: Optional[int] = None

    while True:
        url = INDEX_URL if page == 1 else _PAGE_URL.format(page=page)
        logger.debug("PhotoContestInsider: fetching index page %d — %s", page, url)

        html = _fetch(url, session)
        if not html:
            logger.error(
                "PhotoContestInsider: failed to fetch index page %d — stopping", page
            )
            break

        soup = BeautifulSoup(html, "html.parser")

        # Discover total page count from the first page's pagination
        if page == 1:
            last_page = _parse_last_page(soup)
            logger.debug("PhotoContestInsider: %d total pages", last_page)

        page_listings = _parse_index_page(html)
        all_listings.extend(page_listings)
        logger.debug(
            "PhotoContestInsider: page %d — %d listings (running total: %d)",
            page,
            len(page_listings),
            len(all_listings),
        )

        if not page_listings or _is_last_page(soup, page):
            logger.debug("PhotoContestInsider: reached last page at page %d", page)
            break

        if len(all_listings) >= _MAX_LISTINGS:
            logger.warning(
                "PhotoContestInsider: hit safety cap of %d listings at page %d",
                _MAX_LISTINGS,
                page,
            )
            break

        page += 1

    logger.info(
        "PhotoContestInsider: %d total listings found across %d pages",
        len(all_listings),
        page,
    )

    if not all_listings:
        logger.warning(
            "PhotoContestInsider: no listings found — check if site structure has changed"
        )
        return 0, 0, 0

    # -----------------------------------------------------------------------
    # Phase 2: fetch detail pages and insert
    # -----------------------------------------------------------------------
    skipped_deadline = 0
    detail_fetch_count = 0

    for i, listing in enumerate(all_listings):
        detail_url = listing["detail_url"]
        enter_url = listing["enter_url"]
        index_title = listing["index_title"]
        index_deadline = listing["index_deadline"]
        entry_type = listing["entry_type"]

        # Fast-path deadline check before paying for a detail fetch
        if _is_past_deadline(index_deadline):
            skipped_deadline += 1
            logger.debug(
                "PhotoContestInsider: skipping %r — index deadline %s passed",
                index_title[:60],
                index_deadline,
            )
            continue

        # Polite delay between detail page fetches
        if detail_fetch_count > 0:
            time.sleep(_DETAIL_DELAY)

        detail_html = _fetch(detail_url, session)
        detail_fetch_count += 1

        if not detail_html:
            logger.warning(
                "PhotoContestInsider: could not fetch detail page for %r — skipping",
                index_title[:60],
            )
            continue

        detail = _parse_detail_page(detail_html, detail_url, enter_url)

        # Authoritative deadline from detail page; fall back to index value
        deadline = detail["deadline"] or index_deadline

        # Post-fetch deadline guard
        if _is_past_deadline(deadline):
            skipped_deadline += 1
            logger.debug(
                "PhotoContestInsider: skipping %r — detail deadline %s passed",
                index_title[:60],
                deadline,
            )
            continue

        found += 1

        # Prefer the authoritative title from the detail page h2
        final_title = detail["title"] or index_title

        if not final_title:
            logger.debug(
                "PhotoContestInsider: no title found for %s — skipping", detail_url
            )
            continue

        # Require an application URL to be meaningful
        application_url = detail["application_url"]
        if not application_url:
            logger.debug(
                "PhotoContestInsider: no application URL for %r — skipping",
                final_title[:60],
            )
            continue

        description = detail["description"]
        org_name = detail["org_name"] or "photo-contest-insider"
        org_slug = re.sub(r"[^a-z0-9]+", "-", org_name.lower()).strip("-")[:40]

        eligibility = _infer_eligibility(final_title, description or "")

        # Resolve final entry type: detail page is authoritative
        final_entry_type = detail["entry_type"]
        if final_entry_type == "unknown":
            final_entry_type = entry_type  # fall back to index value

        # Fee metadata
        fee_raw = detail["fee_raw"]
        fee_min: Optional[float] = None
        if fee_raw:
            fee_min = _parse_fee_amount(fee_raw)

        call_data: dict = {
            "title": final_title,
            "description": description,
            "deadline": deadline,
            "application_url": application_url,
            "source_url": detail_url,
            "call_type": "submission",  # PCI is exclusively photo contests/submissions
            "eligibility": eligibility,
            "fee": detail["fee"],  # 0.0 for free, None for paid/varied
            "source_id": source_id,
            "confidence_tier": "aggregated",
            "_org_name": org_slug,
            "metadata": {
                "source": "photocontestinsider",
                "organization": detail["org_name"] or "",
                "entry_type": final_entry_type,
                "fee_raw": fee_raw,
                "fee_min": fee_min,
                "scope": "international",
            },
        }

        result = insert_open_call(call_data)
        if result:
            new += 1
            logger.debug(
                "PhotoContestInsider: inserted/updated %r (deadline=%s, entry=%s)",
                final_title[:60],
                deadline,
                final_entry_type,
            )

    if skipped_deadline:
        logger.info(
            "PhotoContestInsider: skipped %d past-deadline listings", skipped_deadline
        )

    logger.info(
        "PhotoContestInsider: crawl complete — %d found (eligible), %d new, %d updated",
        found,
        new,
        updated,
    )
    return found, new, updated
