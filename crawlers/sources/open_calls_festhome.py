"""
Crawler for FestHome film festival open calls (festhome.com).

FestHome is an international film festival submission platform — a global
aggregator of film festival calls for entries. Festivals use FestHome to
manage submissions from filmmakers worldwide.

Crawl strategy — two-phase (listing + detail):

  Phase 1: paginate the AJAX listing endpoint
    GET https://www.festhome.com/festivales/listado/page:N
    with X-Requested-With: XMLHttpRequest

    Each AJAX page returns 12 festival cards. Key data on the card:
      div#festival_card-{id}          — festival ID
      span.date.text-bold             — deadline ("21 July 2026")
      div.festival-card-status text   — "Festival Closed" when deadline passed
      a[href="/festival/{id}"]        — detail page link

    Pagination stops when a page returns 0 cards, OR when the proportion
    of "Festival Closed" cards exceeds MAX_CLOSED_RATIO (festivals are
    sorted by deadline proximity, so closed = we've passed the active window).

  Phase 2: fetch each open festival's detail page
    GET https://www.festhome.com/festival/{id}

    Fields extracted:
      og:title                              — festival name (canonical)
      div.festival-viewer-dates.active-dl   — final deadline text
      festival-viewer-location-border       — description, location, eligibility flag
      festival-viewer-section-date-fee      — fee info
      external anchor (not festhome/social) — festival's own website

    The detail page URL itself is the application_url — FestHome requires
    creating a free account to submit, but the festival detail page is the
    canonical entry point.

Date format on listing cards: "21 July 2026" / "01 April 2026"
Date format on detail page (active-dl): "26 Mar 2026 Final deadline" —
  just the first <p> text before the <span>.

Fee parsing:
  "Standard Fee 2€" → 2.0
  "Does NOT have submission fees" (icon title) → 0.0
  Absent/unparseable → None

Eligibility: all festivals on FestHome accept international submissions
  (it is a global platform) → "International" for all records.

Call type: "submission" (all are film festival entry calls).
Confidence tier: "aggregated" (FestHome is the platform, not the org).

Rate limiting: 0.5s between detail page fetches.
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

BASE_URL = "https://www.festhome.com"
LISTING_AJAX_URL = "https://www.festhome.com/festivales/listado/page:{page}"
DETAIL_URL = "https://www.festhome.com/festival/{festival_id}"

_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

REQUEST_TIMEOUT = 30
DETAIL_DELAY_S = 0.5

# Stop paginating when this fraction of cards on a page show "Festival Closed".
# FestHome sorts by deadline proximity so once we're deep into closed listings
# the tail is entirely historical festivals.
MAX_CLOSED_RATIO = 0.85

# Safety cap on pages processed per run (569 total as of 2026-03-24).
MAX_PAGES = 600

# Social/CDN domains to skip when extracting the festival's own website
_SKIP_DOMAINS = {
    "festhome.com",
    "festhomedocs.com",
    "facebook.com",
    "twitter.com",
    "instagram.com",
    "youtube.com",
    "vimeo.com",
    "linkedin.com",
    "tiktok.com",
    "t.co",
    "bit.ly",
    "premiosgoya.com",
    "fantlatam.com",
    "imdb.com",
}


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------


def _make_session() -> requests.Session:
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": _USER_AGENT,
            "Accept": "text/html, */*; q=0.01",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": "https://www.festhome.com/festivales/listado",
        }
    )
    return session


def _fetch_listing_page(session: requests.Session, page: int) -> Optional[bytes]:
    """Fetch one AJAX listing page. Returns raw bytes or None on error."""
    url = LISTING_AJAX_URL.format(page=page)
    try:
        resp = session.get(
            url,
            headers={"X-Requested-With": "XMLHttpRequest"},
            timeout=REQUEST_TIMEOUT,
        )
        resp.raise_for_status()
        return resp.content
    except requests.RequestException as exc:
        logger.warning("FestHome: listing page %d fetch error — %s", page, exc)
        return None


def _fetch_detail_page(session: requests.Session, festival_id: int) -> Optional[bytes]:
    """Fetch a festival detail page. Returns raw bytes or None on error."""
    url = DETAIL_URL.format(festival_id=festival_id)
    try:
        resp = session.get(url, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        return resp.content
    except requests.RequestException as exc:
        logger.warning("FestHome: detail page %d fetch error — %s", festival_id, exc)
        return None


# ---------------------------------------------------------------------------
# Date parsing
# ---------------------------------------------------------------------------

# "21 July 2026" / "01 April 2026" / "26 Mar 2026"
_DATE_RE = re.compile(r"(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})")

_MONTH_MAP = {
    "jan": 1,
    "feb": 2,
    "mar": 3,
    "apr": 4,
    "may": 5,
    "jun": 6,
    "jul": 7,
    "aug": 8,
    "sep": 9,
    "oct": 10,
    "nov": 11,
    "dec": 12,
    "january": 1,
    "february": 2,
    "march": 3,
    "april": 4,
    "june": 6,
    "july": 7,
    "august": 8,
    "september": 9,
    "october": 10,
    "november": 11,
    "december": 12,
}


def _parse_date(text: str) -> Optional[str]:
    """
    Parse a date string like "21 July 2026" or "26 Mar 2026" into YYYY-MM-DD.

    Returns None if parsing fails.
    """
    if not text:
        return None
    m = _DATE_RE.search(text.strip())
    if not m:
        return None
    day = int(m.group(1))
    month_name = m.group(2).lower()
    month = _MONTH_MAP.get(month_name[:3]) or _MONTH_MAP.get(month_name)
    if not month:
        return None
    year = int(m.group(3))
    try:
        datetime(year, month, day)
    except ValueError:
        return None
    return f"{year}-{month:02d}-{day:02d}"


def _is_past_deadline(deadline_str: Optional[str]) -> bool:
    """Return True if the deadline (YYYY-MM-DD) has already passed."""
    if not deadline_str:
        return False
    try:
        return date.fromisoformat(deadline_str) < date.today()
    except ValueError:
        return False


# ---------------------------------------------------------------------------
# Fee parsing
# ---------------------------------------------------------------------------

_FEE_NUMBER_RE = re.compile(r"(\d+(?:[.,]\d+)?)")


def _parse_fee(fee_text: str) -> Optional[float]:
    """
    Extract submission fee from text like "Standard Fee 2€" or "Standard Fee 16$".

    Returns 0.0 for free festivals, the lowest numeric value found, or None
    if unparseable.
    """
    if not fee_text:
        return None
    t = fee_text.lower()
    if "free" in t or "no fee" in t or "does not" in t or "without fee" in t:
        return 0.0
    # Find numeric values — take the first (typically the standard fee)
    numbers = []
    for m in _FEE_NUMBER_RE.finditer(fee_text):
        try:
            numbers.append(float(m.group(1).replace(",", ".")))
        except ValueError:
            pass
    if numbers:
        # Ignore very large numbers that are prize amounts, not fees
        fees = [n for n in numbers if n < 500]
        if fees:
            return fees[0]
    return None


# ---------------------------------------------------------------------------
# Listing page parser
# ---------------------------------------------------------------------------


def _parse_listing_card(card_div) -> Optional[dict]:
    """
    Parse one festival card from the AJAX listing page.

    Returns a dict with:
      festival_id (int)
      title (str)         — from festival-card-title (not canonical; detail
                            page og:title is preferred but used for logging)
      deadline (str|None) — YYYY-MM-DD from span.date, or None if closed/absent
      is_closed (bool)    — True when "Festival Closed" appears in status div
    """
    # Extract festival ID from the div id="festival_card-{id}"
    card_id_attr = card_div.get("id", "")
    id_match = re.search(r"festival_card-(\d+)$", card_id_attr)
    if not id_match:
        return None
    festival_id = int(id_match.group(1))

    # Title (for logging only — og:title from detail page is canonical)
    title_div = card_div.find("div", class_="festival-card-title")
    title = title_div.get_text(strip=True) if title_div else f"Festival {festival_id}"

    # Status: check for "Festival Closed"
    status_div = card_div.find("div", class_="festival-card-status")
    status_text = status_div.get_text(strip=True) if status_div else ""
    is_closed = (
        "festival closed" in status_text.lower() or "closed" in status_text.lower()
    )

    # Deadline from span.date.text-bold
    date_span = card_div.find("span", class_="date")
    deadline: Optional[str] = None
    if date_span:
        deadline = _parse_date(date_span.get_text(strip=True))

    return {
        "festival_id": festival_id,
        "title": title,
        "deadline": deadline,
        "is_closed": is_closed,
    }


def _parse_listing_page(html_bytes: bytes) -> tuple[list[dict], int, int]:
    """
    Parse one AJAX listing page.

    Returns:
      (cards, open_count, closed_count)
      cards: list of dicts from _parse_listing_card (all cards, open and closed)
    """
    soup = BeautifulSoup(html_bytes, "html.parser")
    card_divs = soup.find_all("div", class_="card-pre-container")

    cards = []
    open_count = 0
    closed_count = 0

    for div in card_divs:
        card = _parse_listing_card(div)
        if card is None:
            continue
        cards.append(card)
        if card["is_closed"]:
            closed_count += 1
        else:
            open_count += 1

    return cards, open_count, closed_count


# ---------------------------------------------------------------------------
# Detail page parser
# ---------------------------------------------------------------------------


def _parse_detail_page(html_bytes: bytes, festival_id: int) -> Optional[dict]:
    """
    Parse a festival detail page.

    Returns a dict with:
      title (str)
      deadline (str|None)    — YYYY-MM-DD from active-dl div
      description (str|None)
      fee (float|None)
      website (str|None)     — festival's own website (not social media)
      is_free (bool)         — True if fee == 0.0
    Or None if the page is invalid (no title).
    """
    soup = BeautifulSoup(html_bytes, "html.parser")

    # ---------------------------------------------------------------------------
    # Title — og:title is canonical (all-caps official name vs h1 subheading)
    # ---------------------------------------------------------------------------
    og_title = soup.find("meta", property="og:title")
    title = og_title.get("content", "").strip() if og_title else ""
    if not title:
        h1 = soup.find("h1")
        title = h1.get_text(strip=True) if h1 else ""
    if not title:
        logger.debug("FestHome: festival %d — no title found", festival_id)
        return None

    # ---------------------------------------------------------------------------
    # Deadline — div.festival-viewer-dates.active-dl
    # The first <p> contains "26 Mar 2026\nFinal deadline"
    # ---------------------------------------------------------------------------
    deadline: Optional[str] = None
    active_dl = soup.find("div", class_="active-dl")
    if active_dl:
        p = active_dl.find("p")
        if p:
            # Get just the text before the <span> (which contains "Final deadline")
            # by cloning and removing inner span
            p_clone = BeautifulSoup(str(p), "html.parser").find("p")
            if p_clone:
                for span in p_clone.find_all("span"):
                    span.decompose()
                deadline = _parse_date(p_clone.get_text(strip=True))

    # Fallback: scan all date divs for the last deadline-type one
    if not deadline:
        for date_div in soup.find_all("div", class_="festival-viewer-dates"):
            p = date_div.find("p")
            if not p:
                continue
            p_text = p.get_text(separator=" ", strip=True).lower()
            if "deadline" in p_text or "final" in p_text:
                p_clone = BeautifulSoup(str(p), "html.parser").find("p")
                if p_clone:
                    for span in p_clone.find_all("span"):
                        span.decompose()
                    candidate = _parse_date(p_clone.get_text(strip=True))
                    if candidate:
                        deadline = candidate
                        break

    # ---------------------------------------------------------------------------
    # Description — from the "Festival description" location-border section
    # ---------------------------------------------------------------------------
    description: Optional[str] = None
    for border in soup.find_all("div", class_="festival-viewer-location-border"):
        border_text = border.get_text(separator="|", strip=True)
        if "festival description" not in border_text.lower():
            continue

        # Remove the box title ("Festival description")
        box_title = border.find("div", class_="festival-viewer-box-title")
        if box_title:
            box_title.decompose()

        # Collect location paragraphs, skipping festival dates lines
        parts = []
        for p in border.find_all("p", class_="festival-viewer-location"):
            t = p.get_text(strip=True)
            if not t:
                continue
            # Skip structural lines
            if (
                t.startswith("Festival start:")
                or t.startswith("Festival end:")
                or t.startswith("(Edition:")
            ):
                continue
            parts.append(t)

        if parts:
            raw_desc = " ".join(parts).strip()
            raw_desc = re.sub(r"\s{2,}", " ", raw_desc)
            if len(raw_desc) > 20:
                description = raw_desc[:3000]
        break

    # ---------------------------------------------------------------------------
    # Fee — from festival-viewer-section-date-fee divs (first one is enough)
    # ---------------------------------------------------------------------------
    fee: Optional[float] = None
    fee_div = soup.find("div", class_="festival-viewer-section-date-fee")
    if fee_div:
        fee = _parse_fee(fee_div.get_text(strip=True))

    # Fallback: look for "does not have submission fees" in icon titles
    if fee is None:
        for span in soup.find_all(attrs={"title": True}):
            title_attr = span.get("title", "").lower()
            if "does not have submission fees" in title_attr or "no fee" in title_attr:
                fee = 0.0
                break

    # ---------------------------------------------------------------------------
    # Festival's own website — first external link not matching skip list
    # ---------------------------------------------------------------------------
    website: Optional[str] = None
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if not href.startswith("http"):
            continue
        # Extract domain
        domain_match = re.match(r"https?://(?:www\.)?([^/]+)", href)
        if not domain_match:
            continue
        domain = domain_match.group(1).lower()
        if any(skip in domain for skip in _SKIP_DOMAINS):
            continue
        website = href
        break

    return {
        "title": title,
        "deadline": deadline,
        "description": description,
        "fee": fee,
        "website": website,
    }


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl FestHome film festival open calls.

    Strategy:
      1. Paginate the AJAX listing endpoint (12 cards/page, up to 569 pages).
      2. Skip cards marked "Festival Closed".
      3. Pre-filter cards whose listing deadline is already past.
      4. Stop pagination when >= MAX_CLOSED_RATIO of a page is closed.
      5. For each open festival, fetch the detail page and extract full data.
      6. Insert/update via insert_open_call().

    Returns (found, new, updated).
    """
    source_id = source["id"]
    found = new = updated = 0

    session = _make_session()

    # Collect festival IDs to process (listing-level open check)
    festivals_to_fetch: list[dict] = []
    total_listing_cards = 0
    pages_processed = 0

    logger.info("FestHome: starting listing pagination")

    for page in range(1, MAX_PAGES + 1):
        html_bytes = _fetch_listing_page(session, page)
        if html_bytes is None:
            # Network error — stop paginating rather than silently skipping
            logger.warning("FestHome: stopping pagination after error on page %d", page)
            break

        cards, open_count, closed_count = _parse_listing_page(html_bytes)
        pages_processed += 1
        total_listing_cards += len(cards)

        if not cards:
            logger.info("FestHome: page %d returned 0 cards — end of listing", page)
            break

        logger.debug(
            "FestHome: page %d — %d cards (%d open, %d closed)",
            page,
            len(cards),
            open_count,
            closed_count,
        )

        for card in cards:
            if card["is_closed"]:
                continue
            # Pre-filter: skip if listing deadline is already past
            if card["deadline"] and _is_past_deadline(card["deadline"]):
                continue
            festivals_to_fetch.append(card)

        # Stop early if the page is mostly closed festivals
        if len(cards) > 0 and closed_count / len(cards) >= MAX_CLOSED_RATIO:
            logger.info(
                "FestHome: page %d is %.0f%% closed — stopping pagination",
                page,
                100 * closed_count / len(cards),
            )
            break

    logger.info(
        "FestHome: listing done — %d pages, %d total cards, %d to fetch detail",
        pages_processed,
        total_listing_cards,
        len(festivals_to_fetch),
    )

    # ---------------------------------------------------------------------------
    # Phase 2: fetch detail pages and insert
    # ---------------------------------------------------------------------------
    skipped_past = 0
    skipped_no_title = 0
    detail_errors = 0

    for idx, card in enumerate(festivals_to_fetch):
        festival_id = card["festival_id"]

        if idx > 0:
            time.sleep(DETAIL_DELAY_S)

        html_bytes = _fetch_detail_page(session, festival_id)
        if html_bytes is None:
            detail_errors += 1
            logger.warning(
                "FestHome: skipping festival %d — detail fetch failed", festival_id
            )
            continue

        detail = _parse_detail_page(html_bytes, festival_id)
        if detail is None:
            skipped_no_title += 1
            continue

        title = detail["title"]
        deadline = detail["deadline"]

        # Final deadline check using detail-page data (more accurate than listing)
        if _is_past_deadline(deadline):
            skipped_past += 1
            logger.debug(
                "FestHome: skipping %r (id=%d) — deadline %s is past",
                title[:60],
                festival_id,
                deadline,
            )
            continue

        found += 1

        fee = detail.get("fee")
        detail_url = DETAIL_URL.format(festival_id=festival_id)

        # Org name slug: derive from festival title for slug generation
        # e.g. "XVI Montevideo Fantastic Film Festival" → "montevideo-fantastic"
        org_slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:40]

        call_data = {
            "title": title,
            "description": detail.get("description"),
            "deadline": deadline,
            "application_url": detail_url,
            "source_url": detail_url,
            "call_type": "submission",
            "eligibility": "International",
            "fee": fee,
            "source_id": source_id,
            "confidence_tier": "aggregated",
            "_org_name": org_slug,
            "metadata": {
                "source": "festhome",
                "festival_id": festival_id,
                "festival_website": detail.get("website"),
            },
        }

        result = insert_open_call(call_data)
        if result:
            new += 1
            logger.debug(
                "FestHome: inserted/updated %r (id=%d, deadline=%s, fee=%s)",
                title[:60],
                festival_id,
                deadline,
                fee,
            )

    if skipped_past:
        logger.info(
            "FestHome: skipped %d past-deadline festivals (detail check)", skipped_past
        )
    if skipped_no_title:
        logger.info(
            "FestHome: skipped %d festivals with no title on detail page",
            skipped_no_title,
        )
    if detail_errors:
        logger.warning("FestHome: %d detail page fetch errors", detail_errors)

    logger.info(
        "FestHome: crawl complete — %d found, %d new/updated, %d detail errors",
        found,
        new,
        detail_errors,
    )
    return found, new, updated
