"""
Crawler for Poets & Writers grants and contests database.

Source: https://www.pw.org/grants

Poets & Writers is the most widely read nonprofit literary magazine and the
primary publisher of tools and information for the American writing community.
Their grants database is a national aggregator of writing contests, prizes,
grants, fellowships, and residencies across all literary genres.

HTML structure (verified 2026-03-24):
  Drupal Views page with server-side rendering — no JavaScript required.

  Each listing lives in:
    div.views-row
      div.views-field-field-award-issuer > h2.field-content  — sponsoring org
      div.views-field-title > h2 > a.title                   — title + relative URL
      div.views-field-field-cash-prize > span.field-content   — prize amount (e.g. "$1,000")
      div.views-field-field-entry-amount-int > span.field-content — entry fee (e.g. "$10", "$0")
      div.views-field-field-deadline > span.field-content     — deadline (e.g. "3/31/26")
      div.views-field-taxonomy-vocabulary-3 > span.field-content — genre links
      div.views-field-body > div.field-content                — description excerpt + "read more" link

  Pagination: ul.pager inside div.item-list
    <li class="pager-item"><a href="/grants?page=N">N+1</a></li>
    No pager = single page (all results fit on one page).

Deadline format: M/D/YY (e.g. "3/31/26" = March 31, 2026).
  Two-digit year is always 20xx for foreseeable future.

Call type mapping (by title/description keyword inference):
  "residency" — contains "residency", "residence", "retreat", "colony"
  "grant"     — contains "grant", "fellowship", "award" AND fee=0
  "submission" — default (contest, prize, competition with entry fee)

  Heuristic: any listing with a non-zero entry fee is a contest/submission,
  regardless of whether the title says "award" or "prize".

Fee handling:
  $0  → fee=0.0 (free to submit — typically a grant or fellowship)
  $NN → fee=NN.0
  No fee field → fee=None

Confidence tier: "aggregated" — P&W is an aggregator, not the issuing org.
Eligibility: "National" — P&W's database is US-national by scope.
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

BASE_URL = "https://www.pw.org"
GRANTS_URL = "https://www.pw.org/grants"
SOURCE_URL = "https://www.pw.org/grants"

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

# Polite delay between page fetches (seconds)
PAGE_FETCH_DELAY_S = 1.5

# Safety cap — P&W currently has ~3 pages (75 listings), 20 is a ceiling
MAX_PAGES = 20


# ---------------------------------------------------------------------------
# HTTP fetch
# ---------------------------------------------------------------------------


def _fetch(url: str, session: requests.Session) -> Optional[str]:
    """Fetch a URL and return HTML text, or None on failure."""
    try:
        resp = session.get(url, timeout=30)
        resp.raise_for_status()
        return resp.text
    except requests.RequestException as exc:
        logger.warning("P&W: failed to fetch %s: %s", url, exc)
        return None


# ---------------------------------------------------------------------------
# Deadline parsing
# ---------------------------------------------------------------------------


def _parse_deadline(raw: str) -> Optional[str]:
    """
    Parse the deadline display text into ISO 'YYYY-MM-DD'.

    P&W uses M/D/YY format (e.g. "3/31/26", "5/1/26", "12/15/26").
    The two-digit year is always in the 2020s for foreseeable future.

    Also handles:
      MM/DD/YYYY — for robustness
      YYYY-MM-DD — already ISO
    """
    if not raw:
        return None
    text = raw.strip()

    # M/D/YY or MM/DD/YY (2-digit year)
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{2})$", text)
    if m:
        month, day, year_2 = m.groups()
        year = int(year_2) + 2000
        return f"{year}-{int(month):02d}-{int(day):02d}"

    # MM/DD/YYYY (4-digit year)
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})$", text)
    if m:
        month, day, year = m.groups()
        return f"{year}-{int(month):02d}-{int(day):02d}"

    # Already ISO
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})$", text)
    if m:
        return text

    return None


# ---------------------------------------------------------------------------
# Fee parsing
# ---------------------------------------------------------------------------


def _parse_fee(raw: str) -> Optional[float]:
    """
    Extract fee from the entry-fee display string.

    "$10"  → 10.0
    "$0"   → 0.0   (free — grant/fellowship)
    ""     → None
    """
    if not raw:
        return None
    m = re.search(r"\$\s*(\d+(?:\.\d+)?)", raw)
    if m:
        return float(m.group(1))
    return None


# ---------------------------------------------------------------------------
# Call type inference
# ---------------------------------------------------------------------------

# Patterns checked in order — more specific first
_RESIDENCY_RE = re.compile(
    r"\bresiden(?:cy|ce|t)\b|\bretreat\b|\bcolony\b|\bin[\s-]residence\b",
    re.I,
)
_GRANT_RE = re.compile(
    r"\bgrant\b|\bfellowship\b",
    re.I,
)


def _infer_call_type(title: str, description: str, fee: Optional[float]) -> str:
    """
    Determine call_type from listing signals.

    Priority:
    1. Title/desc contains residency keywords → "residency"
    2. Title/desc contains grant/fellowship keywords → "grant"
    3. Entry fee > 0 → "submission" (paid contest)
    4. Entry fee == 0 or None + no keyword match → "grant" (benefit of the doubt
       for free submissions; the P&W database is grant/fellowship-oriented)
    """
    combined = f"{title} {description}"
    if _RESIDENCY_RE.search(combined):
        return "residency"
    if _GRANT_RE.search(combined):
        return "grant"
    if fee is not None and fee > 0:
        return "submission"
    # Free with no clear keyword — the P&W database leans toward grants
    return "grant"


# ---------------------------------------------------------------------------
# Description cleaning
# ---------------------------------------------------------------------------

# Strip "read more" suffix that appears as anchor text inside description divs
_READ_MORE_RE = re.compile(r"\s*read\s+more\s*$", re.I)


def _clean_description(raw: str) -> str:
    """Remove trailing 'read more' link text and normalize whitespace."""
    text = _READ_MORE_RE.sub("", raw).strip()
    text = re.sub(r"\s+", " ", text)
    return text[:2000] if text else ""


# ---------------------------------------------------------------------------
# Row parser
# ---------------------------------------------------------------------------


def _parse_row(row) -> Optional[dict]:
    """
    Parse a single div.views-row into a raw listing dict.

    Returns None if required fields (title, URL) are missing.
    """
    # Sponsoring organization
    issuer_el = row.find("div", class_="views-field-field-award-issuer")
    org_name = ""
    if issuer_el:
        h2 = issuer_el.find("h2", class_="field-content")
        if h2:
            # The H2 contains the org name followed by a <br> tag; get text before <br>
            org_name = h2.get_text(separator=" ", strip=True)

    # Title + application URL
    title_el = row.find("div", class_="views-field-title")
    if not title_el:
        return None
    a_tag = title_el.find("a", class_="title")
    if not a_tag:
        return None
    title = a_tag.get_text(strip=True)
    if not title:
        return None

    relative_url = a_tag.get("href", "")
    application_url = (
        f"{BASE_URL}{relative_url}" if relative_url.startswith("/") else relative_url
    )
    if not application_url:
        return None

    # Cash prize (metadata only — informs call_type inference)
    prize_el = row.find("div", class_="views-field-field-cash-prize")
    prize_raw = ""
    if prize_el:
        prize_content = prize_el.find("span", class_="field-content")
        prize_raw = prize_content.get_text(strip=True) if prize_content else ""

    # Entry fee
    fee_el = row.find("div", class_="views-field-field-entry-amount-int")
    fee_raw = ""
    if fee_el:
        fee_content = fee_el.find("span", class_="field-content")
        fee_raw = fee_content.get_text(strip=True) if fee_content else ""
    fee = _parse_fee(fee_raw)

    # Deadline
    deadline_el = row.find("div", class_="views-field-field-deadline")
    deadline_raw = ""
    if deadline_el:
        dl_content = deadline_el.find("span", class_="field-content")
        deadline_raw = dl_content.get_text(strip=True) if dl_content else ""
    deadline = _parse_deadline(deadline_raw)

    # Genre(s) — multiple genres are comma-separated anchor tags
    genre_el = row.find("div", class_="views-field-taxonomy-vocabulary-3")
    genres: list[str] = []
    if genre_el:
        genre_content = genre_el.find("span", class_="field-content")
        if genre_content:
            for a in genre_content.find_all("a"):
                g = a.get_text(strip=True)
                if g:
                    genres.append(g)

    # Description excerpt
    body_el = row.find("div", class_="views-field-body")
    description = ""
    if body_el:
        desc_content = body_el.find("div", class_="field-content")
        if desc_content:
            description = _clean_description(
                desc_content.get_text(separator=" ", strip=True)
            )

    return {
        "title": title,
        "org_name": org_name,
        "application_url": application_url,
        "fee": fee,
        "fee_raw": fee_raw,
        "prize_raw": prize_raw,
        "deadline": deadline,
        "deadline_raw": deadline_raw,
        "genres": genres,
        "description": description,
    }


# ---------------------------------------------------------------------------
# Page parser
# ---------------------------------------------------------------------------


def _parse_page(html: str) -> tuple[list[dict], Optional[int]]:
    """
    Parse one grants listing page.

    Returns:
      (listings, last_page_number)
      last_page_number is the 0-indexed final page from the pager, or None
      if there is no pager (single page).
    """
    soup = BeautifulSoup(html, "html.parser")

    view = soup.find("div", class_="view-id-grants")
    if not view:
        logger.warning("P&W: grants view container not found on page")
        return [], None

    content = view.find("div", class_="view-content")
    if not content:
        logger.warning("P&W: view-content not found")
        return [], None

    # Parse all listing rows
    rows = content.find_all("div", class_="views-row")
    listings: list[dict] = []
    for row in rows:
        parsed = _parse_row(row)
        if parsed:
            listings.append(parsed)
        else:
            logger.debug("P&W: skipped unparseable row")

    # Determine last page number from pager
    last_page: Optional[int] = None
    pager = view.find("ul", class_="pager")
    if pager:
        # "last »" link: href="/grants?page=N" where N is 0-indexed
        last_li = pager.find("li", class_="pager-last")
        if last_li:
            last_a = last_li.find("a", href=True)
            if last_a:
                m = re.search(r"page=(\d+)", last_a["href"])
                if m:
                    last_page = int(m.group(1))

    return listings, last_page


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl the Poets & Writers grants and contests database.

    Strategy:
      1. Fetch page 0 (the landing page) — parse listings and determine
         whether a pager exists.
      2. If pager present, fetch pages 1..last_page sequentially.
      3. For each listing: skip past-deadline calls, infer call_type,
         and insert/update via insert_open_call().

    Returns (found, new, updated).
    """
    source_id = source["id"]
    found = new = updated = 0
    today = date.today()

    session = requests.Session()
    session.headers.update({
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    })

    # Collect all pages
    all_listings: list[dict] = []

    # Page 0 = /grants (no ?page= param needed)
    html = _fetch(GRANTS_URL, session)
    if not html:
        logger.error("P&W: failed to fetch grants page — aborting")
        return 0, 0, 0

    page_listings, last_page = _parse_page(html)
    all_listings.extend(page_listings)
    logger.debug("P&W: page 0 — %d listings", len(page_listings))

    # Fetch remaining pages if a pager was found
    if last_page is not None and last_page > 0:
        for page_num in range(1, min(last_page + 1, MAX_PAGES)):
            time.sleep(PAGE_FETCH_DELAY_S)

            page_url = f"{GRANTS_URL}?page={page_num}"
            page_html = _fetch(page_url, session)
            if not page_html:
                logger.warning("P&W: failed to fetch page %d — stopping pagination", page_num)
                break

            page_listings, _ = _parse_page(page_html)
            all_listings.extend(page_listings)
            logger.debug("P&W: page %d — %d listings", page_num, len(page_listings))

    logger.info("P&W: %d total listings collected across all pages", len(all_listings))

    if not all_listings:
        logger.warning("P&W: no listings parsed — check if page structure changed")
        return 0, 0, 0

    # Process each listing
    skipped_deadline = 0
    skipped_no_url = 0

    for listing in all_listings:
        title = listing["title"]
        application_url = listing.get("application_url", "")
        if not application_url:
            skipped_no_url += 1
            logger.debug("P&W: skipping '%s' — no application URL", title[:60])
            continue

        # Skip past-deadline calls
        deadline = listing.get("deadline")
        if deadline:
            try:
                if date.fromisoformat(deadline) < today:
                    skipped_deadline += 1
                    logger.debug(
                        "P&W: skipping '%s' — deadline %s already passed",
                        title[:60],
                        deadline,
                    )
                    continue
            except ValueError:
                pass  # malformed date — proceed anyway

        found += 1

        fee = listing.get("fee")
        description = listing.get("description", "")
        call_type = _infer_call_type(title, description, fee)
        org_name = listing.get("org_name") or "poets-writers"
        genres = listing.get("genres", [])

        # Prefix org name into description when present — helpful on the Open Calls board
        full_description = description
        if org_name and org_name.lower() not in description.lower()[:100]:
            full_description = f"{org_name}: {description}" if description else ""

        call_data: dict = {
            "title": title,
            "description": full_description or None,
            "deadline": deadline,
            "application_url": application_url,
            "source_url": SOURCE_URL,
            "call_type": call_type,
            "eligibility": "National",
            "fee": fee,
            "source_id": source_id,
            "confidence_tier": "aggregated",
            "_org_name": org_name or "poets-writers",
            "metadata": {
                "organization": org_name,
                "genres": genres,
                "prize_raw": listing.get("prize_raw"),
                "fee_raw": listing.get("fee_raw"),
                "deadline_raw": listing.get("deadline_raw"),
                "pw_url": application_url,
            },
        }

        result = insert_open_call(call_data)
        if result:
            new += 1

    if skipped_deadline:
        logger.info("P&W: skipped %d past-deadline listings", skipped_deadline)
    if skipped_no_url:
        logger.info("P&W: skipped %d listings with no URL", skipped_no_url)

    logger.info("P&W: %d found, %d new, %d updated", found, new, updated)
    return found, new, updated
