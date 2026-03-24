"""
Crawler for Culture360 ASEF Opportunities (culture360.asef.org/opportunities/).

Culture360 is the Asia-Europe Foundation's (ASEF) cultural exchange platform.
It aggregates open calls, residencies, and grants focused on cross-cultural
exchange between Asia and Europe. Listings span roughly 50–80 active
opportunities at any time across three categories: Open Calls, Residencies,
and Grants.

This is NOT a primary source — Culture360 aggregates calls posted by arts
organizations globally — so confidence_tier is "aggregated".

All calls carry metadata.scope = "international" because ASEF is a
Singapore-based intergovernmental foundation and the calls explicitly target
cross-border participation between Asia-Pacific and European practitioners.

Crawl strategy — two-phase (index + detail):

  Phase 1 — Index pages:
    URL: https://culture360.asef.org/opportunities/ (POST with page_number=N)
    Django-rendered static HTML. Each page lists ~16 calls as:
      <div class="card c360-card c360-card-opportunities mb-2">
        <div class="card-header">
          <h3 class="title card-title">
            <a href="/opportunities/SLUG/">Title</a>
          </h3>
        </div>
        <div class="card-header text-uppercase mb-2" style="font-size: 0.75rem;">
          <p class="item-footer-category"><span>Category</span></p>
          <p class="mb-0">deadline: DD Mon YYYY</p>
        </div>
      </div>

    Pagination: POST form with csrfmiddlewaretoken + page_number=N.
    A session is required to carry the csrftoken cookie across requests.
    Pages are numbered 1..N. Stop when a page returns 0 cards.

    The pagination widget uses JavaScript submitPage() which POSTs a hidden
    input field `page_number`. We replicate this with requests.Session.POST.

  Phase 2 — Detail pages (/opportunities/SLUG/):
    Each detail page contains:

      Article body (div.col.col-lg-9):
        <h1 class="page-item-title ...">Title</h1>
        <p> paragraphs — full description
        <p><strong>Deadline: DD Month YYYY</strong></p>  (or inline in body)

      Aside (aside.col-lg-3):
        <p class="fw-semibold mb-0">Website</p>
        <ul class="list-inline">
          <li><a href="APPLY_URL">...</a></li>
        </ul>
        Countries, Theme, Disciplines sections (used for metadata)

    Description: collected from all <p> tags in the main column, excluding
    the deadline paragraph and any paragraph that only contains a hyperlink
    (the "application guidelines" link). Capped at 2000 chars.

    Application URL: first <a> in the aside "Website" section. Fallback to
    the Culture360 detail page URL itself.

    Deadline: parsed from the body text in patterns:
      "Deadline: DD Month YYYY"
      "Deadline: DD Mon YYYY"

Type mapping (Culture360 category → our call_type):

  "Open Calls"  → submission   (competitions, prize, open submissions)
  "Residencies" → residency
  "Grants"      → grant        (funding, fellowships, impact grants)

  The Culture360 taxonomy is clean and maps 1:1.

Fee extraction:
  Culture360 does not list application fees — ASEF opportunities are
  uniformly free to apply. fee is always None.

Past-deadline filtering:
  Cards on the index show a plain-text deadline. We parse it from the index
  (avoiding a detail page fetch) and skip past-deadline calls before requesting
  their detail pages. This keeps the crawl polite and fast.

Rate limiting:
  Culture360 is a small nonprofit platform. We pause 0.5s between detail
  page requests and 1.0s between paginated index fetches.
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

INDEX_URL = "https://culture360.asef.org/opportunities/"
BASE_URL = "https://culture360.asef.org"

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

REQUEST_TIMEOUT = 30
INDEX_DELAY = 1.0  # seconds between paginated index requests
DETAIL_DELAY = 0.5  # seconds between detail page requests

# ---------------------------------------------------------------------------
# Type mapping
# ---------------------------------------------------------------------------

# Culture360 category label → our call_type
_TYPE_MAP: dict[str, str] = {
    "open calls": "submission",
    "residencies": "residency",
    "grants": "grant",
}


def _classify_type(raw_category: str) -> str:
    """
    Map a Culture360 category label to our call_type.

    Unknown categories default to "submission".
    """
    normalized = raw_category.strip().lower()
    return _TYPE_MAP.get(normalized, "submission")


# ---------------------------------------------------------------------------
# Deadline parsing
# ---------------------------------------------------------------------------

# Index page deadline: "deadline: 30 Mar 2026" or "deadline: 07 Apr 2026"
_INDEX_DEADLINE_RE = re.compile(
    r"deadline\s*:\s*(\d{1,2}\s+\w{3,}\s+\d{4})",
    re.I,
)

# Detail page deadline: "Deadline: 30 March 2026"
_DETAIL_DEADLINE_RE = re.compile(
    r"deadline\s*:\s*(\d{1,2}\s+\w{3,}\s+\d{4})",
    re.I,
)

_MONTH_ABBREVS = {
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


def _parse_deadline_text(text: str) -> Optional[str]:
    """
    Parse a human-readable date string into ISO "YYYY-MM-DD".

    Handles both abbreviated and full month names:
      "30 Mar 2026" → "2026-03-30"
      "7 April 2026" → "2026-04-07"

    Returns None if the text can't be parsed.
    """
    if not text:
        return None
    text = text.strip()
    parts = text.split()
    if len(parts) != 3:
        return None
    try:
        day = int(parts[0])
        month = _MONTH_ABBREVS.get(parts[1].lower())
        year = int(parts[2])
        if not month or not (1 <= day <= 31) or year < 2020:
            return None
        # Validate by constructing the date
        datetime(year, month, day)
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
# HTTP helpers
# ---------------------------------------------------------------------------


def _make_session() -> requests.Session:
    """Create a requests session with browser-like headers."""
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        }
    )
    return session


def _fetch_index_page(
    session: requests.Session, page_number: int, csrf: str
) -> Optional[str]:
    """
    Fetch a paginated index page via POST.

    Page 1 uses GET (the initial load). Pages 2+ use POST with page_number.
    Returns HTML string or None on failure.
    """
    if page_number == 1:
        try:
            resp = session.get(INDEX_URL, timeout=REQUEST_TIMEOUT)
            resp.raise_for_status()
            return resp.text
        except requests.RequestException as exc:
            logger.warning("Culture360: failed to fetch index page 1: %s", exc)
            return None
    else:
        try:
            resp = session.post(
                INDEX_URL,
                data={"csrfmiddlewaretoken": csrf, "page_number": page_number},
                headers={"Referer": INDEX_URL},
                timeout=REQUEST_TIMEOUT,
            )
            resp.raise_for_status()
            return resp.text
        except requests.RequestException as exc:
            logger.warning(
                "Culture360: failed to fetch index page %d: %s", page_number, exc
            )
            return None


def _fetch_detail(session: requests.Session, url: str) -> Optional[str]:
    """Fetch a detail page and return its HTML, or None on failure."""
    try:
        resp = session.get(url, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        return resp.text
    except requests.RequestException as exc:
        logger.warning("Culture360: failed to fetch detail %s: %s", url, exc)
        return None


# ---------------------------------------------------------------------------
# Index page parser
# ---------------------------------------------------------------------------


def _parse_index_page(html: str) -> tuple[list[dict], int, str]:
    """
    Parse a Culture360 opportunities index page.

    Returns:
      (listings, max_page, csrf_token)

    Each listing dict has keys:
      title, detail_url, raw_category, call_type, deadline
    """
    soup = BeautifulSoup(html, "html.parser")

    # Extract CSRF token for subsequent POST requests
    csrf_input = soup.find("input", {"name": "csrfmiddlewaretoken"})
    csrf = csrf_input["value"] if csrf_input else ""

    # Determine max page from pagination buttons
    max_page = 1
    ul = soup.find("ul", class_="pagination")
    if ul:
        for btn in ul.find_all("button"):
            txt = btn.get_text(strip=True)
            if txt.isdigit():
                max_page = max(max_page, int(txt))

    # Parse listing cards
    listings: list[dict] = []
    for card in soup.find_all("div", class_="c360-card-opportunities"):
        # Title + detail URL
        h3 = card.find("h3", class_="card-title")
        if not h3:
            continue
        a_tag = h3.find("a", href=True)
        if not a_tag:
            continue
        title = a_tag.get_text(strip=True)
        if not title:
            continue
        href = a_tag["href"]
        detail_url = href if href.startswith("http") else BASE_URL + href

        # Category (Residencies / Grants / Open Calls)
        cat_el = card.find("p", class_="item-footer-category")
        raw_category = cat_el.get_text(strip=True) if cat_el else ""
        call_type = _classify_type(raw_category)

        # Deadline from index card (avoid fetching detail for past-deadline calls)
        deadline: Optional[str] = None
        for p in card.find_all("p"):
            txt = p.get_text(strip=True)
            m = _INDEX_DEADLINE_RE.search(txt)
            if m:
                deadline = _parse_deadline_text(m.group(1))
                break

        listings.append(
            {
                "title": title,
                "detail_url": detail_url,
                "raw_category": raw_category,
                "call_type": call_type,
                "deadline": deadline,
            }
        )

    return listings, max_page, csrf


# ---------------------------------------------------------------------------
# Detail page parser
# ---------------------------------------------------------------------------


def _parse_detail(html: str, detail_url: str) -> dict:
    """
    Parse a Culture360 opportunity detail page.

    Returns a dict with keys:
      description, application_url, deadline, countries, disciplines
    """
    soup = BeautifulSoup(html, "html.parser")

    article = soup.find("article")
    if not article:
        return {
            "description": None,
            "application_url": detail_url,
            "deadline": None,
            "countries": [],
            "disciplines": [],
        }

    # Main content column (left 9/12)
    main_col = article.find("div", class_="col-lg-9") or article.find(
        "div", class_="col"
    )

    # Aside / sidebar (right 3/12)
    aside = article.find("aside")

    # --- Application URL from aside "Website" section ---
    application_url = detail_url  # fallback
    if aside:
        # Find the "Website" label paragraph and take the next list's first link
        paragraphs = aside.find_all("p", class_="fw-semibold")
        for p in paragraphs:
            if p.get_text(strip=True).lower() == "website":
                # The next sibling ul contains the link
                ul = p.find_next_sibling("ul")
                if ul:
                    link = ul.find("a", href=True)
                    if link and link["href"].startswith("http"):
                        application_url = link["href"]
                break

    # --- Countries and disciplines from aside ---
    countries: list[str] = []
    disciplines: list[str] = []
    if aside:
        for p in aside.find_all("p", class_="fw-semibold"):
            label = p.get_text(strip=True).lower()
            ul = p.find_next_sibling("ul")
            if not ul:
                continue
            items = [li.get_text(strip=True) for li in ul.find_all("li")]
            if label == "countries":
                countries = items
            elif label == "disciplines":
                disciplines = items

    # --- Description from main column paragraphs ---
    description: Optional[str] = None
    deadline: Optional[str] = None

    if main_col:
        paras: list[str] = []
        for p in main_col.find_all("p"):
            txt = p.get_text(separator=" ", strip=True)
            if not txt:
                continue

            # Check for deadline in this paragraph
            if not deadline:
                m = _DETAIL_DEADLINE_RE.search(txt)
                if m:
                    deadline = _parse_deadline_text(m.group(1))

            # Skip paragraphs that are only a hyperlink (the "apply guidelines" line)
            if (
                len(p.find_all("a")) == 1
                and len(p.find_all(string=True, recursive=False)) == 0
            ):
                # paragraph contains only an anchor with no surrounding text
                link_text = p.get_text(strip=True)
                # If the paragraph text equals the link text, it's a bare link paragraph — skip
                a = p.find("a")
                if a and a.get_text(strip=True) == link_text:
                    continue

            # Skip the deadline paragraph itself from description
            if re.match(r"deadline\s*:", txt, re.I):
                continue

            paras.append(txt)

        raw_desc = "\n".join(paras).strip()
        if raw_desc:
            description = raw_desc[:2000]
            if len(raw_desc) > 2000:
                description = raw_desc[:1997] + "..."

    return {
        "description": description,
        "application_url": application_url,
        "deadline": deadline,
        "countries": countries,
        "disciplines": disciplines,
    }


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl the Culture360 ASEF Opportunities listing.

    Strategy:
      1. GET page 1 to acquire session cookies + CSRF token + total page count.
      2. Parse all cards from page 1; POST pages 2..N sequentially.
      3. Skip past-deadline calls before fetching their detail pages.
      4. For each active call, fetch the detail page to get description,
         application URL, and a more reliable deadline.
      5. Insert or update via insert_open_call().

    Returns (found, new, updated).
    """
    source_id = source["id"]
    found = new = updated = 0

    session = _make_session()

    # Phase 1: collect all index listings across all pages
    all_listings: list[dict] = []
    csrf = ""
    max_page = 1

    for page_num in range(1, 50):  # safety cap at 50 pages
        html = _fetch_index_page(session, page_num, csrf)
        if not html:
            logger.warning("Culture360: empty response for index page %d", page_num)
            break

        listings, detected_max, detected_csrf = _parse_index_page(html)

        # Capture CSRF + max page from the first response
        if page_num == 1:
            max_page = detected_max
            csrf = detected_csrf
            logger.info("Culture360: index has %d pages, CSRF acquired", max_page)

        if not listings:
            logger.debug("Culture360: no cards on page %d — stopping", page_num)
            break

        all_listings.extend(listings)
        logger.debug(
            "Culture360: page %d/%d — %d cards", page_num, max_page, len(listings)
        )

        if page_num >= max_page:
            break

        time.sleep(INDEX_DELAY)

    logger.info(
        "Culture360: %d total listings collected across %d pages",
        len(all_listings),
        max_page,
    )

    if not all_listings:
        logger.warning("Culture360: no listings found — check page structure")
        return 0, 0, 0

    # Phase 2: filter past-deadline, fetch details, insert
    skipped_deadline = 0

    for listing in all_listings:
        title = listing["title"]
        index_deadline = listing.get("deadline")

        # Fast-path: skip past-deadline before fetching detail page
        if index_deadline and _is_past_deadline(index_deadline):
            skipped_deadline += 1
            logger.debug(
                "Culture360: skipping %r — index deadline %s passed",
                title[:60],
                index_deadline,
            )
            continue

        found += 1

        # Fetch detail page
        detail_url = listing["detail_url"]
        time.sleep(DETAIL_DELAY)
        detail_html = _fetch_detail(session, detail_url)

        if detail_html:
            detail = _parse_detail(detail_html, detail_url)
        else:
            # Proceed with index-level data only
            detail = {
                "description": None,
                "application_url": detail_url,
                "deadline": None,
                "countries": [],
                "disciplines": [],
            }

        # Use the more precise detail-page deadline if available; fall back to index
        deadline = detail.get("deadline") or index_deadline

        # Re-check deadline with the detail-page value (it may be more precise)
        if deadline and _is_past_deadline(deadline):
            found -= 1
            skipped_deadline += 1
            logger.debug(
                "Culture360: skipping %r — detail deadline %s passed",
                title[:60],
                deadline,
            )
            continue

        application_url = detail.get("application_url") or detail_url
        description = detail.get("description")
        countries = detail.get("countries", [])
        disciplines = detail.get("disciplines", [])
        call_type = listing["call_type"]
        raw_category = listing.get("raw_category", "")

        call_data: dict = {
            "title": title,
            "description": description,
            "deadline": deadline,
            "application_url": application_url,
            "source_url": detail_url,
            "call_type": call_type,
            "eligibility": (
                "Open to artists from Asia-Pacific and Europe"
                if countries
                else "International"
            ),
            "fee": None,  # Culture360 does not list application fees
            "source_id": source_id,
            "confidence_tier": "aggregated",
            "_org_name": "asef-culture360",
            "metadata": {
                "raw_category": raw_category,
                "countries": countries,
                "disciplines": disciplines,
                "scope": "international",
                "source_platform": "culture360_asef",
            },
        }

        result = insert_open_call(call_data)
        if result:
            new += 1
            logger.debug(
                "Culture360: inserted/updated %r (deadline=%s, type=%s)",
                title[:60],
                deadline,
                call_type,
            )

    if skipped_deadline:
        logger.info("Culture360: skipped %d past-deadline listings", skipped_deadline)

    logger.info(
        "Culture360: %d found (non-expired), %d new, %d updated",
        found,
        new,
        updated,
    )
    return found, new, updated
