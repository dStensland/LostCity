"""
Crawler for Competitions.archi (competitions.archi/cat/open/).

Competitions.archi is a long-running WordPress aggregator of architecture and
design competitions — open calls for submission from around the world. With
~3,000+ listings it is one of the largest architecture competition directories
online.

For LostCity this opens an entirely new discipline: architecture / design
competitions were previously unrepresented in the open calls board. All calls
are international in scope. confidence_tier is "aggregated" throughout.

Crawl strategy:
  The "Open" category (cat/open/) is a paginated WordPress archive. Each page
  contains 10 competition cards rendered as static HTML — no JavaScript
  rendering required. We walk listing pages to collect detail page URLs, then
  fetch each detail page to extract the full description and the organizer's
  application URL.

  Pagination: /cat/open/, /cat/open/page/2/, /cat/open/page/3/ …
  We stop when a listing page returns zero competition cards (the archive has
  ~308 pages as of March 2026, so we cap at MAX_LISTING_PAGES=400 to be safe).

  We skip fetching detail pages for competitions whose deadline has already
  passed — that check is done from the listing card alone, keeping HTTP
  requests minimal for expired calls.

Key fields from listing card (span.el.*):
  submission  — deadline date, e.g. "23rd October 2026"
  registration — registration deadline (used as fallback if submission absent)
  location    — freeform text, e.g. "Italy" or "Mieres, Spain"
  prizes      — freeform text, e.g. "10,000 €" / "Free" / "View website"
  type        — freeform eligibility text, e.g. "Open" / "University students"

Key fields from detail page:
  h1.entry-title                   — competition title (canonical)
  div.buttons.content-buttons a    — "Visit Organizer's Website" application URL
  div.entry-content                — full description text
  meta[property=og:image]          — hero image

call_type mapping:
  We infer call_type from the competition type text and prizes text:
  - "nomination" / "award" / "prize"  → "grant"
  - Everything else                   → "submission"

  Architecture design competitions are overwhelmingly open submission calls.
  The minority that are awards/nominations (e.g. "Call for nominations: …")
  map to "grant" since they're competitive grants/prizes rather than work
  submissions.

Fee extraction:
  There is no structured fee field. The "prizes" field sometimes says "Free"
  meaning the competition has no entry fee and no cash prize. We set fee=0.0
  in that case. Otherwise we cannot reliably extract the application fee
  (prize amount ≠ entry fee), so fee stays None.

Rate limiting:
  0.6 s between listing pages; 0.8 s between detail pages. The site uses a
  shared hosting stack; we stay polite.
"""

import logging
import re
import time
from datetime import date
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db.open_calls import insert_open_call

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

BASE_URL = "https://competitions.archi/cat/open/"
PAGE_URL_TEMPLATE = "https://competitions.archi/cat/open/page/{}/"

# Safety cap on listing pages (actual count ~308 as of March 2026)
MAX_LISTING_PAGES = 400

# Polite delays (seconds)
LISTING_PAGE_DELAY = 0.6
DETAIL_PAGE_DELAY = 0.8

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

SOURCE_KEY = "competitions-archi"

# Ordinal date pattern: "23rd October 2026", "1st May 2025", "9th March 2025"
_ORDINAL_DATE_RE = re.compile(
    r"(\d{1,2})(?:st|nd|rd|th)\s+"
    r"(January|February|March|April|May|June|July|August|September|October|November|December)"
    r"\s+(\d{4})",
    re.IGNORECASE,
)

_MONTH_MAP = {
    "january": 1, "february": 2, "march": 3, "april": 4,
    "may": 5, "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12,
}

# Words in the competition type or title that indicate an award/grant call
# rather than a design submission call.
_GRANT_KEYWORDS_RE = re.compile(
    r"\b(award|nomination|prize|grant|scholarship|fellowship|bursary)\b",
    re.IGNORECASE,
)


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------


def _make_session() -> requests.Session:
    session = requests.Session()
    session.headers.update({
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://competitions.archi/",
    })
    return session


def _fetch(session: requests.Session, url: str) -> Optional[str]:
    """Fetch a URL and return raw HTML, or None on failure."""
    try:
        resp = session.get(url, timeout=30)
        resp.raise_for_status()
        return resp.text
    except requests.RequestException as exc:
        logger.warning("competitions.archi: failed to fetch %s — %s", url, exc)
        return None


# ---------------------------------------------------------------------------
# Date parsing
# ---------------------------------------------------------------------------


def _parse_ordinal_date(text: str) -> Optional[str]:
    """
    Parse an ordinal date like "23rd October 2026" → "2026-10-23".
    Returns None if no recognisable date is found.
    """
    if not text:
        return None
    m = _ORDINAL_DATE_RE.search(text)
    if not m:
        return None
    day = int(m.group(1))
    month = _MONTH_MAP.get(m.group(2).lower())
    year = int(m.group(3))
    if not month:
        return None
    try:
        return date(year, month, day).isoformat()
    except ValueError:
        return None


def _is_past_deadline(deadline_iso: Optional[str]) -> bool:
    """Return True if the deadline date is strictly in the past."""
    if not deadline_iso:
        return False
    try:
        return date.fromisoformat(deadline_iso) < date.today()
    except ValueError:
        return False


# ---------------------------------------------------------------------------
# call_type inference
# ---------------------------------------------------------------------------


def _infer_call_type(title: str, comp_type_text: str) -> str:
    """
    Infer whether this is a "submission" (design competition) or "grant"
    (award / nomination / prize).

    Default is "submission" — the vast majority of listings are architecture
    competitions where participants submit design work.
    """
    combined = f"{title} {comp_type_text}"
    if _GRANT_KEYWORDS_RE.search(combined):
        return "grant"
    return "submission"


# ---------------------------------------------------------------------------
# Listing page parsing
# ---------------------------------------------------------------------------


def _parse_listing_page(html: str) -> list[dict]:
    """
    Extract competition stub data from one listing page.

    Returns a list of dicts with:
      url        — detail page URL
      title      — competition title (from card)
      deadline   — parsed ISO date string or None
      comp_type  — raw type string for call_type inference
      prizes     — raw prizes string (for fee detection)
    """
    soup = BeautifulSoup(html, "lxml")
    items = soup.select("div.competition.competition-item")
    stubs: list[dict] = []

    for item in items:
        link_tag = item.select_one("a[href]")
        if not link_tag:
            continue
        url = link_tag["href"].strip()
        if not url.startswith("http"):
            continue

        # Title from card (used for call_type inference; canonical title comes
        # from the detail page h1)
        title_tag = item.select_one("h2.title")
        title_text = title_tag.get_text(strip=True) if title_tag else ""

        # Deadline: prefer submission date, fall back to registration
        submission_el = item.select_one("span.el.submission span")
        registration_el = item.select_one("span.el.registration span")
        deadline_raw = (
            (submission_el.get_text(strip=True) if submission_el else "")
            or (registration_el.get_text(strip=True) if registration_el else "")
        )
        deadline = _parse_ordinal_date(deadline_raw)

        # Type text (freeform eligibility)
        type_el = item.select_one("span.el.type span")
        comp_type = type_el.get_text(strip=True) if type_el else ""

        # Prizes text (for free-entry detection)
        prizes_el = item.select_one("span.el.prizes span")
        prizes_text = prizes_el.get_text(strip=True) if prizes_el else ""

        stubs.append({
            "url": url,
            "title": title_text,
            "deadline": deadline,
            "comp_type": comp_type,
            "prizes_text": prizes_text,
        })

    return stubs


def _has_next_page(html: str) -> bool:
    """Return True if there is a 'next page' link in the wp-pagenavi block."""
    soup = BeautifulSoup(html, "lxml")
    return bool(soup.select_one("div.wp-pagenavi a.nextpostslink"))


# ---------------------------------------------------------------------------
# Detail page parsing
# ---------------------------------------------------------------------------


def _parse_detail_page(html: str, source_url: str) -> dict:
    """
    Extract competition details from a single detail page.

    Returns a dict with:
      title           — canonical competition title
      description     — full description text (up to 4000 chars)
      application_url — organizer website URL (from CTA button)
      image_url       — og:image URL
      location        — location string
    """
    soup = BeautifulSoup(html, "lxml")

    # Canonical title
    h1 = soup.select_one("h1.entry-title")
    title = h1.get_text(strip=True) if h1 else ""

    # Application URL: the "Visit Organizer's Website" button.
    # Must be read BEFORE decomposing div.buttons from entry-content.
    application_url = ""
    btn = soup.select_one("div.buttons.content-buttons a[href]")
    if btn:
        href = btn.get("href", "").strip()
        if href.startswith("http"):
            application_url = href

    # Fallback: if no button found, use the competitions.archi page itself
    if not application_url:
        application_url = source_url

    # Description: entry-content block, stripped of embedded iframes/buttons
    entry_content = soup.select_one("div.entry-content")
    description = ""
    if entry_content:
        # Remove non-text elements: iframes, scripts, divs with buttons/meta
        for tag in entry_content.select("iframe, script, div.buttons, div.competition-meta"):
            tag.decompose()
        description = entry_content.get_text(separator="\n", strip=True)
        # Truncate to a reasonable length
        description = description[:4000].strip()

    # og:image
    og_img = soup.find("meta", property="og:image")
    image_url = og_img.get("content", "").strip() if og_img else ""

    # Location from header data
    location_el = soup.select_one("span.el.location span")
    location = location_el.get_text(strip=True) if location_el else ""

    return {
        "title": title,
        "description": description or None,
        "application_url": application_url,
        "image_url": image_url or None,
        "location": location,
    }


# ---------------------------------------------------------------------------
# Fee extraction
# ---------------------------------------------------------------------------


def _extract_fee(prizes_text: str) -> Optional[float]:
    """
    Competitions.archi has no structured fee field. The prizes field
    sometimes says "Free" which is ambiguous (could mean no cash prize OR
    free entry). We treat it as 0.0 only when the prizes text is exactly
    "Free" — that pattern consistently appears on competitions explicitly
    marked as free-entry student calls.

    For all other cases (cash prizes, "View website") we cannot determine
    the entry fee from this field, so we return None.
    """
    if prizes_text.strip().lower() == "free":
        return 0.0
    return None


# ---------------------------------------------------------------------------
# Organizer slug extraction
# ---------------------------------------------------------------------------

_SLUG_CLEANUP_RE = re.compile(r"[^a-z0-9]+")


def _org_slug_from_url(url: str) -> str:
    """
    Derive a short org slug from the organizer's website domain.
    e.g. "https://www.terravivacompetitions.com/..." → "terravivacompetitions"
    """
    if not url or not url.startswith("http"):
        return "competitions-archi"
    # Extract domain
    try:
        domain = url.split("//", 1)[1].split("/")[0]
        # Strip www. prefix
        if domain.startswith("www."):
            domain = domain[4:]
        # Take the SLD (first part before the first dot)
        sld = domain.split(".")[0]
        cleaned = _SLUG_CLEANUP_RE.sub("-", sld.lower()).strip("-")
        return cleaned or "competitions-archi"
    except (IndexError, AttributeError):
        return "competitions-archi"


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Competitions.archi open call listings.

    Strategy:
      1. Walk listing pages (page 1, 2, 3, …) until a page has no items.
      2. For each listing card, skip if the deadline has already passed.
      3. For remaining cards, fetch the detail page to get description +
         application URL.
      4. Insert via insert_open_call().

    Returns (found, new, updated).
      found   = calls that passed the deadline filter (eligible to insert)
      new     = successfully inserted new rows
      updated = currently 0 (insert_open_call handles dedup transparently)
    """
    source_id: int = source["id"]
    found = new = updated = 0
    seen_urls: set[str] = set()

    session = _make_session()

    for page_num in range(1, MAX_LISTING_PAGES + 1):
        if page_num == 1:
            url = BASE_URL
        else:
            url = PAGE_URL_TEMPLATE.format(page_num)

        if page_num > 1:
            time.sleep(LISTING_PAGE_DELAY)

        html = _fetch(session, url)
        if not html:
            logger.warning(
                "competitions.archi: failed to fetch listing page %d — stopping",
                page_num,
            )
            break

        stubs = _parse_listing_page(html)
        if not stubs:
            logger.info(
                "competitions.archi: page %d returned 0 items — archive exhausted",
                page_num,
            )
            break

        logger.debug(
            "competitions.archi: page %d — %d items",
            page_num, len(stubs),
        )

        for stub in stubs:
            detail_url = stub["url"]

            # Guard against duplicates within a single run (site may repeat
            # featured competitions across multiple listing pages)
            if detail_url in seen_urls:
                continue
            seen_urls.add(detail_url)

            # Skip expired deadlines at the listing stage — avoids fetching
            # detail pages for old competitions (the archive goes back years)
            if _is_past_deadline(stub["deadline"]):
                logger.debug(
                    "competitions.archi: skipping expired call — deadline %s — %s",
                    stub["deadline"], stub["title"][:60],
                )
                continue

            # Fetch detail page
            time.sleep(DETAIL_PAGE_DELAY)
            detail_html = _fetch(session, detail_url)
            if not detail_html:
                logger.warning(
                    "competitions.archi: failed to fetch detail page %s — skipping",
                    detail_url,
                )
                continue

            detail = _parse_detail_page(detail_html, detail_url)

            # Use canonical title from detail page; fall back to listing card title
            title = detail["title"] or stub["title"]
            if not title:
                logger.debug(
                    "competitions.archi: skipping — no title at %s", detail_url
                )
                continue

            # Resolve application URL
            application_url = detail["application_url"]
            if not application_url:
                application_url = detail_url

            # call_type: infer from title + type field text
            call_type = _infer_call_type(title, stub["comp_type"])

            # Fee
            fee = _extract_fee(stub["prizes_text"])

            # Org slug for slug generation (derived from organizer domain)
            org_slug = _org_slug_from_url(application_url)

            # Eligibility: prefer the comp_type field text as eligibility descriptor;
            # fall back to "International"
            eligibility = stub["comp_type"].strip() or "International"

            # Location for metadata
            location = detail.get("location") or ""

            call_data = {
                "title": title,
                "description": detail["description"],
                "deadline": stub["deadline"],
                "application_url": application_url,
                "source_url": detail_url,
                "call_type": call_type,
                "eligibility": eligibility,
                "fee": fee,
                "source_id": source_id,
                "confidence_tier": "aggregated",
                "_org_name": org_slug,
                "metadata": {
                    "source": SOURCE_KEY,
                    "location": location,
                    "prizes_text": stub["prizes_text"],
                    "comp_type_raw": stub["comp_type"],
                    "image_url": detail.get("image_url"),
                    "scope": "international",
                },
            }

            found += 1
            result = insert_open_call(call_data)
            if result:
                new += 1

        # Stop pagination if there is no "next" link
        if not _has_next_page(html):
            logger.info(
                "competitions.archi: no next-page link on page %d — done",
                page_num,
            )
            break

    logger.info(
        "competitions.archi: crawl complete — %d found, %d new, %d updated",
        found, new, updated,
    )
    return found, new, updated
